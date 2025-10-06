import { NextRequest, NextResponse } from 'next/server'
import { getMonitorAgent } from '@/lib/agents/monitor-agent'

/**
 * GET /api/agent/monitor
 * Run monitoring check and get alerts
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Running monitor agent...')
    
    const agent = getMonitorAgent()
    const alerts = await agent.checkAll()

    const critical = alerts.filter(a => a.severity === 'critical')
    const high = alerts.filter(a => a.severity === 'high')
    const medium = alerts.filter(a => a.severity === 'medium')

    return NextResponse.json({
      success: true,
      summary: {
        total: alerts.length,
        critical: critical.length,
        high: high.length,
        medium: medium.length,
      },
      alerts,
    })
  } catch (error: any) {
    console.error('❌ Monitor error:', error)
    return NextResponse.json(
      { error: 'Monitor failed', details: error.message },
      { status: 500 }
    )
  }
}