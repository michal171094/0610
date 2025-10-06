import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET - Sync status of all connections
export async function GET() {
  try {
    // Test Supabase connection
    const { data: testQuery, error } = await supabaseAdmin
      .from('unified_dashboard')
      .select('count')
      .limit(1)

    const supabaseStatus = !error

    // Check other integrations (will be implemented later)
    const connections = [
      {
        name: 'Supabase',
        status: supabaseStatus ? 'connected' : 'error',
        last_sync: new Date().toISOString(),
        details: supabaseStatus ? 'Connected successfully' : error?.message
      },
      {
        name: 'OpenAI',
        status: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
        last_sync: null,
        details: process.env.OPENAI_API_KEY ? 'API key present' : 'Missing API key'
      },
      {
        name: 'Gmail',
        status: 'not_configured',
        last_sync: null,
        details: 'Awaiting configuration'
      },
      {
        name: 'Google Drive',
        status: 'not_configured',
        last_sync: null,
        details: 'Awaiting configuration'
      },
      {
        name: 'WhatsApp',
        status: 'not_configured',
        last_sync: null,
        details: 'Awaiting configuration'
      }
    ]

    return NextResponse.json({ connections })
  } catch (error) {
    console.error('Sync status error:', error)
    return NextResponse.json(
      { error: 'Failed to check sync status' }, 
      { status: 500 }
    )
  }
}

// POST - Trigger manual sync
export async function POST(request: NextRequest) {
  try {
    const { service } = await request.json()

    console.log(`🔄 Triggering sync for: ${service}`)

    switch (service) {
      case 'supabase':
        // Refresh all data from Supabase
        const { data, error } = await supabaseAdmin
          .from('unified_dashboard')
          .select('*')
        
        if (error) throw error

        return NextResponse.json({
          message: 'Supabase synced successfully',
          recordCount: data?.length || 0
        })

      case 'gmail':
        // TODO: Implement Gmail sync
        return NextResponse.json({
          message: 'Gmail sync not yet implemented',
          status: 'pending'
        })

      case 'whatsapp':
        // TODO: Implement WhatsApp sync
        return NextResponse.json({
          message: 'WhatsApp sync not yet implemented',
          status: 'pending'
        })

      default:
        return NextResponse.json(
          { error: 'Unknown service' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Manual sync error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger sync' },
      { status: 500 }
    )
  }
}
