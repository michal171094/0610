/**
 * 📋 Database Schema Configuration
 * 
 * מסמך מרכזי עם כל מבני ה-DB
 * כל קוד חדש צריך לקרוא מכאן!
 */

export const DB_SCHEMA = {
  // 📝 משימות - הטבלה הראשית
  tasks: {
    table: 'unified_dashboard',
    fields: {
      id: 'text',
      title: 'text',
      domain: 'text',
      status: 'text',
      deadline: 'timestamp',
      priority_score: 'integer',
      financial_impact: 'numeric',
      linked_debt_id: 'text',
      linked_bureaucracy_id: 'text',
      linked_client_id: 'text',
      linked_project_id: 'text',
      ai_recommendations: 'jsonb',
      task_chat_history: 'jsonb',
      context_embedding: 'vector',
      created_at: 'timestamp',
      updated_at: 'timestamp',
    },
  },

  // 💰 חובות
  debts: {
    table: 'debts',
    fields: {
      id: 'text',
      original_company: 'text',
      collection_company: 'text',
      collection_agency: 'text',
      original_amount: 'numeric',
      amount: 'numeric',
      currency: 'text',
      status: 'text',
      appeal_status: 'text',
      appeal_date: 'date',
      settlement_offer: 'numeric',
      settlement_date: 'date',
      deadline: 'timestamp',
      payment_plan: 'jsonb',
      contact_history: 'jsonb',
      negotiation_notes: 'text',
      task_id: 'text',
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
      whatsapp: 'text',
      project_type: 'text',
      price: 'numeric',
      amount_paid: 'numeric',
      payment_status: 'text',
      status: 'text',
      deadline: 'timestamp',
      last_contact: 'timestamp',
      email_summary: 'text',
      whatsapp_summary: 'text',
      documents: 'text[]',
      metadata: 'jsonb',
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
      user_id: 'text',
      memory_type: 'text',
      title: 'text',
      content: 'text',
      description: 'text',
      data: 'jsonb',
      context: 'jsonb',
      importance: 'numeric',
      confidence_score: 'numeric',
      decay_rate: 'numeric',
      access_count: 'integer',
      last_accessed_at: 'timestamp',
      embedding: 'vector',
      associations: 'text[]',
      tags: 'text[]',
      created_at: 'timestamp',
      updated_at: 'timestamp',
    },
  },

  // 🏛️ בירוקרטיה
  bureaucracy: {
    table: 'bureaucracy',
    fields: {
      id: 'text',
      title: 'text',
      agency: 'text',
      status: 'text',
      deadline: 'timestamp',
      contact_person: 'text',
      contact_info: 'text',
      documents_needed: 'text[]',
      documents_submitted: 'text[]',
      task_id: 'text',
    },
  },

  // 📁 פרויקטים
  projects: {
    table: 'projects',
    fields: {
      id: 'text',
      title: 'text',
      description: 'text',
      client_id: 'text',
      status: 'text',
      progress: 'integer',
      deadline: 'timestamp',
      versions: 'jsonb',
      documents: 'text[]',
    },
  },

  // 📧 חשבונות Gmail
  gmail_accounts: {
    table: 'gmail_accounts',
    fields: {
      id: 'uuid',
      user_id: 'text',
      email: 'text',
      access_token: 'text',
      refresh_token: 'text',
      expires_at: 'timestamp',
      last_scanned_at: 'timestamp',
    },
  },

  // 📁 חשבונות Drive
  drive_accounts: {
    table: 'drive_accounts',
    fields: {
      id: 'uuid',
      user_id: 'text',
      access_token: 'text',
      refresh_token: 'text',
      expires_at: 'timestamp',
      last_scanned_at: 'timestamp',
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

  // 📁 מסמכים
  documents: {
    table: 'documents',
    fields: {
      id: 'text',
      title: 'text',
      file_path: 'text',
      file_type: 'text',
      mime_type: 'text',
      file_size: 'integer',
      ocr_text: 'text',
      processed: 'boolean',
      ocr_completed: 'boolean',
      extracted_data: 'jsonb',
      related_to: 'text',
      related_type: 'text',
      uploaded_at: 'timestamp',
      processed_at: 'timestamp',
      tags: 'text[]',
    },
  },

  // 💬 צ'אט היסטוריה
  chat_history: {
    table: 'chat_history',
    fields: {
      id: 'text',
      type: 'text',
      message: 'text',
      metadata: 'jsonb',
      embedding: 'vector',
      timestamp: 'timestamp',
      task_context: 'text',
    },
  },

  // 🔍 תובנות מסמכים
  document_insights: {
    table: 'document_insights',
    fields: {
      id: 'uuid',
      file_id: 'text',
      file_name: 'text',
      summary: 'text',
      category: 'text',
      relevance: 'text',
      entities: 'jsonb',
      action_items: 'text[]',
      suggested_tasks: 'text[]',
      related_to: 'text[]',
      related_task: 'text',
      extracted_text: 'text',
      analyzed_at: 'timestamp',
      created_at: 'timestamp',
      drive_account_id: 'uuid',
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
