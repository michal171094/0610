import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { ToolExecution } from '@/types';

/**
 * Tool Registry - מרכז ניהול כל הכלים של ה-AI
 * מטפל ברישום, הרצה, ולוגינג של כלים
 */
export class ToolRegistry {
  private tools: Map<string, DynamicStructuredTool> = new Map();
  private currentSessionId: string = 'default';
  
  constructor(sessionId?: string) {
    if (sessionId) {
      this.currentSessionId = sessionId;
    }
    this.registerCoreTools();
  }
  
  /**
   * רישום כל הכלים הבסיסיים
   */
  private registerCoreTools() {
    this.registerTaskTools();
    this.registerDebtTools();
    this.registerClientTools();
    this.registerSystemTools();
  }
  
  /**
   * כלים לניהול משימות
   */
  private registerTaskTools() {
    // 1. חיפוש משימות
    this.register(
      'search_tasks',
      'חפש משימות לפי מילות מפתח, תחום או סטטוס',
      z.object({
        query: z.string().optional().describe('מילות חיפוש חופשיות'),
        domain: z.enum(['Legal', 'Health', 'Debt', 'Client', 'Bureaucracy', 'Personal']).optional(),
        status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'cancelled']).optional(),
        isUrgent: z.boolean().optional().describe('האם דחוף בלבד'),
        limit: z.number().optional().describe('מספר תוצאות מקסימלי')
      }),
      async (input) => {
        let query = supabaseAdmin.from('unified_dashboard').select('*');
        
        if (input.query) {
          query = query.or(`title.ilike.%${input.query}%,next_action.ilike.%${input.query}%,ai_reasoning.ilike.%${input.query}%`);
        }
        if (input.domain) query = query.eq('domain', input.domain);
        if (input.status) query = query.eq('status', input.status);
        if (input.isUrgent !== undefined) query = query.eq('is_urgent', input.isUrgent);
        
        query = query.order('priority_score', { ascending: false }).limit(input.limit || 10);
        
        const { data, error } = await query;
        
        if (error) throw error;
        return this.formatTaskResults(data || []);
      }
    );
    
    // 2. יצירת משימה
    this.register(
      'create_task',
      'צור משימה חדשה במערכת',
      z.object({
        title: z.string().describe('כותרת המשימה'),
        domain: z.enum(['Legal', 'Health', 'Debt', 'Client', 'Bureaucracy', 'Personal']),
        nextAction: z.string().describe('הפעולה הבאה הנדרשת'),
        description: z.string().optional().describe('תיאור מפורט'),
        deadline: z.string().datetime().optional(),
        isUrgent: z.boolean().optional(),
        financialImpact: z.number().optional(),
        tags: z.array(z.string()).optional()
      }),
      async (input) => {
        const priorityScore = this.calculateTaskPriority({
          isUrgent: input.isUrgent,
          deadline: input.deadline,
          financialImpact: input.financialImpact
        });
        
        const { data, error } = await supabaseAdmin
          .from('unified_dashboard')
          .insert({
            title: input.title,
            domain: input.domain,
            next_action: input.nextAction,
            ai_reasoning: input.description,
            deadline: input.deadline,
            is_urgent: input.isUrgent || false,
            financial_impact: input.financialImpact || 0,
            priority_score: priorityScore,
            status: 'pending',
            progress: 0,
            tags: input.tags || [],
            sub_tasks: [],
            ai_recommendations: {}
          })
          .select()
          .single();
        
        if (error) throw error;
        return `✅ משימה נוצרה בהצלחה: "${data.title}" (ID: ${data.id})\nעדיפות: ${priorityScore}/100\n${input.isUrgent ? '🔴 סומנה כדחופה' : ''}`;
      }
    );
    
    // 3. עדכון משימה
    this.register(
      'update_task',
      'עדכן משימה קיימת',
      z.object({
        taskId: z.string().describe('מזהה המשימה'),
        status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'cancelled']).optional(),
        nextAction: z.string().optional(),
        progress: z.number().min(0).max(100).optional(),
        notes: z.string().optional(),
        isUrgent: z.boolean().optional()
      }),
      async (input) => {
        const updates: any = {};
        if (input.status) updates.status = input.status;
        if (input.nextAction) updates.next_action = input.nextAction;
        if (input.progress !== undefined) updates.progress = input.progress;
        if (input.notes) updates.ai_reasoning = input.notes;
        if (input.isUrgent !== undefined) updates.is_urgent = input.isUrgent;
        
        const { data, error } = await supabaseAdmin
          .from('unified_dashboard')
          .update(updates)
          .eq('id', input.taskId)
          .select()
          .single();
        
        if (error) throw error;
        return `✅ משימה עודכנה: ${data.title}\nסטטוס: ${data.status} | התקדמות: ${data.progress}%`;
      }
    );
  }
  
  /**
   * כלים לניהול חובות
   */
  private registerDebtTools() {
    // 1. חיפוש חובות
    this.register(
      'search_debts',
      'חפש חובות לפי חברה, סכום או סטטוס',
      z.object({
        company: z.string().optional().describe('שם החברה המקורית או הגובה'),
        minAmount: z.number().optional(),
        maxAmount: z.number().optional(),
        status: z.enum(['active', 'negotiating', 'settled', 'legal', 'payment_plan', 'disputed']).optional(),
        currency: z.enum(['EUR', 'ILS', 'USD', 'GBP']).optional()
      }),
      async (input) => {
        let query = supabaseAdmin.from('debts').select('*');
        
        if (input.company) {
          query = query.or(
            `collection_company.ilike.%${input.company}%,original_company.ilike.%${input.company}%`
          );
        }
        if (input.minAmount !== undefined) query = query.gte('amount', input.minAmount);
        if (input.maxAmount !== undefined) query = query.lte('amount', input.maxAmount);
        if (input.status) query = query.eq('status', input.status);
        if (input.currency) query = query.eq('currency', input.currency);
        
        const { data, error } = await query.order('amount', { ascending: false });
        
        if (error) throw error;
        return this.formatDebtResults(data || []);
      }
    );
    
    // 2. עדכון חוב
    this.register(
      'update_debt',
      'עדכן סטטוס או פרטי חוב',
      z.object({
        debtId: z.string(),
        status: z.enum(['active', 'negotiating', 'settled', 'legal', 'payment_plan', 'disputed']).optional(),
        settlementOffer: z.number().optional(),
        notes: z.string().optional()
      }),
      async (input) => {
        const updates: any = {};
        if (input.status) updates.status = input.status;
        if (input.settlementOffer) updates.settlement_offer = input.settlementOffer;
        if (input.notes) updates.negotiation_notes = input.notes;
        
        const { data, error } = await supabaseAdmin
          .from('debts')
          .update(updates)
          .eq('id', input.debtId)
          .select()
          .single();
        
        if (error) throw error;
        return `✅ חוב עודכן: ${data.original_company}\nסכום: ${data.amount} ${data.currency}\nסטטוס: ${data.status}`;
      }
    );
  }
  
  /**
   * כלים לניהול לקוחות
   */
  private registerClientTools() {
    // 1. חיפוש לקוחות
    this.register(
      'search_clients',
      'חפש לקוחות לפי שם, סטטוס או סוג פרויקט',
      z.object({
        name: z.string().optional(),
        status: z.string().optional(),
        paymentStatus: z.enum(['pending', 'partial', 'paid', 'overdue', 'cancelled']).optional()
      }),
      async (input) => {
        let query = supabaseAdmin.from('clients').select('*');
        
        if (input.name) query = query.ilike('name', `%${input.name}%`);
        if (input.status) query = query.eq('status', input.status);
        if (input.paymentStatus) query = query.eq('payment_status', input.paymentStatus);
        
        const { data, error } = await query;
        
        if (error) throw error;
        return this.formatClientResults(data || []);
      }
    );
  }
  
  /**
   * כלים מערכתיים
   */
  private registerSystemTools() {
    // 1. תמונת מצב כללית
    this.register(
      'get_overview',
      'קבל תמונת מצב כללית של המערכת',
      z.object({}),
      async () => {
        const [tasks, debts, clients] = await Promise.all([
          supabaseAdmin.from('unified_dashboard').select('*', { count: 'exact' }),
          supabaseAdmin.from('debts').select('*', { count: 'exact' }),
          supabaseAdmin.from('clients').select('*', { count: 'exact' })
        ]);
        
        const overview = {
          tasks: {
            total: tasks.count || 0,
            urgent: tasks.data?.filter((t: any) => t.is_urgent).length || 0,
            pending: tasks.data?.filter((t: any) => t.status === 'pending').length || 0,
            inProgress: tasks.data?.filter((t: any) => t.status === 'in_progress').length || 0
          },
          debts: {
            total: debts.count || 0,
            totalAmount: debts.data?.reduce((sum: number, d: any) => sum + (d.amount || 0), 0) || 0,
            active: debts.data?.filter((d: any) => d.status === 'active').length || 0,
            negotiating: debts.data?.filter((d: any) => d.status === 'negotiating').length || 0
          },
          clients: {
            total: clients.count || 0,
            active: clients.data?.filter((c: any) => c.status === 'active').length || 0,
            overdue: clients.data?.filter((c: any) => c.payment_status === 'overdue').length || 0
          }
        };
        
        return this.formatOverview(overview);
      }
    );
    
    // 2. שמירת הוראה
    this.register(
      'save_instruction',
      'שמור הוראה או העדפה חדשה למערכת',
      z.object({
        instruction: z.string(),
        category: z.enum(['preference', 'rule', 'correction', 'priority', 'behavior']),
        importance: z.enum(['low', 'medium', 'high', 'critical']),
        context: z.string().optional()
      }),
      async (input) => {
        const { data, error } = await supabaseAdmin
          .from('agent_instructions')
          .insert({
            user_id: 'michal',
            instruction_text: input.instruction,
            category: input.category,
            importance: input.importance,
            context: input.context,
            is_active: true,
            priority: input.importance === 'critical' ? 100 : input.importance === 'high' ? 80 : input.importance === 'medium' ? 50 : 30
          })
          .select()
          .single();
        
        if (error) throw error;
        return `✅ הוראה נשמרה: "${input.instruction}"\nחשיבות: ${input.importance}\nקטגוריה: ${input.category}`;
      }
    );
  }
  
  /**
   * רישום כלי חדש
   */
  register(
    name: string,
    description: string,
    schema: z.ZodObject<any>,
    func: (input: any) => Promise<any>
  ): void {
    const tool = new DynamicStructuredTool({
      name,
      description,
      schema,
      func: async (input) => {
        const startTime = Date.now();
        
        try {
          const result = await func(input);
          const executionTime = Date.now() - startTime;
          
          // Log successful execution
          await this.logExecution(name, input, result, true, executionTime);
          
          return result;
        } catch (error) {
          const executionTime = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // Log failed execution
          await this.logExecution(name, input, null, false, executionTime, errorMessage);
          
          throw error;
        }
      }
    });
    
    this.tools.set(name, tool);
  }
  
  /**
   * קבל את כל הכלים
   */
  getTools(): DynamicStructuredTool[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * קבל כלי לפי שם
   */
  getTool(name: string): DynamicStructuredTool | undefined {
    return this.tools.get(name);
  }
  
  /**
   * רשום ביצוע כלי
   */
  private async logExecution(
    toolName: string,
    input: any,
    output: any,
    success: boolean,
    executionTime: number,
    error?: string
  ): Promise<void> {
    try {
      await supabaseAdmin
        .from('tool_executions')
        .insert({
          session_id: this.currentSessionId,
          tool_name: toolName,
          input_params: input,
          output_result: output,
          success,
          error_message: error,
          execution_time_ms: executionTime
        });
    } catch (logError) {
      // Non-critical error
      console.warn('Failed to log tool execution:', logError);
    }
  }
  
  // ============================================
  // Helper Formatting Methods
  // ============================================
  
  private calculateTaskPriority(factors: {
    isUrgent?: boolean;
    deadline?: string;
    financialImpact?: number;
  }): number {
    let score = 50;
    
    if (factors.isUrgent) score += 30;
    
    if (factors.deadline) {
      const daysUntil = Math.ceil(
        (new Date(factors.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntil < 3) score += 20;
      else if (daysUntil < 7) score += 10;
    }
    
    if (factors.financialImpact) {
      if (factors.financialImpact > 500) score += 15;
      else if (factors.financialImpact > 100) score += 10;
    }
    
    return Math.min(100, Math.max(0, score));
  }
  
  private formatTaskResults(tasks: any[]): string {
    if (tasks.length === 0) return '❌ לא נמצאו משימות';
    
    return tasks
      .map(
        (t, i) =>
          `${i + 1}. 📌 ${t.title}\n` +
          `   תחום: ${t.domain} | סטטוס: ${t.status}\n` +
          `   עדיפות: ${t.priority_score}/100 ${t.is_urgent ? '🔴 דחוף' : ''}\n` +
          `   פעולה הבאה: ${t.next_action || 'לא הוגדרה'}\n` +
          `   ID: ${t.id}`
      )
      .join('\n\n');
  }
  
  private formatDebtResults(debts: any[]): string {
    if (debts.length === 0) return '❌ לא נמצאו חובות';
    
    return debts
      .map(
        (d, i) =>
          `${i + 1}. 💰 ${d.original_company}\n` +
          `   גובה: ${d.collection_company || 'אין'}\n` +
          `   סכום: ${d.amount} ${d.currency}\n` +
          `   סטטוס: ${d.status}\n` +
          `   תיק: ${d.case_number || 'אין'}\n` +
          `   ID: ${d.id}`
      )
      .join('\n\n');
  }
  
  private formatClientResults(clients: any[]): string {
    if (clients.length === 0) return '❌ לא נמצאו לקוחות';
    
    return clients
      .map(
        (c, i) =>
          `${i + 1}. 👤 ${c.name}\n` +
          `   פרויקט: ${c.project_type || 'לא צוין'}\n` +
          `   סטטוס: ${c.status} | תשלום: ${c.payment_status}\n` +
          `   מחיר: ${c.price || 0}€ | שולם: ${c.amount_paid || 0}€\n` +
          `   ID: ${c.id}`
      )
      .join('\n\n');
  }
  
  private formatOverview(overview: any): string {
    return (
      `📊 תמונת מצב כללית:\n\n` +
      `📋 משימות:\n` +
      `   סה"כ: ${overview.tasks.total}\n` +
      `   דחופות: ${overview.tasks.urgent} 🔴\n` +
      `   ממתינות: ${overview.tasks.pending}\n` +
      `   בביצוע: ${overview.tasks.inProgress}\n\n` +
      `💰 חובות:\n` +
      `   סה"כ: ${overview.debts.total}\n` +
      `   פעילים: ${overview.debts.active}\n` +
      `   במו"מ: ${overview.debts.negotiating}\n` +
      `   סכום כולל: ${Math.round(overview.debts.totalAmount)}€\n\n` +
      `👥 לקוחות:\n` +
      `   סה"כ: ${overview.clients.total}\n` +
      `   פעילים: ${overview.clients.active}\n` +
      `   באיחור בתשלום: ${overview.clients.overdue}`
    );
  }
}

// ============================================
// Export singleton instance
// ============================================

let toolRegistryInstance: ToolRegistry | null = null;

export function getToolRegistry(sessionId?: string): ToolRegistry {
  if (!toolRegistryInstance || (sessionId && sessionId !== toolRegistryInstance['currentSessionId'])) {
    toolRegistryInstance = new ToolRegistry(sessionId);
  }
  return toolRegistryInstance;
}
