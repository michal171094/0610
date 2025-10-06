import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { StateGraph, Annotation, MessagesAnnotation } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { allTools } from './tools';
import { Task } from '@/lib/types';
import { MemoryManager } from '@/lib/memory/manager';

const SYSTEM_PROMPT = `אני עוזרת AI חכמה למיכל! 🌟

תפקידי:
- לעזור לך לנהל משימות, חובות, ולקוחות
- לסרוק Gmail וליצור משימות אוטומטית
- לשמור הוראות והעדפות לטווח ארוך
- ללמוד ולהשתפר מכל אינטראקציה

יכולות:
✅ חיפוש במשימות וחובות
✅ סריקת Gmail ויצירת משימות
✅ שמירת הוראות והנחיות
✅ זיהוי קשרים בין משימות
✅ תעדוף חכם
✅ הבנת העדפות אישיות

עקרונות:
- תמיד מנומסת וידידותית בעברית 🌸
- פרואקטיבית - מציעה פתרונות
- לומדת מטעויות
- מתעדפת לפי הקשר אישי
- זוכרת את כל ההיסטוריה

במקרה של הוראות חדשות ("תמיד...", "זכור ש...", "מהיום..."), אשמור אותן אוטומטית.`;

// State definition
const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec,
  results: Annotation<Record<string, any>>({
    reducer: (current, update) => ({ ...current, ...update })
  }),
  actionTaken: Annotation<string>({
    reducer: (_, newValue) => newValue
  })
});

export class MichalAIAgent {
  private llm: ChatOpenAI;
  private graph: any;
  private memory: MemorySaver;
  private memoryManager: MemoryManager;
  
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4o',
      temperature: 0.7,
      streaming: false
    });
    
    this.memory = new MemorySaver();
    this.memoryManager = new MemoryManager();
    this.graph = this.createGraph();
  }
  
  private createGraph() {
    const workflow = new StateGraph(GraphState);
    
    // Node 1: טעינת הוראות מהזיכרון
    workflow.addNode('get_context', async (state) => {
      console.log('✅ Node: get_context - טוען הוראות מהזיכרון');
      
      try {
        const instructions = await this.memoryManager.getInstructions();
        const instructionsText = instructions.length > 0
          ? '\n\n📋 הוראות שמורות:\n' + instructions.map(i => `• ${i.instruction_text}`).join('\n')
          : '';
        
        const enhancedPrompt = SYSTEM_PROMPT + instructionsText;
        
        return {
          messages: [new SystemMessage(enhancedPrompt)],
          results: { instructionsLoaded: instructions.length }
        };
      } catch (error) {
        console.error('שגיאה בטעינת הוראות:', error);
        return {
          messages: [new SystemMessage(SYSTEM_PROMPT)],
          results: { instructionsLoaded: 0 }
        };
      }
    });
    
    // Node 2: הסוכן החכם
    workflow.addNode('agent', async (state) => {
      console.log('✅ Node: agent - מעבד בקשה');
      
      const messages = [
        ...state.messages
      ];
      
      const response = await this.llm.invoke(messages, {
        tools: allTools
      });
      
      return { messages: [response] };
    });
    
    // Node 3: ביצוע כלים
    const toolNode = new ToolNode(allTools);
    workflow.addNode('tools', toolNode);
    
    // Node 4: שמירת זיכרונות והוראות חדשות
    workflow.addNode('finalize', async (state) => {
      console.log('✅ Node: finalize - בודק אם צריך לשמור הוראות');
      
      const lastMessage = state.messages[state.messages.length - 1];
      const userMessage = state.messages.find(m => m instanceof HumanMessage);
      
      // זיהוי אוטומטי של הוראות חדשות
      if (userMessage) {
        const text = userMessage.content.toString();
        const instructionKeywords = ['תמיד', 'זכור ש', 'מהיום', 'כל פעם', 'אל תשכח'];
        
        const containsInstruction = instructionKeywords.some(keyword => 
          text.includes(keyword)
        );
        
        if (containsInstruction) {
          try {
            await this.memoryManager.saveInstruction(text, 'global');
            console.log('✅ הוראה חדשה נשמרה אוטומטית');
          } catch (error) {
            console.error('שגיאה בשמירת הוראה:', error);
          }
        }
      }
      
      return {
        actionTaken: 'completed',
        results: {
          ...state.results,
          final_response: lastMessage.content
        }
      };
    });
    
    // Edges
    workflow.addEdge('__start__', 'get_context');
    workflow.addEdge('get_context', 'agent');
    
    workflow.addConditionalEdges(
      'agent',
      (state: any) => {
        const lastMessage = state.messages[state.messages.length - 1];
        if (lastMessage && 'tool_calls' in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length > 0) {
          return 'tools';
        }
        return 'finalize';
      },
      {
        tools: 'tools',
        finalize: 'finalize'
      }
    );
    
    workflow.addEdge('tools', 'agent');
    workflow.addEdge('finalize', '__end__');
    
    return workflow.compile({ checkpointer: this.memory });
  }
  
  async chat(message: string, threadId: string = 'default'): Promise<string> {
    console.log(`\n💬 User: ${message}`);
    console.log(`🧵 Thread: ${threadId}`);
    
    try {
      const result = await this.graph.invoke(
        { messages: [new HumanMessage(message)] },
        { configurable: { thread_id: threadId }, recursionLimit: 25 }
      );
      
      const messages = result.messages || [];
      const lastMessage = messages[messages.length - 1];
      
      if (!lastMessage) {
        return 'מצטערת, לא הצלחתי לעבד את הבקשה.';
      }
      
      const response = lastMessage.content || 'לא הצלחתי להבין.';
      console.log(`✅ Response: ${response.substring(0, 100)}...`);
      
      return response;
    } catch (error: any) {
      console.error('❌ Chat error:', error);
      return `מצטערת, נתקלתי בשגיאה: ${error.message}`;
    }
  }
  
  async getHistory(threadId: string = 'default'): Promise<BaseMessage[]> {
    try {
      const state: any = await this.memory.get({ configurable: { thread_id: threadId } });
      return state?.channel_values?.messages || [];
    } catch {
      return [];
    }
  }
  
  async clearHistory(threadId: string = 'default'): Promise<void> {
    try {
      await this.memory.put(
        { configurable: { thread_id: threadId } },
        { channel_values: { messages: [] } } as any,
        {} as any
      );
    } catch (error) {
      console.error('Clear history error:', error);
    }
  }
}

export const aiAgent = new MichalAIAgent();