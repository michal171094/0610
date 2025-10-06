/**
 * 🔔 Monitor Check API - בדיקת התראות
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMonitorAgent } from '@/lib/agents/monitor-agent';

export async function GET(request: NextRequest) {
  try {
    const agent = getMonitorAgent();
    
    const [overdue, stuck] = await Promise.all([
      agent.checkOverdueTasks(),
      agent.checkStuckTasks(),
    ]);

    return NextResponse.json({
      success: true,
      alerts: {
        overdue: overdue.length,
        stuck: stuck.length,
      },
      tasks: {
        overdue,
        stuck,
      },
    });
  } catch (error: any) {
    console.error('Monitor check error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
