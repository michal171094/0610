// 📚 כלי למידה - שמירת הוראות והעדפות
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { MemoryManager } from '@/lib/memory/manager';

const memoryManager = new MemoryManager();

/**
 * 💾 כלי לשמירת הוראה חדשה
 */
export const saveInstructionTool = new DynamicStructuredTool({
  name: 'save_instruction',
  description: 'שמירת הוראה או העדפה לטווח ארוך. השתמש כאשר המשתמש אומר "מהיום", "תמיד", "זכור ש", "אל תשכח".',
  schema: z.object({
    instruction: z.string().describe('ההוראה המלאה'),
    category: z.enum(['preference', 'rule', 'correction', 'priority']).describe('סוג ההוראה'),
    context: z.string().optional().nullable().describe('בהקשר של מה זה רלוונטי'),
    importance: z.enum(['low', 'medium', 'high', 'critical']).optional().nullable().describe('חשיבות ההוראה')
  }),
  func: async ({ instruction, category, context, importance = 'medium' }) => {
    try {
      // התאם context לscope הנכון
      let scope: 'global' | 'domain' | 'task' | 'client' = 'global';
      if (context?.includes('לקוח') || context?.includes('client')) {
        scope = 'client';
      } else if (context?.includes('משימה') || context?.includes('task')) {
        scope = 'task';
      } else if (context?.includes('תחום') || context?.includes('domain')) {
        scope = 'domain';
      }
      
      await memoryManager.saveInstruction(instruction, scope, category);
      
      return JSON.stringify({
        success: true,
        message: `✅ הוראה נשמרה: "${instruction}"`,
        category,
        importance
      });
    } catch (error: any) {
      return JSON.stringify({ 
        error: error.message,
        success: false 
      });
    }
  }
});

/**
 * 📚 כלי לקריאת הוראות קיימות
 */
export const getInstructionsTool = new DynamicStructuredTool({
  name: 'get_instructions',
  description: 'קריאת כל ההוראות וההעדפות שהמשתמש נתן בעבר',
  schema: z.object({
    category: z.enum(['preference', 'rule', 'correction', 'priority', 'all']).optional().nullable()
  }),
  func: async ({ category }) => {
    try {
      const instructions = await memoryManager.getInstructions();
      
      // סינון לפי category אם נדרש
      const filtered = category && category !== 'all' 
        ? instructions.filter(i => i.category === category)
        : instructions;

      return JSON.stringify({
        count: filtered.length,
        instructions: filtered.map(i => ({
          id: i.id,
          text: i.instruction_text,
          category: i.category,
          importance: i.importance,
          scope: i.scope,
          created_at: i.created_at
        }))
      });
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  }
});

/**
 * 🔄 כלי לעדכון הוראה קיימת
 */
export const updateInstructionTool = new DynamicStructuredTool({
  name: 'update_instruction',
  description: 'עדכון או השבתת הוראה קיימת כאשר המשתמש אומר "שכחתי מה אמרתי" או "שנה את זה"',
  schema: z.object({
    instructionId: z.string().describe('מזהה ההוראה'),
    newText: z.string().optional().nullable().describe('טקסט מעודכן'),
    active: z.boolean().optional().nullable().describe('האם להשבית/להפעיל')
  }),
  func: async ({ instructionId, newText, active }) => {
    try {
      const updates: any = {};
      if (newText) updates.instruction_text = newText;
      if (active !== undefined && active !== null) updates.is_active = active;

      await memoryManager.updateInstruction(instructionId, updates);

      return JSON.stringify({
        success: true,
        message: active === false ? '❌ הוראה הושבתה' : '✅ הוראה עודכנה'
      });
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  }
});