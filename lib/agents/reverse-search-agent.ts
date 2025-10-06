/**
 * 🔍 Reverse Search Agent
 * 
 * מחפש מיילים חדשים עבור חובות/משימות קיימים
 * על בסיס מספרי תיק, סכומים, שמות חברות
 */

import { supabaseAdmin } from '@/lib/supabase';
import { DB_SCHEMA } from '@/lib/config/schema';
import { GmailAccount, fetchRecentEmails } from '@/lib/gmail/scanner';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface SearchTarget {
  id: string;
  type: 'debt' | 'task' | 'bureaucracy' | 'client';
  name: string;
  case_numbers?: string[];
  amounts?: number[];
  companies?: string[];
  keywords?: string[];
  last_checked?: string;
}

export interface ReverseSearchResult {
  target: SearchTarget;
  found_emails: number;
  new_updates: number;
  search_queries: string[];
  emails: Array<{
    id: string;
    subject: string;
    from: string;
    relevance_score: number;
    match_reasons: string[];
  }>;
}

/**
 * 🔍 Reverse Search - Find new emails for existing entities
 */
export async function performReverseSearch(
  userId: string = 'michal',
  maxResults: number = 100
): Promise<ReverseSearchResult[]> {
  console.log('🔍 Starting reverse search for existing entities...');

  // Get all active debts, tasks, and bureaucracy
  const targets = await getActiveSearchTargets();
  
  if (targets.length === 0) {
    console.log('⚠️ No active targets found for reverse search');
    return [];
  }

  // Get Gmail accounts
  const { data: accounts } = await supabaseAdmin
    .from(DB_SCHEMA.gmail_accounts.table)
    .select('*')
    .eq('user_id', userId);

  if (!accounts || accounts.length === 0) {
    console.log('⚠️ No Gmail accounts found');
    return [];
  }

  const results: ReverseSearchResult[] = [];

  for (const target of targets) {
    console.log(`🔍 Searching for updates on: ${target.name} (${target.type})`);
    
    const result = await searchForTargetUpdates(target, accounts, maxResults);
    results.push(result);
  }

  return results;
}

/**
 * Get all active search targets (debts, tasks, bureaucracy)
 */
async function getActiveSearchTargets(): Promise<SearchTarget[]> {
  const targets: SearchTarget[] = [];

  // Get active debts
  const { data: debts } = await supabaseAdmin
    .from(DB_SCHEMA.debts.table)
    .select('id, original_company, collection_company, amount, case_number, status')
    .eq('status', 'active');

  if (debts) {
    for (const debt of debts) {
      const target: SearchTarget = {
        id: debt.id,
        type: 'debt',
        name: debt.original_company,
        companies: [debt.original_company, debt.collection_company].filter(Boolean),
        amounts: [debt.amount],
        keywords: [
          debt.original_company,
          debt.collection_company,
          'חוב', 'debt', 'inkasso', 'collection',
          'תשלום', 'payment', 'חשבון', 'invoice'
        ].filter(Boolean)
      };

      if (debt.case_number) {
        target.case_numbers = [debt.case_number];
        target.keywords?.push(debt.case_number);
      }

      targets.push(target);
    }
  }

  // Get active bureaucracy
  const { data: bureaucracy } = await supabaseAdmin
    .from(DB_SCHEMA.bureaucracy.table)
    .select('id, title, agency, status')
    .eq('status', 'pending');

  if (bureaucracy) {
    for (const bureau of bureaucracy) {
      targets.push({
        id: bureau.id,
        type: 'bureaucracy',
        name: bureau.title,
        companies: [bureau.agency],
        keywords: [
          bureau.title,
          bureau.agency,
          'ביורוקרטיה', 'bureaucracy', 'משרד', 'office',
          'בקשה', 'application', 'מסמך', 'document'
        ].filter(Boolean)
      });
    }
  }

  // Get active tasks
  const { data: tasks } = await supabaseAdmin
    .from(DB_SCHEMA.tasks.table)
    .select('id, title, description, status')
    .eq('status', 'pending');

  if (tasks) {
    for (const task of tasks) {
      targets.push({
        id: task.id,
        type: 'task',
        name: task.title,
        keywords: [
          task.title,
          task.description,
          'משימה', 'task', 'עדכון', 'update'
        ].filter(Boolean)
      });
    }
  }

  return targets;
}

/**
 * Search for updates for a specific target
 */
async function searchForTargetUpdates(
  target: SearchTarget,
  accounts: GmailAccount[],
  maxResults: number
): Promise<ReverseSearchResult> {
  const result: ReverseSearchResult = {
    target,
    found_emails: 0,
    new_updates: 0,
    search_queries: [],
    emails: []
  };

  // Generate smart search queries
  const searchQueries = generateSearchQueries(target);
  result.search_queries = searchQueries;

  for (const account of accounts) {
    for (const query of searchQueries) {
      try {
        console.log(`📧 Searching account ${account.email} with query: ${query}`);
        
        const emails = await fetchRecentEmails(account, {
          maxResults: Math.floor(maxResults / searchQueries.length),
          timeRange: 'month',
          includeRead: true,
          query: query
        });

        result.found_emails += emails.length;

        // Analyze each email for relevance to this target
        for (const email of emails) {
          const relevance = await analyzeEmailRelevance(email, target);
          
          if (relevance.score > 0.7) {
            result.emails.push({
              id: email.id,
              subject: email.subject,
              from: email.from,
              relevance_score: relevance.score,
              match_reasons: relevance.reasons
            });
            
            result.new_updates++;
          }
        }

      } catch (error) {
        console.error(`❌ Error searching account ${account.email}:`, error);
      }
    }
  }

  return result;
}

/**
 * Generate smart search queries for a target
 */
function generateSearchQueries(target: SearchTarget): string[] {
  const queries: string[] = [];

  // Company name queries
  if (target.companies) {
    for (const company of target.companies) {
      if (company && company.length > 3) {
        queries.push(`"${company}"`);
        queries.push(`from:${company.toLowerCase().replace(/\s+/g, '')}`);
      }
    }
  }

  // Case number queries
  if (target.case_numbers) {
    for (const caseNum of target.case_numbers) {
      queries.push(`"${caseNum}"`);
      queries.push(`subject:${caseNum}`);
    }
  }

  // Amount queries (if specific amounts)
  if (target.amounts) {
    for (const amount of target.amounts) {
      queries.push(`${amount}€`);
      queries.push(`${amount} EUR`);
    }
  }

  // Keyword combinations
  if (target.keywords) {
    const importantKeywords = target.keywords.filter(k => 
      k && k.length > 3 && !['חוב', 'debt', 'תשלום', 'payment'].includes(k)
    );
    
    if (importantKeywords.length > 0) {
      queries.push(`"${importantKeywords[0]}"`);
    }
  }

  return queries.slice(0, 5); // Limit to 5 queries per target
}

/**
 * Analyze email relevance to a specific target
 */
async function analyzeEmailRelevance(
  email: any,
  target: SearchTarget
): Promise<{ score: number; reasons: string[] }> {
  const reasons: string[] = [];
  let score = 0;

  // Company name match
  if (target.companies) {
    for (const company of target.companies) {
      if (company && (
        email.subject.toLowerCase().includes(company.toLowerCase()) ||
        email.from.toLowerCase().includes(company.toLowerCase()) ||
        email.body.toLowerCase().includes(company.toLowerCase())
      )) {
        score += 0.4;
        reasons.push(`Company name match: ${company}`);
      }
    }
  }

  // Case number match
  if (target.case_numbers) {
    for (const caseNum of target.case_numbers) {
      if (email.subject.includes(caseNum) || email.body.includes(caseNum)) {
        score += 0.5;
        reasons.push(`Case number match: ${caseNum}`);
      }
    }
  }

  // Amount match
  if (target.amounts) {
    for (const amount of target.amounts) {
      const amountStr = amount.toString();
      if (email.subject.includes(amountStr) || email.body.includes(amountStr)) {
        score += 0.3;
        reasons.push(`Amount match: ${amount}€`);
      }
    }
  }

  // Keyword match
  if (target.keywords) {
    for (const keyword of target.keywords) {
      if (keyword && keyword.length > 3) {
        if (email.subject.toLowerCase().includes(keyword.toLowerCase()) ||
            email.body.toLowerCase().includes(keyword.toLowerCase())) {
          score += 0.1;
          reasons.push(`Keyword match: ${keyword}`);
        }
      }
    }
  }

  return { score: Math.min(score, 1.0), reasons };
}

/**
 * Save reverse search results to database
 */
export async function saveReverseSearchResults(results: ReverseSearchResult[]): Promise<void> {
  for (const result of results) {
    if (result.new_updates > 0) {
      // Save to agent_memories for future reference
      await supabaseAdmin
        .from(DB_SCHEMA.agent_memories.table)
        .insert({
          user_id: 'michal',
          memory_type: 'reverse_search_result',
          title: `Reverse search: ${result.target.name}`,
          content: `Found ${result.new_updates} new emails for ${result.target.name}`,
          data: {
            target: result.target,
            search_queries: result.search_queries,
            emails_found: result.emails.length,
            new_updates: result.new_updates
          },
          importance: result.new_updates > 0 ? 0.8 : 0.3,
          tags: ['reverse_search', result.target.type, 'automated']
        });
    }
  }
}
