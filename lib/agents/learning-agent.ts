/**
 * Learning Agent
 * Learns from feedback and improves over time
 */

import { supabase } from '@/lib/supabase'
import { getHybridMemory } from '@/lib/memory/hybrid-memory'

export interface LearningEvent {
  action: string
  context: any
  outcome: 'success' | 'failure' | 'neutral'
  feedback?: string
  userId?: string
}

export interface Pattern {
  pattern: string
  confidence: number
  occurrences: number
  lastSeen: Date
}

export class LearningAgent {
  private memory = getHybridMemory()

  async recordEvent(event: LearningEvent): Promise<void> {
    // Save to learned_patterns table
    const { error } = await supabase
      .from('learned_patterns')
      .insert({
        pattern_type: 'action_outcome',
        pattern_data: {
          action: event.action,
          context: event.context,
          outcome: event.outcome,
        },
        confidence_score: event.outcome === 'success' ? 0.8 : 0.3,
        success_count: event.outcome === 'success' ? 1 : 0,
        failure_count: event.outcome === 'failure' ? 1 : 0,
      })

    if (error) {
      console.error('Error recording learning event:', error)
    }

    // Also save to semantic memory
    await this.memory.save(
      `Action: ${event.action}, Outcome: ${event.outcome}${event.feedback ? `, Feedback: ${event.feedback}` : ''}`,
      {
        type: 'learning',
        importance: event.outcome === 'success' ? 0.7 : 0.9,
        source: 'learning-agent',
      }
    )
  }

  async getPatterns(action: string): Promise<Pattern[]> {
    const { data } = await supabase
      .from('learned_patterns')
      .select('*')
      .eq('pattern_type', 'action_outcome')
      .order('confidence_score', { ascending: false })
      .limit(10)

    if (!data) return []

    return data.map(p => ({
      pattern: p.pattern_data.action,
      confidence: p.confidence_score,
      occurrences: p.success_count + p.failure_count,
      lastSeen: new Date(p.last_occurrence_at),
    }))
  }

  async shouldRecommendAction(action: string): Promise<{ recommend: boolean; confidence: number; reason: string }> {
    const patterns = await this.getPatterns(action)
    
    if (patterns.length === 0) {
      return {
        recommend: true,
        confidence: 0.5,
        reason: 'No prior data - neutral recommendation',
      }
    }

    const successRate = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length

    return {
      recommend: successRate > 0.6,
      confidence: successRate,
      reason: successRate > 0.6 
        ? `Action succeeded ${Math.round(successRate * 100)}% of the time`
        : `Action has low success rate (${Math.round(successRate * 100)}%)`,
    }
  }
}

let learningAgent: LearningAgent | null = null

export function getLearningAgent(): LearningAgent {
  if (!learningAgent) {
    learningAgent = new LearningAgent()
  }
  return learningAgent
}
