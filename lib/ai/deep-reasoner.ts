/**
 * Deep Reasoner
 * Specialized wrapper for o4-mini with extended thinking
 */

import OpenAI from 'openai'

export interface DeepThinkingOptions {
  effort?: 'low' | 'medium' | 'high'
  showReasoning?: boolean
  context?: string
  maxTokens?: number
}

export interface DeepThinkingResponse {
  answer: string
  reasoning: string
  confidence: number
  thinkingTime: number
  model: string
}

export class DeepReasoner {
  private openai: OpenAI

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    })
  }

  async think(
    problem: string,
    options: DeepThinkingOptions = {}
  ): Promise<DeepThinkingResponse> {
    const {
      effort = 'medium',
      showReasoning = true,
      context,
      maxTokens = 8000,
    } = options

    const startTime = Date.now()

    try {
      const systemPrompt = this.buildSystemPrompt(effort, context)

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: problem,
        },
      ]

      const response = await this.openai.chat.completions.create({
        model: 'o4-mini',
        messages,
        max_tokens: maxTokens,
      })

      const thinkingTime = Date.now() - startTime
      const fullContent = response.choices[0].message.content || ''

      const { reasoning, answer, confidence } = this.parseResponse(fullContent)

      return {
        answer,
        reasoning: showReasoning ? reasoning : '',
        confidence,
        thinkingTime,
        model: 'o4-mini',
      }
    } catch (error) {
      console.error('Error in deep thinking:', error)
      throw new Error('Failed to perform deep reasoning')
    }
  }

  private buildSystemPrompt(effort: string, context?: string): string {
    let basePrompt = `You are an expert strategic advisor with deep analytical capabilities.`

    if (context) {
      basePrompt += `\n\nContext:\n${context}`
    }

    switch (effort) {
      case 'low':
        basePrompt += `\n\nProvide a clear analysis with key considerations.`
        break
      
      case 'medium':
        basePrompt += `\n\nThink step-by-step:
1. Break down the problem
2. Consider multiple perspectives
3. Evaluate pros and cons
4. Provide a reasoned recommendation

Show your reasoning process.`
        break
      
      case 'high':
        basePrompt += `\n\nPerform deep analysis:
1. Thoroughly understand the problem and all constraints
2. Generate multiple potential solutions
3. Evaluate each solution across multiple criteria
4. Consider second-order effects and long-term implications
5. Assess risks and opportunities
6. Provide a comprehensive recommendation with contingencies

Think deeply and show all your reasoning.`
        break
    }

    return basePrompt
  }

  private parseResponse(content: string): {
    reasoning: string
    answer: string
    confidence: number
  } {
    let reasoning = ''
    let answer = content

    const thinkingMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/)
    if (thinkingMatch) {
      reasoning = thinkingMatch[1].trim()
      answer = content.replace(/<thinking>[\s\S]*?<\/thinking>/, '').trim()
    } else {
      const lines = content.split('\n\n')
      if (lines.length > 2) {
        const mid = Math.floor(lines.length / 2)
        reasoning = lines.slice(0, mid).join('\n\n')
        answer = lines.slice(mid).join('\n\n')
      }
    }

    const reasoningWords = reasoning.split(/\s+/).length
    let confidence = 0.5

    if (reasoningWords > 200) confidence = 0.9
    else if (reasoningWords > 100) confidence = 0.8
    else if (reasoningWords > 50) confidence = 0.7
    else if (reasoningWords > 20) confidence = 0.6

    const uncertaintyMarkers = ['אולי', 'maybe', 'might', 'could be', 'uncertain']
    const hasUncertainty = uncertaintyMarkers.some(marker => 
      content.toLowerCase().includes(marker)
    )
    if (hasUncertainty) {
      confidence *= 0.9
    }

    return { reasoning, answer, confidence }
  }

  async planFinancial(
    situation: {
      income: number
      debts: Array<{ amount: number, interest: number, name: string }>
      question: string
    }
  ): Promise<DeepThinkingResponse> {
    const problem = `Financial Situation:
- Monthly Income: €${situation.income}
- Debts: ${situation.debts.map(d => `${d.name}: €${d.amount} (${d.interest}% interest)`).join(', ')}

Question: ${situation.question}

Provide a detailed financial strategy with specific action steps.`

    return this.think(problem, {
      effort: 'high',
      context: 'You are a financial advisor. Consider cash flow, interest rates, priorities, and risk.',
    })
  }

  async planNegotiation(
    scenario: {
      party: string
      currentAmount: number
      targetAmount: number
      context: string
    }
  ): Promise<DeepThinkingResponse> {
    const problem = `Negotiation Scenario:
- Negotiating with: ${scenario.party}
- Current Amount: €${scenario.currentAmount}
- Target Amount: €${scenario.targetAmount}
- Context: ${scenario.context}

Develop a negotiation strategy with specific tactics, talking points, and fallback positions.`

    return this.think(problem, {
      effort: 'high',
      context: 'You are a negotiation strategist. Consider psychology, leverage, timing, and alternatives.',
    })
  }
}

let deepReasoner: DeepReasoner | null = null

export function getDeepReasoner(): DeepReasoner {
  if (!deepReasoner) {
    deepReasoner = new DeepReasoner()
  }
  return deepReasoner
}