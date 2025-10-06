// 🔍 סקריפט לבדיקת טבלאות קיימות
import { supabaseAdmin } from '../lib/supabase';

async function checkAllTables() {
  console.log('🔍 בודק אילו טבלאות קיימות...\n');
  
  // רשימת כל הטבלאות שאני מצפה למצוא
  const expectedTables = [
    'unified_dashboard',
    'debts',
    'clients',
    'bureaucracy',
    'email_insights',
    'gmail_accounts',
    'drive_accounts',
    'document_insights',
    'agent_memories',
    'agent_instructions',
    'agent_learning_log',
    'sync_sessions',
    'entity_connections',
    'learned_patterns',
    'web_search_cache',
    'reasoning_log',
    'profiles',
    'refresh_tokens',
    'tasks_chat_history'
  ];
  
  const results: Record<string, any> = {};
  
  for (const table of expectedTables) {
    try {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        results[table] = { exists: false, error: error.message };
        console.log(`❌ ${table}: לא קיים (${error.message})`);
      } else {
        results[table] = { exists: true, count };
        console.log(`✅ ${table}: ${count} שורות`);
      }
    } catch (err: any) {
      results[table] = { exists: false, error: err.message };
      console.log(`❌ ${table}: שגיאה - ${err.message}`);
    }
  }
  
  // סיכום
  console.log('\n📊 סיכום:\n');
  const existing = Object.keys(results).filter(t => results[t].exists);
  const missing = Object.keys(results).filter(t => !results[t].exists);
  
  console.log(`✅ טבלאות קיימות (${existing.length}):`);
  existing.forEach(t => console.log(`   • ${t} (${results[t].count} שורות)`));
  
  console.log(`\n❌ טבלאות חסרות (${missing.length}):`);
  missing.forEach(t => console.log(`   • ${t}`));
  
  // שמור תוצאות לקובץ
  const fs = require('fs');
  fs.writeFileSync(
    'EXISTING-TABLES-REPORT.json',
    JSON.stringify(results, null, 2)
  );
  
  console.log('\n💾 תוצאות נשמרו ב: EXISTING-TABLES-REPORT.json');
}

checkAllTables().catch(console.error);
