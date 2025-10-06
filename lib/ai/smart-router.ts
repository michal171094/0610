/**
 * Hybrid Memory System
 * 
 * Combines Supabase pgvector (hot/recent) + Qdrant (cold/all history)
 * Smart routing based on recency and importance
 */

import { createClient } from '@supabase/supabase-js'
import { QdrantMemory, MemoryMetadata, MemoryPoint } from '@/lib/memory/qdrant-memory'
import OpenAI from 'openai'

export interface HybridMemoryOptions {
  importance?: number
  entityId?: string
  source?: string
  type?: 'conversation' | 'fact' | 'preference' | 'task' | 'general'
}

export interface HybridSearchOptions {
  limit?: number
  minSimilarity?: number
  searchSupabase?: boolean
  searchQdrant?: boolean
  filter?: {
    type?: string
    entityId?: string
    importance?: { gte?: number, lte?: number }
  }
}

export class HybridMemory {
  private supabase: ReturnType<typeof createClient>
  private qdrant: QdrantMemory
  private openai: OpenAI
  private embeddingModel: string
  private readonly IMPORTANCE_THRESHOLD = 0.7
  private readonly RECENCY_DAYS = 30

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    this.qdrant = new QdrantMemory()

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    })

    this.embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
  }

  async initialize(): Promise<void> {
    await this.qdrant.initialize()
    console.log('✅ Hybrid memory system initialized')
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
      })

      return response.data[0].embedding
    } catch (error) {
      console.error('Error generating embedding:', error)
      throw new Error('Failed to generate embedding')
    }
  }

  private calculateImportance(
    content: string,
    metadata: HybridMemoryOptions
  ): number {
    let score = metadata.importance || 0.5

    if (metadata.type === 'preference') score += 0.2
    if (metadata.type === 'fact') score += 0.15
    if (metadata.entityId) score += 0.1

    const importantKeywords = ['important', 'critical', 'urgent', 'remember', 'always', 'never']
    const lowerContent = content.toLowerCase()
    const keywordMatches = importantKeywords.filter(kw => lowerContent.includes(kw)).length
    score += keywordMatches * 0.05

    return Math.min(Math.max(score, 0), 1)
  }

  async remember(
    content: string,
    options: HybridMemoryOptions = {}
  ): Promise<{ supabaseId?: string, qdrantId?: string }> {
    try {
      const importance = this.calculateImportance(content, options)
      const embedding = await this.generateEmbedding(content)

      const metadata: MemoryMetadata = {
        type: options.type || 'general',
        importance,
        entityId: options.entityId,
        source: options.source,
        timestamp: new Date().toISOString(),
      }

      const result: { supabaseId?: string, qdrantId?: string } = {}

      if (importance >= this.IMPORTANCE_THRESHOLD || options.entityId) {
        const { data, error } = await this.supabase
          .from('semantic_memories')
          .insert({
            content,
            embedding: `[${embedding.join(',')}]`,
            importance,
            memory_type: metadata.type,
            entity_id: metadata.entityId,
            metadata: metadata as any,
          })
          .select('id')
          .single()

        if (error) {
          console.error('Error saving to Supabase:', error)
        } else {
          result.supabaseId = data.id
          console.log(`✅ Saved to Supabase: ${data.id}`)
        }
      }

      const qdrantId = await this.qdrant.save(content, metadata)
      result.qdrantId = qdrantId

      return result
    } catch (error) {
      console.error('Error in hybrid remember:', error)
      throw new Error('Failed to save memory')
    }
  }

  async search(
    query: string,
    options: HybridSearchOptions = {}
  ): Promise<MemoryPoint[]> {
    const {
      limit = 10,
      minSimilarity = 0.7,
      searchSupabase = true,
      searchQdrant = true,
      filter = {},
    } = options

    try {
      const results: MemoryPoint[] = []

      if (searchSupabase) {
        const supabaseResults = await this.searchSupabase(query, {
          limit: Math.ceil(limit / 2),
          minSimilarity,
          filter,
        })
        results.push(...supabaseResults)
      }

      if (searchQdrant) {
        const qdrantResults = await this.qdrant.search(query, {
          limit: Math.ceil(limit / 2),
          minSimilarity,
          filter,
        })
        results.push(...qdrantResults)
      }

      const uniqueResults = this.mergeResults(results)

      uniqueResults.sort((a, b) => {
        const scoreA = (a.similarity || 0) * (a.metadata?.importance || 0.5)
        const scoreB = (b.similarity || 0) * (b.metadata?.importance || 0.5)
        return scoreB - scoreA
      })

      return uniqueResults.slice(0, limit)
    } catch (error) {
      console.error('Error in hybrid search:', error)
      return []
    }
  }

  private async searchSupabase(
    query: string,
    options: {
      limit: number
      minSimilarity: number
      filter: any
    }
  ): Promise<MemoryPoint[]> {
    try {
      const embedding = await this.generateEmbedding(query)

      const { data, error } = await this.supabase.rpc('search_semantic_memories', {
        query_embedding: `[${embedding.join(',')}]`,
        match_count: options.limit,
        min_similarity: options.minSimilarity,
        filter_type: options.filter.type || null,
      })

      if (error) {
        console.error('Error searching Supabase:', error)
        return []
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        content: row.content,
        metadata: {
          type: row.memory_type,
          ...row.metadata,
        },
        similarity: row.similarity,
      }))
    } catch (error) {
      console.error('Error in searchSupabase:', error)
      return []
    }
  }

  private mergeResults(results: MemoryPoint[]): MemoryPoint[] {
    const seen = new Set<string>()
    const merged: MemoryPoint[] = []

    for (const result of results) {
      const contentHash = this.hashContent(result.content)
      
      if (!seen.has(contentHash)) {
        seen.add(contentHash)
        merged.push(result)
      }
    }

    return merged
  }

  private hashContent(content: string): string {
    return content.substring(0, 100).toLowerCase().trim()
  }

  async getRecent(days: number = 7, limit: number = 20): Promise<MemoryPoint[]> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)

      const { data, error } = await this.supabase
        .from('semantic_memories')
        .select('*')
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Error getting recent memories:', error)
        return []
      }

      return (data || []).map(row => ({
        id: row.id,
        content: row.content,
        metadata: {
          type: row.memory_type,
          importance: row.importance,
          entityId: row.entity_id,
          ...row.metadata,
        },
      }))
    } catch (error) {
      console.error('Error in getRecent:', error)
      return []
    }
  }

  async getByEntity(entityId: string, limit: number = 50): Promise<MemoryPoint[]> {
    try {
      const [supabaseResults, qdrantResults] = await Promise.all([
        this.supabase
          .from('semantic_memories')
          .select('*')
          .eq('entity_id', entityId)
          .order('created_at', { ascending: false })
          .limit(limit),
        this.qdrant.getByEntity(entityId, limit),
      ])

      const supabaseMemories = (supabaseResults.data || []).map(row => ({
        id: row.id,
        content: row.content,
        metadata: {
          type: row.memory_type,
          importance: row.importance,
          entityId: row.entity_id,
          ...row.metadata,
        },
      }))

      const allResults = [...supabaseMemories, ...qdrantResults]
      return this.mergeResults(allResults).slice(0, limit)
    } catch (error) {
      console.error('Error in getByEntity:', error)
      return []
    }
  }

  async getStats(): Promise<{
    supabase: { count: number }
    qdrant: { totalMemories: number, status: string }
    total: number
  }> {
    try {
      const [supabaseCount, qdrantStats] = await Promise.all([
        this.supabase
          .from('semantic_memories')
          .select('*', { count: 'exact', head: true }),
        this.qdrant.getStats(),
      ])

      return {
        supabase: { count: supabaseCount.count || 0 },
        qdrant: qdrantStats,
        total: (supabaseCount.count || 0) + qdrantStats.totalMemories,
      }
    } catch (error) {
      console.error('Error getting stats:', error)
      return {
        supabase: { count: 0 },
        qdrant: { totalMemories: 0, status: 'error' },
        total: 0,
      }
    }
  }
}

let hybridMemory: HybridMemory | null = null

export function getHybridMemory(): HybridMemory {
  if (!hybridMemory) {
    hybridMemory = new HybridMemory()
  }
  return hybridMemory
}