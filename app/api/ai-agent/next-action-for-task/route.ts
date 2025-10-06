import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

export async function POST(request: NextRequest) {
  try {
    const { 
      taskId, 
      taskTitle, 
      taskDomain,
      deadline,
      priorityScore,
      progress,
      isUrgent,
      financialImpact,
      additionalContext 
    } = await request.json();

    if (!taskTitle) {
      return NextResponse.json(
        { error: 'Task title is required' },
        { status: 400 }
      );
    }

    console.log(`🎯 Generating next action for task: ${taskTitle}`);

    const systemPrompt = `אתה עוזר חכם למיכל. תפקידך לומר לה בדיוק מה הפעולה הבאה שהיא צריכה לעשות למשימה הספציפית.

כללים חשובים:
1. תן פעולה קונקרטית, לא כללית - "התקשרי לבנק הפועלים", לא "לבדוק סטטוס"
2. כתוב בגוף שני נקבה (את) - "שלחי מייל", "התקשרי", "אספי מסמכים"
3. תמיד כולל מה בדיוק לעשות - למי להתקשר, מה לשלוח, איזה מסמכים
4. בירוקרטיה וחובות - תן עדיפות גבוהה

כללים לחובות ותשלומים:
- אם יש סכום חוב קונקרטי - קודם בדקי אם יש מקום לערער או לנהל משא ומתן
- אם אין מקום לערער - המלצי איך ומתי לשלם (תכנית תשלומים, בקשה לפריסה)
- אם אין עדיין סכום ברור - המלצי לברר את הסכום המדויק ואת כל הפרטים

אם אין מידע מספיק - המלצי על איסוף מידע קונקרטי.

החזר רק את הפעולה הבאה בעברית, ללא JSON. משפט אחד או שניים.`;

    // בניית מידע מפורט למשימה
    let contextDetails = [];
    
    if (deadline) {
      const deadlineDate = new Date(deadline);
      const daysLeft = Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      contextDetails.push(`תאריך יעד: ${deadlineDate.toLocaleDateString('he-IL')} (עוד ${daysLeft} ימים)`);
    }
    
    if (priorityScore) {
      contextDetails.push(`עדיפות: ${priorityScore}/100`);
    }
    
    if (progress !== undefined) {
      contextDetails.push(`התקדמות: ${progress}%`);
    }
    
    if (isUrgent) {
      contextDetails.push(`🔴 דחוף!`);
    }
    
    if (financialImpact) {
      contextDetails.push(`השפעה כספית: €${financialImpact}`);
    }
    
    if (additionalContext) {
      if (additionalContext.amount && additionalContext.currency) {
        contextDetails.push(`סכום חוב: ${additionalContext.amount} ${additionalContext.currency}`);
      }
      if (additionalContext.status) {
        contextDetails.push(`סטטוס: ${additionalContext.status}`);
      }
      if (additionalContext.paymentStatus) {
        contextDetails.push(`סטטוס תשלום: ${additionalContext.paymentStatus}`);
      }
      if (additionalContext.company) {
        contextDetails.push(`חברה: ${additionalContext.company}`);
      }
      if (additionalContext.agency) {
        contextDetails.push(`גוף ממשלתי: ${additionalContext.agency}`);
      }
      if (additionalContext.caseNumber) {
        contextDetails.push(`מספר תיק: ${additionalContext.caseNumber}`);
      }
    }

    const userPrompt = `משימה: ${taskTitle}
תחום: ${taskDomain}
${contextDetails.length > 0 ? '\nפרטים נוספים:\n' + contextDetails.join('\n') : ''}

מה הפעולה הבאה הקונקרטית שאני צריכה לעשות?`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    const nextAction = response.choices[0].message.content?.trim() || 'ממתין להגדרה';

    console.log(`✅ Generated next action: ${nextAction}`);

    return NextResponse.json({
      taskId,
      nextAction,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error generating next action:', error);
    return NextResponse.json(
      { error: 'Failed to generate next action' },
      { status: 500 }
    );
  }
}
