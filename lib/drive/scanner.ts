/**
 * 📁 Google Drive Scanner
 * 
 * סורק מסמכים ב-Drive ומבצע:
 * - OCR למסמכים
 * - ניתוח AI של התוכן
 * - זיהוי ישויות (חובות, לקוחות, משימות)
 * - יצירת הצעות פעולה
 */

import { google } from 'googleapis';
import { supabaseAdmin } from '@/lib/supabase';
import { DB_SCHEMA } from '@/lib/config/schema';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export interface DriveDocument {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  webViewLink?: string;
  parents?: string[];
}

export interface DocumentInsight {
  id: string;
  file_id: string;
  file_name: string;
  summary: string;
  category: string;
  relevance: 'high' | 'medium' | 'low';
  entities: {
    debts?: Array<{ name: string; amount?: number; status?: string }>;
    clients?: Array<{ name: string; email?: string; project?: string }>;
    tasks?: Array<{ title: string; deadline?: string; priority?: string }>;
    bureaucracy?: Array<{ agency: string; deadline?: string; status?: string }>;
  };
  action_items: string[];
  suggested_tasks: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    deadline?: string;
    linked_entity?: { type: string; id: string };
  }>;
  related_to: string[];
  extracted_text: string;
}

export class DriveScanner {
  private drive: any;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.initializeDrive();
  }

  private async initializeDrive() {
    // Get Drive account from Supabase
    const { data: account, error } = await supabaseAdmin
      .from(DB_SCHEMA.drive_accounts.table)
      .select('*')
      .eq('user_id', this.userId)
      .single();

    if (error || !account) {
      throw new Error(`No Drive account found for user ${this.userId}`);
    }

    // Initialize Google Drive API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    });

    this.drive = google.drive({ version: 'v3', auth: oauth2Client });
  }

  /**
   * Scan all documents in Drive
   */
  async scanAllDocuments(options: {
    sinceDays?: number;
    maxFiles?: number;
    includeRead?: boolean;
  } = {}): Promise<DocumentInsight[]> {
    const { sinceDays = 7, maxFiles = 50 } = options;

    console.log(`🔍 Scanning Drive documents for user ${this.userId}...`);

    // 1. Get recent documents from Drive
    const documents = await this.getRecentDocuments(sinceDays, maxFiles);
    console.log(`📁 Found ${documents.length} documents to analyze`);

    // 2. Process each document
    const insights: DocumentInsight[] = [];
    for (const doc of documents) {
      try {
        const insight = await this.analyzeDocument(doc);
        if (insight.relevance !== 'low') {
          insights.push(insight);
        }
      } catch (error) {
        console.error(`❌ Error analyzing document ${doc.name}:`, error);
      }
    }

    // 3. Save insights to database
    await this.saveInsights(insights);

    console.log(`✅ Drive scan completed: ${insights.length} relevant documents found`);
    return insights;
  }

  /**
   * Get recent documents from Drive
   */
  private async getRecentDocuments(sinceDays: number, maxFiles: number): Promise<DriveDocument[]> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - sinceDays);

    const response = await this.drive.files.list({
      pageSize: maxFiles,
      orderBy: 'modifiedTime desc',
      q: `modifiedTime > '${sinceDate.toISOString()}' and trashed = false`,
      fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink, parents)',
    });

    return response.data.files || [];
  }

  /**
   * Analyze a single document with AI
   */
  private async analyzeDocument(doc: DriveDocument): Promise<DocumentInsight> {
    console.log(`🔍 Analyzing document: ${doc.name}`);

    // 1. Extract text (OCR if needed)
    const extractedText = await this.extractText(doc);

    if (!extractedText || extractedText.length < 50) {
      return {
        id: crypto.randomUUID(),
        file_id: doc.id,
        file_name: doc.name,
        summary: 'Document contains insufficient text for analysis',
        category: 'unreadable',
        relevance: 'low',
        entities: {},
        action_items: [],
        suggested_tasks: [],
        related_to: [],
        extracted_text: extractedText || '',
      };
    }

    // 2. Get existing entities from database for context
    const existingEntities = await this.getExistingEntities();

    // 3. Analyze with GPT-4
    const analysis = await this.analyzeWithAI(extractedText, doc.name, existingEntities);

    return {
      id: crypto.randomUUID(),
      file_id: doc.id,
      file_name: doc.name,
      summary: analysis.summary,
      category: analysis.category,
      relevance: analysis.relevance,
      entities: analysis.entities,
      action_items: analysis.action_items,
      suggested_tasks: analysis.suggested_tasks,
      related_to: analysis.related_to,
      extracted_text: extractedText,
    };
  }

  /**
   * Extract text from document (OCR if needed)
   */
  private async extractText(doc: DriveDocument): Promise<string> {
    try {
      // For PDFs and images, use OCR
      if (doc.mimeType === 'application/pdf' || doc.mimeType.startsWith('image/')) {
        return await this.performOCR(doc);
      }

      // For text files, try to get content directly
      if (doc.mimeType === 'text/plain' || doc.mimeType.includes('document')) {
        const response = await this.drive.files.export({
          fileId: doc.id,
          mimeType: 'text/plain',
        });
        return response.data as string;
      }

      // For Google Docs/Sheets, use export
      if (doc.mimeType.includes('google-apps')) {
        const exportMimeType = this.getExportMimeType(doc.mimeType);
        const response = await this.drive.files.export({
          fileId: doc.id,
          mimeType: exportMimeType,
        });
        return response.data as string;
      }

      return '';
  } catch (error) {
      console.error(`Error extracting text from ${doc.name}:`, error);
      return '';
  }
}

/**
   * Perform OCR on document
   */
  private async performOCR(doc: DriveDocument): Promise<string> {
    try {
      // Download file for OCR processing
      const response = await this.drive.files.get({
        fileId: doc.id,
        alt: 'media',
      });

      // For now, return placeholder - in production you'd use Tesseract or Google Vision API
      return `[OCR Text from ${doc.name} - ${doc.mimeType}]`;
  } catch (error) {
      console.error(`OCR error for ${doc.name}:`, error);
      return '';
  }
}

/**
   * Get export MIME type for Google Apps files
   */
  private getExportMimeType(mimeType: string): string {
    switch (mimeType) {
      case 'application/vnd.google-apps.document':
        return 'text/plain';
      case 'application/vnd.google-apps.spreadsheet':
        return 'text/csv';
      case 'application/vnd.google-apps.presentation':
        return 'text/plain';
      default:
        return 'text/plain';
    }
  }

  /**
   * Analyze document content with GPT-4
   */
  private async analyzeWithAI(
    text: string,
  fileName: string,
    existingEntities: any
  ): Promise<any> {
    const prompt = `Analyze this document for business-relevant information:

Document: ${fileName}
Content: ${text.substring(0, 4000)}...

Existing entities in database:
- Debts: ${JSON.stringify(existingEntities.debts?.slice(0, 5) || [])}
- Clients: ${JSON.stringify(existingEntities.clients?.slice(0, 5) || [])}
- Tasks: ${JSON.stringify(existingEntities.tasks?.slice(0, 5) || [])}
- Bureaucracy: ${JSON.stringify(existingEntities.bureaucracy?.slice(0, 5) || [])}

Return JSON with:
{
  "summary": "Brief summary of document content",
  "category": "debt|client|bureaucracy|general",
  "relevance": "high|medium|low",
  "entities": {
    "debts": [{"name": "...", "amount": 123, "status": "..."}],
    "clients": [{"name": "...", "email": "...", "project": "..."}],
    "tasks": [{"title": "...", "deadline": "...", "priority": "..."}],
    "bureaucracy": [{"agency": "...", "deadline": "...", "status": "..."}]
  },
  "action_items": ["Action 1", "Action 2"],
  "suggested_tasks": [
    {
      "title": "Task title",
      "description": "Task description",
      "priority": "high|medium|low",
      "deadline": "YYYY-MM-DD",
      "linked_entity": {"type": "debt|client|bureaucracy", "id": "..."}
    }
  ],
  "related_to": ["entity_id_1", "entity_id_2"]
}

Focus on actionable items and cross-domain connections (e.g., Norway benefit → Kazakhstan insurance).`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  /**
   * Get existing entities from database for context
   */
  private async getExistingEntities(): Promise<any> {
    const [debts, clients, tasks, bureaucracy] = await Promise.all([
      supabaseAdmin.from(DB_SCHEMA.debts.table).select('id, original_company, amount, status').limit(20),
      supabaseAdmin.from(DB_SCHEMA.clients.table).select('id, name, email, project_type').limit(20),
      supabaseAdmin.from(DB_SCHEMA.tasks.table).select('id, title, status, deadline').limit(20),
      supabaseAdmin.from(DB_SCHEMA.bureaucracy.table).select('id, title, agency, status, deadline').limit(20),
    ]);

    return {
      debts: debts.data || [],
      clients: clients.data || [],
      tasks: tasks.data || [],
      bureaucracy: bureaucracy.data || [],
    };
  }

  /**
   * Save insights to database
   */
  private async saveInsights(insights: DocumentInsight[]): Promise<void> {
    if (insights.length === 0) return;

    const { error } = await supabaseAdmin
      .from(DB_SCHEMA.document_insights.table)
      .upsert(
        insights.map(insight => ({
          id: insight.id,
          file_id: insight.file_id,
          file_name: insight.file_name,
          summary: insight.summary,
          category: insight.category,
          relevance: insight.relevance,
          entities: insight.entities,
          action_items: insight.action_items,
          suggested_tasks: insight.suggested_tasks,
          related_to: insight.related_to,
          extracted_text: insight.extracted_text,
          analyzed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })),
        { onConflict: 'file_id' }
      );

    if (error) {
      console.error('Error saving document insights:', error);
    throw error;
  }
}

/**
   * Update last scanned timestamp
   */
  async updateLastScanned(): Promise<void> {
    const { error } = await supabaseAdmin
      .from(DB_SCHEMA.drive_accounts.table)
      .update({ last_scanned_at: new Date().toISOString() })
      .eq('user_id', this.userId);

    if (error) {
      console.error('Error updating last scanned timestamp:', error);
    }
  }
}