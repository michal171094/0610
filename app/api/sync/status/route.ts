/**
 * 📊 Sync Status API - בדיקת סטטוס
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // קרא email_insights שלא processed
    const { data: unprocessed, error } = await supabaseAdmin
      .from('email_insights')
      .select('id')
      .eq('processed', false);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      unprocessed: unprocessed?.length || 0,
      lastSync: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Status error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
