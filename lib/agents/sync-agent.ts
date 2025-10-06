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
import { getWebSearchTool } from '@/lib/tools/web-search'
import { getLearningAgent } from './learning-agent'

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
  private webSearch = getWebSearchTool()
  private learningAgent = getLearningAgent()

  /**
   * Main sync function - now includes Drive and Chat insights
   */
  async sync(options: {
    sinceDays?: number
    maxEmails?: number
    autoApprove?: boolean
    includeDrive?: boolean
    includeChat?: boolean
  } = {}): Promise<SyncResult> {
    const {
      sinceDays = 7,
      maxEmails = 50,
      autoApprove = false,
      includeDrive = true,
      includeChat = true,
    } = options

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - sinceDays)

    const suggestions: SyncSuggestion[] = []
    let processedSources = 0

    // 1. Get recent email insights
    const { data: emailInsights } = await supabase
      .from('email_insights')
      .select('*')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(maxEmails)

    if (emailInsights && emailInsights.length > 0) {
      for (const insight of emailInsights) {
        const insightSuggestions = await this.processInsight(insight)
        suggestions.push(...insightSuggestions)
      }
      processedSources++
    }

    // 2. Get Drive document insights if enabled
    if (includeDrive) {
      const { data: driveInsights } = await supabase
        .from('document_insights')
        .select('*')
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(50)

      if (driveInsights && driveInsights.length > 0) {
        for (const insight of driveInsights) {
          const insightSuggestions = await this.processDocumentInsight(insight)
          suggestions.push(...insightSuggestions)
        }
        processedSources++
      }
    }

    // 3. Get Chat insights if enabled
    if (includeChat) {
      const { data: chatInsights } = await supabase
        .from('chat_history')
        .select('*')
        .gte('timestamp', cutoffDate.toISOString())
        .is('analyzed', null)
        .order('timestamp', { ascending: false })
        .limit(100)

      if (chatInsights && chatInsights.length > 0) {
        for (const insight of chatInsights) {
          const insightSuggestions = await this.processChatInsight(insight)
          suggestions.push(...insightSuggestions)
        }
        processedSources++
      }
    }

    if (suggestions.length === 0) {
      return {
        processed_emails: emailInsights?.length || 0,
        new_insights: 0,
        updates_found: 0,
        suggestions: [],
        summary: 'No new insights to process',
      }
    }

    // 4. Cross-domain analysis - find connections between insights
    const crossDomainSuggestions = await this.findCrossDomainConnections(suggestions)
    suggestions.push(...crossDomainSuggestions)

    // 5. Auto-approve high-confidence suggestions if enabled
    if (autoApprove) {
      await this.autoApplySuggestions(
        suggestions.filter(s => s.confidence > 0.9)
      )
    }

    // 6. Save to memory
    await this.saveSyncSession(suggestions)

    return {
      processed_emails: emailInsights?.length || 0,
      new_insights: suggestions.filter(s => s.type === 'new_task').length,
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
   * Save sync session to memory with detailed insights
   */
  private async saveSyncSession(suggestions: SyncSuggestion[]): Promise<void> {
    try {
      // Save overall sync summary
      const summary = `Email sync completed:
- Found ${suggestions.length} suggestions
- ${suggestions.filter(s => s.type === 'update_debt').length} debt updates
- ${suggestions.filter(s => s.type === 'new_task').length} new tasks
- ${suggestions.filter(s => s.type === 'update_task').length} task updates`

      await this.memory.save(summary, {
        type: 'sync_summary',
        importance: suggestions.length > 0 ? 0.8 : 0.5,
        tags: ['sync', 'email', 'automated']
      })

      // Save individual high-importance suggestions
      for (const suggestion of suggestions) {
        if (suggestion.confidence > 0.7) {
          await this.memory.save(
            `Sync suggestion: ${suggestion.title}`,
            {
              type: 'sync_suggestion',
              importance: suggestion.confidence,
              tags: [suggestion.type, suggestion.priority],
              context: {
                description: suggestion.description,
                action: suggestion.proposed_action,
                confidence: suggestion.confidence
              }
            }
          )
        }
      }

      // Save cross-domain patterns
      const crossDomainSuggestions = suggestions.filter(s => 
        s.title.includes('חיבור תחומים') || s.title.includes('דפוס היסטורי')
      )
      
      for (const suggestion of crossDomainSuggestions) {
        await this.memory.save(
          `Cross-domain pattern: ${suggestion.description}`,
          {
            type: 'cross_domain_pattern',
            importance: 0.9,
            tags: ['cross-domain', 'pattern', 'learning'],
            context: {
              title: suggestion.title,
              description: suggestion.description,
              confidence: suggestion.confidence
            }
          }
        )
      }

      // Save web search results if any
      for (const suggestion of suggestions) {
        if (suggestion.proposed_action?.task_data?.web_search_results) {
          const searchResults = suggestion.proposed_action.task_data.web_search_results
          
          await this.memory.save(
            `Web search results for: ${suggestion.title}`,
            {
              type: 'web_search_results',
              importance: 0.7,
              tags: ['web-search', 'research'],
              context: {
                query: suggestion.title,
                results: searchResults,
                relevance: searchResults.map((r: any) => r.relevance).reduce((a: number, b: number) => a + b, 0) / searchResults.length
              }
            }
          )
        }
      }

      // Save learning patterns
      try {
        await this.learningAgent.learnFromSyncSession(suggestions)
      } catch (error) {
        console.error('Failed to learn from sync session:', error)
      }

    } catch (error) {
      console.error('Failed to save sync session:', error)
    }
  }

  /**
   * Process document insight from Drive
   */
  private async processDocumentInsight(insight: any): Promise<SyncSuggestion[]> {
    const suggestions: SyncSuggestion[] = []

    // Process suggested tasks from document
    if (insight.suggested_tasks && insight.suggested_tasks.length > 0) {
      for (const task of insight.suggested_tasks) {
        suggestions.push({
          id: crypto.randomUUID(),
          type: 'new_task',
          priority: task.priority || 'medium',
          title: `מסמך: ${task.title}`,
          description: `${task.description}\n\nמקור: ${insight.file_name}`,
          proposed_action: {
            action: 'create_task',
            task_data: {
              title: task.title,
              description: task.description,
              priority: task.priority,
              deadline: task.deadline,
              linked_entity: task.linked_entity
            }
          },
          confidence: insight.relevance === 'high' ? 0.9 : insight.relevance === 'medium' ? 0.7 : 0.5,
          source_email_id: undefined
        })
      }
    }

    // Process action items
    if (insight.action_items && insight.action_items.length > 0) {
      for (const action of insight.action_items) {
        suggestions.push({
          id: crypto.randomUUID(),
          type: 'new_task',
          priority: 'medium',
          title: `פעולה נדרשת: ${action}`,
          description: `מסמך: ${insight.file_name}\nפעולה: ${action}`,
          proposed_action: {
            action: 'create_task',
            task_data: {
              title: action,
              description: `פעולה נדרשת מהמסמך: ${insight.file_name}`,
              priority: 'medium'
            }
          },
          confidence: 0.7,
          source_email_id: undefined
        })
      }
    }

    return suggestions
  }

  /**
   * Process chat insight
   */
  private async processChatInsight(insight: any): Promise<SyncSuggestion[]> {
    const suggestions: SyncSuggestion[] = []

    // Analyze chat message for actionable items
    const message = insight.message || ''
    
    // Look for keywords that suggest tasks
    const taskKeywords = ['צריך', 'חשוב', 'דדליין', 'מועד', 'להתקשר', 'לשלוח', 'לעדכן']
    const hasTaskKeywords = taskKeywords.some(keyword => message.includes(keyword))

    if (hasTaskKeywords && message.length > 20) {
      suggestions.push({
        id: crypto.randomUUID(),
        type: 'new_task',
        priority: 'medium',
        title: `משימה מצ'אט: ${message.substring(0, 50)}...`,
        description: `הודעה מצ'אט: ${message}`,
        proposed_action: {
          action: 'create_task',
          task_data: {
            title: `משימה מצ'אט: ${message.substring(0, 100)}`,
            description: message,
            priority: 'medium'
          }
        },
        confidence: 0.6,
        source_email_id: undefined
      })
    }

    return suggestions
  }

  /**
   * Find cross-domain connections between insights with AI and web search
   */
  private async findCrossDomainConnections(suggestions: SyncSuggestion[]): Promise<SyncSuggestion[]> {
    const crossDomainSuggestions: SyncSuggestion[] = []

    try {
      // 1. AI-powered cross-domain analysis
      const aiConnections = await this.analyzeCrossDomainWithAI(suggestions)
      crossDomainSuggestions.push(...aiConnections)

      // 2. Pattern-based analysis for known cross-domain scenarios
      const patternConnections = await this.findPatternBasedConnections(suggestions)
      crossDomainSuggestions.push(...patternConnections)

      // 3. Semantic search for similar historical patterns
      const historicalConnections = await this.findHistoricalConnections(suggestions)
      crossDomainSuggestions.push(...historicalConnections)

    } catch (error) {
      console.error('Error in cross-domain analysis:', error)
    }

    return crossDomainSuggestions
  }

  /**
   * 🧠 AI-powered cross-domain analysis
   */
  private async analyzeCrossDomainWithAI(suggestions: SyncSuggestion[]): Promise<SyncSuggestion[]> {
    const crossDomainSuggestions: SyncSuggestion[] = []

    try {
      const openai = await import('openai')
      const openaiClient = new openai.default({ apiKey: process.env.OPENAI_API_KEY })

      // Combine all suggestion text for analysis
      const allText = suggestions.map(s => `${s.title} ${s.description}`).join(' ')

      const prompt = `Analyze these insights for cross-domain connections and implications:

${allText}

Look for:
1. Indirect effects between different domains (e.g., Norway benefit → Kazakhstan insurance)
2. Legal/financial implications across countries
3. Timing dependencies between tasks
4. Resource allocation conflicts
5. Regulatory compliance issues

Return JSON:
{
  "connections": [
    {
      "source": "source insight",
      "target": "target domain/action",
      "relationship": "how they're connected",
      "action": "specific action needed",
      "priority": "high|medium|low",
      "confidence": 0.0-1.0,
      "webSearchNeeded": true/false,
      "searchQuery": "query for web search if needed"
    }
  ]
}`

      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      })

      const analysis = JSON.parse(response.choices[0].message.content || '{"connections":[]}')

      for (const connection of analysis.connections) {
        let enhancedDescription = connection.action

        // Perform web search if needed
        if (connection.webSearchNeeded && connection.searchQuery) {
          try {
            const searchResults = await this.webSearch.searchCrossDomainConnection(
              allText,
              connection.action
            )

            if (searchResults.length > 0) {
              enhancedDescription += `\n\nמידע רלוונטי:\n${searchResults.map(r => `• ${r.title}: ${r.snippet}`).join('\n')}`
            }
          } catch (error) {
            console.error('Web search failed:', error)
          }
        }

        crossDomainSuggestions.push({
          id: crypto.randomUUID(),
          type: 'new_task',
          priority: connection.priority as 'high' | 'medium' | 'low',
          title: `חיבור תחומים: ${connection.target}`,
          description: enhancedDescription,
          proposed_action: {
            action: 'create_task',
            task_data: {
              title: connection.target,
              description: enhancedDescription,
              priority: connection.priority,
              cross_domain_source: connection.source,
              relationship: connection.relationship
            }
          },
          confidence: connection.confidence,
          source_email_id: undefined
        })

        // Save to memory for future learning
        await this.memory.save(
          `Cross-domain connection: ${connection.relationship}`,
          {
            type: 'cross_domain_pattern',
            importance: connection.confidence,
            source: connection.source,
            target: connection.target,
            action: connection.action
          }
        )
      }

    } catch (error) {
      console.error('AI cross-domain analysis failed:', error)
    }

    return crossDomainSuggestions
  }

  /**
   * 📋 Pattern-based cross-domain connections
   */
  private async findPatternBasedConnections(suggestions: SyncSuggestion[]): Promise<SyncSuggestion[]> {
    const crossDomainSuggestions: SyncSuggestion[] = []

    // Known cross-domain patterns
    const patterns = [
      {
        keywords: ['נורבגיה', 'קצבה', 'הפסיקה'],
        action: 'בדוק ביטוח לאומי קזחסטן',
        reason: 'קצבה בנורבגיה הפסיקה - ייתכן שצריך לעדכן ביטוח לאומי בקזחסטן',
        searchQuery: 'Norway social security benefits Kazakhstan national insurance impact'
      },
      {
        keywords: ['חוב', 'הסדר', 'תשלום'],
        action: 'בדוק השפעה על ביטוח לאומי',
        reason: 'הסדר חוב עשוי להשפיע על זכאות לקצבאות',
        searchQuery: 'debt settlement impact social security benefits eligibility'
      },
      {
        keywords: ['לקוח', 'פרויקט', 'השלמה'],
        action: 'בדוק השפעה על תשלומים וחובות',
        reason: 'השלמת פרויקט - בדוק השפעה על תשלומים וחובות',
        searchQuery: 'project completion payment debt impact financial obligations'
      }
    ]

    const allText = suggestions.map(s => `${s.title} ${s.description}`).join(' ')

    for (const pattern of patterns) {
      const hasKeywords = pattern.keywords.some(keyword => allText.includes(keyword))

      if (hasKeywords) {
        // Perform web search for additional context
        try {
          const searchResults = await this.webSearch.searchCrossDomainConnection(
            allText,
            pattern.action
          )

          const enhancedDescription = searchResults.length > 0
            ? `${pattern.reason}\n\nמידע רלוונטי:\n${searchResults.map(r => `• ${r.title}: ${r.snippet}`).join('\n')}`
            : pattern.reason

          crossDomainSuggestions.push({
            id: crypto.randomUUID(),
            type: 'new_task',
            priority: 'high',
            title: `חיבור תחומים: ${pattern.action}`,
            description: enhancedDescription,
            proposed_action: {
              action: 'create_task',
              task_data: {
                title: pattern.action,
                description: enhancedDescription,
                priority: 'high',
                web_search_results: searchResults.map(r => ({
                  title: r.title,
                  url: r.url,
                  relevance: r.relevance_score
                }))
              }
            },
            confidence: searchResults.length > 0 ? 0.9 : 0.8,
            source_email_id: undefined
          })

          // Save pattern to memory
          await this.memory.save(
            `Cross-domain pattern: ${pattern.reason}`,
            {
              type: 'pattern',
              importance: 0.8,
              keywords: pattern.keywords,
              action: pattern.action,
              search_results: searchResults.length
            }
          )

        } catch (error) {
          console.error('Pattern-based connection failed:', error)
        }
      }
    }

    return crossDomainSuggestions
  }

  /**
   * 🔍 Historical pattern search
   */
  private async findHistoricalConnections(suggestions: SyncSuggestion[]): Promise<SyncSuggestion[]> {
    const crossDomainSuggestions: SyncSuggestion[] = []

    try {
      // Search for similar historical patterns in memory
      const allText = suggestions.map(s => `${s.title} ${s.description}`).join(' ')

      const { data: historicalPatterns } = await supabase
        .from('agent_memories')
        .select('content, context, importance')
        .eq('memory_type', 'cross_domain_pattern')
        .gte('importance', 0.7)
        .order('importance', { ascending: false })
        .limit(10)

      if (historicalPatterns && historicalPatterns.length > 0) {
        for (const pattern of historicalPatterns) {
          // Check if current insights match historical patterns
          const similarity = this.calculateTextSimilarity(allText, pattern.content)
          
          if (similarity > 0.7) {
            crossDomainSuggestions.push({
              id: crypto.randomUUID(),
              type: 'new_task',
              priority: 'medium',
              title: `דפוס היסטורי: ${pattern.context?.action || 'בדוק חיבור תחומים'}`,
              description: `דפוס דומה זוהה בעבר: ${pattern.content}`,
              proposed_action: {
                action: 'create_task',
                task_data: {
                  title: pattern.context?.action || 'בדוק חיבור תחומים',
                  description: pattern.content,
                  priority: 'medium',
                  historical_pattern: true
                }
              },
              confidence: similarity * pattern.importance,
              source_email_id: undefined
            })
          }
        }
      }

    } catch (error) {
      console.error('Historical connection search failed:', error)
    }

    return crossDomainSuggestions
  }

  /**
   * 📊 Calculate text similarity
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple similarity calculation - in production, use proper NLP
    const words1 = text1.toLowerCase().split(' ').filter(w => w.length > 3)
    const words2 = text2.toLowerCase().split(' ').filter(w => w.length > 3)
    
    const intersection = words1.filter(word => words2.includes(word))
    const union = [...new Set([...words1, ...words2])]
    
    return intersection.length / union.length
  }

  /**
   * Generate summary
   */
  private generateSummary(suggestions: SyncSuggestion[]): string {
    if (suggestions.length === 0) {
      return 'No updates found'
    }

    const highPriority = suggestions.filter(s => s.priority === 'high').length
    const crossDomain = suggestions.filter(s => s.title.includes('חיבור תחומים')).length
    const types = suggestions.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return `Found ${suggestions.length} updates (${highPriority} high priority, ${crossDomain} cross-domain): ${Object.entries(types).map(([k, v]) => `${v} ${k}`).join(', ')}`
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