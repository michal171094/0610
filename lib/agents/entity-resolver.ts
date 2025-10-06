/**
 * Entity Resolver
 * 
 * Identifies entities (clients, debts, tasks) mentioned in text:
 * - By exact name match
 * - By fuzzy match (similar names)
 * - By context clues
 * 
 * Used by Sync Agent to connect emails to existing records
 */

import { supabase } from '@/lib/supabase'

export interface ResolvedEntity {
  id: string
  type: 'client' | 'debt' | 'task' | 'bureaucracy'
  name: string
  confidence: number // 0-1
  match_type: 'exact' | 'fuzzy' | 'context'
}

export interface ResolutionResult {
  clients: ResolvedEntity[]
  debts: ResolvedEntity[]
  tasks: ResolvedEntity[]
  bureaucracy: ResolvedEntity[]
  new_entities: { name: string; email?: string; type: string }[]
}

export class EntityResolver {
  private supabase = supabase

  /**
   * Main resolution function
   */
  async resolve(text: string): Promise<ResolutionResult> {
    const result: ResolutionResult = {
      clients: [],
      debts: [],
      tasks: [],
      bureaucracy: [],
      new_entities: [],
    }

    // 1. Extract potential entity names from text
    const potentialNames = this.extractNames(text)
    const potentialEmails = this.extractEmails(text)

    // 2. Resolve each name
    for (const name of potentialNames) {
      const resolved = await this.resolveEntityByName(name)
      
      resolved.clients.forEach(c => result.clients.push(c))
      resolved.debts.forEach(d => result.debts.push(d))
      resolved.tasks.forEach(t => result.tasks.push(t))
      resolved.bureaucracy.forEach(b => result.bureaucracy.push(b))
    }

    // 3. Check for new entities
    for (const name of potentialNames) {
      const isKnown = 
        result.clients.some(c => c.name.toLowerCase() === name.toLowerCase()) ||
        result.debts.some(d => d.name.toLowerCase() === name.toLowerCase())

      if (!isKnown && name.length > 3) {
        const email = potentialEmails.find(e => 
          e.toLowerCase().includes(name.toLowerCase())
        )

        result.new_entities.push({
          name,
          email,
          type: 'potential_client',
        })
      }
    }

    return result
  }

  /**
   * Resolve entity by name
   */
  private async resolveEntityByName(name: string): Promise<{
    clients: ResolvedEntity[]
    debts: ResolvedEntity[]
    tasks: ResolvedEntity[]
    bureaucracy: ResolvedEntity[]
  }> {
    const result = {
      clients: [] as ResolvedEntity[],
      debts: [] as ResolvedEntity[],
      tasks: [] as ResolvedEntity[],
      bureaucracy: [] as ResolvedEntity[],
    }

    // Search clients
    const clients = await this.searchClients(name)
    result.clients = clients

    // Search debts
    const debts = await this.searchDebts(name)
    result.debts = debts

    // Search tasks
    const tasks = await this.searchTasks(name)
    result.tasks = tasks

    // Search bureaucracy
    const bureaucracy = await this.searchBureaucracy(name)
    result.bureaucracy = bureaucracy

    return result
  }

  /**
   * Search clients by name
   */
  private async searchClients(name: string): Promise<ResolvedEntity[]> {
    const resolved: ResolvedEntity[] = []

    // Exact match
    const { data: exact } = await this.supabase
      .from('clients')
      .select('*')
      .ilike('name', name)

    if (exact && exact.length > 0) {
      exact.forEach(client => {
        resolved.push({
          id: client.id,
          type: 'client',
          name: client.name,
          confidence: 1.0,
          match_type: 'exact',
        })
      })
      return resolved
    }

    // Fuzzy match
    const { data: fuzzy } = await this.supabase
      .from('clients')
      .select('*')
      .ilike('name', `%${name}%`)

    if (fuzzy && fuzzy.length > 0) {
      fuzzy.forEach(client => {
        const similarity = this.calculateSimilarity(name, client.name)
        if (similarity > 0.6) {
          resolved.push({
            id: client.id,
            type: 'client',
            name: client.name,
            confidence: similarity,
            match_type: 'fuzzy',
          })
        }
      })
    }

    return resolved
  }

  /**
   * Search debts by entity name
   */
  private async searchDebts(name: string): Promise<ResolvedEntity[]> {
    const resolved: ResolvedEntity[] = []

    // Exact match
    const { data: exact } = await this.supabase
      .from('debts')
      .select('*')
      .ilike('entity_name', name)

    if (exact && exact.length > 0) {
      exact.forEach(debt => {
        resolved.push({
          id: debt.id,
          type: 'debt',
          name: debt.entity_name,
          confidence: 1.0,
          match_type: 'exact',
        })
      })
      return resolved
    }

    // Fuzzy match
    const { data: fuzzy } = await this.supabase
      .from('debts')
      .select('*')
      .ilike('entity_name', `%${name}%`)

    if (fuzzy && fuzzy.length > 0) {
      fuzzy.forEach(debt => {
        const similarity = this.calculateSimilarity(name, debt.entity_name)
        if (similarity > 0.6) {
          resolved.push({
            id: debt.id,
            type: 'debt',
            name: debt.entity_name,
            confidence: similarity,
            match_type: 'fuzzy',
          })
        }
      })
    }

    return resolved
  }

  /**
   * Search tasks by title
   */
  private async searchTasks(name: string): Promise<ResolvedEntity[]> {
    const resolved: ResolvedEntity[] = []

    const { data: tasks } = await this.supabase
      .from('unified_dashboard')
      .select('*')
      .ilike('title', `%${name}%`)
      .limit(5)

    if (tasks && tasks.length > 0) {
      tasks.forEach(task => {
        const similarity = this.calculateSimilarity(name, task.title)
        if (similarity > 0.5) {
          resolved.push({
            id: task.id,
            type: 'task',
            name: task.title,
            confidence: similarity,
            match_type: 'fuzzy',
          })
        }
      })
    }

    return resolved
  }

  /**
   * Search bureaucracy by entity name
   */
  private async searchBureaucracy(name: string): Promise<ResolvedEntity[]> {
    const resolved: ResolvedEntity[] = []

    const { data: items } = await this.supabase
      .from('bureaucracy')
      .select('*')
      .ilike('entity_name', `%${name}%`)

    if (items && items.length > 0) {
      items.forEach(item => {
        const similarity = this.calculateSimilarity(name, item.entity_name)
        if (similarity > 0.6) {
          resolved.push({
            id: item.id,
            type: 'bureaucracy',
            name: item.entity_name,
            confidence: similarity,
            match_type: 'fuzzy',
          })
        }
      })
    }

    return resolved
  }

  /**
   * Extract potential names from text
   */
  private extractNames(text: string): string[] {
    const names: string[] = []

    // Simple heuristic: capitalized words
    const words = text.split(/\s+/)
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^a-zA-Z]/g, '')
      
      // Skip if too short
      if (word.length < 3) continue

      // Check if capitalized
      if (word[0] === word[0].toUpperCase()) {
        // Check for multi-word names
        let name = word
        
        // Look ahead for more capitalized words
        if (i < words.length - 1) {
          const nextWord = words[i + 1].replace(/[^a-zA-Z]/g, '')
          if (nextWord[0] === nextWord[0].toUpperCase() && nextWord.length > 2) {
            name = `${word} ${nextWord}`
            i++ // Skip next word
          }
        }

        names.push(name)
      }
    }

    // Remove duplicates
    const unique: string[] = [];
    const seen: Record<string, boolean> = {};
    for (const name of names) {
      if (!seen[name]) {
        seen[name] = true;
        unique.push(name);
      }
    }
    return unique;
  }

  /**
   * Extract emails from text
   */
  private extractEmails(text: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    return text.match(emailRegex) || []
  }

  /**
   * Calculate string similarity (simple Levenshtein-based)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase()
    const s2 = str2.toLowerCase()

    // Exact match
    if (s1 === s2) return 1.0

    // Contains
    if (s2.includes(s1) || s1.includes(s2)) return 0.8

    // Levenshtein distance
    const longer = s1.length > s2.length ? s1 : s2
    const shorter = s1.length > s2.length ? s2 : s1
    
    const editDistance = this.levenshteinDistance(s1, s2)
    const maxLength = longer.length

    if (maxLength === 0) return 1.0

    return 1.0 - editDistance / maxLength
  }

  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }
}

// Singleton
let entityResolver: EntityResolver | null = null

export function getEntityResolver(): EntityResolver {
  if (!entityResolver) {
    entityResolver = new EntityResolver()
  }
  return entityResolver
}

export default EntityResolver