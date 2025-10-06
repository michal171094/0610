import { google } from 'googleapis';
import { getOAuth2Client, getValidAccessToken } from './oauth';
import { supabaseAdmin } from '@/lib/supabase';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
  size: string;
  thumbnailLink?: string;
}

interface DocumentInsight {
  fileId: string;
  fileName: string;
  relevance: 'high' | 'medium' | 'low';
  category: 'debt' | 'bureaucracy' | 'legal' | 'health' | 'client' | 'other';
  relatedTo: string[];
  extractedText?: string;
  summary: string;
  actionItems: string[];
  suggestedTasks: string[];
  entities: {
    organizations?: string[];
    dates?: string[];
    amounts?: string[];
    people?: string[];
  };
}

/**
 * חיפוש קבצים רלוונטיים ב-Drive
 */
export async function searchDriveFiles(
  accountId: string,
  query: string,
  limit: number = 50
): Promise<DriveFile[]> {
  try {
    const accessToken = await getValidAccessToken(accountId);
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // חיפוש קבצים (PDFs, תמונות, מסמכים)
    const response = await drive.files.list({
      q: `(${query}) and (
        mimeType='application/pdf' or 
        mimeType contains 'image/' or 
        mimeType contains 'document' or
        mimeType contains 'text'
      ) and trashed=false`,
      pageSize: limit,
      fields: 'files(id, name, mimeType, modifiedTime, webViewLink, size, thumbnailLink)',
      orderBy: 'modifiedTime desc'
    });

    return response.data.files as DriveFile[] || [];
  } catch (error) {
    console.error('Error searching Drive files:', error);
    throw error;
  }
}

/**
 * חילוץ טקסט מקובץ (OCR למסמכים סרוקים)
 */
export async function extractTextFromFile(
  accountId: string,
  fileId: string
): Promise<string> {
  try {
    const accessToken = await getValidAccessToken(accountId);
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // קבלת פרטי הקובץ
    const fileMetadata = await drive.files.get({
      fileId,
      fields: 'mimeType, name'
    });

    const mimeType = fileMetadata.data.mimeType;

    // אם זה PDF או תמונה - נשתמש ב-OCR של Google Vision
    if (mimeType?.includes('pdf') || mimeType?.includes('image')) {
      // ייצוא ל-Google Docs format (מבצע OCR אוטומטית)
      const response = await drive.files.export({
        fileId,
        mimeType: 'text/plain'
      }, { responseType: 'text' });

      return response.data as string;
    }

    // אם זה כבר מסמך טקסט
    if (mimeType?.includes('text') || mimeType?.includes('document')) {
      const response = await drive.files.export({
        fileId,
        mimeType: 'text/plain'
      }, { responseType: 'text' });

      return response.data as string;
    }

    return '';
  } catch (error) {
    console.error('Error extracting text from file:', error);
    return '';
  }
}

/**
 * ניתוח מסמך עם GPT-4
 */
export async function analyzeDocument(
  file: DriveFile,
  extractedText: string,
  taskContext?: string
): Promise<DocumentInsight> {
  try {
    const systemPrompt = `אתה עוזר AI המנתח מסמכים עבור אישה העובדת עם מערכת ניהול משימות.
היא מתמודדת עם:
- חובות לבנקים וחברות
- בירוקרטיה ממשלתית (Jobcenter, LEA, ביטוח לאומי)
- ניהול לקוחות
- סוגיות משפטיות ובריאותיות

נתח את המסמך והחזר בפורמט JSON:
{
  "relevance": "high/medium/low",
  "category": "debt/bureaucracy/legal/health/client/other",
  "relatedTo": ["רשימת נושאים קשורים"],
  "summary": "סיכום קצר של המסמך",
  "actionItems": ["פעולות שצריך לבצע"],
  "suggestedTasks": ["משימות מוצעות"],
  "entities": {
    "organizations": ["ארגונים"],
    "dates": ["תאריכים חשובים"],
    "amounts": ["סכומים כספיים"],
    "people": ["אנשים"]
  }
}`;

    const userPrompt = `מסמך: ${file.name}
סוג: ${file.mimeType}
${taskContext ? `הקשר למשימה: ${taskContext}` : ''}

תוכן המסמך:
${extractedText.substring(0, 4000)}

נתח את המסמך והחזר JSON.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const analysis = JSON.parse(completion.choices[0].message.content || '{}');

    return {
      fileId: file.id,
      fileName: file.name,
      relevance: analysis.relevance || 'low',
      category: analysis.category || 'other',
      relatedTo: analysis.relatedTo || [],
      extractedText,
      summary: analysis.summary || '',
      actionItems: analysis.actionItems || [],
      suggestedTasks: analysis.suggestedTasks || [],
      entities: analysis.entities || {}
    };
  } catch (error) {
    console.error('Error analyzing document:', error);
    throw error;
  }
}

/**
 * חיפוש מסמכים אוטומטי למשימה
 */
export async function findRelevantDocuments(
  accountId: string,
  taskTitle: string,
  taskDescription: string,
  domain: string
): Promise<{ files: DriveFile[], insights: DocumentInsight[] }> {
  try {
    // בניית שאילתת חיפוש חכמה
    const searchTerms = [
      taskTitle,
      ...taskDescription.split(' ').filter(word => word.length > 3)
    ].join(' OR ');

    // חיפוש קבצים
    const files = await searchDriveFiles(accountId, searchTerms, 10);

    // ניתוח כל קובץ
    const insights: DocumentInsight[] = [];
    for (const file of files) {
      try {
        const text = await extractTextFromFile(accountId, file.id);
        const insight = await analyzeDocument(
          file,
          text,
          `${taskTitle} - ${taskDescription}`
        );
        
        // שמירה לדאטהבייס
        await saveDocumentInsight(accountId, insight, taskTitle);
        insights.push(insight);
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
      }
    }

    return { files, insights };
  } catch (error) {
    console.error('Error finding relevant documents:', error);
    throw error;
  }
}

/**
 * שמירת תובנות מסמך לדאטהבייס
 */
async function saveDocumentInsight(
  accountId: string,
  insight: DocumentInsight,
  relatedTask: string
) {
  try {
    const { error } = await supabaseAdmin
      .from('document_insights')
      .upsert({
        drive_account_id: accountId,
        file_id: insight.fileId,
        file_name: insight.fileName,
        relevance: insight.relevance,
        category: insight.category,
        related_to: insight.relatedTo,
        extracted_text: insight.extractedText,
        summary: insight.summary,
        action_items: insight.actionItems,
        suggested_tasks: insight.suggestedTasks,
        entities: insight.entities,
        related_task: relatedTask,
        analyzed_at: new Date().toISOString()
      }, {
        onConflict: 'file_id'
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error saving document insight:', error);
  }
}

/**
 * העלאת מסמך סרוק ידנית
 */
export async function uploadScannedDocument(
  accountId: string,
  fileName: string,
  fileContent: Buffer,
  mimeType: string,
  taskId?: string
): Promise<{ fileId: string, webViewLink: string }> {
  try {
    const accessToken = await getValidAccessToken(accountId);
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // יצירת תיקיית "Scanned Documents" אם לא קיימת
    const folderResponse = await drive.files.list({
      q: "name='Scanned Documents' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id)'
    });

    let folderId: string;
    if (folderResponse.data.files && folderResponse.data.files.length > 0) {
      folderId = folderResponse.data.files[0].id!;
    } else {
      const folder = await drive.files.create({
        requestBody: {
          name: 'Scanned Documents',
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id'
      });
      folderId = folder.data.id!;
    }

    // העלאת הקובץ
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId]
      },
      media: {
        mimeType,
        body: fileContent
      },
      fields: 'id, webViewLink'
    });

    const fileId = response.data.id!;
    const webViewLink = response.data.webViewLink!;

    // ניתוח אוטומטי של המסמך
    if (taskId) {
      const text = await extractTextFromFile(accountId, fileId);
      const file: DriveFile = {
        id: fileId,
        name: fileName,
        mimeType,
        modifiedTime: new Date().toISOString(),
        webViewLink,
        size: fileContent.length.toString()
      };
      
      const insight = await analyzeDocument(file, text, taskId);
      await saveDocumentInsight(accountId, insight, taskId);
    }

    return { fileId, webViewLink };
  } catch (error) {
    console.error('Error uploading scanned document:', error);
    throw error;
  }
}

/**
 * קבלת מסמכים קשורים למשימה
 */
export async function getDocumentsForTask(taskId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('document_insights')
      .select('*')
      .eq('related_task', taskId)
      .order('relevance', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting documents for task:', error);
    return [];
  }
}
