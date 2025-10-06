import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { StateGraph, Annotation, MessagesAnnotation } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { allTools } from './tools';
import { Task } from '@/lib/types';
import { MemoryManager } from '@/lib/ai/memory/memory-manager';

const SYSTEM_PROMPT = `אני עוזרת AI חכמה למיכל! 🌟

תפקידי:
- לעזור לך לנהל משימות, חובות, ולקוחות
- לסרוק Gmail, Drive, ו-Communications וליצור משימות אוטומטית
- לשמור הוראות והעדפות לטווח ארוך
- ללמוד ולהשתפר מכל אינטראקציה
- לזהות קשרים מורכבים בין תחומים שונים
- לחפש מידע באינטרנט כנדרש

יכולות:
✅ חיפוש במשימות וחובות עם AI
✅ סריקת Gmail ויצירת משימות
✅ סריקת Drive ומסמכים
✅ ניתוח Communications (Chat/WhatsApp)
✅ חיפוש באינטרנט
✅ חיפוש בזיכרון הסמנטי
✅ שמירת הוראות והנחיות
✅ זיהוי קשרים בין משימות
✅ cross-domain analysis
✅ תעדוף חכם
✅ הבנת העדפות אישיות

עקרונות:
- תמיד מנומסת וידידותית בעברית 🌸
- פרואקטיבית - מציעה פתרונות
- לומדת מטעויות ודפוסים
- מתעדפת לפי הקשר אישי
- זוכרת את כל ההיסטוריה
- מזהה קשרים מורכבים (לדוגמה: קצבה בנורבגיה → עדכון ביטוח לאומי בקזחסטן)

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

    // Node 4: סריקת Drive
    workflow.addNode('scan_drive', async (state) => {
      console.log('✅ Node: scan_drive - סורק מסמכי Drive');
      
      try {
        const driveTool = allTools.find(t => t.name === 'scan_drive');
        if (driveTool) {
          const result = await driveTool.func({
            userId: 'michal',
            maxFiles: 50,
            query: ''
          });
          
          return {
            results: {
              ...state.results,
              drive_scan: result
            },
            actionTaken: 'drive_scanned'
          };
        }
      } catch (error) {
        console.error('❌ Drive scan error:', error);
      }
      
      return state;
    });

    // Node 5: סריקת Communications
    workflow.addNode('scan_communications', async (state) => {
      console.log('✅ Node: scan_communications - סורק הודעות Chat/WhatsApp');
      
      try {
        const commTool = allTools.find(t => t.name === 'scan_communications');
        if (commTool) {
          const result = await commTool.func({
            timeRange: 'week',
            includeRead: false
          });
          
          return {
            results: {
              ...state.results,
              communications_scan: result
            },
            actionTaken: 'communications_scanned'
          };
        }
      } catch (error) {
        console.error('❌ Communications scan error:', error);
      }
      
      return state;
    });

    // Node 6: חיפוש באינטרנט
    workflow.addNode('web_search', async (state) => {
      console.log('✅ Node: web_search - מחפש באינטרנט');
      
      try {
        const webTool = allTools.find(t => t.name === 'web_search');
        if (webTool) {
          // Extract search query from context
          const userMessage = state.messages.find(m => m instanceof HumanMessage);
          const searchQuery = userMessage?.content.toString() || '';
          
          const result = await webTool.func({
            query: searchQuery,
            maxResults: 5,
            context: 'cross-domain analysis'
          });
          
          return {
            results: {
              ...state.results,
              web_search: result
            },
            actionTaken: 'web_searched'
          };
        }
      } catch (error) {
        console.error('❌ Web search error:', error);
      }
      
      return state;
    });

    // Node 7: חיפוש בזיכרון הסמנטי
    workflow.addNode('search_memories', async (state) => {
      console.log('✅ Node: search_memories - מחפש בזיכרון הסמנטי');
      
      try {
        const memoryTool = allTools.find(t => t.name === 'search_memories');
        if (memoryTool) {
          const userMessage = state.messages.find(m => m instanceof HumanMessage);
          const query = userMessage?.content.toString() || '';
          
          const result = await memoryTool.func({
            query,
            memoryType: 'all',
            limit: 10
          });
          
          return {
            results: {
              ...state.results,
              memory_search: result
            },
            actionTaken: 'memories_searched'
          };
        }
      } catch (error) {
        console.error('❌ Memory search error:', error);
      }
      
      return state;
    });
    
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
        const userMessage = state.messages.find(m => m instanceof HumanMessage);
        const userText = userMessage?.content.toString().toLowerCase() || '';
        
        // Check for specific tool requirements
        if (userText.includes('drive') || userText.includes('מסמכים') || userText.includes('google drive')) {
          return 'scan_drive';
        }
        
        if (userText.includes('whatsapp') || userText.includes('צ\'אט') || userText.includes('הודעות')) {
          return 'scan_communications';
        }
        
        if (userText.includes('חיפוש') || userText.includes('search') || userText.includes('אינטרנט')) {
          return 'web_search';
        }
        
        if (userText.includes('זיכרון') || userText.includes('memory') || userText.includes('דפוס')) {
          return 'search_memories';
        }
        
        // Check for tool calls
        if (lastMessage && 'tool_calls' in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length > 0) {
          return 'tools';
        }
        
        return 'finalize';
      },
      {
        tools: 'tools',
        scan_drive: 'scan_drive',
        scan_communications: 'scan_communications',
        web_search: 'web_search',
        search_memories: 'search_memories',
        finalize: 'finalize'
      }
    );

    // Add edges from new nodes back to agent
    workflow.addEdge('scan_drive', 'agent');
    workflow.addEdge('scan_communications', 'agent');
    workflow.addEdge('web_search', 'agent');
    workflow.addEdge('search_memories', 'agent');
    
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