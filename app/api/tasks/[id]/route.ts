import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET specific task
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: task, error } = await supabaseAdmin
      .from('unified_dashboard')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error('Get task error:', error)
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
  }
}

// PUT update task
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    // Update last_updated timestamp
    const updateData = {
      ...body,
      last_updated: new Date().toISOString()
    }

    const { data: task, error } = await supabaseAdmin
      .from('unified_dashboard')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task, message: 'המשימה עודכנה בהצלחה ✅' })
  } catch (error) {
    console.error('Update task error:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

// DELETE task
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabaseAdmin
      .from('unified_dashboard')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'המשימה נמחקה בהצלחה 🗑️' })
  } catch (error) {
    console.error('Delete task error:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
