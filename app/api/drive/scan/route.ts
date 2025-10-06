/**
 * 📁 Drive Scan API
 * POST /api/drive/scan
 * 
 * סורק מסמכים ב-Google Drive ומנתח אותם עם AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { DriveScanner } from '@/lib/drive/scanner';
import { supabaseAdmin } from '@/lib/supabase';
import { DB_SCHEMA } from '@/lib/config/schema';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId = 'michal', // Default user for now
      sinceDays = 7,
      maxFiles = 50,
      includeRead = false
    } = body;

    console.log(`🔍 Starting Drive scan for user ${userId}...`);

    // Check if user has Drive account connected
    const { data: driveAccount, error: accountError } = await supabaseAdmin
      .from(DB_SCHEMA.drive_accounts.table)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (accountError || !driveAccount) {
      return NextResponse.json({
        success: false,
        error: 'No Drive account connected',
        message: 'Please connect your Google Drive account first'
      }, { status: 400 });
    }

    // Initialize Drive Scanner
    const driveScanner = new DriveScanner(userId);

    // Scan documents
    const insights = await driveScanner.scanAllDocuments({
      sinceDays,
      maxFiles,
      includeRead
    });

    // Update last scanned timestamp
    await driveScanner.updateLastScanned();

    // Filter relevant insights
    const relevantInsights = insights.filter(insight => insight.relevance !== 'low');
    
    console.log(`✅ Drive scan completed: ${relevantInsights.length} relevant documents found`);

    return NextResponse.json({
      success: true,
      message: `Found ${relevantInsights.length} relevant documents`,
      insights: relevantInsights,
      stats: {
        totalScanned: insights.length,
        relevantFound: relevantInsights.length,
        highRelevance: relevantInsights.filter(i => i.relevance === 'high').length,
        mediumRelevance: relevantInsights.filter(i => i.relevance === 'medium').length,
        suggestedTasks: relevantInsights.reduce((sum, i) => sum + i.suggested_tasks.length, 0),
        actionItems: relevantInsights.reduce((sum, i) => sum + i.action_items.length, 0)
      }
    });

  } catch (error) {
    console.error('❌ Drive scan error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Drive scan failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET - Get Drive scan status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'michal';

    // Get Drive account info
    const { data: driveAccount } = await supabaseAdmin
      .from(DB_SCHEMA.drive_accounts.table)
      .select('*')
      .eq('user_id', userId)
      .single();

    // Get recent document insights
    const { data: recentInsights } = await supabaseAdmin
      .from(DB_SCHEMA.document_insights.table)
      .select('*')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      success: true,
      status: {
        connected: !!driveAccount,
        lastScanned: driveAccount?.last_scanned_at || null,
        recentInsights: recentInsights?.length || 0,
        account: driveAccount ? {
          id: driveAccount.id,
          connectedAt: driveAccount.created_at,
          expiresAt: driveAccount.expires_at
        } : null
      }
    });

  } catch (error) {
    console.error('Error getting Drive status:', error);
    return NextResponse.json(
      { error: 'Failed to get Drive status' },
      { status: 500 }
    );
  }
}
