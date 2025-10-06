// 🤖 LangGraph AI Agent Chat - State Machine with Memory & Tools
import { NextRequest, NextResponse } from 'next/server';
import { aiAgent } from '@/lib/ai-agent/langraph';

export async function POST(request: NextRequest) {
  try {
    const { message, threadId = 'michal-main' } = await request.json();
    
    console.log(`\n📥 Incoming chat request`);
    console.log(`💬 Message: ${message}`);
    console.log(`🧵 Thread: ${threadId}`);
    
    // השתמש ב-LangGraph agent עם state machine מלא
    const response = await aiAgent.chat(message, threadId);
    
    console.log(`✅ Response ready`);
    
    return NextResponse.json({
      response,
      metadata: {
        threadId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ Agent chat error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// ההקוד הישן הוסר - עכשיו משתמשים רק ב-LangGraph Agent
