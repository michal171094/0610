// 🎯 Next Action API - Get smart recommendation
import { NextRequest, NextResponse } from 'next/server';
import { getNextActionRecommendation, checkOverdueTasks, suggestDeadlines } from '@/lib/ai-agent/next-action';

export async function GET(request: NextRequest) {
  try {
    console.log('🎯 Getting next action recommendation...');
    
    // Check overdue tasks first
    const overdueCount = await checkOverdueTasks();
    if (overdueCount > 0) {
      console.log(`⚠️ Updated ${overdueCount} overdue tasks`);
    }

    // Get recommendation
    const recommendation = await getNextActionRecommendation();
    
    if (!recommendation) {
      return NextResponse.json({
        message: 'אין משימות פעילות',
        hasRecommendation: false
      });
    }

    return NextResponse.json({
      hasRecommendation: true,
      recommendation,
      overdueTasksUpdated: overdueCount
    });
  } catch (error: any) {
    console.error('❌ Next action error:', error);
    return NextResponse.json(
      { error: 'Failed to get next action', details: error.message },
      { status: 500 }
    );
  }
}

// POST to suggest deadlines for tasks without them
export async function POST(request: NextRequest) {
  try {
    console.log('📅 Suggesting deadlines for tasks...');
    
    await suggestDeadlines();
    
    return NextResponse.json({
      success: true,
      message: 'Deadlines suggested successfully'
    });
  } catch (error: any) {
    console.error('❌ Suggest deadlines error:', error);
    return NextResponse.json(
      { error: 'Failed to suggest deadlines', details: error.message },
      { status: 500 }
    );
  }
}
