import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client for browser
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Types
export type Task = {
  id: string
  title: string
  domain: 'Legal' | 'Health' | 'Debt' | 'Client' | 'Bureaucracy'
  priority_score: number
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  is_urgent: boolean
  next_action: string
  deadline: string
  financial_impact: number
  ai_reasoning: string
  sub_tasks: SubTask[]
  ai_recommendations: AIRecommendations
  progress: number
  last_updated: string
  tags: string[]
  task_chat_history: ChatMessage[]
  // מידע נוסף מטבלאות קשורות (חובות/בירוקרטיה/לקוחות)
  additionalContext?: {
    amount?: number
    currency?: string
    status?: string
    paymentStatus?: string
    company?: string
    agency?: string
    caseNumber?: string
    settlementOffer?: number
  }
}

export type SubTask = {
  id: string
  title: string
  status: 'pending' | 'completed' | 'in_progress'
  completed_at?: string
}

export type AIRecommendations = {
  message_draft_email?: string
  message_draft_whatsapp?: string
  phone_script?: string
  best_time_to_call?: string
  documents_needed?: string[]
  backup_plan?: string
  negotiation_strategy?: string
  timeline_expectation?: string
}

export type ChatMessage = {
  id: string
  type: 'user' | 'ai'
  message: string
  timestamp: string
  task_context?: string
}

export type Client = {
  id: string
  name: string
  project_type: string
  status: string
  payment_status: string
  deadline: string
  price: number
  last_contact: string
  whatsapp_summary?: string
  email_summary?: string
  documents?: string[]
}

export type Debt = {
  id: string
  collection_company: string
  original_company: string
  amount: number
  currency: string
  status: string
  case_number?: string
  notes?: string
}

export type BureaucracyTask = {
  id: string
  title: string
  agency: string
  status: string
  deadline?: string
  documents_needed?: string[]
  notes?: string
}
