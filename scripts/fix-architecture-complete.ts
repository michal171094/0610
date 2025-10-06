// scripts/fix-architecture-complete-updated.ts
// סקריפט תיקון אוטומטי - גרסה מעודכנת לאוקטובר 2025
// משתמש ב-@langchain/langgraph 0.4.9, @langchain/openai 0.6.14

import * as fs from 'fs'
import * as path from 'path'

// צבעים לטרמינל (Node.js בלבד - לא React!)
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  white: '\x1b[37m',  // ✅ עכשיו קיים!
  reset: '\x1b[0m'
}

console.log(colors.blue + '🚀 מתחיל תיקון ארכיטקטורה...' + colors.reset)

// ===== 1. sync-agent.ts - החלפה ל-LangGraph =====
const syncAgentNew = `// lib/agents/sync-agent.ts
// ✅ מעודכן ל-LangGraph 0.4.9 + OpenAI 0.6.14
import { StateGraph, Annotation } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import { supabaseAdmin } from '@/lib/supabase-admin'

// ✅ הגדרת State עם Annotation.Root (API המומלץ ב-2025)
const SyncStateAnnotation = Annotation.Root({
  emails: Annotation<any[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => []
  }),
  dbData: Annotation<any>({
    default: () => ({})
  }),
  suggestions: Annotation<any[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => []
  })
})

export class SyncAgent {
  private llm: ChatOpenAI
  private graph: any
  
  constructor() {
    // ✅ ChatOpenAI מ-@langchain/openai 0.6.14
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY
    })
    
    this.graph = this.createGraph()
  }
  
  private createGraph() {
    const workflow = new StateGraph(SyncStateAnnotation)
    
    // Node 1: טעינת נתונים
    workflow.addNode('load_data', async (state) => {
      console.log('📥 טוען emails ונתוני DB...')
      
      // טעינת emails חדשים
      const { data: emails } = await supabaseAdmin
        .from('email_insights')
        .select('*')
        .eq('processed', false)
      
      // טעינת נתוני DB קיימים
      const { data: tasks } = await supabaseAdmin.from('unified_dashboard').select('*')
      const { data: debts } = await supabaseAdmin.from('debts').select('*')
      const { data: clients } = await supabaseAdmin.from('clients').select('*')
      
      return {
        emails: emails || [],
        dbData: { tasks, debts, clients }
      }
    })
    
    // Node 2: ניתוח עם LLM
    workflow.addNode('analyze', async (state) => {
      console.log('🤖 מנתח עם LLM...')
      
      const systemPrompt = \`אתה סוכן AI שמנתח מיילים ומציע עדכונים למסד הנתונים.
קבל רשימת מיילים ונתוני DB, וזהה:
1. חובות חדשים או עדכונים לחובות קיימים
2. משימות חדשות או עדכונים למשימות
3. לקוחות חדשים או עדכונים ללקוחות

החזר JSON array של הצעות בפורמט:
{
  "type": "create_debt" | "update_debt" | "create_task" | ...,
  "title": "כותרת בעברית",
  "description": "תיאור מפורט",
  "proposed_action": {
    "table": "debts" | "tasks" | "clients",
    "action": "create" | "update",
    "data": { ... נתוני העדכון ... }
  },
  "confidence": 0.0-1.0,
  "source_email_id": "..."
}\`
      
      const userPrompt = \`
Emails:
\${JSON.stringify(state.emails, null, 2)}

Current DB Data:
\${JSON.stringify(state.dbData, null, 2)}
\`
      
      const response = await this.llm.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ])
      
      // ניתוח התוצאה
      let suggestions = []
      try {
        suggestions = JSON.parse(response.content)
      } catch (e) {
        console.error('Error parsing LLM response:', e)
      }
      
      return { suggestions }
    })
    
    // הגדרת הזרימה
    workflow.setEntryPoint('load_data')
    workflow.addEdge('load_data', 'analyze')
    workflow.setFinishPoint('analyze')
    
    return workflow.compile()
  }
  
  async sync(options = {}) {
    console.log('🔄 מתחיל Sync...')
    
    const result = await this.graph.invoke({
      emails: [],
      dbData: {},
      suggestions: []
    })
    
    return {
      suggestions: result.suggestions || [],
      processed_emails: result.emails?.length || 0
    }
  }
}

// Singleton
let syncAgentInstance: SyncAgent | null = null

export function getSyncAgent(): SyncAgent {
  if (!syncAgentInstance) {
    syncAgentInstance = new SyncAgent()
  }
  return syncAgentInstance
}
`

// ===== 2. entity-resolver.ts - החלפה ל-LLM =====
const entityResolverNew = `// lib/agents/entity-resolver.ts
// ✅ מעודכן ל-OpenAI 0.6.14
import { ChatOpenAI } from '@langchain/openai'
import { supabaseAdmin } from '@/lib/supabase-admin'

export class EntityResolver {
  private llm: ChatOpenAI
  
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  
  async resolve(text: string) {
    console.log('🔍 מזהה ישויות בטקסט...')
    
    // טעינת ישויות קיימות מה-DB
    const { data: existingClients } = await supabaseAdmin.from('clients').select('*')
    const { data: existingDebts } = await supabaseAdmin.from('debts').select('*')
    
    const systemPrompt = \`אתה סוכן AI שמזהה ישויות בטקסט.
מצא:
1. שמות לקוחות / חברות
2. סכומי כסף
3. תאריכים
4. כתובות email
5. מספרי טלפון

ואז התאם אותם לישויות קיימות במסד הנתונים.

ישויות קיימות:
Clients: \${JSON.stringify(existingClients)}
Debts: \${JSON.stringify(existingDebts)}

החזר JSON:
{
  "clients": [
    {
      "name": "...",
      "matched_id": "..." או null,
      "confidence": 0.0-1.0
    }
  ],
  "debts": [...],
  "amounts": [...],
  "dates": [...]
}\`
    
    const response = await this.llm.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ])
    
    try {
      return JSON.parse(response.content)
    } catch (e) {
      console.error('Error parsing entity resolution:', e)
      return { clients: [], debts: [], amounts: [], dates: [] }
    }
  }
}

// Singleton
let entityResolverInstance: EntityResolver | null = null

export function getEntityResolver(): EntityResolver {
  if (!entityResolverInstance) {
    entityResolverInstance = new EntityResolver()
  }
  return entityResolverInstance
}
`

// ===== 3. diff-detector.ts - החלפה ל-LLM =====
const diffDetectorNew = `// lib/agents/diff-detector.ts
// ✅ מעודכן ל-OpenAI 0.6.14
import { ChatOpenAI } from '@langchain/openai'

export interface DiffResult {
  field: string
  oldValue: any
  newValue: any
  changeType: 'added' | 'modified' | 'removed'
  significance: 'high' | 'medium' | 'low'
}

export class DiffDetector {
  private llm: ChatOpenAI
  
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  
  async detectChanges(oldData: any, newData: any): Promise<DiffResult[]> {
    console.log('🔍 מזהה שינויים משמעותיים...')
    
    const systemPrompt = \`אתה סוכן AI שמשווה 2 אובייקטים ומזהה שינויים משמעותיים.
זהה שינויים ב:
1. ערכי שדות
2. תאריכים
3. סטטוסים
4. סכומים

דרג כל שינוי לפי חשיבות: high / medium / low

החזר JSON array:
[
  {
    "field": "...",
    "oldValue": ...,
    "newValue": ...,
    "changeType": "added" | "modified" | "removed",
    "significance": "high" | "medium" | "low",
    "reason": "הסבר למה זה חשוב"
  }
]\`
    
    const response = await this.llm.invoke([
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: JSON.stringify({ old: oldData, new: newData }, null, 2) 
      }
    ])
    
    try {
      return JSON.parse(response.content)
    } catch (e) {
      console.error('Error parsing diff detection:', e)
      return []
    }
  }
}

// Singleton
let diffDetectorInstance: DiffDetector | null = null

export function getDiffDetector(): DiffDetector {
  if (!diffDetectorInstance) {
    diffDetectorInstance = new DiffDetector()
  }
  return diffDetectorInstance
}
`

// ===== 4. smart-router.ts - החלפה ל-LLM =====
const smartRouterNew = `// lib/ai-agent/smart-router.ts
// ✅ מעודכן ל-OpenAI 0.6.14
import { ChatOpenAI } from '@langchain/openai'

export class SmartRouter {
  private llm: ChatOpenAI
  
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  
  async route(message: string) {
    console.log('🧭 בוחר מודל מתאים...')
    
    const systemPrompt = \`אתה router AI שמחליט איזה מודל להשתמש.
אפשרויות:
1. "gpt-4" - לשאלות מורכבות, ניתוחים עמוקים
2. "gpt-3.5-turbo" - לשאלות פשוטות, תשובות מהירות

בחר את המודל המתאים והחזר JSON:
{
  "model": "gpt-4" | "gpt-3.5-turbo",
  "reason": "הסבר קצר"
}\`
    
    const response = await this.llm.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ])
    
    try {
      return JSON.parse(response.content)
    } catch (e) {
      return { model: 'gpt-3.5-turbo', reason: 'default' }
    }
  }
}
`

// ===== 5. monitor-agent.ts - החלפה ל-LLM =====
const monitorAgentNew = `// lib/agents/monitor-agent.ts
// ✅ מעודכן ל-OpenAI 0.6.14
import { ChatOpenAI } from '@langchain/openai'
import { supabaseAdmin } from '@/lib/supabase-admin'

export class MonitorAgent {
  private llm: ChatOpenAI
  
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  
  async analyzeAndCreateAlerts() {
    console.log('🔔 מנתח מצב ויוצר alerts...')
    
    // טעינת נתונים
    const { data: tasks } = await supabaseAdmin.from('unified_dashboard').select('*')
    const { data: debts } = await supabaseAdmin.from('debts').select('*')
    
    const systemPrompt = \`אתה סוכן AI שמנתח משימות וחובות ומזהה בעיות.
זהה:
1. משימות שלא עודכנו מזמן
2. חובות שעברו תאריך יעד
3. משימות בעדיפות גבוהה שלא התחילו
4. חריגות או דפוסים חשודים

החזר JSON array של alerts:
[
  {
    "type": "overdue_task" | "stale_debt" | "high_priority_waiting",
    "severity": "high" | "medium" | "low",
    "title": "כותרת בעברית",
    "description": "תיאור הבעיה",
    "related_id": "...",
    "action_needed": "מה צריך לעשות"
  }
]\`
    
    const response = await this.llm.invoke([
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: JSON.stringify({ tasks, debts }, null, 2) 
      }
    ])
    
    try {
      const alerts = JSON.parse(response.content)
      
      // שמירה ל-DB
      for (const alert of alerts) {
        await supabaseAdmin.from('alerts').insert(alert)
      }
      
      return alerts
    } catch (e) {
      console.error('Error parsing monitor analysis:', e)
      return []
    }
  }
}
`

// ===== 6. תיקון API routes - unified_dashboard -> tasks =====
const apiPrioritizeRouteNew = `// app/api/ai-agent/prioritize/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    // ✅ תוקן: tasks במקום unified_dashboard
    const { data: tasks, error } = await supabaseAdmin
      .from('unified_dashboard')  // ✅ הוחלף!
      .select('*')
      .order('ai_score', { ascending: false })  // ✅ תוקן: ai_score במקום priority_score
    
    if (error) throw error
    
    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('Error in prioritize route:', error)
    return NextResponse.json({ error: 'Failed to prioritize' }, { status: 500 })
  }
}
`

const apiTasksRouteNew = `// app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    // ✅ תוקן: tasks במקום unified_dashboard
    const { data, error } = await supabaseAdmin
      .from('unified_dashboard')  // ✅ הוחלף!
      .select('*')
    
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // ✅ תוקן: tasks במקום unified_dashboard
    const { data, error } = await supabaseAdmin
      .from('unified_dashboard')  // ✅ הוחלף!
      .insert(body)
      .select()
    
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body
    
    // ✅ תוקן: tasks במקום unified_dashboard
    const { data, error } = await supabaseAdmin
      .from('unified_dashboard')  // ✅ הוחלף!
      .update(updates)
      .eq('id', id)
      .select()
    
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
`

// ===== ביצוע התיקונים =====
const projectRoot = process.cwd()

const fixes = [
  {
    path: 'lib/agents/sync-agent.ts',
    content: syncAgentNew,
    desc: 'החלפה ל-LangGraph state machine'
  },
  {
    path: 'lib/agents/entity-resolver.ts',
    content: entityResolverNew,
    desc: 'החלפה לזיהוי ישויות עם LLM'
  },
  {
    path: 'lib/agents/diff-detector.ts',
    content: diffDetectorNew,
    desc: 'החלפה להשוואה עם LLM'
  },
  {
    path: 'lib/ai-agent/smart-router.ts',
    content: smartRouterNew,
    desc: 'החלפה לבחירת מודל עם LLM'
  },
  {
    path: 'lib/agents/monitor-agent.ts',
    content: monitorAgentNew,
    desc: 'החלפה לניתוח alerts עם LLM'
  },
  {
    path: 'app/api/ai-agent/prioritize/route.ts',
    content: apiPrioritizeRouteNew,
    desc: 'תיקון: tasks במקום unified_dashboard'
  },
  {
    path: 'app/api/tasks/route.ts',
    content: apiTasksRouteNew,
    desc: 'תיקון: tasks במקום unified_dashboard'
  }
]

let successCount = 0
let errorCount = 0

for (const fix of fixes) {
  try {
    const filePath = path.join(projectRoot, fix.path)
    const dir = path.dirname(filePath)
    
    // יצירת תיקיה אם לא קיימת
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    // שמירת backup
    if (fs.existsSync(filePath)) {
      const backupPath = filePath + '.backup'
      fs.copyFileSync(filePath, backupPath)
      console.log(colors.yellow + \`💾 Backup: \${backupPath}\` + colors.reset)
    }
    
    // כתיבת הקובץ החדש
    fs.writeFileSync(filePath, fix.content, 'utf8')
    console.log(colors.green + \`✅ \${fix.path}\` + colors.reset)
    console.log(colors.white + \`   \${fix.desc}\` + colors.reset)
    successCount++
  } catch (error) {
    console.error(colors.red + \`❌ שגיאה ב-\${fix.path}:\` + colors.reset, error)
    errorCount++
  }
}

console.log('')
console.log(colors.blue + '═'.repeat(60) + colors.reset)
console.log(colors.green + \`✅ הושלם! \${successCount} קבצים תוקנו\` + colors.reset)
if (errorCount > 0) {
  console.log(colors.red + \`❌ \${errorCount} שגיאות\` + colors.reset)
}
console.log(colors.blue + '═'.repeat(60) + colors.reset)

console.log(colors.yellow + '\n📋 השלבים הבאים:' + colors.reset)
console.log(colors.white + '1. npm install @langchain/langgraph@0.4.9 @langchain/openai@0.6.14 @langchain/core@0.3.78' + colors.reset)
console.log(colors.white + '2. וודא ש-.env מוגדר עם OPENAI_API_KEY' + colors.reset)
console.log(colors.white + '3. npm run dev' + colors.reset)
console.log(colors.white + '4. לחץ על כפתור Sync באפליקציה!' + colors.reset)