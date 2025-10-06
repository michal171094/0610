/**
 * Memory Search API
 * POST /api/memory/search
 */

import { NextRequest, NextResponse } from 'next/server'
import { getHybridMemory } from '@/lib/memory/hybrid-memory'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      query,
      limit = 10,
      minSimilarity = 0.7,
      filter = {},
    } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      )
    }

    const memory = getHybridMemory()

    const results = await memory.search(query, {
      limit,
      minSimilarity,
      filter,
    })

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
      query,
    })
  } catch (error) {
    console.error('Error in memory search:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to search memories',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    const memory = getHybridMemory()
    const results = await memory.search(query, { limit })

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
    })
  } catch (error) {
    console.error('Error in memory search:', error)
    
    return NextResponse.json(
      { error: 'Failed to search memories' },
      { status: 500 }
    )
  }
}