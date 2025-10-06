/**
 * Entity Resolver
 * 
 * Identifies entities (clients, debts, tasks) mentioned in text:
 * - By exact name match
 * - By fuzzy match (similar names)
 * - By context clues
 * - By cross-domain analysis (e.g., Norway benefit → Kazakhstan insurance)
 * 
 * Used by Sync Agent to connect emails to existing records
 */

import { supabase } from '@/lib/supabase'
import { DB_SCHEMA } from '@/lib/config/schema'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

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
   * Main resolution function - enhanced with cross-domain analysis
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

    // 2. AI-powered entity resolution
    try {
      const aiAnalysis = await this.analyzeWithAI(text)
      
      // Process AI suggestions
      for (const suggestion of aiAnalysis.entitySuggestions) {
        const resolved = await this.resolveEntityBySuggestion(suggestion)
        if (resolved) {
          switch (suggestion.type) {
            case 'client':
              result.clients.push(resolved)
              break
            case 'debt':
              result.debts.push(resolved)
              break
            case 'task':
              result.tasks.push(resolved)
              break
            case 'bureaucracy':
              result.bureaucracy.push(resolved)
              break
          }
        } else {
          // New entity
          result.new_entities.push({
            name: suggestion.name,
            email: suggestion.email,
            type: suggestion.type,
          })
        }
      }

      // Cross-domain analysis
      const crossDomainEntities = await this.findCrossDomainConnectionsWithAI(text, result)
      result.clients.push(...crossDomainEntities.clients)
      result.debts.push(...crossDomainEntities.debts)
      result.tasks.push(...crossDomainEntities.tasks)
      result.bureaucracy.push(...crossDomainEntities.bureaucracy)

      // Semantic search
      const semanticMatches = await this.findSemanticMatches(text)
      result.clients.push(...semanticMatches.clients)
      result.debts.push(...semanticMatches.debts)
      result.tasks.push(...semanticMatches.tasks)
      result.bureaucracy.push(...semanticMatches.bureaucracy)

    } catch (error) {
      console.error('AI resolution failed, falling back to basic:', error)
      
      // Fallback to basic resolution
      for (const name of potentialNames) {
        const resolved = await this.resolveEntityByName(name)
        
        resolved.clients.forEach(c => result.clients.push(c))
        resolved.debts.forEach(d => result.debts.push(d))
        resolved.tasks.forEach(t => result.tasks.push(t))
        resolved.bureaucracy.forEach(b => result.bureaucracy.push(b))
      }
    }

    // 3. Remove duplicates (AI already handled cross-domain analysis)
    result.clients = this.removeDuplicates(result.clients)
    result.debts = this.removeDuplicates(result.debts)
    result.tasks = this.removeDuplicates(result.tasks)
    result.bureaucracy = this.removeDuplicates(result.bureaucracy)

    // 4. Check for new entities
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

  /**
   * Find cross-domain connections between entities
   * Example: Norway benefit → Kazakhstan insurance
   */
  private async findCrossDomainConnections(
    text: string, 
    existingEntities: ResolutionResult
  ): Promise<{
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

    // Cross-domain patterns
    const patterns = [
      {
        keywords: ['נורבגיה', 'קצבה', 'הפסיקה'],
        connectionType: 'bureaucracy',
        searchTerms: ['ביטוח לאומי', 'קזחסטן', 'קצבה'],
        description: 'קצבה בנורבגיה הפסיקה - בדוק השפעה על ביטוח לאומי בקזחסטן'
      },
      {
        keywords: ['חוב', 'הסדר', 'תשלום'],
        connectionType: 'debt',
        searchTerms: ['ביטוח לאומי', 'זכאות', 'קצבה'],
        description: 'הסדר חוב - בדוק השפעה על זכאות לקצבאות'
      },
      {
        keywords: ['לקוח', 'פרויקט', 'השלמה'],
        connectionType: 'client',
        searchTerms: ['תשלום', 'חוב', 'חיוב'],
        description: 'השלמת פרויקט - בדוק השפעה על תשלומים וחובות'
      }
    ]

    // Check for cross-domain patterns
    for (const pattern of patterns) {
      const hasKeywords = pattern.keywords.some(keyword => text.includes(keyword))
      
      if (hasKeywords) {
        // Search for related entities using the pattern's search terms
        for (const searchTerm of pattern.searchTerms) {
          const relatedEntities = await this.searchEntitiesByKeyword(searchTerm, pattern.connectionType)
          
          relatedEntities.forEach(entity => {
            // Add cross-domain connection
            const crossDomainEntity: ResolvedEntity = {
              id: entity.id,
              type: entity.type as any,
              name: `${entity.name} (קשר: ${pattern.description})`,
              confidence: 0.7, // High confidence for cross-domain connections
              match_type: 'context'
            }

            switch (pattern.connectionType) {
              case 'bureaucracy':
                result.bureaucracy.push(crossDomainEntity)
                break
              case 'debt':
                result.debts.push(crossDomainEntity)
                break
              case 'client':
                result.clients.push(crossDomainEntity)
                break
            }
          })
        }
      }
    }

    return result
  }

  /**
   * Search entities by keyword across all tables
   */
  private async searchEntitiesByKeyword(keyword: string, type: string): Promise<any[]> {
    const results: any[] = []

    try {
      // Search in relevant tables based on type
      if (type === 'bureaucracy' || type === 'all') {
        const { data: bureaucracy } = await supabase
          .from(DB_SCHEMA.bureaucracy.table)
          .select('*')
          .or(`title.ilike.%${keyword}%,agency.ilike.%${keyword}%`)
          .limit(5)

        if (bureaucracy) {
          results.push(...bureaucracy.map(b => ({
            id: b.id,
            name: b.title,
            type: 'bureaucracy'
          })))
        }
      }

      if (type === 'debt' || type === 'all') {
        const { data: debts } = await supabase
          .from(DB_SCHEMA.debts.table)
          .select('*')
          .or(`original_company.ilike.%${keyword}%,collection_company.ilike.%${keyword}%`)
          .limit(5)

        if (debts) {
          results.push(...debts.map(d => ({
            id: d.id,
            name: d.original_company,
            type: 'debt'
          })))
        }
      }

      if (type === 'client' || type === 'all') {
        const { data: clients } = await supabase
          .from(DB_SCHEMA.clients.table)
          .select('*')
          .or(`name.ilike.%${keyword}%,project_type.ilike.%${keyword}%`)
          .limit(5)

        if (clients) {
          results.push(...clients.map(c => ({
            id: c.id,
            name: c.name,
            type: 'client'
          })))
        }
      }

    } catch (error) {
      console.error('Error searching entities by keyword:', error)
    }

    return results
  }

  /**
   * 🧠 AI-powered entity analysis
   */
  private async analyzeWithAI(text: string): Promise<{
    entitySuggestions: Array<{
      name: string;
      type: 'client' | 'debt' | 'task' | 'bureaucracy';
      confidence: number;
      email?: string;
      context?: string;
    }>;
    crossDomainConnections: Array<{
      source: string;
      target: string;
      relationship: string;
      confidence: number;
    }>;
  }> {
    try {
      const prompt = `Analyze this text and identify entities (clients, debts, tasks, bureaucracy) and their relationships:

Text: "${text}"

Return JSON with:
{
  "entitySuggestions": [
    {
      "name": "entity name",
      "type": "client|debt|task|bureaucracy",
      "confidence": 0.0-1.0,
      "email": "email if found",
      "context": "relevant context"
    }
  ],
  "crossDomainConnections": [
    {
      "source": "source entity",
      "target": "target entity", 
      "relationship": "how they're connected",
      "confidence": 0.0-1.0
    }
  ]
}

Look for:
- Company names, people names
- Debt amounts, case numbers, account numbers
- Task descriptions, deadlines, priorities
- Government agencies, forms, procedures
- Cross-domain connections (e.g., Norway benefit → Kazakhstan insurance)`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      return JSON.parse(response.choices[0].message.content || '{"entitySuggestions":[],"crossDomainConnections":[]}');
    } catch (error) {
      console.error('AI analysis error:', error);
      return { entitySuggestions: [], crossDomainConnections: [] };
    }
  }

  /**
   * 🔍 Resolve entity by AI suggestion
   */
  private async resolveEntityBySuggestion(suggestion: any): Promise<ResolvedEntity | null> {
    try {
      // Try exact match first
      const exactMatches = await this.resolveByName(suggestion.name, 'exact');
      
      // Check all entity types
      const allMatches = [
        ...exactMatches.clients,
        ...exactMatches.debts,
        ...exactMatches.tasks,
        ...exactMatches.bureaucracy
      ];

      if (allMatches.length > 0) {
        // Return the best match
        return allMatches.sort((a, b) => b.confidence - a.confidence)[0];
      }

      // Try fuzzy match
      const fuzzyMatches = await this.resolveByName(suggestion.name, 'fuzzy');
      const allFuzzyMatches = [
        ...fuzzyMatches.clients,
        ...fuzzyMatches.debts,
        ...fuzzyMatches.tasks,
        ...fuzzyMatches.bureaucracy
      ];

      if (allFuzzyMatches.length > 0) {
        return allFuzzyMatches.sort((a, b) => b.confidence - a.confidence)[0];
      }

      return null;
    } catch (error) {
      console.error('Error resolving entity by suggestion:', error);
      return null;
    }
  }

  /**
   * 🌐 Cross-domain analysis with AI
   */
  private async findCrossDomainConnectionsWithAI(
    text: string,
    existingEntities: ResolutionResult
  ): Promise<{
    clients: ResolvedEntity[];
    debts: ResolvedEntity[];
    tasks: ResolvedEntity[];
    bureaucracy: ResolvedEntity[];
  }> {
    const result = {
      clients: [] as ResolvedEntity[],
      debts: [] as ResolvedEntity[],
      tasks: [] as ResolvedEntity[],
      bureaucracy: [] as ResolvedEntity[]
    };

    try {
      // Look for cross-domain patterns
      const patterns = [
        {
          keywords: ['נורבגיה', 'קצבה', 'הפסיקה'],
          action: 'בדוק ביטוח לאומי קזחסטן',
          reason: 'קצבה בנורבגיה הפסיקה - ייתכן שצריך לעדכן ביטוח לאומי בקזחסטן',
          searchQuery: 'Norway social security benefits Kazakhstan national insurance impact'
        },
        {
          keywords: ['גרמניה', 'חוב', 'חיוב'],
          action: 'בדוק השפעה על ביטוח לאומי ישראל',
          reason: 'חוב בגרמניה יכול להשפיע על זכויות ביטוח לאומי',
          searchQuery: 'Germany debt impact Israel national insurance'
        }
      ];

      const allText = `${text} ${existingEntities.clients.map(e => e.name).join(' ')} ${existingEntities.debts.map(e => e.name).join(' ')}`;

      for (const pattern of patterns) {
        const hasKeywords = pattern.keywords.some(keyword => allText.includes(keyword));

        if (hasKeywords) {
          // Create a cross-domain task
          result.tasks.push({
            id: crypto.randomUUID(),
            type: 'task',
            name: pattern.action,
            confidence: 0.8,
            match_type: 'context'
          });

          // Save pattern to memory
          await this.supabase
            .from('agent_memories')
            .insert({
              content: `Cross-domain pattern detected: ${pattern.reason}`,
              memory_type: 'pattern',
              importance: 0.8,
              tags: ['cross-domain', pattern.keywords.join(',')]
            });
        }
      }
    } catch (error) {
      console.error('Error in cross-domain analysis:', error);
    }

    return result;
  }

  /**
   * 🔍 Semantic search for related entities
   */
  private async findSemanticMatches(text: string): Promise<{
    clients: ResolvedEntity[];
    debts: ResolvedEntity[];
    tasks: ResolvedEntity[];
    bureaucracy: ResolvedEntity[];
  }> {
    const result = {
      clients: [] as ResolvedEntity[],
      debts: [] as ResolvedEntity[],
      tasks: [] as ResolvedEntity[],
      bureaucracy: [] as ResolvedEntity[]
    };

    try {
      // Use semantic search to find similar entities
      const { data: semanticMatches } = await this.supabase.rpc('search_semantic_memories', {
        query_embedding: await this.getTextEmbedding(text),
        match_threshold: 0.7,
        match_count: 10,
        p_user_id: 'michal'
      });

      if (semanticMatches) {
        for (const match of semanticMatches) {
          // Try to resolve the matched content
          const resolved = await this.resolveByName(match.content, 'context');
          
          result.clients.push(...resolved.clients);
          result.debts.push(...resolved.debts);
          result.tasks.push(...resolved.tasks);
          result.bureaucracy.push(...resolved.bureaucracy);
        }
      }
    } catch (error) {
      console.error('Error in semantic search:', error);
    }

    return result;
  }

  /**
   * 📝 Get text embedding for semantic search
   */
  private async getTextEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error getting embedding:', error);
      return [];
    }
  }

  /**
   * 🔄 Remove duplicate entities
   */
  private removeDuplicates(entities: ResolvedEntity[]): ResolvedEntity[] {
    const seen = new Set<string>();
    return entities.filter(entity => {
      const key = `${entity.type}-${entity.name.toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
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