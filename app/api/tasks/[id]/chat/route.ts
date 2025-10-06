import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// POST - Add chat message to specific task
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { message, type } = await request.json()

    // Get current task
    const { data: task, error: fetchError } = await supabaseAdmin
      .from('unified_dashboard')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Add new message to chat history
    const newMessage = {
      id: `msg_${Date.now()}`,
      type,
      message,
      timestamp: new Date().toISOString(),
      task_context: params.id
    }

    const updatedChatHistory = [
      ...(task.task_chat_history || []),
      newMessage
    ]

    // Update task with new chat history
    const { data: updatedTask, error: updateError } = await supabaseAdmin
      .from('unified_dashboard')
      .update({ 
        task_chat_history: updatedChatHistory,
        last_updated: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      console.error('Update chat error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      task: updatedTask,
      message: newMessage 
    })
  } catch (error) {
    console.error('Task chat error:', error)
    return NextResponse.json({ error: 'Failed to add message' }, { status: 500 })
  }
}

// GET - Get chat history for task
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: task, error } = await supabaseAdmin
      .from('unified_dashboard')
      .select('task_chat_history')
      .eq('id', params.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      chatHistory: task?.task_chat_history || [] 
    })
  } catch (error) {
    console.error('Get chat history error:', error)
    return NextResponse.json({ error: 'Failed to fetch chat history' }, { status: 500 })
  }
}
