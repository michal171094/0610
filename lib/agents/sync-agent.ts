/**
 * Sync Agent
 * 
 * Syncs data from Gmail and identifies:
 * - New tasks mentioned in emails
 * - Updates to existing debts/tasks
 * - Important information to remember
 * 
 * Works with:
 * - EntityResolver (identifies clients/debts)
 * - DiffDetector (finds changes)
 */

import { supabase } from '@/lib/supabase'
import { getHybridMemory } from '@/lib/memory/hybrid-memory'
import { getEntityResolver } from './entity-resolver'
import { getDiffDetector } from './diff-detector'

export interface SyncResult {
  processed_emails: number
  new_insights: number
  updates_found: number
  suggestions: SyncSuggestion[]
  summary: string
}

export interface SyncSuggestion {
  id: string
  type: 'new_task' | 'update_debt' | 'update_task' | 'new_contact'
  priority: 'low' | 'medium' | 'high'
  title: string
  description: string
  proposed_action: Record<string, any>
  confidence: number
  source_email_id?: string
}

export interface ResolvedEntities {
  clients: any[]
  debts: any[]
  tasks: any[]
  bureaucracy: any[]
  new_entities: Array<{ name: string; email?: string; type: string }>
}

export class SyncAgent {
  private memory = getHybridMemory()
  private entityResolver = getEntityResolver()
  private diffDetector = getDiffDetector()

  /**
   * Main sync function
   */
  async sync(options: {
    sinceDays?: number
    maxEmails?: number
    autoApprove?: boolean
  } = {}): Promise<SyncResult> {
    const {
      sinceDays = 7,
      maxEmails = 50,
      autoApprove = false,
    } = options

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - sinceDays)

    // 1. Get recent email insights
    const { data: insights } = await supabase
      .from('email_insights')
      .select('*')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(maxEmails)

    if (!insights || insights.length === 0) {
      return {
        processed_emails: 0,
        new_insights: 0,
        updates_found: 0,
        suggestions: [],
        summary: 'No new emails to process',
      }
    }

    const suggestions: SyncSuggestion[] = []

    // 2. Process each insight
    for (const insight of insights) {
      const insightSuggestions = await this.processInsight(insight)
      suggestions.push(...insightSuggestions)
    }

    // 3. Auto-approve high-confidence suggestions if enabled
    if (autoApprove) {
      await this.autoApplySuggestions(
        suggestions.filter(s => s.confidence > 0.9)
      )
    }

    // 4. Save to memory
    await this.saveSyncSession(suggestions)

    return {
      processed_emails: insights.length,
      new_insights: insights.filter((i: any) => i.action_needed).length,
      updates_found: suggestions.length,
      suggestions,
      summary: this.generateSummary(suggestions),
    }
  }

  /**
   * Process a single email insight
   */
  private async processInsight(insight: any): Promise<SyncSuggestion[]> {
    const suggestions: SyncSuggestion[] = []

    // Parse entities mentioned
    const entities = await this.entityResolver.resolve(insight.summary)

    // Check for debt updates
    if (insight.category === 'debt' || insight.category === 'payment') {
      const debtSuggestions = await this.checkDebtUpdates(insight, entities)
      suggestions.push(...debtSuggestions)
    }

    // Check for task updates
    if (insight.action_needed) {
      const taskSuggestions = await this.checkTaskUpdates(insight, entities)
      suggestions.push(...taskSuggestions)
    }

    // Check for new contacts
    if (entities.new_entities.length > 0) {
      const contactSuggestions = this.checkNewContacts(insight, entities)
      suggestions.push(...contactSuggestions)
    }

    return suggestions
  }

  /**
   * Check for debt updates
   */
  private async checkDebtUpdates(
    insight: any,
    entities: ResolvedEntities
  ): Promise<SyncSuggestion[]> {
    const suggestions: SyncSuggestion[] = []

    for (const entity of entities.debts) {
      // Get current debt
      const { data: currentDebt } = await supabase
        .from('debts')
        .select('*')
        .eq('id', entity.id)
        .single()

      if (!currentDebt) continue

      // Detect differences
      const changes = await this.diffDetector.detectChanges(
        currentDebt,
        insight
      )

      if (changes.length > 0) {
        for (const change of changes) {
          suggestions.push({
            id: `update-debt-${entity.id}-${Date.now()}`,
            type: 'update_debt',
            priority: change.field === 'amount' ? 'high' : 'medium',
            title: `Update debt: ${currentDebt.entity_name}`,
            description: change.field + ': ' + change.oldValue + ' → ' + change.newValue,
            proposed_action: {
              table: 'debts',
              id: entity.id,
              updates: change.newValue,
            },
            confidence: change.changeType === 'modified' ? 0.9 : 0.5,
            source_email_id: insight.email_id,
          })
        }
      }
    }

    return suggestions
  }

  /**
   * Check for task updates
   */
  private async checkTaskUpdates(
    insight: any,
    entities: ResolvedEntities
  ): Promise<SyncSuggestion[]> {
    const suggestions: SyncSuggestion[] = []

    // Check if this relates to an existing task
    const relatedTasks = await this.findRelatedTasks(insight, entities)

    if (relatedTasks.length > 0) {
      // Suggest updates to existing tasks
      for (const task of relatedTasks) {
        const updates = await this.diffDetector.detectChanges(task, insight)

        if (updates.length > 0) {
          suggestions.push({
            id: `update-task-${task.id}-${Date.now()}`,
            type: 'update_task',
            priority: 'medium',
            title: `Update task: ${task.title}`,
            description: updates.map((u: any) => u.description).join('; '),
            proposed_action: {
              table: 'unified_dashboard',
              id: task.id,
              updates: updates.reduce((acc: any, u: any) => ({ ...acc, ...u.proposed_value }), {}),
            },
            confidence: Math.min(...updates.map((u: any) => u.confidence)),
            source_email_id: insight.email_id,
          })
        }
      }
    } else {
      // Suggest new task
      suggestions.push({
        id: `new-task-${Date.now()}`,
        type: 'new_task',
        priority: insight.priority || 'medium',
        title: 'New task from email',
        description: insight.summary,
        proposed_action: {
          table: 'unified_dashboard',
          data: {
            title: insight.summary.slice(0, 100),
            description: insight.summary,
            status: 'pending',
            priority: insight.priority || 'medium',
            source: 'email',
            source_id: insight.email_id,
            created_at: new Date().toISOString(),
          },
        },
        confidence: 0.7,
        source_email_id: insight.email_id,
      })
    }

    return suggestions
  }

  /**
   * Check for new contacts
   */
  private checkNewContacts(insight: any, entities: ResolvedEntities): SyncSuggestion[] {
    const suggestions: SyncSuggestion[] = []

    for (const newEntity of entities.new_entities) {
      suggestions.push({
        id: `new-contact-${Date.now()}`,
        type: 'new_contact',
        priority: 'low',
        title: `New contact: ${newEntity.name}`,
        description: `Found in email: ${insight.subject}`,
        proposed_action: {
          table: 'clients',
          data: {
            name: newEntity.name,
            email: newEntity.email,
            source: 'email',
            created_at: new Date().toISOString(),
          },
        },
        confidence: 0.6,
        source_email_id: insight.email_id,
      })
    }

    return suggestions
  }

  /**
   * Find related tasks based on insight
   */
  private async findRelatedTasks(insight: any, entities: ResolvedEntities): Promise<any[]> {
    const tasks: any[] = []

    // Search by entity
    if (entities.debts.length > 0) {
      const { data } = await supabase
        .from('unified_dashboard')
        .select('*')
        .in('entity_id', entities.debts.map((d: any) => d.id))

      if (data) tasks.push(...data)
    }

    // Search by keyword
    if (tasks.length === 0) {
      const keywords = insight.summary.toLowerCase().split(' ').slice(0, 3)
      const { data } = await supabase
        .from('unified_dashboard')
        .select('*')
        .or(keywords.map((k: string) => `title.ilike.%${k}%`).join(','))
        .limit(3)

      if (data) tasks.push(...data)
    }

    return tasks
  }

  /**
   * Auto-apply high-confidence suggestions
   */
  private async autoApplySuggestions(suggestions: SyncSuggestion[]): Promise<void> {
    for (const suggestion of suggestions) {
      try {
        const { table, id, data, updates } = suggestion.proposed_action as any

        if (id) {
          // Update existing
          await supabase
            .from(table)
            .update(updates)
            .eq('id', id)
        } else {
          // Insert new
          await supabase
            .from(table)
            .insert(data)
        }

        console.log(`✅ Auto-applied: ${suggestion.title}`)
      } catch (error) {
        console.error(`❌ Failed to apply suggestion:`, error)
      }
    }
  }

  /**
   * Save sync session to memory
   */
  private async saveSyncSession(suggestions: SyncSuggestion[]): Promise<void> {
    try {
      const content = `Email sync completed:
- Found ${suggestions.length} suggestions
- ${suggestions.filter(s => s.type === 'update_debt').length} debt updates
- ${suggestions.filter(s => s.type === 'new_task').length} new tasks
- ${suggestions.filter(s => s.type === 'update_task').length} task updates`

      await this.memory.save(content, {
        type: 'conversation',
        importance: suggestions.length > 0 ? 0.8 : 0.5,
      })
    } catch (error) {
      console.error('Failed to save sync session:', error)
    }
  }

  /**
   * Generate summary
   */
  private generateSummary(suggestions: SyncSuggestion[]): string {
    if (suggestions.length === 0) {
      return 'No updates found'
    }

    const highPriority = suggestions.filter(s => s.priority === 'high').length
    const types = suggestions.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return `Found ${suggestions.length} updates (${highPriority} high priority): ${Object.entries(types).map(([k, v]) => `${v} ${k}`).join(', ')}`
  }
}

// Singleton
let syncAgent: SyncAgent | null = null

export function getSyncAgent(): SyncAgent {
  if (!syncAgent) {
    syncAgent = new SyncAgent()
  }
  return syncAgent
}