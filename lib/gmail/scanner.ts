// 🔍 Smart Gmail Scanner
// Uses GPT-4 to intelligently scan emails for task/debt updates

import { google } from 'googleapis';
import { getOAuth2Client, getValidAccessToken, type GmailAccount } from './oauth';
import { supabaseAdmin } from '../supabase';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  body: string;
  date: Date;
  labels: string[];
}

export interface EmailInsight {
  email_id: string;
  relevance: 'high' | 'medium' | 'low' | 'spam';
  related_to: {
    type: 'debt' | 'bureaucracy' | 'client' | 'general';
    id?: string;
    name?: string;
  };
  summary: string;
  action_items: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  should_create_task: boolean;
  suggested_task?: {
    title: string;
    description: string;
    priority: number;
    deadline?: string;
  };
}

// 📧 Fetch recent emails from Gmail
export async function fetchRecentEmails(
  account: GmailAccount,
  options?: {
    maxResults?: number;
    timeRange?: 'day' | 'week' | 'month';
    includeRead?: boolean;
    query?: string;
  }
): Promise<EmailMessage[]> {
  const {
    maxResults = 100,
    timeRange = 'week',
    includeRead = false,
    query
  } = options || {};

  const oauth2Client = getOAuth2Client();
  const accessToken = await getValidAccessToken(account);
  
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Build time range query
  const timeRangeMap = {
    day: '1d',
    week: '7d',
    month: '30d'
  };

  // Build comprehensive search query
  let searchQuery = query || '';
  
  if (!searchQuery) {
    const parts = [
      includeRead ? '' : 'is:unread',
      '-category:spam',
      '-category:promotions',
      '-category:social',
      `newer_than:${timeRangeMap[timeRange]}`
    ].filter(Boolean);
    
    searchQuery = parts.join(' ');
  }

  try {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      maxResults,
    });

    if (!response.data.messages) {
      return [];
    }

    // Fetch full message details
    const emails: EmailMessage[] = [];
    for (const message of response.data.messages) {
      try {
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full',
        });

        const headers = fullMessage.data.payload?.headers || [];
        const from = headers.find(h => h.name === 'From')?.value || '';
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        // Extract body
        let body = '';
        if (fullMessage.data.payload?.body?.data) {
          body = Buffer.from(fullMessage.data.payload.body.data, 'base64').toString('utf-8');
        } else if (fullMessage.data.payload?.parts) {
          const textPart = fullMessage.data.payload.parts.find(p => p.mimeType === 'text/plain');
          if (textPart?.body?.data) {
            body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
          }
        }

        emails.push({
          id: fullMessage.data.id!,
          threadId: fullMessage.data.threadId!,
          from,
          subject,
          body: body.substring(0, 5000), // Limit to 5000 chars
          date: new Date(date),
          labels: fullMessage.data.labelIds || [],
        });
      } catch (error) {
        console.error('❌ Error fetching message:', message.id, error);
      }
    }

    return emails;
  } catch (error) {
    console.error('❌ Error fetching emails:', error);
    throw error;
  }
}

// 🧠 Analyze email with GPT-4 - SMART VERSION
export async function analyzeEmailWithContext(
  email: EmailMessage,
  context: {
    debts: Array<{ id: string; original_company: string; collection_company?: string; amount: number; status: string; case_number?: string }>;
    bureaucracy: Array<{ id: string; organization: string; task_type: string; status: string }>;
    clients: Array<{ id: string; name: string; company?: string }>;
    tasks: Array<{ id: string; title: string; description?: string; related_debt_id?: string }>;
  }
): Promise<EmailInsight & { update_type?: 'new' | 'update' | 'status_change'; changes?: any }> {
  const systemPrompt = `אתה עוזר AI חכם שמנתח מיילים עבור מיכל. 🎯

📊 **הקשר - מה כבר קיים במערכת:**

חובות קיימים (${context.debts.length}):
${context.debts.map(d => `• ID: ${d.id} | חברה: ${d.original_company}${d.collection_company ? ` → גבייה: ${d.collection_company}` : ''} | סכום: ${d.amount}€ | תיק: ${d.case_number || 'אין'} | סטטוס: ${d.status}`).join('\n')}

משימות קיימות (${context.tasks.length}):
${context.tasks.map(t => `• ID: ${t.id} | ${t.title}`).join('\n')}

ביורוקרטיה (${context.bureaucracy.length}):
${context.bureaucracy.map(b => `• ID: ${b.id} | ${b.organization} - ${b.task_type}`).join('\n')}

לקוחות (${context.clients.length}):
${context.clients.map(c => `• ID: ${c.id} | ${c.name}${c.company ? ` (${c.company})` : ''}`).join('\n')}

---

🎯 **המשימה שלך:**

**צעד 1: זהה התאמה** 
- בדוק אם המייל קשור לחוב/משימה/ארגון **קיים** מהרשימה למעלה
- השווה לפי: שם חברה, מספר תיק, מספר אסמכתא, נושא דומה
- אם יש התאמה → החזר את ה-ID המדויק!

**צעד 2: קבע סוג עדכון**
- **update** = יש שינוי במידע קיים (סכום השתנה, תאריך חדש, סטטוס חדש)
- **status_change** = שינוי משמעותי (שולם, נדחה, אושר, נסגר)
- **new** = זה משהו חדש לגמרי, אין רשומה קיימת

**צעד 3: חלץ שינויים מדויקים**
אם זה update/status_change, ציין בדיוק מה השתנה:
- "סכום השתנה מ-50€ ל-75€"
- "דדליין חדש: 15.03.2025 (היה: 10.03.2025)"
- "סטטוס: שולם (היה: פעיל)"
- "מספר תיק חדש: 12345"

**צעד 4: החלט פעולה**
- אם update קיים → should_create_task = false, פשוט תן את השינויים
- אם new → should_create_task = true + הצע כותרת/תיאור

---

🔍 **דוגמאות:**

**דוגמה 1 - עדכון לחוב קיים:**
מייל: "PAIR Finance - תזכורת סופית, סכום: 75.50€, תיק: 50916993"
תשובה:
{
  "update_type": "update",
  "related_to": {"type": "debt", "id": "debt-123", "name": "PAIR Finance"},
  "changes": {
    "amount": {"from": 45.55, "to": 75.50},
    "reason": "הסכום עלה - אולי התווספו הוצאות"
  },
  "should_create_task": false,
  "summary": "עדכון סכום חוב ל-75.50€ (עלייה של 30€)"
}

**דוגמה 2 - חוב חדש:**
מייל: "coeo Inkasso - Swaprad GmbH, חוב: 120€"
אבל Swaprad לא ברשימת החובות הקיימים
תשובה:
{
  "update_type": "new",
  "related_to": {"type": "debt", "name": "Swaprad GmbH"},
  "should_create_task": true,
  "suggested_task": {
    "title": "חוב חדש: Swaprad GmbH דרך coeo Inkasso",
    "description": "סכום: 120€, צריך לבדוק מקור החוב"
  }
}

**דוגמה 3 - שינוי סטטוס:**
מייל: "הערעור שלך אושר - החוב בוטל"
תשובה:
{
  "update_type": "status_change",
  "related_to": {"type": "debt", "id": "debt-456"},
  "changes": {
    "status": {"from": "active", "to": "cancelled"},
    "reason": "ערעור אושר!"
  },
  "sentiment": "positive"
}

---

📤 **פורמט תשובה (JSON):**
{
  "relevance": "high|medium|low|spam",
  "update_type": "new|update|status_change",
  "related_to": {
    "type": "debt|bureaucracy|client|task|general",
    "id": "ID מדויק אם יש התאמה, אחרת null",
    "name": "שם החברה/ארגון"
  },
  "summary": "סיכום המייל בעברית - מה כתוב שם?",
  "changes": {
    "amount": {"from": 50, "to": 75},
    "deadline": {"from": "2025-01-01", "to": "2025-02-01"},
    "status": {"from": "pending", "to": "paid"},
    "reason": "הסבר קצר למה השתנה"
  },
  "extracted_data": {
    "amount": 123.45,
    "currency": "EUR",
    "deadline": "2025-03-15",
    "case_number": "50916993",
    "payment_reference": "REF12345",
    "contact_person": "שם איש קשר אם יש"
  },
  "action_items": ["פעולה 1 ספציפית", "פעולה 2"],
  "sentiment": "positive|neutral|negative|urgent",
  "should_create_task": true/false,
  "suggested_task": {
    "title": "רק אם צריך משימה חדשה!",
    "description": "תיאור",
    "priority": 1-5
  }
}`;

  const userPrompt = `📧 **מייל לניתוח:**

מאת: ${email.from}
נושא: ${email.subject}
תאריך: ${email.date.toISOString()}

תוכן:
${email.body.substring(0, 3000)}

---
🔍 נתח והשב ב-JSON`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const insight = JSON.parse(response.choices[0].message.content!) as any;
    insight.email_id = email.id;

    return insight;
  } catch (error) {
    console.error('❌ Error analyzing email:', error);
    return {
      email_id: email.id,
      relevance: 'low',
      related_to: { type: 'general' },
      summary: 'Failed to analyze email',
      action_items: [],
      sentiment: 'neutral',
      should_create_task: false,
    };
  }
}

// 🔄 Backward compatibility
export async function analyzeEmail(
  email: EmailMessage,
  context: {
    debts: Array<{ id: string; creditor: string; amount: number; status: string }>;
    bureaucracy: Array<{ id: string; organization: string; task_type: string; status: string }>;
    clients: Array<{ id: string; name: string; company?: string }>;
  }
): Promise<EmailInsight> {
  // Convert to new format and call smart version
  const smartContext = {
    ...context,
    debts: context.debts.map(d => ({ ...d, original_company: d.creditor })),
    tasks: []
  };
  return analyzeEmailWithContext(email, smartContext);
}

// 💾 Save email insight to database
export async function saveEmailInsight(
  accountId: string,
  email: EmailMessage,
  insight: EmailInsight
): Promise<void> {
  const { error } = await supabaseAdmin.from('email_insights').insert({
    gmail_account_id: accountId,
    email_id: email.id,
    thread_id: email.threadId,
    from_address: email.from,
    subject: email.subject,
    received_at: email.date.toISOString(),
    relevance: insight.relevance,
    related_type: insight.related_to.type,
    related_id: insight.related_to.id,
    related_name: insight.related_to.name,
    summary: insight.summary,
    action_items: insight.action_items,
    sentiment: insight.sentiment,
    should_create_task: insight.should_create_task,
    suggested_task: insight.suggested_task,
  });

  if (error) {
    console.error('❌ Failed to save email insight:', error);
  }
}

// 🎯 Scan all accounts and analyze emails - SMART VERSION
export async function scanAllAccounts(
  userId: string,
  options?: {
    maxResults?: number;
    timeRange?: 'day' | 'week' | 'month';
    includeRead?: boolean;
    showLastEmailPerCompany?: boolean;
  }
): Promise<{
  totalEmails: number;
  updates: Array<{
    type: 'new' | 'update' | 'status_change';
    entity_type: 'debt' | 'task' | 'bureaucracy' | 'client';
    entity_id?: string;
    entity_name: string;
    summary: string;
    changes?: any;
    action: string;
    email_from: string;
    email_subject: string;
    priority: 'high' | 'medium' | 'low';
    extracted_data?: any;
  }>;
  insights: Array<{
    from: string;
    subject: string;
    summary: string;
    relevance: string;
  }>;
}> {
  console.log('🔍 Starting SMART Gmail scan for user:', userId, 'options:', options);

  // Get all Gmail accounts
  const { data: accounts } = await supabaseAdmin
    .from('gmail_accounts')
    .select('*')
    .eq('user_id', userId);

  if (!accounts || accounts.length === 0) {
    console.log('⚠️ No Gmail accounts found');
    return { totalEmails: 0, updates: [], insights: [] };
  }

  // Get FULL context - everything the agent knows
  const { data: debts } = await supabaseAdmin
    .from('debts')
    .select('id, original_company, collection_company, amount, status, case_number');
  
  const { data: bureaucracy } = await supabaseAdmin
    .from('bureaucracy')
    .select('id, organization, task_type, status');
  
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, name, company');
  
  const { data: tasks } = await supabaseAdmin
    .from('tasks')
    .select('id, title, description, related_debt_id');

  const context = {
    debts: debts || [],
    bureaucracy: bureaucracy || [],
    clients: clients || [],
    tasks: tasks || []
  };

  const updates: any[] = [];
  const insights: any[] = [];
  let totalEmails = 0;

  // Scan each account
  for (const account of accounts) {
    try {
      console.log('📧 Scanning account:', account.email);
      const emails = await fetchRecentEmails(account, { 
        maxResults: options?.maxResults || 50,
        timeRange: options?.timeRange || 'week',
        includeRead: options?.includeRead || false
      });
      totalEmails += emails.length;

      for (const email of emails) {
        const insight = await analyzeEmailWithContext(email, context);
        
        // Skip spam and low relevance
        if (insight.relevance === 'spam' || insight.relevance === 'low') {
          continue;
        }

        // Save insight to database
        await saveEmailInsight(account.id, email, insight);

        // Add to insights list
        insights.push({
          from: email.from,
          subject: email.subject,
          summary: insight.summary,
          relevance: insight.relevance
        });

        // Process based on update type
        if (insight.update_type === 'update' || insight.update_type === 'status_change') {
          // This is an UPDATE to existing entity
          updates.push({
            type: insight.update_type,
            entity_type: insight.related_to.type as any,
            entity_id: insight.related_to.id,
            entity_name: insight.related_to.name || 'Unknown',
            summary: insight.summary,
            changes: insight.changes,
            action: formatUpdateAction(insight),
            email_from: email.from,
            email_subject: email.subject,
            priority: insight.sentiment === 'urgent' ? 'high' : 'medium',
            extracted_data: (insight as any).extracted_data
          });
        } else if (insight.update_type === 'new' && insight.should_create_task) {
          // This is a NEW entity
          updates.push({
            type: 'new',
            entity_type: insight.related_to.type as any,
            entity_name: insight.related_to.name || 'Unknown',
            summary: insight.summary,
            action: `ליצור ${getEntityTypeHebrew(insight.related_to.type)} חדש: ${insight.suggested_task?.title || insight.related_to.name}`,
            email_from: email.from,
            email_subject: email.subject,
            priority: 'high',
            extracted_data: (insight as any).extracted_data
          });
        }
      }

      // Mark last scan time
      await supabaseAdmin
        .from('gmail_accounts')
        .update({ last_scanned_at: new Date().toISOString() })
        .eq('id', account.id);

    } catch (error) {
      console.error('❌ Error scanning account:', account.email, error);
    }
  }

  console.log(`✅ Scan complete: ${totalEmails} emails, ${updates.length} updates, ${insights.length} insights`);
  return { totalEmails, updates, insights };
}

// 📝 Format update action for display
function formatUpdateAction(insight: any): string {
  const changes = insight.changes;
  const type = insight.related_to.type;
  
  if (!changes) {
    return `עדכון: ${insight.summary}`;
  }

  const parts: string[] = [];

  if (changes.amount) {
    parts.push(`עדכן סכום מ-${changes.amount.from}€ ל-${changes.amount.to}€`);
  }

  if (changes.deadline) {
    parts.push(`עדכן תאריך ל-${changes.deadline.to}`);
  }

  if (changes.status) {
    parts.push(`שנה סטטוס מ-"${changes.status.from}" ל-"${changes.status.to}"`);
  }

  if (changes.case_number) {
    parts.push(`הוסף מספר תיק: ${changes.case_number}`);
  }

  if (parts.length > 0) {
    return parts.join(' + ');
  }

  return `עדכון: ${insight.summary}`;
}

// 🏷️ Get entity type in Hebrew
function getEntityTypeHebrew(type: string): string {
  const map: Record<string, string> = {
    'debt': 'חוב',
    'task': 'משימה',
    'bureaucracy': 'משימת ביורוקרטיה',
    'client': 'לקוח',
    'general': 'פריט'
  };
  return map[type] || 'פריט';
}

// 🔔 Mark email as processed
export async function markEmailAsRead(account: GmailAccount, emailId: string): Promise<void> {
  const oauth2Client = getOAuth2Client();
  const accessToken = await getValidAccessToken(account);
  
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  await gmail.users.messages.modify({
    userId: 'me',
    id: emailId,
    requestBody: {
      removeLabelIds: ['UNREAD'],
    },
  });
}
