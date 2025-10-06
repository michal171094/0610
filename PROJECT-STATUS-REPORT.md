# 📋 דוח מצב פרויקט - מערכת הסוכן החכם של מיכל

**תאריך**: 5.10.2025, 22:50:42  
**גרסה**: 1.0.0

---

## 📊 מצב נוכחי - סיכום מהיר

| שלב | שם | סטטוס |
|-----|-----|--------|
| 0 | תיקון Mismatches | ✅ הושלם |
| 1 | חיבור הזיכרון | ✅ הושלם |
| 2 | Sync Manager | ✅ הושלם |
| 3 | Background Polling | ✅ הושלם |

### 🎯 הצעד הבא:
**כל השלבים הבסיסיים הושלמו! ✅**

---

## 🔍 פירוט מלא

### שלב 0: תיקון Mismatches ✅ הושלם

**מטרה**: תקן את כל אי ההתאמות בין הקוד ל-DB.

**סטטוס**:
- ✅ **lib/config/schema.ts**: קובץ קיים
- ✅ **tools.ts (unified_dashboard → tasks)**: תוקן! משתמש ב-tasks

**משימות**:
- החלף `unified_dashboard` → `tasks` בכל הקוד
- תקן שמות שדות (ai_score vs priority_score)
- צור `lib/config/schema.ts`
- מחק קבצים מיותרים

---

### שלב 1: חיבור הזיכרון ✅ הושלם

**מטרה**: הסוכן יזכור הכל - הוראות, העדפות, קשרים.

**סטטוס**:
- ✅ **lib/memory/manager.ts**: קיים
- ✅ **langraph.ts - חיבור לזיכרון**: מחובר

**משימות**:
1. **צור Memory Manager** (`lib/memory/manager.ts`)
   ```typescript
   export class MemoryManager {
     async saveInstruction(text: string, scope: string) {
       await supabaseAdmin.from('agent_instructions')
         .insert({ instruction: text, scope, active: true })
     }
     
     async getInstructions() {
       const { data } = await supabaseAdmin
         .from('agent_instructions')
         .select('*')
         .eq('active', true)
       return data
     }
   }
   ```

2. **עדכן learning-tools.ts**
   ```typescript
   import { MemoryManager } from '@/lib/memory/manager'
   const memory = new MemoryManager()
   
   func: async ({ instruction }) => {
     await memory.saveInstruction(instruction, scope)
     return `✅ הוראה נשמרה`
   }
   ```

3. **שלב ב-langraph.ts**
   ```typescript
   async chat(message: string) {
     const instructions = await this.memory.getInstructions()
     const contextMessage = `הוראות: ${instructions.join(', ')}`
     // ... הרץ את הגרף עם ההקשר
   }
   ```

---

### שלב 2: Sync Manager ✅ הושלם

**מטרה**: פופאפ שמציג הצעות עדכון עם קישורים למיילים.

**סטטוס**:
- ✅ **route.ts**: קיים
- ✅ **route.ts**: קיים

**משימות**:
1. **צור `/api/sync/run`**
   ```typescript
   export async function POST(request: NextRequest) {
     const syncAgent = new SyncAgent()
     const result = await syncAgent.sync({
       sinceDays: 7,
       maxEmails: 50
     })
     return NextResponse.json(result)
   }
   ```

2. **תקן sync-agent.ts** - שלב entity-resolver + diff-detector

3. **צור `/api/sync/apply`** - לאישור הצעות

4. **עדכן SyncManager.tsx** - קרא מ-API אמיתי (לא mock)

---

### שלב 3: Background Polling ✅ הושלם

**מטרה**: סריקה אוטומטית כל 5 דקות.

**סטטוס**:
- ✅ **app/api/background/sync/route.ts**: קיים

**משימות**:
1. **צור `/api/background/sync`**
   ```typescript
   export async function GET() {
     // 1. קרא email_insights חדשים
     // 2. הפעל Sync Agent
     // 3. יצור הצעות
     return NextResponse.json({ success: true })
   }
   ```

2. **הוסף polling ב-Dashboard.tsx**
   ```typescript
   useEffect(() => {
     const interval = setInterval(() => {
       fetch('/api/background/sync')
     }, 5 * 60 * 1000)  // 5 דקות
     return () => clearInterval(interval)
   }, [])
   ```

---

## 🗂️ מסמך ההגדרות (Living Document)

### טבלאות ושדות מרכזיים:

```yaml
tasks:
  table: tasks  # ⚠️ לא unified_dashboard!
  fields:
    - id: uuid
    - title: text
    - ai_score: integer (0-100)
    - status: text (pending/in_progress/completed)
    - deadline: timestamp

debts:
  table: debts
  fields:
    - id: text
    - amount: numeric
    - collection_company: text
    - status: text

agent_instructions:
  table: agent_instructions
  fields:
    - id: uuid
    - instruction: text
    - scope: text (global/domain/task)
    - active: boolean

agent_memories:
  table: agent_memories
  fields:
    - id: uuid
    - memory_type: text
    - content: jsonb
    - importance: double precision
```

---

## 🎯 שלבים נוספים (לעתיד)

### שלב 4: Entity Resolution
- שלב entity-resolver ב-sync-agent
- בדוק fuzzy matching

### שלב 5: GPT-5
- החלף model ל-`gpt-5-2025-08-07`
- הפעל caching (90% הנחה!)

### שלב 6: OCR
- התקן Tesseract
- צור `/api/documents/upload`

### שלב 7: Monitor Agent
- צור monitor-agent.ts
- הגדר Vercel Cron

---

## 🚨 חוקים קריטיים

1. **אסור לשנות Frontend** (אלא אם זה bug)
2. **אסור למחוק נתונים מ-DB**
3. **כל קוד חדש קורא מ-DB_SCHEMA**
4. **כל שלב בנוי על השלב הקודם**

---

**הערה**: דוח זה נוצר אוטומטית על ידי `analyze-current-state.ts`
