#!/usr/bin/env ts-node
/**
 * 🏗️ Generate Skeleton Script
 * יצירת כל הקבצים החסרים עם TODO placeholders
 */

import * as fs from 'fs';
import * as path from 'path';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

interface FileToCreate {
  path: string;
  content: string;
}

/**
 * יצירת קובץ עם התוכן
 */
function createFile(file: FileToCreate): boolean {
  const fullPath = path.join(process.cwd(), file.path);
  const dir = path.dirname(fullPath);
  
  // צור תיקייה אם לא קיימת
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // אל תדרוס קובץ קיים
  if (fs.existsSync(fullPath)) {
    log(`  ⚠️  קיים כבר: ${file.path}`, colors.yellow);
    return false;
  }
  
  fs.writeFileSync(fullPath, file.content, 'utf8');
  log(`  ✅ נוצר: ${file.path}`, colors.green);
  return true;
}

/**
 * רשימת כל הקבצים ליצירה
 */
const FILES_TO_CREATE: FileToCreate[] = [
  // 1. Memory Manager
  {
    path: 'lib/memory/manager.ts',
    content: `/**
 * 🧠 Memory Manager - ניהול זיכרון ארוך טווח
 */

import { supabaseAdmin } from '@/lib/supabase';
import DB_SCHEMA from '@/lib/config/schema';

interface Instruction {
  id: string;
  instruction: string;
  scope: string;
  importance: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface Memory {
  id: string;
  memory_type: string;
  content: any;
  importance: number;
  last_accessed: string;
  access_count: number;
  created_at: string;
}

export class MemoryManager {
  /**
   * 💾 שמור הוראה חדשה
   */
  async saveInstruction(
    instruction: string,
    scope: 'global' | 'domain' | 'task',
    importance: number = 5
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from(DB_SCHEMA.agent_instructions.table)
      .insert({
        instruction,
        scope,
        importance,
        active: true,
      });

    if (error) {
      console.error('Failed to save instruction:', error);
      throw error;
    }
  }

  /**
   * 📖 קרא הוראות פעילות
   */
  async getInstructions(scope?: string): Promise<Instruction[]> {
    let query = supabaseAdmin
      .from(DB_SCHEMA.agent_instructions.table)
      .select('*')
      .eq('active', true)
      .order('importance', { ascending: false });

    if (scope) {
      query = query.eq('scope', scope);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to get instructions:', error);
      return [];
    }

    return data as Instruction[];
  }

  /**
   * 🔄 עדכן הוראה קיימת
   */
  async updateInstruction(
    id: string,
    updates: Partial<Instruction>
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from(DB_SCHEMA.agent_instructions.table)
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Failed to update instruction:', error);
      throw error;
    }
  }

  /**
   * 💭 שמור זיכרון
   */
  async saveMemory(
    content: any,
    type: 'fact' | 'preference' | 'pattern' | 'context',
    importance: number = 0.7
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from(DB_SCHEMA.agent_memories.table)
      .insert({
        memory_type: type,
        content,
        importance,
        access_count: 0,
      });

    if (error) {
      console.error('Failed to save memory:', error);
      throw error;
    }
  }

  /**
   * 🔍 אחזר זיכרונות רלוונטיים
   */
  async recall(
    context: string,
    limit: number = 10
  ): Promise<Memory[]> {
    const { data, error } = await supabaseAdmin
      .from(DB_SCHEMA.agent_memories.table)
      .select('*')
      .order('importance', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to recall memories:', error);
      return [];
    }

    // עדכן access_count
    if (data && data.length > 0) {
      const ids = data.map((m: any) => m.id);
      await supabaseAdmin.rpc('increment_memory_access', { memory_ids: ids });
    }

    return data as Memory[];
  }
}

// Singleton
let memoryManager: MemoryManager | null = null;

export function getMemoryManager(): MemoryManager {
  if (!memoryManager) {
    memoryManager = new MemoryManager();
  }
  return memoryManager;
}

export default MemoryManager;
`
  },

  // 2. API - Sync Run
  {
    path: 'app/api/sync/run/route.ts',
    content: `/**
 * 🔄 Sync Run API - הפעלת סנכרון
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // TODO: הוסף לוגיקה של sync-agent
    // 1. קרא email_insights שלא processed
    // 2. הרץ entity-resolver
    // 3. הרץ diff-detector
    // 4. החזר suggestions

    return NextResponse.json({
      success: true,
      message: 'Sync completed',
      suggestions: [],
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
`
  },

  // 3. API - Sync Apply
  {
    path: 'app/api/sync/apply/route.ts',
    content: `/**
 * ✅ Sync Apply API - אישור הצעות
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { suggestions } = body;

    // TODO: הוסף לוגיקה לאישור הצעות
    // 1. עבור על כל suggestion
    // 2. עדכן DB בהתאם
    // 3. סמן email_insights כ-processed

    return NextResponse.json({
      success: true,
      applied: 0,
    });
  } catch (error: any) {
    console.error('Apply error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
`
  },

  // 4. API - Sync Status
  {
    path: 'app/api/sync/status/route.ts',
    content: `/**
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
`
  },

  // 5. API - Background Sync
  {
    path: 'app/api/background/sync/route.ts',
    content: `/**
 * 🔁 Background Sync API - polling כל 5 דקות
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // TODO: הוסף לוגיקה של polling
    // 1. הפעל Gmail Scanner
    // 2. הפעל Sync Agent
    // 3. החזר תוצאות

    return NextResponse.json({
      success: true,
      scanned: 0,
      suggestions: 0,
    });
  } catch (error: any) {
    console.error('Background sync error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
`
  },

  // 6. Monitor Agent
  {
    path: 'lib/agents/monitor-agent.ts',
    content: `/**
 * 👁️ Monitor Agent - ניטור משימות ודדליינים
 */

import { supabaseAdmin } from '@/lib/supabase';
import DB_SCHEMA from '@/lib/config/schema';

export class MonitorAgent {
  /**
   * 🔍 בדוק משימות שעברו דדליין
   */
  async checkOverdueTasks() {
    const { data, error } = await supabaseAdmin
      .from(DB_SCHEMA.tasks.table)
      .select('*')
      .lt('deadline', new Date().toISOString())
      .neq('status', 'completed');

    if (error) {
      console.error('Failed to check overdue tasks:', error);
      return [];
    }

    return data || [];
  }

  /**
   * ⏳ בדוק משימות ללא עדכון
   */
  async checkStuckTasks(days: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await supabaseAdmin
      .from(DB_SCHEMA.tasks.table)
      .select('*')
      .eq('status', 'in_progress')
      .lt('updated_at', cutoffDate.toISOString());

    if (error) {
      console.error('Failed to check stuck tasks:', error);
      return [];
    }

    return data || [];
  }
}

// Singleton
let monitorAgent: MonitorAgent | null = null;

export function getMonitorAgent(): MonitorAgent {
  if (!monitorAgent) {
    monitorAgent = new MonitorAgent();
  }
  return monitorAgent;
}

export default MonitorAgent;
`
  },

  // 7. API - Monitor Check
  {
    path: 'app/api/monitor/check/route.ts',
    content: `/**
 * 🔔 Monitor Check API - בדיקת התראות
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMonitorAgent } from '@/lib/agents/monitor-agent';

export async function GET(request: NextRequest) {
  try {
    const agent = getMonitorAgent();
    
    const [overdue, stuck] = await Promise.all([
      agent.checkOverdueTasks(),
      agent.checkStuckTasks(),
    ]);

    return NextResponse.json({
      success: true,
      alerts: {
        overdue: overdue.length,
        stuck: stuck.length,
      },
      tasks: {
        overdue,
        stuck,
      },
    });
  } catch (error: any) {
    console.error('Monitor check error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
`
  },
];

/**
 * ריצה ראשית
 */
async function main() {
  log('\n🏗️  מתחיל יצירת Skeleton...\n', colors.bright + colors.cyan);

  let createdCount = 0;

  for (const file of FILES_TO_CREATE) {
    if (createFile(file)) {
      createdCount++;
    }
  }

  log('\n' + '='.repeat(50), colors.cyan);
  log(`✅ סיימתי! נוצרו ${createdCount}/${FILES_TO_CREATE.length} קבצים`, colors.bright + colors.green);
  log('='.repeat(50) + '\n', colors.cyan);

  log('🎯 הקבצים שנוצרו:', colors.bright);
  log('  ✅ lib/memory/manager.ts - Memory Manager מלא', colors.green);
  log('  ✅ app/api/sync/* - 3 API routes', colors.green);
  log('  ✅ app/api/background/sync - polling ברקע', colors.green);
  log('  ✅ lib/agents/monitor-agent.ts - Monitor Agent', colors.green);
  log('  ✅ app/api/monitor/check - API לmonitor\n', colors.green);

  log('📝 השלבים הבאים:', colors.bright);
  log('  1. מלא את הלוגיקה ב-sync-agent.ts', colors.cyan);
  log('  2. שלב entity-resolver + diff-detector', colors.cyan);
  log('  3. עדכן learning-tools.ts לקרוא מ-Memory Manager', colors.cyan);
  log('  4. עדכן langraph.ts לקרוא מ-Memory Manager', colors.cyan);
  log('  5. בדוק שהכל עובד!\n', colors.cyan);
}

main().catch(error => {
  log(`\n❌ שגיאה: ${error.message}`, colors.red);
  process.exit(1);
});