/**
 * 🔁 Background Sync API - polling כל 5 דקות
 * 
 * מפעיל סנכרון מלא מכל המקורות:
 * - Gmail Scanner
 * - Drive Scanner
 * - Chat History Analysis
 * - Cross-domain analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DB_SCHEMA } from '@/lib/config/schema';
import { DriveScanner } from '@/lib/drive/scanner';
import { SyncAgent } from '@/lib/agents/sync-agent';
import { performReverseSearch, saveReverseSearchResults } from '@/lib/agents/reverse-search-agent';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting comprehensive background sync...');
    
    const syncResults = {
      gmail: { scanned: 0, insights: 0 },
      drive: { scanned: 0, insights: 0 },
      chat: { analyzed: 0, insights: 0 },
      reverseSearch: { targets: 0, newEmails: 0, updates: 0 },
      crossDomain: { connections: 0, suggestions: 0 },
      total: { suggestions: 0, errors: [] as string[] }
    };

    // 1. Gmail Sync - Check for new insights that need processing
    try {
      console.log('📧 Starting Gmail sync...');
      
      // Check for unprocessed email insights from recent scans
      const { data: newInsights } = await supabaseAdmin
        .from(DB_SCHEMA.email_insights.table)
        .select('*')
        .eq('processed', false)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(50);

      if (newInsights && newInsights.length > 0) {
        // Process each insight
        let processedCount = 0;
        for (const insight of newInsights) {
          if (insight.should_create_task || insight.is_update) {
            processedCount++;
          }
          
          // Mark as processed
          await supabaseAdmin
            .from(DB_SCHEMA.email_insights.table)
            .update({ processed: true })
            .eq('id', insight.id);
        }
        
        syncResults.gmail = {
          scanned: newInsights.length,
          insights: processedCount
        };
        console.log(`✅ Gmail sync completed: ${newInsights.length} insights processed, ${processedCount} actionable`);
      } else {
        syncResults.gmail = { scanned: 0, insights: 0 };
        console.log('✅ Gmail sync completed: No new insights to process');
      }
    } catch (error) {
      console.error('❌ Gmail sync error:', error);
      syncResults.total.errors.push(`Gmail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 2. Drive Sync - Check for new document insights
    try {
      console.log('📁 Starting Drive sync...');
      
      // Check for unprocessed document insights
      const { data: newDocumentInsights } = await supabaseAdmin
        .from(DB_SCHEMA.document_insights.table)
        .select('*')
        .eq('processed', false)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(50);

      if (newDocumentInsights && newDocumentInsights.length > 0) {
        let processedCount = 0;
        for (const insight of newDocumentInsights) {
          if (insight.relevance !== 'low' && (insight.action_items?.length > 0 || insight.suggested_tasks?.length > 0)) {
            processedCount++;
          }
          
          // Mark as processed (we'll add this field to the schema)
          await supabaseAdmin
            .from(DB_SCHEMA.document_insights.table)
            .update({ processed: true })
            .eq('id', insight.id);
        }
        
        syncResults.drive = {
          scanned: newDocumentInsights.length,
          insights: processedCount
        };
        console.log(`✅ Drive sync completed: ${newDocumentInsights.length} documents processed, ${processedCount} actionable`);
      } else {
        syncResults.drive = { scanned: 0, insights: 0 };
        console.log('✅ Drive sync completed: No new document insights to process');
      }
    } catch (error) {
      console.error('❌ Drive sync error:', error);
      syncResults.total.errors.push(`Drive: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 3. Communications Analysis (Chat/WhatsApp)
    try {
      console.log('💬 Analyzing communications...');
      
      // Get recent communications that haven't been analyzed
      const { data: communications } = await supabaseAdmin
        .from(DB_SCHEMA.communications.table)
        .select('*')
        .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .eq('processed', false)
        .limit(50);

      if (communications && communications.length > 0) {
        // Analyze each communication for actionable items
        let insightsCount = 0;
        for (const comm of communications) {
          const hasActionableKeywords = hasActionableContent(comm.content || '');
          if (hasActionableKeywords) {
            insightsCount++;
            
            // Mark as processed
            await supabaseAdmin
              .from(DB_SCHEMA.communications.table)
              .update({ processed: true, processed_at: new Date().toISOString() })
              .eq('id', comm.id);
          }
        }
        
        syncResults.chat.analyzed = communications.length;
        syncResults.chat.insights = insightsCount;
        console.log(`✅ Communications analysis completed: ${communications.length} messages, ${insightsCount} actionable`);
      } else {
        syncResults.chat = { analyzed: 0, insights: 0 };
        console.log('✅ Communications analysis completed: No new communications to process');
      }
    } catch (error) {
      console.error('❌ Communications analysis error:', error);
      syncResults.total.errors.push(`Communications: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 4. Reverse Search - Find new emails for existing entities
    try {
      console.log('🔍 Starting reverse search...');
      
      const reverseResults = await performReverseSearch('michal', 50);
      
      syncResults.reverseSearch.targets = reverseResults.length;
      syncResults.reverseSearch.newEmails = reverseResults.reduce((sum, r) => sum + r.found_emails, 0);
      syncResults.reverseSearch.updates = reverseResults.reduce((sum, r) => sum + r.new_updates, 0);
      
      // Save results to memory
      await saveReverseSearchResults(reverseResults);
      
      console.log(`✅ Reverse search completed: ${reverseResults.length} targets, ${syncResults.reverseSearch.newEmails} emails found, ${syncResults.reverseSearch.updates} updates`);
    } catch (error) {
      console.error('❌ Reverse search error:', error);
      syncResults.total.errors.push(`Reverse search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 5. Cross-Domain Analysis
    try {
      console.log('🔗 Starting cross-domain analysis...');
      
      const syncAgent = new SyncAgent();
      const syncResult = await syncAgent.sync({
        sinceDays: 7,
        maxEmails: 100,
        autoApprove: false
      });

      syncResults.crossDomain.connections = syncResult.updates_found;
      syncResults.crossDomain.suggestions = syncResult.suggestions.length;
      syncResults.total.suggestions = syncResult.suggestions.length;
    } catch (error) {
      console.error('❌ Cross-domain analysis error:', error);
      syncResults.total.errors.push(`Cross-domain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 6. Log sync results
    await supabaseAdmin
      .from(DB_SCHEMA.sync_logs.table)
      .insert({
        sync_time: new Date().toISOString(),
        processed_items: {
          gmail: syncResults.gmail,
          drive: syncResults.drive,
          chat: syncResults.chat,
          crossDomain: syncResults.crossDomain
        },
        errors: syncResults.total.errors.length > 0 ? syncResults.total.errors : null
      });

    console.log('✅ Background sync completed:', syncResults);

    return NextResponse.json({
      success: true,
      message: 'Background sync completed successfully',
      results: syncResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Background sync error:', error);
    
    // Log error
    await supabaseAdmin
      .from(DB_SCHEMA.sync_logs.table)
      .insert({
        sync_time: new Date().toISOString(),
        processed_items: null,
        errors: [{ type: 'system', message: error instanceof Error ? error.message : 'Unknown error' }]
      });

    return NextResponse.json(
      { 
        error: 'Background sync failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Get background sync status and history
 */
export async function GET(request: NextRequest) {
  try {
    // Get recent sync logs
    const { data: recentLogs } = await supabaseAdmin
      .from(DB_SCHEMA.sync_logs.table)
      .select('*')
      .order('sync_time', { ascending: false })
      .limit(10);

    // Get sync statistics
    const { count: totalLogs } = await supabaseAdmin
      .from(DB_SCHEMA.sync_logs.table)
      .select('*', { count: 'exact', head: true });

    const { count: errorLogs } = await supabaseAdmin
      .from(DB_SCHEMA.sync_logs.table)
      .select('*', { count: 'exact', head: true })
      .not('errors', 'is', null);

    return NextResponse.json({
      success: true,
      status: {
        totalSyncs: totalLogs || 0,
        errorSyncs: errorLogs || 0,
        successRate: totalLogs ? ((totalLogs - (errorLogs || 0)) / totalLogs * 100).toFixed(1) : '100',
        recentLogs: recentLogs || []
      }
    });

  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }

}

/**
 * Check if communication content has actionable keywords
 */
function hasActionableContent(content: string): boolean {
  const actionableKeywords = [
    'צריך', 'חשוב', 'דדליין', 'מועד', 'להתקשר', 'לשלוח', 'לעדכן',
    'תזכורת', 'תשלום', 'חיוב', 'חשבון', 'מסמך', 'לשלוח', 'להעביר',
    'urgent', 'deadline', 'payment', 'document', 'call', 'send'
  ];
  
  return actionableKeywords.some(keyword => 
    content.toLowerCase().includes(keyword.toLowerCase())
  );
}