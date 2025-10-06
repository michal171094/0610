git add -A && git commit -m "Snapshot commit: project state on 2025-10-06"import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SyncAgent } from '@/lib/agents/sync-agent';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

/**
 * POST /api/sync/run
 * 
 * מפעיל את תהליך ה-Sync:
 * 1. קורא email_insights חדשים (שעדיין לא עובדו)
 * 2. מפעיל SyncAgent לניתוח והשוואה
 * 3. מחזיר הצעות עדכון
 * 
 * Body (optional):
 * {
 *   sinceDays?: number,  // ברירת מחדל: 7
 *   maxEmails?: number,  // ברירת מחדל: 50
 *   forceRescan?: boolean // ברירת מחדל: false
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { 
      sinceDays = 7, 
      maxEmails = 50,
      forceRescan = false 
    } = body;

    console.log('🔄 Starting sync process...', { sinceDays, maxEmails, forceRescan });

    // 1. קרא email_insights חדשים מהסופבייס
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - sinceDays);

    let query = supabaseAdmin
      .from('email_insights')
      .select('*')
      .gte('created_at', sinceDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(maxEmails);

    // אם לא forceRescan, קח רק אלו שעדיין לא עובדו
    if (!forceRescan) {
      query = query.or('processed.is.null,processed.eq.false');
    }

    const { data: emailInsights, error: emailError } = await query;

    if (emailError) {
      console.error('❌ Error fetching email insights:', emailError);
      return NextResponse.json(
        { error: 'Failed to fetch email insights', details: emailError.message },
        { status: 500 }
      );
    }

    if (!emailInsights || emailInsights.length === 0) {
      console.log('ℹ️ No new email insights found');
      return NextResponse.json({
        success: true,
        message: 'No new emails to process',
        proposals: [],
        stats: {
          emailsProcessed: 0,
          proposalsGenerated: 0
        }
      });
    }

    console.log(`📧 Found ${emailInsights.length} email insights to process`);

    // 2. הפעל את ה-SyncAgent
    const syncAgent = new SyncAgent();
    
    const syncResult = await syncAgent.sync({
      emailInsights,
      sinceDays,
      maxEmails
    });

    console.log('✅ Sync completed:', {
      proposalsCount: syncResult.proposals.length,
      errors: syncResult.errors?.length || 0
    });

    // 3. סמן את ה-email_insights כמעובדים
    const emailIds = emailInsights.map(e => e.id);
    if (emailIds.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('email_insights')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .in('id', emailIds);

      if (updateError) {
        console.warn('⚠️ Failed to mark emails as processed:', updateError);
      }
    }

    // 4. החזר את התוצאות
    return NextResponse.json({
      success: true,
      message: `Processed ${emailInsights.length} emails`,
      proposals: syncResult.proposals,
      stats: {
        emailsProcessed: emailInsights.length,
        proposalsGenerated: syncResult.proposals.length,
        errors: syncResult.errors?.length || 0
      },
      errors: syncResult.errors || []
    });

  } catch (error: any) {
    console.error('❌ Error in sync/run:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync/run
 * 
 * מחזיר סטטוס של תהליך ה-sync
 */
export async function GET() {
  try {
    // ספירת email_insights שעדיין לא עובדו
    const { count: pendingCount, error: countError } = await supabaseAdmin
      .from('email_insights')
      .select('*', { count: 'exact', head: true })
      .or('processed.is.null,processed.eq.false');

    if (countError) {
      throw countError;
    }

    // ספירת email_insights שעובדו ב-7 הימים האחרונים
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: processedCount, error: processedError } = await supabaseAdmin
      .from('email_insights')
      .select('*', { count: 'exact', head: true })
      .eq('processed', true)
      .gte('processed_at', sevenDaysAgo.toISOString());

    if (processedError) {
      throw processedError;
    }

    return NextResponse.json({
      success: true,
      status: {
        pendingEmails: pendingCount || 0,
        processedLast7Days: processedCount || 0,
        lastChecked: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ Error in sync/run GET:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status', details: error.message },
      { status: 500 }
    );
  }
}