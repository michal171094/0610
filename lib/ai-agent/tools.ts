// 🛠️ LangGraph Tools - כלים שהסוכן יכול להשתמש בהם
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { scanAllAccounts } from '@/lib/gmail/scanner';

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
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`);

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
        next_action: t.next_action,
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
      queryBuilder = queryBuilder.or(`original_company.ilike.%${creditor}%,collection_company.ilike.%${creditor}%`);
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
        description,
        domain,
        deadline,
        priority: priority || 5,
        status: 'pending',
        related_to_id: related_id,
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
    if (next_action) updates.next_action = next_action;
    if (notes) updates.notes = notes;

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
      .or(`title.ilike.%${entity_name}%,description.ilike.%${entity_name}%`);

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
      urgent_tasks: tasks.data?.filter(t => t.is_urgent).length || 0,
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
  updateInstructionTool
];

export const toolNames = allTools.map(t => t.name);