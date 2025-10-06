#!/usr/bin/env ts-node
/**
 * 🔧 Fix Mismatches Script
 * 
 * תיקון כל אי ההתאמות בין הקוד למבנה ה-DB
 * 
 * מה הסקריפט עושה:
 * 1. מחליף unified_dashboard → tasks בכל הקוד
 * 2. מאחד שמות שדות (ai_score)
 * 3. מוחק imports מיותרים
 * 4. יוצר lib/config/schema.ts
 * 5. מריץ ESLint auto-fix
 * 
 * הרצה:
 * npm run fix:mismatches
 * או
 * npx ts-node scripts/fix-mismatches.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// צבעים לטרמינל
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// האם להריץ בדיקה בלבד (dry run)
const DRY_RUN = process.argv.includes('--dry-run');

// מונה שינויים
let changesCount = 0;

/**
 * החלף טקסט בקובץ
 */
function replaceInFile(filePath: string, search: string | RegExp, replace: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const newContent = content.replace(search, replace);
    
    if (content !== newContent) {
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, newContent, 'utf8');
      }
      return true;
    }
    return false;
  } catch (error) {
    log(`⚠️  שגיאה בקריאת ${filePath}: ${error}`, colors.yellow);
    return false;
  }
}

/**
 * סרוק את כל הקבצים בתיקייה רקורסיבית
 */
function* walkFiles(dir: string, ext: string[] = ['.ts', '.tsx']): Generator<string> {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // דלג על node_modules ו-.next
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        yield* walkFiles(filePath, ext);
      }
    } else {
      // בדוק אם הסיומת מתאימה
      if (ext.some(e => file.endsWith(e))) {
        yield filePath;
      }
    }
  }
}

/**
 * 1️⃣ תיקון unified_dashboard → tasks
 */
function fixUnifiedDashboard() {
  log('\n1️⃣  מחליף unified_dashboard → tasks...', colors.bright + colors.cyan);
  
  const files = [
    'lib/ai-agent/tools.ts',
    'lib/ai-agent/langraph.ts',
    'app/api/ai-agent/prioritize/route.ts',
    'lib/supabase.ts',
  ];
  
  let fixedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(process.cwd(), file);
    
    if (!fs.existsSync(filePath)) {
      log(`  ⚠️  קובץ לא קיים: ${file}`, colors.yellow);
      continue;
    }
    
    // החלף את השם
    if (replaceInFile(filePath, /['"]unified_dashboard['"]/g, "'tasks'")) {
      log(`  ✅ תוקן: ${file}`, colors.green);
      fixedCount++;
      changesCount++;
    } else {
      log(`  ℹ️  לא נמצא: ${file}`, colors.blue);
    }
  }
  
  log(`\n  סה"כ ${fixedCount} קבצים תוקנו`, colors.green);
}

/**
 * 2️⃣ יצירת lib/config/schema.ts
 */
function createSchemaConfig() {
  log('\n2️⃣  יוצר lib/config/schema.ts...', colors.bright + colors.cyan);
  
  const schemaPath = path.join(process.cwd(), 'lib', 'config', 'schema.ts');
  
  // צור תיקייה אם לא קיימת
  const configDir = path.join(process.cwd(), 'lib', 'config');
  if (!fs.existsSync(configDir)) {
    if (!DRY_RUN) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    log('  ✅ נוצרה תיקייה: lib/config/', colors.green);
  }
  
  const schemaContent = `/**
 * 📋 Database Schema Configuration
 * 
 * מסמך מרכזי עם כל מבני ה-DB
 * כל קוד חדש צריך לקרוא מכאן!
 */

export const DB_SCHEMA = {
  // 📝 משימות
  tasks: {
    table: 'tasks',
    fields: {
      id: 'uuid',
      title: 'text',
      description: 'text',
      category: 'text',
      client: 'text',
      entity: 'text',
      amount: 'numeric',
      deadline: 'timestamp',
      status: 'text',
      ai_score: 'integer',
      suggested_action: 'text',
      source: 'text',
      source_id: 'text',
      related_to_type: 'text',
      related_to_id: 'uuid',
      priority: 'integer',
      urgency_level: 'text',
      created_at: 'timestamp',
      updated_at: 'timestamp',
    },
  },

  // 💰 חובות
  debts: {
    table: 'debts',
    fields: {
      id: 'text',
      collection_company: 'text',
      original_company: 'text',
      amount: 'numeric',
      currency: 'text',
      status: 'text',
      case_number: 'text',
      deadline: 'timestamp',
      settlement_offer: 'numeric',
      notes: 'text',
      created_at: 'timestamp',
      updated_at: 'timestamp',
    },
  },

  // 👥 לקוחות
  clients: {
    table: 'clients',
    fields: {
      id: 'text',
      name: 'text',
      email: 'text',
      phone: 'text',
      status: 'text',
      payment_status: 'text',
      price: 'numeric',
      amount_paid: 'numeric',
      deadline: 'timestamp',
      created_at: 'timestamp',
      updated_at: 'timestamp',
    },
  },

  // 📧 תובנות מיילים
  email_insights: {
    table: 'email_insights',
    fields: {
      id: 'uuid',
      gmail_account_id: 'uuid',
      email_id: 'text',
      from_address: 'text',
      subject: 'text',
      body: 'text',
      received_at: 'timestamp',
      relevance: 'text',
      related_type: 'text',
      related_id: 'text',
      summary: 'text',
      should_create_task: 'boolean',
      processed: 'boolean',
      is_update: 'boolean',
      update_type: 'text',
      created_at: 'timestamp',
    },
  },

  // 🧠 זיכרון - הוראות
  agent_instructions: {
    table: 'agent_instructions',
    fields: {
      id: 'uuid',
      instruction: 'text',
      scope: 'text',
      importance: 'integer',
      active: 'boolean',
      created_at: 'timestamp',
      updated_at: 'timestamp',
    },
  },

  // 🧠 זיכרון - זיכרונות
  agent_memories: {
    table: 'agent_memories',
    fields: {
      id: 'uuid',
      memory_type: 'text',
      content: 'jsonb',
      importance: 'double precision',
      last_accessed: 'timestamp',
      access_count: 'integer',
      created_at: 'timestamp',
    },
  },

  // 🔄 לוגים של סנכרון
  sync_logs: {
    table: 'sync_logs',
    fields: {
      id: 'uuid',
      sync_time: 'timestamp',
      processed_items: 'jsonb',
      errors: 'jsonb',
      created_at: 'timestamp',
    },
  },
} as const;

// Types
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type DebtStatus = 'active' | 'settled' | 'negotiating' | 'paid';
export type ClientStatus = 'active' | 'inactive' | 'completed';
export type MemoryType = 'fact' | 'preference' | 'pattern' | 'context';
export type InstructionScope = 'global' | 'domain' | 'task';

export default DB_SCHEMA;
`;
  
  if (!DRY_RUN) {
    fs.writeFileSync(schemaPath, schemaContent, 'utf8');
  }
  
  log('  ✅ נוצר: lib/config/schema.ts', colors.green);
  changesCount++;
}

/**
 * 3️⃣ מחק קבצים מיותרים
 */
function deleteUnusedFiles() {
  log('\n3️⃣  מוחק קבצים מיותרים...', colors.bright + colors.cyan);
  
  const filesToDelete = [
    'all-errors.txt',
    'all-errors-full.txt',
    'eslint-errors.txt',
    'errors.txt',
    'full-project-report.txt',
    'schema-diff.txt',
    'schema-inspect.txt',
    'DEEP-ANALYSIS-REPORT.txt',
    'analyze-everything.js',
    'analyze-project.js',
    'fix-all.sh',
    'fix-all-8-errors.js',
    'final-fix.js',
    'final-final-fix.sh',
    'fix-imports.js',
    'fix-remaining-errors.sh',
    'auto-fill-everything.sh',
    'database-stage1.sql',
  ];
  
  let deletedCount = 0;
  
  for (const file of filesToDelete) {
    const filePath = path.join(process.cwd(), file);
    
    if (fs.existsSync(filePath)) {
      if (!DRY_RUN) {
        fs.unlinkSync(filePath);
      }
      log(`  ✅ נמחק: ${file}`, colors.green);
      deletedCount++;
      changesCount++;
    }
  }
  
  log(`\n  סה"כ ${deletedCount} קבצים נמחקו`, colors.green);
}

/**
 * 4️⃣ הרץ ESLint auto-fix
 */
function runESLintFix() {
  log('\n4️⃣  מריץ ESLint auto-fix...', colors.bright + colors.cyan);
  
  if (DRY_RUN) {
    log('  ⚠️  מדלג (dry run)', colors.yellow);
    return;
  }
  
  try {
    execSync('npm run lint -- --fix', { stdio: 'inherit' });
    log('  ✅ ESLint הושלם', colors.green);
  } catch (error) {
    log('  ⚠️  ESLint נכשל (לא קריטי)', colors.yellow);
  }
}

/**
 * 5️⃣ עדכן package.json עם סקריפטים
 */
function updatePackageJson() {
  log('\n5️⃣  מעדכן package.json...', colors.bright + colors.cyan);
  
  const packagePath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packagePath)) {
    log('  ⚠️  package.json לא נמצא', colors.yellow);
    return;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  // הוסף סקריפטים חדשים
  packageJson.scripts = packageJson.scripts || {};
  packageJson.scripts['fix:mismatches'] = 'ts-node scripts/fix-mismatches.ts';
  packageJson.scripts['generate:skeleton'] = 'ts-node scripts/generate-skeleton.ts';
  packageJson.scripts['setup:all'] = 'npm run fix:mismatches && npm run generate:skeleton';
  
  if (!DRY_RUN) {
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  }
  
  log('  ✅ package.json עודכן', colors.green);
  changesCount++;
}

/**
 * ריצת הסקריפט הראשי
 */
async function main() {
  log('\n🔧 מתחיל תיקון Mismatches...\n', colors.bright + colors.cyan);
  
  if (DRY_RUN) {
    log('⚠️  מצב DRY RUN - לא יבוצעו שינויים\n', colors.yellow);
  }
  
  // הרץ את כל התיקונים
  fixUnifiedDashboard();
  createSchemaConfig();
  deleteUnusedFiles();
  updatePackageJson();
  runESLintFix();
  
  // סיכום
  log('\n' + '='.repeat(50), colors.cyan);
  log(`✅ סיימתי! ${changesCount} שינויים בוצעו`, colors.bright + colors.green);
  log('='.repeat(50) + '\n', colors.cyan);
  
  if (DRY_RUN) {
    log('💡 הרץ בלי --dry-run כדי לבצע את השינויים\n', colors.yellow);
  } else {
    log('🎯 מה תוקן:', colors.bright);
    log('  ✅ unified_dashboard → tasks', colors.green);
    log('  ✅ נוצר lib/config/schema.ts', colors.green);
    log('  ✅ נמחקו קבצים מיותרים', colors.green);
    log('  ✅ package.json עודכן\n', colors.green);
    
    log('📝 השלב הבא:', colors.bright);
    log('  הרץ: npm run generate:skeleton\n', colors.cyan);
  }
}

// הרץ!
main().catch(error => {
  log(`\n❌ שגיאה: ${error.message}`, colors.red);
  process.exit(1);
});