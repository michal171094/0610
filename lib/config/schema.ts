/**
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
