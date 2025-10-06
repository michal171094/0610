import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 בדיקה פשוטה של מסד הנתונים...');

    // בדיקת טבלאות בסיסיות
    const tablesToCheck = ['emails', 'email_sync', 'email_insights', 'gmail_sync_log'];
    const results: any = {};

    for (const table of tablesToCheck) {
      try {
        const { data, error } = await supabaseAdmin
          .from(table)
          .select('*')
          .limit(1);

        results[table] = {
          exists: !error,
          error: error?.message || null,
          sampleData: data?.[0] || null
        };
      } catch (err: any) {
        results[table] = {
          exists: false,
          error: err.message
        };
      }
    }

    // בדיקת מספר רשומות בטבלאות קיימות
    const countResults: any = {};
    for (const table of tablesToCheck) {
      if (results[table]?.exists) {
        try {
          const { count, error } = await supabaseAdmin
            .from(table)
            .select('*', { count: 'exact', head: true });
          
          countResults[table] = count || 0;
        } catch (err) {
          countResults[table] = 'error';
        }
      }
    }

    return NextResponse.json({
      success: true,
      tables: results,
      counts: countResults,
      message: 'Simple database check completed'
    });

  } catch (error: any) {
    console.error('❌ שגיאה:', error);
    return NextResponse.json(
      { error: 'Simple check failed', details: error.message },
      { status: 500 }
    );
  }
}
