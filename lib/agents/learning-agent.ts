/**
 * 🧠 Learning Agent
 * 
 * מערכת למידה לשמירת דפוסים, הצלחות וכישלונות
 * ולימוד מהאינטראקציות עם המשתמש
 */

import { supabaseAdmin } from '@/lib/supabase';
import { DB_SCHEMA } from '@/lib/config/schema';
import { getHybridMemory } from '@/lib/memory/hybrid-memory';

export interface LearningPattern {
  id: string;
  pattern_name: string;
  pattern_type: 'cross_domain' | 'entity_connection' | 'task_creation' | 'search_success';
  trigger_conditions: string[];
  recommended_actions: string[];
  success_rate: number;
  usage_count: number;
  last_used_at: string;
  confidence_score: number;
  pattern_description: string;
  failure_rate?: number;
  success_count?: number;
  failure_count?: number;
}

export interface LearningFeedback {
  pattern_id: string;
  was_successful: boolean;
  user_feedback?: string;
  context: string;
  timestamp: string;
}

export class LearningAgent {
  private memory = getHybridMemory();

  /**
   * Learn from a successful cross-domain connection
   */
  async learnCrossDomainPattern(
    sourceContext: string,
    targetAction: string,
    success: boolean,
    searchResults?: any[]
  ): Promise<void> {
    const patternName = `cross_domain_${sourceContext.replace(/\s+/g, '_').toLowerCase()}_${targetAction.replace(/\s+/g, '_').toLowerCase()}`;
    
    const pattern: Partial<LearningPattern> = {
      pattern_name: patternName,
      pattern_type: 'cross_domain',
      trigger_conditions: [sourceContext],
      recommended_actions: [targetAction],
      pattern_description: `Cross-domain connection: ${sourceContext} → ${targetAction}`,
      success_rate: success ? 1.0 : 0.0,
      usage_count: 1,
      last_used_at: new Date().toISOString(),
      confidence_score: searchResults && searchResults.length > 0 ? 0.9 : 0.7,
      success_count: success ? 1 : 0,
      failure_count: success ? 0 : 1
    };

    await this.saveOrUpdatePattern(pattern as LearningPattern);
  }

  /**
   * Learn from entity resolution success/failure
   */
  async learnEntityResolution(
    entityName: string,
    entityType: string,
    resolutionMethod: 'exact' | 'fuzzy' | 'context',
    wasSuccessful: boolean,
    confidence: number
  ): Promise<void> {
    const patternName = `entity_resolution_${entityType}_${resolutionMethod}`;
    
    const pattern: Partial<LearningPattern> = {
      pattern_name: patternName,
      pattern_type: 'entity_connection',
      trigger_conditions: [`${entityType}:${entityName}`],
      recommended_actions: [`Use ${resolutionMethod} matching for ${entityType} entities`],
      pattern_description: `Entity resolution pattern for ${entityType} using ${resolutionMethod} matching`,
      success_rate: wasSuccessful ? 1.0 : 0.0,
      usage_count: 1,
      last_used_at: new Date().toISOString(),
      confidence_score: confidence,
      success_count: wasSuccessful ? 1 : 0,
      failure_count: wasSuccessful ? 0 : 1
    };

    await this.saveOrUpdatePattern(pattern as LearningPattern);
  }

  /**
   * Learn from web search success
   */
  async learnSearchPattern(
    query: string,
    searchResults: any[],
    userSatisfaction: 'high' | 'medium' | 'low'
  ): Promise<void> {
    const patternName = `search_${query.replace(/\s+/g, '_').toLowerCase()}`;
    const satisfactionScore = userSatisfaction === 'high' ? 1.0 : userSatisfaction === 'medium' ? 0.5 : 0.0;
    
    const pattern: Partial<LearningPattern> = {
      pattern_name: patternName,
      pattern_type: 'search_success',
      trigger_conditions: [query],
      recommended_actions: [`Use similar search terms: ${query}`],
      pattern_description: `Successful search pattern for query: ${query}`,
      success_rate: satisfactionScore,
      usage_count: 1,
      last_used_at: new Date().toISOString(),
      confidence_score: searchResults.length > 0 ? 0.8 : 0.3,
      success_count: satisfactionScore > 0.5 ? 1 : 0,
      failure_count: satisfactionScore <= 0.5 ? 1 : 0
    };

    await this.saveOrUpdatePattern(pattern as LearningPattern);
  }

  /**
   * Learn from task creation success/failure
   */
  async learnTaskCreation(
    taskTitle: string,
    taskType: string,
    wasSuccessful: boolean,
    userApproved: boolean
  ): Promise<void> {
    const patternName = `task_creation_${taskType}`;
    
    const pattern: Partial<LearningPattern> = {
      pattern_name: patternName,
      pattern_type: 'task_creation',
      trigger_conditions: [taskTitle, taskType],
      recommended_actions: [`Create ${taskType} tasks with similar titles`],
      pattern_description: `Task creation pattern for ${taskType} tasks`,
      success_rate: wasSuccessful && userApproved ? 1.0 : wasSuccessful ? 0.7 : 0.0,
      usage_count: 1,
      last_used_at: new Date().toISOString(),
      confidence_score: userApproved ? 0.9 : 0.5,
      success_count: wasSuccessful && userApproved ? 1 : 0,
      failure_count: !wasSuccessful || !userApproved ? 1 : 0
    };

    await this.saveOrUpdatePattern(pattern as LearningPattern);
  }

  /**
   * Get learned patterns for a given context
   */
  async getRelevantPatterns(context: string, limit: number = 5): Promise<LearningPattern[]> {
    try {
      // Search for patterns that match the context
      const { data: patterns } = await supabaseAdmin
        .from(DB_SCHEMA.learned_patterns.table)
        .select('*')
        .or(
          DB_SCHEMA.learned_patterns.fields.trigger_conditions + '.cs.{' + context + '}',
          DB_SCHEMA.learned_patterns.fields.pattern_description + '.ilike.%' + context + '%'
        )
        .order(DB_SCHEMA.learned_patterns.fields.success_rate, { ascending: false })
        .order(DB_SCHEMA.learned_patterns.fields.usage_count, { ascending: false })
        .limit(limit);

      return patterns || [];
    } catch (error) {
      console.error('Error getting relevant patterns:', error);
      return [];
    }
  }

  /**
   * Update pattern based on feedback
   */
  async updatePatternFromFeedback(feedback: LearningFeedback): Promise<void> {
    try {
      const { data: pattern } = await supabaseAdmin
        .from(DB_SCHEMA.learned_patterns.table)
      .select('*')
        .eq('id', feedback.pattern_id)
        .single();

      if (!pattern) {
        console.error('Pattern not found for feedback:', feedback.pattern_id);
        return;
      }

      const newSuccessCount = pattern.success_count + (feedback.was_successful ? 1 : 0);
      const newFailureCount = pattern.failure_count + (feedback.was_successful ? 0 : 1);
      const newUsageCount = pattern.usage_count + 1;
      const newSuccessRate = newUsageCount > 0 ? newSuccessCount / newUsageCount : 0;

      await supabaseAdmin
        .from(DB_SCHEMA.learned_patterns.table)
        .update({
          success_count: newSuccessCount,
          failure_count: newFailureCount,
          usage_count: newUsageCount,
          success_rate: newSuccessRate,
          failure_rate: 1 - newSuccessRate,
          last_used_at: feedback.timestamp,
          updated_at: new Date().toISOString()
        })
        .eq('id', feedback.pattern_id);

      // Save feedback to memory
      await this.memory.save(
        `Pattern feedback: ${feedback.was_successful ? 'success' : 'failure'} for ${pattern.pattern_name}`,
        {
          type: 'feedback',
          importance: 0.7,
          pattern_id: feedback.pattern_id,
          was_successful: feedback.was_successful,
          user_feedback: feedback.user_feedback,
          context: feedback.context
        }
      );

    } catch (error) {
      console.error('Error updating pattern from feedback:', error);
    }
  }

  /**
   * Save or update a learning pattern
   */
  private async saveOrUpdatePattern(pattern: LearningPattern): Promise<void> {
    try {
      // Check if pattern already exists
      const { data: existingPattern } = await supabaseAdmin
        .from(DB_SCHEMA.learned_patterns.table)
        .select('*')
        .eq('pattern_name', pattern.pattern_name)
        .single();

      if (existingPattern) {
        // Update existing pattern
        const newUsageCount = existingPattern.usage_count + 1;
        const newSuccessCount = existingPattern.success_count + (pattern.success_count || 0);
        const newFailureCount = existingPattern.failure_count + (pattern.failure_count || 0);
        const newSuccessRate = newUsageCount > 0 ? newSuccessCount / newUsageCount : 0;

        await supabaseAdmin
          .from(DB_SCHEMA.learned_patterns.table)
          .update({
            usage_count: newUsageCount,
            success_count: newSuccessCount,
            failure_count: newFailureCount,
            success_rate: newSuccessRate,
            failure_rate: 1 - newSuccessRate,
            last_used_at: pattern.last_used_at,
            updated_at: new Date().toISOString()
          })
          .eq('pattern_name', pattern.pattern_name);
      } else {
        // Create new pattern
        await supabaseAdmin
          .from(DB_SCHEMA.learned_patterns.table)
          .insert({
            id: crypto.randomUUID(),
            pattern_name: pattern.pattern_name,
            pattern_type: pattern.pattern_type,
            trigger_conditions: pattern.trigger_conditions,
            recommended_actions: pattern.recommended_actions,
            pattern_description: pattern.pattern_description,
            success_rate: pattern.success_rate,
            usage_count: pattern.usage_count,
            last_used_at: pattern.last_used_at,
            confidence_score: pattern.confidence_score,
            success_count: pattern.success_count || 0,
            failure_count: pattern.failure_count || 0,
            failure_rate: pattern.failure_rate || 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }

      // Save pattern to memory
      await this.memory.save(
        `Learned pattern: ${pattern.pattern_name} (${pattern.pattern_type})`,
        {
          type: 'pattern',
          importance: pattern.success_rate > 0.8 ? 0.9 : 0.6,
          pattern_name: pattern.pattern_name,
          pattern_type: pattern.pattern_type,
          success_rate: pattern.success_rate,
          trigger_conditions: pattern.trigger_conditions
        }
      );

    } catch (error) {
      console.error('Error saving pattern:', error);
    }
  }

  /**
   * Get learning statistics
   */
  async getLearningStats(): Promise<{
    totalPatterns: number;
    averageSuccessRate: number;
    mostUsedPatterns: LearningPattern[];
    recentPatterns: LearningPattern[];
  }> {
    try {
      const { count: totalPatterns } = await supabaseAdmin
        .from(DB_SCHEMA.learned_patterns.table)
        .select('*', { count: 'exact', head: true });

      const { data: allPatterns } = await supabaseAdmin
        .from(DB_SCHEMA.learned_patterns.table)
        .select('*');

      const averageSuccessRate = allPatterns && allPatterns.length > 0
        ? allPatterns.reduce((sum, p) => sum + (p.success_rate || 0), 0) / allPatterns.length
        : 0;

      const mostUsedPatterns = (allPatterns || [])
        .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
        .slice(0, 5);

      const recentPatterns = (allPatterns || [])
        .sort((a, b) => new Date(b.last_used_at || '').getTime() - new Date(a.last_used_at || '').getTime())
        .slice(0, 5);

    return {
        totalPatterns: totalPatterns || 0,
        averageSuccessRate,
        mostUsedPatterns,
        recentPatterns
      };

    } catch (error) {
      console.error('Error getting learning stats:', error);
      return {
        totalPatterns: 0,
        averageSuccessRate: 0,
        mostUsedPatterns: [],
        recentPatterns: []
      };
    }
  }
  /**
   * Learn from sync session results
   */
  async learnFromSyncSession(suggestions: any[]): Promise<void> {
    try {
      // Analyze successful patterns
      const successfulSuggestions = suggestions.filter(s => s.confidence > 0.8);
      
      for (const suggestion of successfulSuggestions) {
        // Extract pattern from successful suggestion
        const pattern = this.extractPatternFromSuggestion(suggestion);
        
        if (pattern) {
          await this.saveLearningPattern(pattern);
        }
      }

      // Learn from cross-domain connections
      const crossDomainSuggestions = suggestions.filter(s => 
        s.title.includes('חיבור תחומים') || s.title.includes('דפוס היסטורי')
      );

      for (const suggestion of crossDomainSuggestions) {
        await this.learnCrossDomainPattern(
          suggestion.description,
          suggestion.title,
          suggestion.confidence > 0.7,
          suggestion.proposed_action?.task_data?.web_search_results || []
        );
      }

      // Update success/failure rates for existing patterns
      await this.updatePatternStats(suggestions);

    } catch (error) {
      console.error('Error learning from sync session:', error);
    }
  }

  /**
   * Extract learning pattern from suggestion
   */
  private extractPatternFromSuggestion(suggestion: any): LearningPattern | null {
    try {
    return {
        id: crypto.randomUUID(),
        pattern_name: suggestion.title,
        pattern_type: this.determinePatternType(suggestion),
        trigger_conditions: this.extractTriggerConditions(suggestion),
        recommended_actions: [suggestion.description],
        success_rate: suggestion.confidence,
        usage_count: 1,
        last_used_at: new Date().toISOString(),
        confidence_score: suggestion.confidence,
        pattern_description: suggestion.description,
        failure_rate: 1 - suggestion.confidence,
        success_count: suggestion.confidence > 0.7 ? 1 : 0,
        failure_count: suggestion.confidence <= 0.7 ? 1 : 0
      };
    } catch (error) {
      console.error('Error extracting pattern:', error);
      return null;
    }
  }

  /**
   * Determine pattern type from suggestion
   */
  private determinePatternType(suggestion: any): 'cross_domain' | 'entity_connection' | 'task_creation' | 'search_success' {
    if (suggestion.title.includes('חיבור תחומים')) {
      return 'cross_domain';
    }
    if (suggestion.type === 'new_task') {
      return 'task_creation';
    }
    if (suggestion.title.includes('חיבור') || suggestion.title.includes('קשר')) {
      return 'entity_connection';
    }
    if (suggestion.proposed_action?.task_data?.web_search_results) {
      return 'search_success';
    }
    return 'task_creation';
  }

  /**
   * Extract trigger conditions from suggestion
   */
  private extractTriggerConditions(suggestion: any): string[] {
    const conditions: string[] = [];
    
    // Extract keywords from title and description
    const text = `${suggestion.title} ${suggestion.description}`;
    const keywords = text.match(/[\u0590-\u05FF\u200f-\u200f]+/g) || [];
    
    // Add significant keywords as trigger conditions
    keywords.forEach(keyword => {
      if (keyword.length > 2 && !conditions.includes(keyword)) {
        conditions.push(keyword);
      }
    });

    return conditions.slice(0, 5); // Limit to 5 conditions
  }

  /**
   * Update pattern statistics
   */
  private async updatePatternStats(suggestions: any[]): Promise<void> {
    try {
      for (const suggestion of suggestions) {
        // Find similar existing patterns
        const { data: existingPatterns } = await supabaseAdmin
          .from('learned_patterns')
          .select('*')
          .ilike('pattern_name', `%${suggestion.title.substring(0, 20)}%`)
          .limit(1);

        if (existingPatterns && existingPatterns.length > 0) {
          const pattern = existingPatterns[0];
          const isSuccess = suggestion.confidence > 0.7;
          
          // Update statistics
          const newSuccessCount = pattern.success_count + (isSuccess ? 1 : 0);
          const newFailureCount = pattern.failure_count + (isSuccess ? 0 : 1);
          const newUsageCount = pattern.usage_count + 1;
          const newSuccessRate = newSuccessCount / newUsageCount;
          const newFailureRate = newFailureCount / newUsageCount;

          await supabaseAdmin
            .from('learned_patterns')
            .update({
              success_count: newSuccessCount,
              failure_count: newFailureCount,
              usage_count: newUsageCount,
              success_rate: newSuccessRate,
              failure_rate: newFailureRate,
              confidence_score: newSuccessRate,
              last_used_at: new Date().toISOString()
            })
            .eq('id', pattern.id);
        }
      }
    } catch (error) {
      console.error('Error updating pattern stats:', error);
    }
  }

let learningAgent: LearningAgent | null = null;

export function getLearningAgent(): LearningAgent {
  if (!learningAgent) {
    learningAgent = new LearningAgent();
  }
  return learningAgent;
}

export default LearningAgent;