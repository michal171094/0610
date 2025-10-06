/**
 * 🔍 בדיקת מבנה מסד הנתונים הקיים
 * בודק אילו טבלאות קיימות ומבנה שלהן
 */

import { supabaseAdmin } from '@/lib/supabase';

async function checkDatabaseStructure() {
  console.log('🔍 בודק את מבנה מסד הנתונים...\n');

  try {
    // 1. בדיקת כל הטבלאות
    console.log('📋 רשימת כל הטבלאות:');
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name, table_type')
      .eq('table_schema', 'public')
      .order('table_name');

    if (tablesError) {
      console.error('❌ שגיאה בקבלת רשימת טבלאות:', tablesError);
      return;
    }

    console.log(`✅ נמצאו ${tables?.length || 0} טבלאות:`);
    tables?.forEach(table => {
      console.log(`  - ${table.table_name} (${table.table_type})`);
    });

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

    console.log('\n📧 בדיקת טבלאות רלוונטיות למיילים:');
    for (const tableName of relevantTables) {
      const tableExists = tables?.some(t => t.table_name === tableName);
      if (tableExists) {
        console.log(`  ✅ ${tableName} - קיימת`);
        
        // בדיקת מבנה הטבלה
        const { data: columns, error: columnsError } = await supabaseAdmin
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable, column_default')
          .eq('table_schema', 'public')
          .eq('table_name', tableName)
          .order('ordinal_position');

        if (!columnsError && columns) {
          console.log(`    📊 שדות: ${columns.map(c => c.column_name).join(', ')}`);
        }
      } else {
        console.log(`  ❌ ${tableName} - לא קיימת`);
      }
    }

    // 3. בדיקת נתונים בטבלאות קיימות
    console.log('\n📊 בדיקת נתונים בטבלאות רלוונטיות:');
    
    for (const tableName of relevantTables) {
      const tableExists = tables?.some(t => t.table_name === tableName);
      if (tableExists) {
        try {
          const { count, error } = await supabaseAdmin
            .from(tableName)
            .select('*', { count: 'exact', head: true });
          
          if (!error) {
            console.log(`  📈 ${tableName}: ${count} רשומות`);
          }
        } catch (error) {
          console.log(`  ⚠️ ${tableName}: לא ניתן לספור רשומות`);
        }
      }
    }

    // 4. בדיקת אינדקסים
    console.log('\n🔍 בדיקת אינדקסים:');
    const { data: indexes, error: indexesError } = await supabaseAdmin
      .from('pg_indexes')
      .select('indexname, tablename, indexdef')
      .eq('schemaname', 'public')
      .like('indexname', '%email%');

    if (!indexesError && indexes) {
      console.log(`✅ נמצאו ${indexes.length} אינדקסים רלוונטיים:`);
      indexes.forEach(index => {
        console.log(`  - ${index.indexname} על ${index.tablename}`);
      });
    } else {
      console.log('❌ לא נמצאו אינדקסים רלוונטיים');
    }

  } catch (error) {
    console.error('❌ שגיאה כללית:', error);
  }
}

// הרצה אם הקובץ נקרא ישירות
if (require.main === module) {
  checkDatabaseStructure().then(() => {
    console.log('\n✅ בדיקה הושלמה');
    process.exit(0);
  }).catch(error => {
    console.error('❌ שגיאה:', error);
    process.exit(1);
  });
}

export { checkDatabaseStructure };
