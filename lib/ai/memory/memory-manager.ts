import { supabaseAdmin } from '@/lib/supabase';
import { AgentMemory, MemoryType } from '@/types';

/**
 * Memory Manager - ניהול זיכרון AI
 * מטפל באחסון, שליפה, ואיחוד זיכרונות
 */
export class MemoryManager {
  private userId: string;
  
  constructor(userId: string = 'michal') {
    this.userId = userId;
  }
  
  /**
   * שמור זיכרון חדש
   */
  async storeMemory(
    title: string,
    data: any,
    type: MemoryType = 'episodic',
    tags: string[] = [],
    importanceScore?: number
  ): Promise<AgentMemory> {
    const description = this.summarizeContent(data);
    const importance = importanceScore ?? this.calculateImportance(data, type);
    
    const { data: memory, error } = await supabaseAdmin
      .from('agent_memories')
      .insert({
        user_id: this.userId,
        memory_type: type,
        title,
        description,
        data,
        importance_score: importance,
        context_tags: tags,
        access_count: 0,
        decay_rate: this.getDecayRate(type),
        associations: [],
      })
      .select()
      .single();
    
    if (error) {
      console.error('Failed to store memory:', error);
      throw new Error(`Failed to store memory: ${error.message}`);
    }
    
    return this.mapFromDatabase(memory);
  }
  
  /**
   * שלוף זיכרונות רלוונטיים
   */
  async retrieveMemories(
    query: string,
    limit: number = 5,
    memoryTypes?: MemoryType[]
  ): Promise<AgentMemory[]> {
    // Build query
    let dbQuery = supabaseAdmin
      .from('agent_memories')
      .select('*')
      .eq('user_id', this.userId)
      .gte('importance_score', 0.3)
      .order('importance_score', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(limit * 2); // Get more for filtering
    
    if (memoryTypes && memoryTypes.length > 0) {
      dbQuery = dbQuery.in('memory_type', memoryTypes);
    }
    
    const { data, error } = await dbQuery;
    
    if (error) {
      console.error('Failed to retrieve memories:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    // Filter by relevance to query
    const queryLower = query.toLowerCase();
    const relevantMemories = data.filter(m => {
      const titleMatch = m.title?.toLowerCase().includes(queryLower);
      const descMatch = m.description?.toLowerCase().includes(queryLower);
      const tagMatch = m.context_tags?.some((tag: string) => 
        tag.toLowerCase().includes(queryLower) || queryLower.includes(tag.toLowerCase())
      );
      const dataMatch = JSON.stringify(m.data).toLowerCase().includes(queryLower);
      
      return titleMatch || descMatch || tagMatch || dataMatch;
    });
    
    // Take top matches
    const topMemories = relevantMemories.slice(0, limit);
    
    // Update access count and last accessed
    if (topMemories.length > 0) {
      const memoryIds = topMemories.map((m: any) => m.id);
      await this.updateAccessedMemories(memoryIds);
    }
    
    return topMemories.map(this.mapFromDatabase);
  }
  
  /**
   * קבל working memory (זיכרון עבודה - רלוונטי כרגע)
   */
  async getWorkingMemory(): Promise<AgentMemory[]> {
    const { data, error } = await supabaseAdmin
      .from('agent_memories')
      .select('*')
      .eq('user_id', this.userId)
      .eq('memory_type', 'working')
      .gte('importance_score', 0.7)
      .order('updated_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Failed to get working memory:', error);
      return [];
    }
    
    return (data || []).map(this.mapFromDatabase);
  }
  
  /**
   * קבל זיכרונות לפי tags
   */
  async getMemoriesByTags(tags: string[], limit: number = 10): Promise<AgentMemory[]> {
    const { data, error } = await supabaseAdmin
      .from('agent_memories')
      .select('*')
      .eq('user_id', this.userId)
      .contains('context_tags', tags)
      .order('importance_score', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Failed to get memories by tags:', error);
      return [];
    }
    
    return (data || []).map(this.mapFromDatabase);
  }
  
  /**
   * איחוד זיכרונות (קיבוץ וזיהוי דפוסים)
   */
  async consolidateMemories(): Promise<void> {
    // Get recent episodic memories (last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const { data: recentMemories } = await supabaseAdmin
      .from('agent_memories')
      .select('*')
      .eq('user_id', this.userId)
      .eq('memory_type', 'episodic')
      .gte('created_at', oneDayAgo.toISOString())
      .order('importance_score', { ascending: false });
    
    if (!recentMemories || recentMemories.length < 3) {
      return; // Need at least 3 memories to find patterns
    }
    
    // Group related memories
    const groups = this.groupRelatedMemories(recentMemories);
    
    // Create semantic memories from patterns
    for (const group of groups) {
      if (group.length >= 3) {
        const pattern = this.extractPattern(group);
        if (pattern) {
          await this.storeMemory(
            pattern.title,
            pattern.data,
            'semantic',
            pattern.tags,
            pattern.importance
          );
        }
      }
    }
  }
  
  /**
   * החל ריקבון על חשיבות זיכרונות
   */
  async applyMemoryDecay(): Promise<void> {
    try {
      // Call database function
      await supabaseAdmin.rpc('decay_memory_importance');
    } catch (error) {
      console.error('Failed to apply memory decay:', error);
    }
  }
  
  /**
   * קשר בין זיכרונות
   */
  async linkMemories(memoryId1: string, memoryId2: string): Promise<void> {
    // Get both memories
    const { data: memories } = await supabaseAdmin
      .from('agent_memories')
      .select('id, associations')
      .in('id', [memoryId1, memoryId2]);
    
    if (!memories || memories.length !== 2) return;
    
    // Update associations bidirectionally
    for (const memory of memories) {
      const otherId = memory.id === memoryId1 ? memoryId2 : memoryId1;
      const associations = memory.associations || [];
      
      if (!associations.includes(otherId)) {
        associations.push(otherId);
        
        await supabaseAdmin
          .from('agent_memories')
          .update({ 
            associations,
            updated_at: new Date().toISOString()
          })
          .eq('id', memory.id);
      }
    }
  }
  
  /**
   * מחק זיכרונות ישנים/לא חשובים
   */
  async cleanup(importanceThreshold: number = 0.2, daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const { data, error } = await supabaseAdmin
      .from('agent_memories')
      .delete()
      .eq('user_id', this.userId)
      .lt('importance_score', importanceThreshold)
      .lt('created_at', cutoffDate.toISOString())
      .select('id');
    
    if (error) {
      console.error('Failed to cleanup memories:', error);
      return 0;
    }
    
    return data?.length || 0;
  }
  
  // ============================================
  // Private Helper Methods
  // ============================================
  
  private summarizeContent(data: any): string {
    if (typeof data === 'string') {
      return data.substring(0, 200);
    }
    
    if (typeof data === 'object') {
      // Try to extract meaningful summary
      if (data.title) return data.title;
      if (data.description) return data.description;
      if (data.content) return String(data.content).substring(0, 200);
    }
    
    return JSON.stringify(data).substring(0, 200);
  }
  
  private calculateImportance(data: any, type: MemoryType): number {
    let score = 0.5; // Base score
    
    // Adjust based on memory type
    switch (type) {
      case 'working':
        score += 0.3;
        break;
      case 'procedural':
        score += 0.2;
        break;
      case 'semantic':
        score += 0.15;
        break;
      case 'episodic':
        score += 0.1;
        break;
    }
    
    // Adjust based on content characteristics
    if (data.isUrgent) score += 0.2;
    if (data.financialImpact && data.financialImpact > 100) score += 0.1;
    if (data.deadline) score += 0.1;
    if (data.priority === 'high' || data.priority === 'critical') score += 0.15;
    
    return Math.min(1.0, Math.max(0.1, score));
  }
  
  private getDecayRate(type: MemoryType): number {
    switch (type) {
      case 'working':
        return 0.2; // Decays fast
      case 'episodic':
        return 0.1;
      case 'semantic':
        return 0.05; // Decays slowly
      case 'procedural':
        return 0.02; // Almost doesn't decay
      default:
        return 0.1;
    }
  }
  
  private async updateAccessedMemories(memoryIds: string[]): Promise<void> {
    try {
      for (const id of memoryIds) {
        await supabaseAdmin.rpc('increment_memory_access', { memory_id: id });
      }
    } catch (error) {
      // Non-critical error, just log it
      console.warn('Failed to update memory access count:', error);
    }
  }
  
  private groupRelatedMemories(memories: any[]): any[][] {
    const groups: any[][] = [];
    const used = new Set<string>();
    
    for (const memory of memories) {
      if (used.has(memory.id)) continue;
      
      const group = [memory];
      used.add(memory.id);
      
      // Find related memories
      for (const other of memories) {
        if (used.has(other.id)) continue;
        
        const similarity = this.calculateSimilarity(memory, other);
        if (similarity > 0.6) {
          group.push(other);
          used.add(other.id);
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }
  
  private calculateSimilarity(memory1: any, memory2: any): number {
    // Tag similarity (Jaccard)
    const tags1 = new Set(memory1.context_tags || []);
    const tags2 = new Set(memory2.context_tags || []);
    
    const intersection = new Set(Array.from(tags1).filter(x => tags2.has(x)));
    const union = new Set([...Array.from(tags1), ...Array.from(tags2)]);
    
    const tagSimilarity = union.size > 0 ? intersection.size / union.size : 0;
    
    // Type similarity
    const typeSimilarity = memory1.memory_type === memory2.memory_type ? 0.3 : 0;
    
    // Time proximity (closer in time = more similar)
    const time1 = new Date(memory1.created_at).getTime();
    const time2 = new Date(memory2.created_at).getTime();
    const timeDiff = Math.abs(time1 - time2);
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    const timeSimilarity = Math.max(0, 1 - hoursDiff / 24) * 0.2;
    
    return tagSimilarity * 0.5 + typeSimilarity + timeSimilarity;
  }
  
  private extractPattern(memories: any[]): any | null {
    // Find common tags
    const allTags = memories.flatMap(m => m.context_tags || []);
    const tagCounts = allTags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const commonTags = Object.entries(tagCounts)
      .filter(([_, count]) => (count as number) >= memories.length * 0.6) // Appears in 60%+ of memories
      .map(([tag, _]) => tag);
    
    if (commonTags.length === 0) return null;
    
    // Calculate pattern importance
    const avgImportance = memories.reduce((sum, m) => sum + m.importance_score, 0) / memories.length;
    const patternImportance = Math.min(1.0, avgImportance * 1.2); // Boost pattern importance
    
    return {
      title: `דפוס: ${commonTags.join(', ')}`,
      data: {
        type: 'pattern',
        instances: memories.map(m => ({
          id: m.id,
          title: m.title,
          timestamp: m.created_at,
        })),
        commonTags,
        count: memories.length,
        confidence: memories.length / 10, // 10+ instances = high confidence
      },
      tags: commonTags,
      importance: patternImportance,
    };
  }
  
  private mapFromDatabase(dbMemory: any): AgentMemory {
    return {
      id: dbMemory.id,
      userId: dbMemory.user_id,
      memoryType: dbMemory.memory_type,
      title: dbMemory.title,
      description: dbMemory.description,
      data: dbMemory.data,
      importanceScore: dbMemory.importance_score,
      accessCount: dbMemory.access_count,
      lastAccessedAt: dbMemory.last_accessed_at ? new Date(dbMemory.last_accessed_at) : undefined,
      decayRate: dbMemory.decay_rate,
      associations: dbMemory.associations || [],
      contextTags: dbMemory.context_tags || [],
      embedding: dbMemory.embedding,
      createdAt: new Date(dbMemory.created_at),
      updatedAt: new Date(dbMemory.updated_at),
    };
  }
}
