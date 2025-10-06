import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 בודק את מבנה מסד הנתונים...');

    // 1. בדיקת כל הטבלאות
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name, table_type')
      .eq('table_schema', 'public')
      .order('table_name');

    if (tablesError) {
      console.error('❌ שגיאה בקבלת רשימת טבלאות:', tablesError);
      return NextResponse.json({ error: tablesError.message }, { status: 500 });
    }

    // 2. בדיקת טבלאות רלוונטיות למיילים
    const relevantTables = [
      'emails',
      'email_sync', 
      'email_insights',
      'gmail_sync_log',
      'email_sync_log',
      'processed_emails',
      'email_tracking'
    ];

    const tableInfo: any = {};
    
    for (const tableName of relevantTables) {
      const tableExists = tables?.some(t => t.table_name === tableName);
      if (tableExists) {
        // בדיקת מבנה הטבלה
        const { data: columns, error: columnsError } = await supabaseAdmin
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable, column_default')
          .eq('table_schema', 'public')
          .eq('table_name', tableName)
          .order('ordinal_position');

        // בדיקת מספר רשומות
        const { count, error: countError } = await supabaseAdmin
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        tableInfo[tableName] = {
          exists: true,
          columns: columnsError ? null : columns,
          rowCount: countError ? null : count
        };
      } else {
        tableInfo[tableName] = { exists: false };
      }
    }

    // 3. בדיקת אינדקסים
    const { data: indexes, error: indexesError } = await supabaseAdmin
      .from('pg_indexes')
      .select('indexname, tablename, indexdef')
      .eq('schemaname', 'public')
      .like('indexname', '%email%');

    return NextResponse.json({
      success: true,
      totalTables: tables?.length || 0,
      tables: tables?.map(t => t.table_name) || [],
      emailRelatedTables: tableInfo,
      emailIndexes: indexesError ? null : indexes,
      summary: {
        totalTables: tables?.length || 0,
        emailTablesFound: Object.values(tableInfo).filter((info: any) => info.exists).length,
        totalIndexes: indexesError ? 0 : indexes?.length || 0
      }
    });

  } catch (error: any) {
    console.error('❌ שגיאה כללית:', error);
    return NextResponse.json(
      { error: 'Database check failed', details: error.message },
      { status: 500 }
    );
  }
}
