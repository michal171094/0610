/**
 * 📱 WhatsApp Scanner API
 * 
 * סורק הודעות WhatsApp ומוצא פעולות נדרשות
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DB_SCHEMA } from '@/lib/config/schema';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { timeRange = 'week', maxMessages = 100 } = body;
    
    console.log('📱 Starting WhatsApp scan...');
    
    // Calculate date range
    const days = timeRange === 'day' ? 1 : timeRange === 'week' ? 7 : 30;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    
    // Get recent WhatsApp messages
    const { data: whatsappMessages, error } = await supabaseAdmin
      .from(DB_SCHEMA.communications.table)
      .select('*')
      .eq('type', 'whatsapp')
      .gte('timestamp', sinceDate.toISOString())
      .eq('processed', false)
      .order('timestamp', { ascending: false })
      .limit(maxMessages);

    if (error) {
      throw error;
    }

    if (!whatsappMessages || whatsappMessages.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new WhatsApp messages to process',
        stats: {
          messagesScanned: 0,
          actionableFound: 0,
          tasksCreated: 0
        },
        insights: []
      });
    }

    // Analyze messages for actionable content
    const actionableKeywords = [
      'צריך', 'חשוב', 'דדליין', 'מועד', 'להתקשר', 'לשלוח', 'לעדכן',
      'תזכורת', 'תשלום', 'חיוב', 'חשבון', 'מסמך', 'לשלוח', 'להעביר',
      'urgent', 'deadline', 'payment', 'document', 'call', 'send', 'reminder'
    ];

    const actionableMessages = [];
    let tasksCreated = 0;

    for (const message of whatsappMessages) {
      const content = message.content || '';
      const hasActionableKeywords = actionableKeywords.some(keyword => 
        content.toLowerCase().includes(keyword.toLowerCase())
      );

      if (hasActionableKeywords) {
        actionableMessages.push({
          id: message.id,
          content: content,
          contact: message.contact_name || 'Unknown',
          timestamp: message.timestamp,
          suggestedAction: extractSuggestedAction(content)
        });

        // Mark as processed
        await supabaseAdmin
          .from(DB_SCHEMA.communications.table)
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('id', message.id);
      }
    }

    console.log(`✅ WhatsApp scan completed: ${whatsappMessages.length} messages, ${actionableMessages.length} actionable`);

    return NextResponse.json({
      success: true,
      message: `WhatsApp scan completed successfully`,
      stats: {
        messagesScanned: whatsappMessages.length,
        actionableFound: actionableMessages.length,
        tasksCreated: tasksCreated
      },
      insights: actionableMessages
    });

  } catch (error) {
    console.error('❌ WhatsApp scan error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'WhatsApp scan failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Extract suggested action from message content
 */
function extractSuggestedAction(content: string): string {
  const lowerContent = content.toLowerCase();
  
  if (lowerContent.includes('תשלום') || lowerContent.includes('payment')) {
    return 'Payment reminder - check if payment is needed';
  }
  
  if (lowerContent.includes('מסמך') || lowerContent.includes('document')) {
    return 'Document request - prepare or send required documents';
  }
  
  if (lowerContent.includes('התקשר') || lowerContent.includes('call')) {
    return 'Call request - make phone call to contact';
  }
  
  if (lowerContent.includes('שלח') || lowerContent.includes('send')) {
    return 'Send request - send information or documents';
  }
  
  if (lowerContent.includes('דדליין') || lowerContent.includes('deadline')) {
    return 'Deadline reminder - check and update task deadlines';
  }
  
  return 'General action required - review message for specific tasks';
}
