/**
 * Type Definitions
 * Centralized type definitions for the entire project
 */

// Database Types
export interface Task {
  id: string
  title: string
  domain: 'debt' | 'bureaucracy' | 'client' | 'project' | 'general'
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  deadline?: string
  priority_score?: number
  financial_impact?: number
  linked_debt_id?: string
  linked_bureaucracy_id?: string
  linked_client_id?: string
  linked_project_id?: string
  ai_recommendations?: any
  task_chat_history?: any[]
  context_embedding?: number[]
  created_at?: string
  updated_at?: string
}

export interface Debt {
  id: string
  original_company: string
  collection_company?: string
  collection_agency?: string
  original_amount?: number
  amount: number
  currency?: string
  status?: string
  appeal_status?: string
  appeal_date?: string
  settlement_offer?: number
  settlement_date?: string
  deadline?: string
  payment_plan?: any
  contact_history?: any[]
  negotiation_notes?: string
  task_id?: string
}

export interface Client {
  id: string
  name: string
  email?: string
  phone?: string
  whatsapp?: string
  project_type?: string
  price?: number
  amount_paid?: number
  payment_status?: string
  status?: string
  deadline?: string
  last_contact?: string
  email_summary?: string
  whatsapp_summary?: string
  documents?: string[]
  metadata?: any
}

export interface Bureaucracy {
  id: string
  title: string
  agency: string
  status?: string
  deadline?: string
  contact_person?: string
  contact_info?: string
  documents_needed?: string[]
  documents_submitted?: string[]
  task_id?: string
}

// AI & Memory Types
export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'working'

export interface AgentMemory {
  id: string
  userId: string
  memoryType: MemoryType
  title?: string
  description?: string
  data: any
  importanceScore: number
  accessCount: number
  lastAccessedAt?: Date
  decayRate: number
  associations: string[]
  contextTags: string[]
  embedding?: number[]
  createdAt: Date
  updatedAt: Date
}

export interface ToolExecution {
  id: string
  sessionId: string
  toolName: string
  toolInput: any
  toolOutput: any
  success: boolean
  executionTimeMs: number
  tokensUsed?: number
  costEstimate?: number
  errorMessage?: string
  createdAt: Date
}

// Email Types
export interface EmailInsight {
  id: string
  email_id: string
  thread_id: string
  gmail_account_id?: string
  from_address: string
  subject?: string
  received_at: string
  summary?: string
  sentiment?: string
  relevance?: string
  is_update?: boolean
  update_type?: string
  related_type?: string
  related_id?: string
  related_name?: string
  should_create_task?: boolean
  suggested_task?: any
  task_created_id?: string
  action_items?: string[]
  tags?: string[]
}

// Communication Types
export interface Communication {
  id: string
  type: 'email' | 'whatsapp' | 'phone'
  direction: 'inbound' | 'outbound'
  contact_id?: string
  contact_name?: string
  subject?: string
  content?: string
  timestamp: string
  processed: boolean
  created_task_id?: string
  embedding?: number[]
  metadata?: any
}

// Project Types
export interface Project {
  id: string
  title: string
  description?: string
  client_id?: string
  status?: string
  progress?: number
  deadline?: string
  versions?: any[]
  documents?: string[]
}

// System Types
export interface ChatSession {
  id: string
  session_id: string
  user_id?: string
  thread_id?: string
  title?: string
  summary?: string
  messages?: any[]
  context?: any
  metadata?: any
  total_tokens?: number
  total_cost?: number
  started_at?: string
  last_message_at?: string
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Search Types
export interface SearchOptions {
  limit?: number
  minSimilarity?: number
  filter?: {
    type?: string
    entityId?: string
    importance?: { gte?: number, lte?: number }
  }
}

export interface SearchResult {
  id: string
  content: string
  similarity?: number
  metadata?: any
}

