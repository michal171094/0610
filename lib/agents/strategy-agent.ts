/**
 * Strategy Agent
 * Provides strategic advice for complex decisions
 */

import { supabase } from '@/lib/supabase'
import { getHybridMemory } from '@/lib/memory/hybrid-memory'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export interface StrategyRequest {
  situation: string
  context?: {
    relatedTasks?: any[]
    relatedDebts?: any[]
    constraints?: string[]
  }
  options?: string[]
}

export interface StrategyRecommendation {
  recommendation: string
  reasoning: string
  pros: string[]
  cons: string[]
  risks: string[]
  nextSteps: string[]
  confidence: number
}

export class StrategyAgent {
  private memory = getHybridMemory()

  async getStrategicAdvice(request: StrategyRequest): Promise<StrategyRecommendation> {
    // Get relevant memories
    const memories = await this.memory.search({
      query: request.situation,
      limit: 5,
      minSimilarity: 0.6,
    })

    const prompt = `אתה יועץ אסטרטגי חכם עבור מיכל.

**המצב:**
${request.situation}

**הקשר נוסף:**
${request.context ? JSON.stringify(request.context, null, 2) : 'אין'}

**אופציות שנשקלות:**
${request.options ? request.options.map((o, i) => `${i + 1}. ${o}`).join('\n') : 'לא צוין'}

**זיכרונות רלוונטיים:**
${memories.map(m => `- ${m.content}`).join('\n')}

נתח את המצב ותן המלצה אסטרטגית. השב בJSON:
{
  "recommendation": "ההמלצה המרכזית",
  "reasoning": "הנימוק המלא",
  "pros": ["יתרון 1", "יתרון 2"],
  "cons": ["חיסרון 1", "חיסרון 2"],
  "risks": ["סיכון 1", "סיכון 2"],
  "nextSteps": ["צעד 1", "צעד 2", "צעד 3"],
  "confidence": 0.85
}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(response.choices[0].message.content!)

    // Save the strategy session to memory
    await this.memory.save(
      `Strategy session: ${request.situation}\nRecommendation: ${result.recommendation}`,
      {
        type: 'strategy',
        importance: 0.8,
        source: 'strategy-agent',
      }
    )

    return result
  }

  async getNegotiationStrategy(debtId: string): Promise<StrategyRecommendation> {
    const { data: debt } = await supabase
      .from('debts')
      .select('*')
      .eq('id', debtId)
      .single()

    if (!debt) {
      throw new Error('Debt not found')
    }

    return this.getStrategicAdvice({
      situation: `איך לנהל משא ומתן על חוב של ${debt.amount}€ עם ${debt.original_company}`,
      context: {
        relatedDebts: [debt],
        constraints: ['תקציב מוגבל', 'צריך פתרון מהיר'],
      },
      options: [
        'להציע תשלום חלקי',
        'לבקש הקפאת ריבית',
        'להציע תשלומים',
        'לפנות לעורך דין',
      ],
    })
  }
}

let strategyAgent: StrategyAgent | null = null

export function getStrategyAgent(): StrategyAgent {
  if (!strategyAgent) {
    strategyAgent = new StrategyAgent()
  }
  return strategyAgent
}
