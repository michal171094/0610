/**
 * Hybrid Memory System
 * Combines Supabase (structured) + Qdrant (semantic)
 */

import { supabase } from '@/lib/supabase'
import { getQdrantMemory } from './qdrant-memory'

export interface HybridSearchOptions {
  query: string
  limit?: number
  useQdrant?: boolean
  usePgVector?: boolean
  minSimilarity?: number
  entityId?: string
}

export interface HybridMemoryResult {
  id: string
  content: string
  source: 'qdrant' | 'supabase'
  similarity?: number
  metadata?: any
  created_at?: string
}

export class HybridMemory {
  private qdrant = getQdrantMemory()

  /**
   * Save memory to both systems
   */
  async save(content: string, metadata: any = {}): Promise<void> {
    const useQdrant = process.env.USE_SEMANTIC_MEMORY === 'true'

    // Always save to Supabase for structured data
    const { error: supabaseError } = await supabase
      .from('semantic_memories')
      .insert({
        content,
        memory_type: metadata.type || 'general',
        importance: metadata.importance || 0.5,
        metadata: metadata,
      })

    if (supabaseError) {
      console.error('Error saving to Supabase:', supabaseError)
    }

    // Optionally save to Qdrant for semantic search
    if (useQdrant) {
      try {
        await this.qdrant.save(content, metadata)
      } catch (error) {
        console.error('Error saving to Qdrant:', error)
      }
    }
  }

  /**
   * Search memories using hybrid approach
   */
  async search(options: HybridSearchOptions): Promise<HybridMemoryResult[]> {
    const {
      query,
      limit = 10,
      useQdrant = process.env.USE_SEMANTIC_MEMORY === 'true',
      usePgVector = true,
      minSimilarity = 0.7,
      entityId,
    } = options

    const results: HybridMemoryResult[] = []

    // Search Qdrant if enabled
    if (useQdrant) {
      try {
        const qdrantResults = await this.qdrant.search(query, {
          limit,
          minSimilarity,
          filter: entityId ? { entityId } : {},
        })

        results.push(
          ...qdrantResults.map(r => ({
            id: r.id,
            content: r.content,
            source: 'qdrant' as const,
            similarity: r.similarity,
            metadata: r.metadata,
          }))
        )
      } catch (error) {
        console.error('Qdrant search error:', error)
      }
    }

    // Search Supabase pgvector
    if (usePgVector) {
      try {
        const { data: supabaseResults } = await supabase
          .rpc('match_memories', {
            query_text: query,
            match_threshold: minSimilarity,
            match_count: limit,
          })

        if (supabaseResults) {
          results.push(
            ...supabaseResults.map((r: any) => ({
              id: r.id,
              content: r.content,
              source: 'supabase' as const,
              similarity: r.similarity,
              metadata: r.metadata,
              created_at: r.created_at,
            }))
          )
        }
      } catch (error) {
        console.error('Supabase search error:', error)
      }
    }

    // Sort by similarity and limit
    return results
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, limit)
  }

  /**
   * Get recent memories
   */
  async getRecent(limit: number = 10): Promise<HybridMemoryResult[]> {
    const { data } = await supabase
      .from('semantic_memories')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    return (data || []).map(r => ({
      id: r.id,
      content: r.content,
      source: 'supabase' as const,
      metadata: r.metadata,
      created_at: r.created_at,
    }))
  }

  /**
   * Get memories by entity
   */
  async getByEntity(entityId: string, limit: number = 20): Promise<HybridMemoryResult[]> {
    const { data } = await supabase
      .from('semantic_memories')
      .select('*')
      .eq('metadata->>entityId', entityId)
      .order('created_at', { ascending: false })
      .limit(limit)

    return (data || []).map(r => ({
      id: r.id,
      content: r.content,
      source: 'supabase' as const,
      metadata: r.metadata,
      created_at: r.created_at,
    }))
  }
}

// Export singleton instance
let hybridMemory: HybridMemory | null = null

export function getHybridMemory(): HybridMemory {
  if (!hybridMemory) {
    hybridMemory = new HybridMemory()
  }
  return hybridMemory
}