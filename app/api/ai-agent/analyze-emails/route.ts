// 🔍 Smart Email Analysis Endpoint - LangGraph powered
import { NextRequest, NextResponse } from 'next/server';
import { aiAgent } from '@/lib/ai-agent/langraph';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { emailInsights } = await request.json();
    
    if (!emailInsights || emailInsights.length === 0) {
      return NextResponse.json({
        updates: [],
        newTasks: [],
        message: 'לא נמצאו מיילים לניתוח'
      });
    }
    
    console.log(`\n📧 Analyzing ${emailInsights.length} email insights with LangGraph...`);
    
    const updates: any[] = [];
    const newTasks: any[] = [];
    const userId = 'michal-user-id';
    
    for (const insight of emailInsights) {
      const analysisPrompt = `
נתח את המייל הזה וקבע:

**מייל:**
מאת: ${insight.from_address}
נושא: ${insight.subject}
תאריך: ${insight.email_date}
קטגוריה: ${insight.category}
רלוונטיות: ${insight.relevance}
סיכום: ${insight.summary}

**שלבי החשיבה:**
1. חפש משימות קשורות באמצעות search_tasks
2. חפש חובות קשורים באמצעות search_debts
3. קבע: זו משימה חדשה או עדכון לקיימת?
4. אם זו משימה חדשה - צור אותה באמצעות create_task
5. אם זה עדכון - עדכן משימה קיימת באמצעות update_task

**חשוב:** אם יש קשר לחברה/לקוח/חוב קיים - **עדכן משימה קיימת**, אל תיצור חדשה!

תן לי ניתוח מפורט של מה עשית ולמה.
`;

      const response = await aiAgent.chat(analysisPrompt, `email-analysis-${insight.id}`);
      
      // בדוק אם הסוכן יצר או עדכן משהו
      if (response.includes('✅') || response.includes('עודכן') || response.includes('נוצר')) {
        if (response.includes('עודכן')) {
          updates.push({
            insight,
            action: 'updated',
            details: response
          });
        } else if (response.includes('נוצר')) {
          newTasks.push({
            insight,
            action: 'created',
            details: response
          });
        }
      }
    }
    
    console.log(`✅ Analysis complete: ${updates.length} updates, ${newTasks.length} new tasks`);
    
    return NextResponse.json({
      updates,
      newTasks,
      message: `נותחו ${emailInsights.length} מיילים: ${updates.length} עדכונים ו-${newTasks.length} משימות חדשות`
    });
    
  } catch (error: any) {
    console.error('❌ Email analysis error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
