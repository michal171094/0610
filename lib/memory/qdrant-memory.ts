/**
 * Qdrant Memory Client
 * 
 * Manages long-term memory storage in Qdrant Cloud.
 * Handles millions of memories with fast semantic search.
 */

import { QdrantClient } from '@qdrant/js-client-rest'
import OpenAI from 'openai'
import { randomUUID } from 'crypto'

// Types
export interface MemoryMetadata {
  type?: 'conversation' | 'fact' | 'preference' | 'task' | 'general'
  importance?: number
  entityId?: string
  source?: string
  timestamp?: string
  [key: string]: any
}

export interface MemoryPoint {
  id: string
  content: string
  metadata: MemoryMetadata
  similarity?: number
}

export interface SearchOptions {
  limit?: number
  minSimilarity?: number
  filter?: {
    type?: string
    entityId?: string
    importance?: { gte?: number, lte?: number }
  }
}

export class QdrantMemory {
  private client: QdrantClient
  private openai: OpenAI
  private collectionName: string
  private embeddingModel: string

  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL!,
      apiKey: process.env.QDRANT_API_KEY!,
    })

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    })

    this.collectionName = process.env.QDRANT_COLLECTION_NAME || 'michal_memories'
    this.embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
  }

  async initialize(): Promise<void> {
    try {
      const collections = await this.client.getCollections()
      const exists = collections.collections.some(
        (c: any) => c.name === this.collectionName
      )

      if (!exists) {
        console.log(`Creating Qdrant collection: ${this.collectionName}`)
        
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 1536,
            distance: 'Cosine',
          },
        })

        console.log('✅ Qdrant collection created')
      } else {
        console.log('✅ Qdrant collection already exists')
      }
    } catch (error) {
      console.error('Error initializing Qdrant:', error)
      throw new Error('Failed to initialize Qdrant memory system')
    }
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

  async save(
    content: string,
    metadata: MemoryMetadata = {}
  ): Promise<string> {
    try {
      const embedding = await this.generateEmbedding(content)
  const id = randomUUID()

      const payload = {
        content,
        type: metadata.type || 'general',
        importance: metadata.importance || 0.5,
        entityId: metadata.entityId,
        source: metadata.source,
        timestamp: metadata.timestamp || new Date().toISOString(),
        ...metadata,
      }

      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id,
            vector: embedding,
            payload,
          },
        ],
      })

      console.log(`✅ Memory saved to Qdrant: ${id}`)
      return id
    } catch (error) {
      console.error('Error saving to Qdrant:', error)
      throw new Error('Failed to save memory')
    }
  }

  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<MemoryPoint[]> {
    try {
      const {
        limit = 10,
        minSimilarity = 0.7,
        filter = {},
      } = options

      const queryEmbedding = await this.generateEmbedding(query)
      const qdrantFilter: any = { must: [] }

      if (filter.type) {
        qdrantFilter.must.push({
          key: 'type',
          match: { value: filter.type },
        })
      }

      if (filter.entityId) {
        qdrantFilter.must.push({
          key: 'entityId',
          match: { value: filter.entityId },
        })
      }

      const searchResult = await this.client.search(this.collectionName, {
        vector: queryEmbedding,
        limit,
        score_threshold: minSimilarity,
        filter: qdrantFilter.must.length > 0 ? qdrantFilter : undefined,
        with_payload: true,
      })

      return searchResult.map((result: any) => ({
        id: result.id.toString(),
        content: (result.payload?.content as string) || '',
        metadata: result.payload as MemoryMetadata,
        similarity: result.score,
      }))
    } catch (error) {
      console.error('Error searching Qdrant:', error)
      throw new Error('Failed to search memories')
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: [id],
      })

      console.log(`✅ Memory deleted from Qdrant: ${id}`)
    } catch (error) {
      console.error('Error deleting from Qdrant:', error)
      throw new Error('Failed to delete memory')
    }
  }

  async getStats(): Promise<{
    totalMemories: number
    collectionStatus: string
  }> {
    try {
      const collectionInfo = await this.client.getCollection(this.collectionName)
      
      return {
        totalMemories: collectionInfo.points_count || 0,
        collectionStatus: collectionInfo.status,
      }
    } catch (error) {
      console.error('Error getting Qdrant stats:', error)
      return {
        totalMemories: 0,
        collectionStatus: 'error',
      }
    }
  }
}

let qdrantMemory: QdrantMemory | null = null

export function getQdrantMemory(): QdrantMemory {
  if (!qdrantMemory) {
    qdrantMemory = new QdrantMemory()
  }
  return qdrantMemory
}