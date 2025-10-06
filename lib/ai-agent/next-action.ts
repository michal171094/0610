// 🎯 Next Action Recommender - Smart task suggestions
import OpenAI from 'openai';
import { supabaseAdmin } from '../supabase';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface NextActionRecommendation {
  taskId: string;
  title: string;
  currentStatus: string;
  recommendation: string;
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
  reasoning: string;
  suggestedDeadline?: string;
  shouldCheckStatus: boolean;
}

// 🧠 Analyze all tasks and recommend next action
export async function getNextActionRecommendation(): Promise<NextActionRecommendation | null> {
  try {
    // Get all active tasks
    const { data: tasks, error } = await supabaseAdmin
      .from('unified_dashboard')
      .select('*')
      .neq('status', 'completed')
      .order('priority_score', { ascending: false })
      .limit(20);

    if (error || !tasks || tasks.length === 0) {
      return null;
    }

    // Get context about overdue tasks
    const now = new Date();
    const overdueTasks = tasks.filter(t => 
      t.deadline && new Date(t.deadline) < now && t.status === 'pending'
    );

    // Prepare context for GPT-4
    const context = tasks.map(t => ({
      id: t.id,
      title: t.title,
      domain: t.domain,
      status: t.status,
      priority: t.priority_score,
      deadline: t.deadline,
      nextAction: t.next_action,
      lastUpdated: t.last_updated,
      isOverdue: t.deadline && new Date(t.deadline) < now
    }));

    const systemPrompt = `אתה עוזר חכם למיכל. תפקידך לנתח את כל המשימות ולהמליץ על הפעולה הבאה החשובה ביותר.

כללים:
1. משימות שעברו deadline צריכות בדיקת סטטוס
2. משימות ללא next_action צריכות להישאר pending עם deadline
3. תן עדיפות למשימות דחופות (חובות, ביורוקרטיה)
4. המלץ על מה לעשות בפועל, לא רק "לבדוק"

החזר JSON:
{
  "taskId": "...",
  "title": "...",
  "currentStatus": "...",
  "recommendation": "הפעולה הבאה הקונקרטית",
  "urgencyLevel": "critical|high|medium|low",
  "reasoning": "למה זה החשוב ביותר עכשיו",
  "suggestedDeadline": "2024-12-15" (אם צריך),
  "shouldCheckStatus": true/false (אם עבר deadline)
}`;

    const userPrompt = `המשימות שלי:
${JSON.stringify(context, null, 2)}

משימות שעברו deadline: ${overdueTasks.length}

מה המשימה הבאה החשובה ביותר שאני צריכה לעשות עכשיו?`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const recommendation = JSON.parse(response.choices[0].message.content!) as NextActionRecommendation;
    
    // Update task if needed
    if (recommendation.shouldCheckStatus) {
      await supabaseAdmin
        .from('unified_dashboard')
        .update({
          next_action: `⚠️ בדיקת סטטוס: ${recommendation.recommendation}`,
          last_updated: new Date().toISOString()
        })
        .eq('id', recommendation.taskId);
    }

    return recommendation;
  } catch (error) {
    console.error('❌ Failed to get next action:', error);
    return null;
  }
}

// 🔄 Auto-update tasks that passed deadline
export async function checkOverdueTasks(): Promise<number> {
  try {
    const now = new Date();
    
    const { data: overdueTasks } = await supabaseAdmin
      .from('unified_dashboard')
      .select('*')
      .eq('status', 'pending')
      .lt('deadline', now.toISOString());

    if (!overdueTasks || overdueTasks.length === 0) {
      return 0;
    }

    // Update each overdue task
    for (const task of overdueTasks) {
      await supabaseAdmin
        .from('unified_dashboard')
        .update({
          next_action: `⚠️ עבר deadline - צריך לבדוק סטטוס`,
          last_updated: now.toISOString()
        })
        .eq('id', task.id);
    }

    return overdueTasks.length;
  } catch (error) {
    console.error('❌ Failed to check overdue tasks:', error);
    return 0;
  }
}

// 🎯 Suggest deadline for tasks without one
export async function suggestDeadlines(): Promise<void> {
  try {
    const { data: tasksWithoutDeadline } = await supabaseAdmin
      .from('unified_dashboard')
      .select('*')
      .is('deadline', null)
      .eq('status', 'pending')
      .limit(10);

    if (!tasksWithoutDeadline || tasksWithoutDeadline.length === 0) {
      return;
    }

    const systemPrompt = `אתה עוזר חכם. תן deadline מתאים לכל משימה.
כללים:
- חובות דחופים: 3-7 ימים
- ביורוקרטיה: 7-14 ימים
- לקוחות: לפי הקשר
- משימות כלליות: 14 ימים

החזר JSON מערך:
[
  {"taskId": "...", "suggestedDeadline": "2024-12-20"},
  ...
]`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `תן deadlines למשימות האלה:\n${JSON.stringify(
            tasksWithoutDeadline.map(t => ({ id: t.id, title: t.title, domain: t.domain })),
            null,
            2
          )}` 
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const suggestions = JSON.parse(response.choices[0].message.content!);
    
    // Update tasks with suggested deadlines
    for (const suggestion of suggestions.deadlines || []) {
      await supabaseAdmin
        .from('unified_dashboard')
        .update({ deadline: suggestion.suggestedDeadline })
        .eq('id', suggestion.taskId);
    }
  } catch (error) {
    console.error('❌ Failed to suggest deadlines:', error);
  }
}
