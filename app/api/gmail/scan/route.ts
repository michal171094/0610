// 🔍 Gmail Scanner - Trigger intelligent email scan
import { NextRequest, NextResponse } from 'next/server';
import { scanAllAccounts } from '@/lib/gmail/scanner';

export async function POST(request: NextRequest) {
  try {
    // TODO: Get actual user ID from session
    const userId = 'michal-user-id';
    
    // Parse options from request body
    const body = await request.json().catch(() => ({}));
    const { timeRange, includeRead, showLastEmailPerCompany, forceFullScan } = body;
    
    console.log('🚀 Starting Gmail scan with options:', { timeRange, includeRead, showLastEmailPerCompany });
    
    const results = await scanAllAccounts(userId, {
      timeRange: timeRange || 'week',
      includeRead: includeRead || false,
      showLastEmailPerCompany: showLastEmailPerCompany || false,
      forceFullScan: forceFullScan || false,
      maxResults: 100
    });
    
    // Get the actual insights from database
    const { supabaseAdmin } = await import('@/lib/supabase');
    const { data: insights } = await supabaseAdmin
      .from('email_insights')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    return NextResponse.json({
      scanned: true,
      relevant: results.updates?.length || 0,
      tasksCreated: 0,
      success: true,
      totalEmails: results.totalEmails || 0,
      updates: results.updates || [],  // ✅ שטח את updates החוצה!
      insights: insights || [],
      message: `Scanned ${results.totalEmails} emails, found ${results.updates?.length || 0} relevant, created 0 tasks`
    });
  } catch (error: any) {
    console.error('❌ Gmail scan error:', error);
    return NextResponse.json(
      { error: 'Failed to scan Gmail accounts', details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint to check scan status
export async function GET(request: NextRequest) {
  try {
    // TODO: Get actual user ID from session
    const userId = 'michal-user-id';
    
    // Return last scan info (you can add a table to track this)
    return NextResponse.json({
      status: 'ready',
      message: 'Use POST to trigger a scan'
    });
  } catch (error: any) {
    console.error('❌ Error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
  }