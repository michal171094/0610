import { NextRequest, NextResponse } from 'next/server'
import { aiAgent } from '@/lib/ai-agent/langraph'
import { supabaseAdmin } from '@/lib/supabase'

// POST - Generate message draft for task
export async function POST(request: NextRequest) {
  try {
    const { taskId, messageType, language } = await request.json()

    if (!taskId || !messageType) {
      return NextResponse.json(
        { error: 'taskId and messageType are required' }, 
        { status: 400 }
      )
    }

    // Fetch task
    const { data: task, error } = await supabaseAdmin
      .from('unified_dashboard')
      .select('*')
      .eq('id', taskId)
      .single()

    if (error || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    console.log(`✍️ Generating ${messageType} draft for task: ${task.title}`)

    // Generate draft
    const draft = await aiAgent.generateMessageDraft(
      task,
      messageType,
      language || 'de'
    )

    // Optionally save draft to task recommendations
    const updatedRecommendations = {
      ...task.ai_recommendations,
      [`message_draft_${messageType}`]: draft,
      last_generated: new Date().toISOString()
    }

    await supabaseAdmin
      .from('unified_dashboard')
      .update({ ai_recommendations: updatedRecommendations })
      .eq('id', taskId)

    return NextResponse.json({ 
      draft,
      messageType,
      language,
      taskTitle: task.title
    })
  } catch (error) {
    console.error('Compose error:', error)
    return NextResponse.json(
      { error: 'Failed to generate message draft' }, 
      { status: 500 }
    )
  }
}
