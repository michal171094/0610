import { NextRequest, NextResponse } from 'next/server'
import { aiAgent } from '@/lib/ai-agent/langraph'
import { supabaseAdmin } from '@/lib/supabase'

// POST - Recalculate priorities for all tasks
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting priority recalculation...')

    // Fetch all tasks
    const { data: tasks, error: fetchError } = await supabaseAdmin
      .from('unified_dashboard')
      .select('*')

    if (fetchError || !tasks) {
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }

    // Recalculate priorities
    const updatedTasks = await aiAgent.updateTaskPriorities(tasks)

    // Update all tasks in database
    const updatePromises = updatedTasks.map(task =>
      supabaseAdmin
        .from('unified_dashboard')
        .update({
          priority_score: task.priority_score,
          last_updated: task.last_updated
        })
        .eq('id', task.id)
    )

    await Promise.all(updatePromises)

    console.log('✅ Priority recalculation complete!')

    return NextResponse.json({ 
      message: 'העדיפויות עודכנו בהצלחה! 🎯',
      updatedCount: updatedTasks.length,
      tasks: updatedTasks
    })
  } catch (error) {
    console.error('Prioritize error:', error)
    return NextResponse.json(
      { error: 'Failed to recalculate priorities' }, 
      { status: 500 }
    )
  }
}
