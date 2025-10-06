import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET all tasks - ממוין לפי עדיפות
export async function GET() {
  try {
    const { data: tasks, error } = await supabaseAdmin
      .from('unified_dashboard')
      .select('*')
      .order('priority_score', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // כרגע נחלץ מידע מהכותרת (אם יש שם של חברה/גוף)
    // בעתיד נוכל לשלב עם טבלאות debts/bureaucracy אם יהיו קישורים
    const enrichedTasks = tasks?.map(task => {
      const additionalContext: any = {}
      
      // נסה לחלץ מידע מהכותרת
      const title = task.title || ''
      
      // זיהוי חובות לפי הכותרת
      if (task.domain === 'Debt' || title.includes('חוב:')) {
        // חילוץ שם החברה מהכותרת
        const companyMatch = title.match(/חוב:\s*(.+)/)
        if (companyMatch) {
          additionalContext.company = companyMatch[1].trim()
        }
        additionalContext.status = 'active'
      }
      
      // זיהוי בירוקרטיה
      if (task.domain === 'Bureaucracy') {
        // חילוץ גוף ממשלתי מהכותרת
        const agencyMatch = title.match(/(?:ביטוח לאומי|רשות המסים|משרד הפנים|משרד.+)/i)
        if (agencyMatch) {
          additionalContext.agency = agencyMatch[0]
        }
      }
      
      return {
        ...task,
        additionalContext
      }
    }) || []

    return NextResponse.json({ tasks: enrichedTasks, count: enrichedTasks.length })
  } catch (error) {
    console.error('Get tasks error:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

// POST new task - יצירת משימה חדשה
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Add default values
    const taskData = {
      ...body,
      id: `task_${Date.now()}`,
      status: body.status || 'pending',
      priority_score: body.priority_score || 50,
      progress: 0,
      last_updated: new Date().toISOString(),
      sub_tasks: body.sub_tasks || [],
      ai_recommendations: body.ai_recommendations || {},
      task_chat_history: [],
      tags: body.tags || [],
    }

    const { data: task, error } = await supabaseAdmin
      .from('unified_dashboard')
      .insert([taskData])
      .select()
      .single()

    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task, message: 'משימה נוצרה בהצלחה ✅' }, { status: 201 })
  } catch (error) {
    console.error('Create task error:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
