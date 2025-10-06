/**
 * Memory Save API
 * POST /api/memory/save
 */

import { NextRequest, NextResponse } from 'next/server'
import { getHybridMemory } from '@/lib/memory/hybrid-memory'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      content,
      type = 'general',
      importance,
      entityId,
      source,
    } = body

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required and must be a string' },
        { status: 400 }
      )
    }

    if (content.length < 5) {
      return NextResponse.json(
        { error: 'Content must be at least 5 characters' },
        { status: 400 }
      )
    }

    const validTypes = ['conversation', 'fact', 'preference', 'task', 'general']
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const memory = getHybridMemory()

    const result = await memory.remember(content, {
      type,
      importance,
      entityId,
      source,
    })

    return NextResponse.json({
      success: true,
      message: 'Memory saved successfully',
      ids: result,
      savedTo: {
        supabase: !!result.supabaseId,
        qdrant: !!result.qdrantId,
      },
    })
  } catch (error) {
    console.error('Error saving memory:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to save memory',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}