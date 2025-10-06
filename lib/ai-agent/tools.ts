// 🛠️ LangGraph Tools - כלים שהסוכן יכול להשתמש בהם
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { scanAllAccounts } from '@/lib/gmail/scanner';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * 🔍 כלי לחיפוש משימות קיימות
 */
export const searchTasksTool = new DynamicStructuredTool({
  name: 'search_tasks',
  description: 'חיפוש משימות קיימות לפי שם, תחום, או טקסט חופשי. השתמש בזה כדי למצוא משימות דומות או קשורות.',
  schema: z.object({
    query: z.string().describe('טקסט חיפוש - שם לקוח, נושא, או מילת מפתח'),
    domain: z.enum(['Client', 'Debt', 'Bureaucracy', 'Legal', 'Health']).optional().describe('סינון לפי תחום'),
    status: z.enum(['pending', 'in_progress', 'blocked', 'completed']).optional().describe('סינון לפי סטטוס')
  }),
  func: async ({ query, domain, status }) => {
    let queryBuilder = supabaseAdmin
      .from('unified_dashboard')
      .select('*')
      .or(`title.ilike.%${query}%,ai_recommendations.ilike.%${query}%`);

    if (domain) queryBuilder = queryBuilder.eq('domain', domain);
    if (status) queryBuilder = queryBuilder.eq('status', status);

    const { data, error } = await queryBuilder.limit(10);

    if (error) return JSON.stringify({ error: error.message });

    return JSON.stringify({
      found: data?.length || 0,
      tasks: data?.map(t => ({
        id: t.id,
        title: t.title,
        domain: t.domain,
        status: t.status,
        next_action: t.ai_recommendations?.next_action || 'לא מוגדר',
        deadline: t.deadline
      }))
    });
  }
});

/**
 * 💰 כלי לחיפוש חובות
 */
export const searchDebtsTool = new DynamicStructuredTool({
  name: 'search_debts',
  description: 'חיפוש חובות קיימים לפי שם חברה או סכום. השתמש כדי לבדוק אם יש כבר חוב רשום.',
  schema: z.object({
    creditor: z.string().optional().nullable().describe('שם החברה הנושה'),
    min_amount: z.number().optional().nullable().describe('סכום מינימלי'),
    status: z.string().optional().nullable().describe('סטטוס החוב')
  }),
  func: async ({ creditor, min_amount, status }) => {
    let queryBuilder = supabaseAdmin.from('debts').select('*');

    if (creditor) {
      queryBuilder = queryBuilder.or(`original_company.ilike.%${creditor}%,collection_company.ilike.%${creditor}%,collection_agency.ilike.%${creditor}%`);
    }
    if (min_amount) queryBuilder = queryBuilder.gte('amount', min_amount);
    if (status) queryBuilder = queryBuilder.eq('status', status);

    const { data, error } = await queryBuilder.limit(10);

    if (error) return JSON.stringify({ error: error.message });

    return JSON.stringify({
      found: data?.length || 0,
      debts: data?.map(d => ({
        id: d.id,
        creditor: d.original_company,
        collection_company: d.collection_company,
        collection_agency: d.collection_agency,
        amount: d.amount,
        currency: d.currency,
        status: d.status
      }))
    });
  }
});

/**
 * 📧 כלי לסריקת Gmail
 */
export const scanGmailTool = new DynamicStructuredTool({
  name: 'scan_gmail',
  description: 'סריקת מיילים בGmail למציאת עדכונים חדשים. תמיד השתמש בזה אחרי שיוצרים משימה חדשה.',
  schema: z.object({
    timeRange: z.enum(['day', 'week', 'month']).optional().nullable().describe('טווח זמן לסריקה'),
    includeRead: z.boolean().optional().nullable().describe('האם לכלול מיילים שכבר נקראו'),
    specificCompany: z.string().optional().nullable().describe('חיפוש ממוקד לחברה ספציפית')
  }),
  func: async ({ timeRange = 'week', includeRead = false, specificCompany }) => {
    const userId = 'michal-user-id';
    
    const results = await scanAllAccounts(userId, {
      timeRange,
      includeRead,
      showLastEmailPerCompany: true,
      maxResults: 50
    });

    const { data: insights } = await supabaseAdmin
      .from('email_insights')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    return JSON.stringify({
      scanned: true,
      relevant: results.updates?.length || 0,
      totalEmails: results.totalEmails || 0,
      insights: insights?.map(ins => ({
        subject: ins.subject,
        from: ins.from_address,
        relevance: ins.relevance
      })) || []
    });
  }
});

/**
 * ✍️ כלי ליצירת משימה חדשה
 */
export const createTaskTool = new DynamicStructuredTool({
  name: 'create_task',
  description: 'יצירת משימה חדשה במערכת. השתמש בזה כשמזהים פעולה נדרשת ממייל או מבקשה.',
  schema: z.object({
    title: z.string().describe('כותרת המשימה'),
    description: z.string().optional().nullable().describe('תיאור מפורט'),
    domain: z.enum(['Client', 'Debt', 'Bureaucracy', 'Legal', 'Health']).describe('תחום המשימה'),
    deadline: z.string().optional().nullable().describe('תאריך יעד (ISO format)'),
    priority: z.number().optional().nullable().describe('רמת עדיפות 1-10'),
    related_id: z.string().optional().nullable().describe('מזהה של ישות קשורה')
  }),
  func: async ({ title, description, domain, deadline, priority, related_id }) => {
    const { data, error } = await supabaseAdmin
      .from('unified_dashboard')
      .insert({
        title,
        domain,
        deadline,
        priority_score: priority || 50,
        status: 'pending',
        ai_recommendations: { description, next_action: 'לבדוק פרטים נוספים' },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) return JSON.stringify({ error: error.message });

    return JSON.stringify({
      success: true,
      task_id: data.id,
      message: `✅ משימה נוצרה: "${title}"`
    });
  }
});

/**
 * 🔄 כלי לעדכון משימה קיימת
 */
export const updateTaskTool = new DynamicStructuredTool({
  name: 'update_task',
  description: 'עדכון משימה קיימת - שינוי סטטוס, דדליין, או תיאור',
  schema: z.object({
    task_id: z.string().describe('מזהה המשימה'),
    status: z.enum(['pending', 'in_progress', 'blocked', 'completed']).optional().nullable(),
    deadline: z.string().optional().nullable().describe('תאריך יעד חדש'),
    next_action: z.string().optional().nullable().describe('הפעולה הבאה'),
    notes: z.string().optional().nullable().describe('הערות נוספות')
  }),
  func: async ({ task_id, status, deadline, next_action, notes }) => {
    const updates: any = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (deadline) updates.deadline = deadline;
    if (next_action || notes) {
      updates.ai_recommendations = { next_action, notes };
    }

    const { error } = await supabaseAdmin
  .from('unified_dashboard')
      .update(updates)
      .eq('id', task_id);

    if (error) return JSON.stringify({ error: error.message });

    return JSON.stringify({
      success: true,
      message: `✅ משימה עודכנה`
    });
  }
});

/**
 * 🔗 כלי למציאת משימות קשורות
 */
export const findRelatedTasksTool = new DynamicStructuredTool({
  name: 'find_related_tasks',
  description: 'מציאת משימות קשורות לישות מסוימת. שימושי לזיהוי כפילויות או קשרים.',
  schema: z.object({
    entity_name: z.string().describe('שם הישות (לקוח, חברה, נושא)'),
    domain: z.enum(['Client', 'Debt', 'Bureaucracy', 'Legal', 'Health']).optional().nullable().describe('תחום')
  }),
  func: async ({ entity_name, domain }) => {
    let taskQuery = supabaseAdmin
      .from('unified_dashboard')
      .select('*')
      .or(`title.ilike.%${entity_name}%,ai_recommendations.ilike.%${entity_name}%`);

    if (domain) taskQuery = taskQuery.eq('domain', domain);

    const { data, error } = await taskQuery.limit(5);

    if (error) return JSON.stringify({ error: error.message });

    return JSON.stringify({
      found: data?.length || 0,
      tasks: data?.map(t => ({
        id: t.id,
        title: t.title,
        domain: t.domain,
        status: t.status
      })),
      recommendation: data && data.length > 0 ? 
        '⚠️ נמצאו משימות קשורות - בדוק אם זו משימה חדשה או עדכון' :
        '✅ לא נמצאו משימות דומות'
    });
  }
});

/**
 * 📊 כלי לקבלת תמונת מצב כללית
 */
export const getOverviewTool = new DynamicStructuredTool({
  name: 'get_overview',
  description: 'קבלת תמונת מצב כללית של כל המשימות וחובות',
  schema: z.object({
    includeCounts: z.boolean().optional().nullable().describe('האם לכלול ספירות')
  }),
  func: async ({ includeCounts = true }) => {
    const [tasks, debts] = await Promise.all([
  supabaseAdmin.from('unified_dashboard').select('*', { count: 'exact' }),
      supabaseAdmin.from('debts').select('*', { count: 'exact' })
    ]);

    const overview = {
      total_tasks: tasks.count || 0,
      total_debts: debts.count || 0,
      urgent_tasks: tasks.data?.filter(t => t.priority_score > 80).length || 0,
      overdue_tasks: tasks.data?.filter(t => t.deadline && new Date(t.deadline) < new Date()).length || 0,
      active_debts: debts.data?.filter(d => d.status !== 'paid').length || 0,
      total_debt_amount: debts.data?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0
    };

    return JSON.stringify({
      overview,
      summary: `יש לך ${overview.total_tasks} משימות, ${overview.active_debts} חובות פעילים (${overview.total_debt_amount}€)`,
      alerts: overview.overdue_tasks > 0 ?
        [`⚠️ יש ${overview.overdue_tasks} משימות שעברו דדליין!`] : []
    });
  }
});

// יבוא כלי למידה
import { saveInstructionTool, getInstructionsTool, updateInstructionTool } from './learning-tools';

// ייצוא כל הכלים
/**
 * 📁 כלי לסריקת מסמכי Drive
 */
export const scanDriveTool = new DynamicStructuredTool({
  name: 'scan_drive',
  description: 'סריקת מסמכים ב-Google Drive וניתוח עם AI. השתמש בזה כדי למצוא מסמכים רלוונטיים או לנתח מסמכים חדשים.',
  schema: z.object({
    query: z.string().optional().describe('טקסט חיפוש במסמכים'),
    userId: z.string().default('michal').describe('מזהה משתמש'),
    maxFiles: z.number().default(50).describe('מספר מקסימלי של קבצים לסריקה')
  }),
  func: async ({ query, userId, maxFiles }) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/drive/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sinceDays: 7,
          maxFiles,
          includeRead: false
        })
      });

      if (!response.ok) {
        throw new Error(`Drive scan failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        scanned: data.stats?.totalScanned || 0,
        relevant: data.stats?.relevantFound || 0,
        insights: data.insights || [],
        message: `סרקתי ${data.stats?.totalScanned || 0} מסמכים ומצאתי ${data.stats?.relevantFound || 0} רלוונטיים`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'שגיאה בסריקת Drive'
      };
    }
  }
});

/**
 * 💬 כלי לסריקת Communications (Chat/WhatsApp)
 */
export const scanCommunicationsTool = new DynamicStructuredTool({
  name: 'scan_communications',
  description: 'סריקת הודעות Chat/WhatsApp וזיהוי פעולות נדרשות. השתמש בזה כדי למצוא הודעות שמכילות בקשות או תזכורות.',
  schema: z.object({
    timeRange: z.enum(['day', 'week', 'month']).default('week').describe('טווח זמן לסריקה'),
    includeRead: z.boolean().default(false).describe('הכלל הודעות שנקראו')
  }),
  func: async ({ timeRange, includeRead }) => {
    try {
      const days = timeRange === 'day' ? 1 : timeRange === 'week' ? 7 : 30;
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);

      const { data: communications, error } = await supabaseAdmin
        .from('communications')
        .select('*')
        .gte('timestamp', sinceDate.toISOString())
        .eq('processed', includeRead)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Analyze communications with AI
      const actionableMessages = [];
      for (const comm of communications || []) {
        const analysis = await analyzeCommunicationWithAI(comm);
        if (analysis.isActionable) {
          actionableMessages.push({
            ...comm,
            analysis,
            suggestedAction: analysis.suggestedAction
          });
        }
      }

      return {
        success: true,
        scanned: communications?.length || 0,
        actionable: actionableMessages.length,
        messages: actionableMessages,
        message: `סרקתי ${communications?.length || 0} הודעות ומצאתי ${actionableMessages.length} פעולות נדרשות`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'שגיאה בסריקת Communications'
      };
    }
  }
});

/**
 * 🌐 כלי לחיפוש באינטרנט
 */
export const webSearchTool = new DynamicStructuredTool({
  name: 'web_search',
  description: 'חיפוש מידע באינטרנט. השתמש בזה כדי לחפש מידע רלוונטי, חוקים, או פרטים על נושאים ספציפיים.',
  schema: z.object({
    query: z.string().describe('שאילתת חיפוש'),
    context: z.string().optional().describe('הקשר לחיפוש'),
    maxResults: z.number().default(5).describe('מספר מקסימלי של תוצאות')
  }),
  func: async ({ query, context, maxResults }) => {
    try {
      const { getWebSearchTool } = await import('@/lib/tools/web-search');
      const webSearch = getWebSearchTool();
      
      const results = await webSearch.search({
        query,
        context: context || '',
        maxResults,
        saveResults: true
      });

      return {
        success: true,
        results: results.length,
        searchResults: results.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          relevance: r.relevance_score
        })),
        message: `מצאתי ${results.length} תוצאות רלוונטיות`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'שגיאה בחיפוש באינטרנט'
      };
    }
  }
});

/**
 * 🧠 כלי לחיפוש בזיכרון הסמנטי
 */
export const searchMemoriesTool = new DynamicStructuredTool({
  name: 'search_memories',
  description: 'חיפוש בזיכרון הסמנטי של הסוכן. השתמש בזה כדי למצוא דפוסים, התנסויות קודמות או מידע רלוונטי.',
  schema: z.object({
    query: z.string().describe('שאילתת חיפוש בזיכרון'),
    memoryType: z.enum(['pattern', 'experience', 'fact', 'all']).default('all').describe('סוג זיכרון'),
    limit: z.number().default(10).describe('מספר מקסימלי של תוצאות')
  }),
  func: async ({ query, memoryType, limit }) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/memory/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          limit,
          minSimilarity: 0.7,
          filter: memoryType !== 'all' ? { type: memoryType } : {}
        })
      });

      if (!response.ok) {
        throw new Error(`Memory search failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        results: data.count || 0,
        memories: data.results || [],
        message: `מצאתי ${data.count || 0} זיכרונות רלוונטיים`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'שגיאה בחיפוש בזיכרון'
      };
    }
  }
});

/**
 * Analyze communication with AI to detect actionable content
 */
async function analyzeCommunicationWithAI(communication: any): Promise<{
  isActionable: boolean;
  suggestedAction?: string;
  priority?: 'high' | 'medium' | 'low';
  confidence: number;
}> {
  try {
    const prompt = `Analyze this communication message for actionable content:

Content: ${communication.content}
Type: ${communication.type}
From: ${communication.contact_name || 'Unknown'}

Return JSON:
{
  "isActionable": boolean,
  "suggestedAction": "string (if actionable)",
  "priority": "high|medium|low",
  "confidence": number (0-1)
}

Consider actionable: requests, reminders, deadlines, payments, documents, urgent matters.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    return JSON.parse(response.choices[0].message.content || '{"isActionable": false, "confidence": 0}');
  } catch (error) {
    console.error('Error analyzing communication:', error);
    return { isActionable: false, confidence: 0 };
  }
}

export const allTools = [
  searchTasksTool,
  searchDebtsTool,
  scanGmailTool,
  createTaskTool,
  updateTaskTool,
  findRelatedTasksTool,
  getOverviewTool,
  saveInstructionTool,
  getInstructionsTool,
  updateInstructionTool,
  scanDriveTool,
  scanCommunicationsTool,
  webSearchTool,
  searchMemoriesTool
];

export const toolNames = allTools.map(t => t.name);