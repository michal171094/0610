/**
 * Monitor Agent
 * 
 * Monitors tasks, debts, and bureaucracy items for:
 * - Overdue deadlines
 * - Stuck tasks (no updates for X days)
 * - High-priority items needing attention
 * 
 * Can be triggered:
 * - On demand (from chat)
 * - Scheduled (via cron/Trigger.dev)
 */

import { supabase } from '@/lib/supabase'
import { getHybridMemory } from '@/lib/memory/hybrid-memory'

export interface MonitorAlert {
  id: string
  type: 'deadline' | 'stuck_task' | 'high_priority' | 'waiting_response'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  entity_type: 'task' | 'debt' | 'bureaucracy'
  entity_id: string
  suggested_action?: string
  created_at: string
}

export interface MonitorReport {
  alerts: MonitorAlert[]
  summary: {
    total_alerts: number
    critical_count: number
    high_count: number
    categories: Record<string, number>
  }
  recommendations: string[]
}

export class MonitorAgent {
  private supabase = supabase
  private memory = getHybridMemory()

  /**
   * Main monitoring function
   */
  async monitor(options: {
    includeDeadlines?: boolean
    includeStuckTasks?: boolean
    includePriorities?: boolean
    daysStuckThreshold?: number
  } = {}): Promise<MonitorReport> {
    const {
      includeDeadlines = true,
      includeStuckTasks = true,
      includePriorities = true,
      daysStuckThreshold = 7,
    } = options

    const alerts: MonitorAlert[] = []

    // 1. Check overdue deadlines
    if (includeDeadlines) {
      const deadlineAlerts = await this.checkDeadlines()
      alerts.push(...deadlineAlerts)
    }

    // 2. Check stuck tasks
    if (includeStuckTasks) {
      const stuckAlerts = await this.checkStuckTasks(daysStuckThreshold)
      alerts.push(...stuckAlerts)
    }

    // 3. Check high priorities
    if (includePriorities) {
      const priorityAlerts = await this.checkHighPriorities()
      alerts.push(...priorityAlerts)
    }

    // 4. Check waiting for response
    const waitingAlerts = await this.checkWaitingForResponse()
    alerts.push(...waitingAlerts)

    // 5. Generate summary
    const summary = this.generateSummary(alerts)

    // 6. Generate recommendations
    const recommendations = await this.generateRecommendations(alerts)

    // 7. Save to memory
    await this.saveMonitoringSession(alerts, summary)

    return {
      alerts,
      summary,
      recommendations,
    }
  }

  /**
   * Check for overdue deadlines
   */
  private async checkDeadlines(): Promise<MonitorAlert[]> {
    const alerts: MonitorAlert[] = []
    const now = new Date().toISOString()

    // Check bureaucracy deadlines
    const { data: bureaucracy } = await this.supabase
      .from('bureaucracy')
      .select('*')
      .not('deadline', 'is', null)
      .lt('deadline', now)
      .eq('status', 'pending')

    if (bureaucracy) {
      for (const item of bureaucracy) {
        const daysOverdue = Math.floor(
          (Date.now() - new Date(item.deadline).getTime()) / (1000 * 60 * 60 * 24)
        )

        alerts.push({
          id: `deadline-${item.id}`,
          type: 'deadline',
          severity: daysOverdue > 30 ? 'critical' : daysOverdue > 7 ? 'high' : 'medium',
          title: `Overdue: ${item.entity_name}`,
          description: `Deadline was ${daysOverdue} days ago (${new Date(item.deadline).toLocaleDateString()})`,
          entity_type: 'bureaucracy',
          entity_id: item.id,
          suggested_action: `Contact ${item.entity_name} immediately to resolve this`,
          created_at: new Date().toISOString(),
        })
      }
    }

    // Check unified_dashboard tasks with deadlines
    const { data: tasks } = await this.supabase
      .from('unified_dashboard')
      .select('*')
      .not('due_date', 'is', null)
      .lt('due_date', now)
      .neq('status', 'completed')

    if (tasks) {
      for (const task of tasks) {
        const daysOverdue = Math.floor(
          (Date.now() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24)
        )

        alerts.push({
          id: `deadline-task-${task.id}`,
          type: 'deadline',
          severity: daysOverdue > 14 ? 'critical' : 'high',
          title: `Overdue Task: ${task.title}`,
          description: `Due ${daysOverdue} days ago`,
          entity_type: 'task',
          entity_id: task.id,
          suggested_action: task.next_action || 'Review and update this task',
          created_at: new Date().toISOString(),
        })
      }
    }

    return alerts
  }

  /**
   * Check for stuck tasks (no updates for X days)
   */
  private async checkStuckTasks(daysThreshold: number): Promise<MonitorAlert[]> {
    const alerts: MonitorAlert[] = []
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysThreshold)

    const { data: tasks } = await this.supabase
      .from('unified_dashboard')
      .select('*')
      .eq('status', 'in_progress')
      .lt('updated_at', cutoffDate.toISOString())

    if (tasks) {
      for (const task of tasks) {
        const daysSinceUpdate = Math.floor(
          (Date.now() - new Date(task.updated_at).getTime()) / (1000 * 60 * 60 * 24)
        )

        alerts.push({
          id: `stuck-${task.id}`,
          type: 'stuck_task',
          severity: daysSinceUpdate > 30 ? 'high' : 'medium',
          title: `Stuck: ${task.title}`,
          description: `No updates for ${daysSinceUpdate} days`,
          entity_type: 'task',
          entity_id: task.id,
          suggested_action: 'Check if this task is still relevant or needs action',
          created_at: new Date().toISOString(),
        })
      }
    }

    return alerts
  }

  /**
   * Check high priority items
   */
  private async checkHighPriorities(): Promise<MonitorAlert[]> {
    const alerts: MonitorAlert[] = []

    // High priority tasks
    const { data: tasks } = await this.supabase
      .from('unified_dashboard')
      .select('*')
      .eq('priority', 'high')
      .neq('status', 'completed')

    if (tasks) {
      for (const task of tasks) {
        alerts.push({
          id: `priority-${task.id}`,
          type: 'high_priority',
          severity: 'high',
          title: `High Priority: ${task.title}`,
          description: task.description || 'No description',
          entity_type: 'task',
          entity_id: task.id,
          suggested_action: task.next_action || 'Review this high-priority item',
          created_at: new Date().toISOString(),
        })
      }
    }

    // Large debts
    const { data: debts } = await this.supabase
      .from('debts')
      .select('*')
      .eq('status', 'active')
      .gte('amount', 1000)

    if (debts) {
      for (const debt of debts) {
        alerts.push({
          id: `priority-debt-${debt.id}`,
          type: 'high_priority',
          severity: debt.amount > 5000 ? 'critical' : 'high',
          title: `Large Debt: €${debt.amount}`,
          description: `Owed to ${debt.entity_name}`,
          entity_type: 'debt',
          entity_id: debt.id,
          suggested_action: 'Consider payment plan or negotiation',
          created_at: new Date().toISOString(),
        })
      }
    }

    return alerts
  }

  /**
   * Check items waiting for response
   */
  private async checkWaitingForResponse(): Promise<MonitorAlert[]> {
    const alerts: MonitorAlert[] = []

    const { data: tasks } = await this.supabase
      .from('unified_dashboard')
      .select('*')
      .eq('status', 'waiting')

    if (tasks) {
      for (const task of tasks) {
        const daysSinceUpdate = Math.floor(
          (Date.now() - new Date(task.updated_at).getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysSinceUpdate > 3) {
          alerts.push({
            id: `waiting-${task.id}`,
            type: 'waiting_response',
            severity: daysSinceUpdate > 7 ? 'high' : 'medium',
            title: `Waiting: ${task.title}`,
            description: `Waiting for ${daysSinceUpdate} days`,
            entity_type: 'task',
            entity_id: task.id,
            suggested_action: 'Send follow-up message',
            created_at: new Date().toISOString(),
          })
        }
      }
    }

    return alerts
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(alerts: MonitorAlert[]) {
    const summary = {
      total_alerts: alerts.length,
      critical_count: alerts.filter(a => a.severity === 'critical').length,
      high_count: alerts.filter(a => a.severity === 'high').length,
      categories: {} as Record<string, number>,
    }

    // Count by type
    for (const alert of alerts) {
      summary.categories[alert.type] = (summary.categories[alert.type] || 0) + 1
    }

    return summary
  }

  /**
   * Generate AI-powered recommendations
   */
  private async generateRecommendations(alerts: MonitorAlert[]): Promise<string[]> {
    const recommendations: string[] = []

    // Critical alerts
    const critical = alerts.filter(a => a.severity === 'critical')
    if (critical.length > 0) {
      recommendations.push(`🚨 You have ${critical.length} critical items requiring immediate attention`)
    }

    // Deadlines
    const deadlines = alerts.filter(a => a.type === 'deadline')
    if (deadlines.length > 3) {
      recommendations.push(`📅 Multiple overdue deadlines (${deadlines.length}) - consider prioritizing by importance`)
    }

    // Stuck tasks
    const stuck = alerts.filter(a => a.type === 'stuck_task')
    if (stuck.length > 0) {
      recommendations.push(`⏸️ ${stuck.length} tasks haven't been updated recently - review and close or update them`)
    }

    // Waiting
    const waiting = alerts.filter(a => a.type === 'waiting_response')
    if (waiting.length > 0) {
      recommendations.push(`✉️ ${waiting.length} items waiting for response - send follow-ups`)
    }

    return recommendations
  }

  /**
   * Save monitoring session to memory
   */
  private async saveMonitoringSession(
    alerts: MonitorAlert[],
    summary: any
  ): Promise<void> {
    try {
      const content = `Monitoring session completed:
- Total alerts: ${summary.total_alerts}
- Critical: ${summary.critical_count}
- High priority: ${summary.high_count}

Top issues:
${alerts.slice(0, 3).map(a => `- ${a.title}`).join('\n')}`

      await this.memory.save(content, {
        type: 'monitoring',
        importance: summary.critical_count > 0 ? 1.0 : 0.7,
        metadata: {
          alert_count: summary.total_alerts,
          critical_count: summary.critical_count,
        },
      })
    } catch (error) {
      console.error('Failed to save monitoring session:', error)
    }
  }

  /**
   * Get alert details
   */
  async getAlertDetails(alertId: string): Promise<any> {
    // Parse alert ID to get entity type and ID
    const [type, ...idParts] = alertId.split('-')
    const entityId = idParts.join('-')

    if (type === 'deadline' || type === 'stuck' || type === 'priority' || type === 'waiting') {
      if (alertId.includes('task')) {
        const { data } = await this.supabase
          .from('unified_dashboard')
          .select('*')
          .eq('id', entityId)
          .single()
        return data
      } else if (alertId.includes('debt')) {
        const { data } = await this.supabase
          .from('debts')
          .select('*')
          .eq('id', entityId)
          .single()
        return data
      } else {
        const { data } = await this.supabase
          .from('bureaucracy')
          .select('*')
          .eq('id', entityId)
          .single()
        return data
      }
    }

    return null
  }
}

// Singleton instance
let monitorAgent: MonitorAgent | null = null

export function getMonitorAgent(): MonitorAgent {
  if (!monitorAgent) {
    monitorAgent = new MonitorAgent()
  }
  return monitorAgent
}