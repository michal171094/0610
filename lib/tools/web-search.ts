/**
 * 🌐 Web Search Tool
 * 
 * כלי לחיפוש מידע באינטרנט כדי שהסוכן יוכל לחפש מידע רלוונטי
 * ולשמור תוצאות למאגר המידע
 */

import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabase';
import { DB_SCHEMA } from '@/lib/config/schema';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  relevance_score: number;
  source: string;
}

export interface WebSearchQuery {
  query: string;
  context: string;
  maxResults?: number;
  saveResults?: boolean;
}

export class WebSearchTool {
  private memory = new Map<string, WebSearchResult[]>();

  /**
   * Search the web for relevant information
   */
  async search(query: WebSearchQuery): Promise<WebSearchResult[]> {
    console.log(`🔍 Searching web for: ${query.query}`);

    try {
      // 1. Check if we have cached results
      const cached = this.getCachedResults(query.query);
      if (cached && cached.length > 0) {
        console.log(`📋 Using cached results for: ${query.query}`);
        return cached;
      }

      // 2. Generate search query with context
      const searchQuery = await this.generateSearchQuery(query.query, query.context);
      
      // 3. Simulate web search (in production, use Google Custom Search API or similar)
      const results = await this.simulateWebSearch(searchQuery, query.maxResults || 5);

      // 4. Filter and rank results by relevance
      const filteredResults = await this.filterByRelevance(results, query.context);

      // 5. Save results if requested
      if (query.saveResults) {
        await this.saveSearchResults(query.query, filteredResults, query.context);
      }

      // 6. Cache results
      this.memory.set(query.query, filteredResults);

      console.log(`✅ Found ${filteredResults.length} relevant results`);
      return filteredResults;

    } catch (error) {
      console.error('❌ Web search error:', error);
      return [];
    }
  }

  /**
   * Generate optimized search query using AI
   */
  private async generateSearchQuery(originalQuery: string, context: string): Promise<string> {
    const prompt = `Generate an optimized web search query for finding relevant information.

Original query: "${originalQuery}"
Context: "${context}"

Return a concise, effective search query that would find the most relevant information.
Focus on:
- Key terms and keywords
- Specific entities or organizations
- Relevant timeframes
- Geographic locations if relevant

Examples:
- "Norway social security benefits eligibility requirements"
- "Kazakhstan national insurance benefits application process"
- "debt settlement impact on social security benefits"

Return only the search query, nothing else.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 100,
      });

      return response.choices[0].message.content?.trim() || originalQuery;
    } catch (error) {
      console.error('Error generating search query:', error);
      return originalQuery;
    }
  }

  /**
   * Simulate web search (replace with real API in production)
   */
  private async simulateWebSearch(query: string, maxResults: number): Promise<WebSearchResult[]> {
    // In production, this would call Google Custom Search API, Bing API, etc.
    // For now, we'll simulate with relevant results based on the query
    
    const mockResults: WebSearchResult[] = [];

    // Simulate results based on query keywords
    if (query.toLowerCase().includes('norway') || query.toLowerCase().includes('נורבגיה')) {
      mockResults.push(
        {
          title: 'Norwegian Social Security Benefits - NAV',
          url: 'https://www.nav.no/en/home/benefits-and-services/social-security-benefits',
          snippet: 'Information about Norwegian social security benefits including eligibility requirements, application process, and benefit amounts.',
          relevance_score: 0.9,
          source: 'nav.no'
        },
        {
          title: 'How to Apply for Norwegian Benefits',
          url: 'https://www.nav.no/en/home/benefits-and-services/how-to-apply',
          snippet: 'Step-by-step guide for applying for Norwegian social security benefits, including required documents and deadlines.',
          relevance_score: 0.8,
          source: 'nav.no'
        }
      );
    }

    if (query.toLowerCase().includes('kazakhstan') || query.toLowerCase().includes('קזחסטן')) {
      mockResults.push(
        {
          title: 'Kazakhstan Social Security System',
          url: 'https://www.gov.kz/memleket/entities/mzsr/activities/assurance',
          snippet: 'Overview of Kazakhstan social security system including benefits, eligibility, and application procedures.',
          relevance_score: 0.9,
          source: 'gov.kz'
        },
        {
          title: 'National Insurance Benefits in Kazakhstan',
          url: 'https://www.gov.kz/memleket/entities/mzsr/activities/insurance',
          snippet: 'Information about national insurance benefits and social security contributions in Kazakhstan.',
          relevance_score: 0.8,
          source: 'gov.kz'
        }
      );
    }

    if (query.toLowerCase().includes('debt') || query.toLowerCase().includes('חוב')) {
      mockResults.push(
        {
          title: 'Debt Settlement Impact on Benefits',
          url: 'https://www.consumerfinance.gov/debt-settlement',
          snippet: 'How debt settlement agreements may affect your eligibility for government benefits and social security.',
          relevance_score: 0.7,
          source: 'consumerfinance.gov'
        }
      );
    }

    return mockResults.slice(0, maxResults);
  }

  /**
   * Filter results by relevance using AI
   */
  private async filterByRelevance(
    results: WebSearchResult[], 
    context: string
  ): Promise<WebSearchResult[]> {
    if (results.length === 0) return results;

    const prompt = `Rate the relevance of these search results to the given context.

Context: "${context}"

Results:
${results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}`).join('\n\n')}

For each result, provide a relevance score from 0.0 to 1.0.
Return only a JSON array of numbers, one for each result in order.

Example: [0.9, 0.7, 0.3, 0.8]`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const scores = JSON.parse(response.choices[0].message.content || '[]');
      
      return results
        .map((result, index) => ({
          ...result,
          relevance_score: scores[index] || result.relevance_score
        }))
        .filter(result => result.relevance_score > 0.5)
        .sort((a, b) => b.relevance_score - a.relevance_score);

    } catch (error) {
      console.error('Error filtering results:', error);
      return results.filter(r => r.relevance_score > 0.5);
    }
  }

  /**
   * Save search results to database
   */
  private async saveSearchResults(
    query: string, 
    results: WebSearchResult[], 
    context: string
  ): Promise<void> {
    try {
      const searchRecord = {
        id: crypto.randomUUID(),
        query,
        context,
        results: results.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          relevance_score: r.relevance_score,
          source: r.source
        })),
        created_at: new Date().toISOString(),
        result_count: results.length
      };

      // Save to knowledge base or search history table
      await supabaseAdmin
        .from('knowledge_base')
        .insert({
          id: searchRecord.id,
          title: `חיפוש: ${query}`,
          content: JSON.stringify(searchRecord),
          category: 'web_search',
          source: 'web_search_tool',
          relevance_score: results.length > 0 ? results[0].relevance_score : 0
        });

      console.log(`💾 Saved ${results.length} search results to knowledge base`);

    } catch (error) {
      console.error('Error saving search results:', error);
    }
  }

  /**
   * Get cached results
   */
  private getCachedResults(query: string): WebSearchResult[] | null {
    return this.memory.get(query) || null;
  }

  /**
   * Search for information related to a specific task or context
   */
  async searchForTask(taskTitle: string, taskDescription: string): Promise<WebSearchResult[]> {
    const context = `Task: ${taskTitle}\nDescription: ${taskDescription}`;
    
    return this.search({
      query: `${taskTitle} ${taskDescription}`,
      context,
      maxResults: 5,
      saveResults: true
    });
  }

  /**
   * Search for cross-domain connections
   */
  async searchCrossDomainConnection(
    sourceContext: string, 
    targetDomain: string
  ): Promise<WebSearchResult[]> {
    const query = `${sourceContext} impact on ${targetDomain}`;
    const context = `Cross-domain analysis: ${sourceContext} → ${targetDomain}`;
    
    return this.search({
      query,
      context,
      maxResults: 3,
      saveResults: true
    });
  }
}

// Singleton
let webSearchTool: WebSearchTool | null = null;

export function getWebSearchTool(): WebSearchTool {
  if (!webSearchTool) {
    webSearchTool = new WebSearchTool();
  }
  return webSearchTool;
}

export default WebSearchTool;
