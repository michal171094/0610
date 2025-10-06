import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * API לעדכון משימות מתוך תובנות מייל
 * מעדכן סטטוס, דדליין, סכומים וכו' לפי מה שהסוכן מצא
 */
export async function POST(request: NextRequest) {
  try {
    const { updates } = await request.json();
    
    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'Invalid updates format' }, { status: 400 });
    }

    const results = [];
    
    for (const update of updates) {
      const { taskId, extractedData } = update;
      
      if (!taskId) continue;

      // בניית אובייקט העדכון
      const updateData: any = {
        last_updated: new Date().toISOString()
      };

      // עדכון דדליין אם נמצא
      if (extractedData?.deadline) {
        updateData.deadline = extractedData.deadline;
      }

      // עדכון סטטוס אם נמצא
      if (extractedData?.status_update) {
        const statusMap: any = {
          'paid': 'completed',
          'pending': 'in_progress',
          'overdue': 'blocked',
          'settled': 'completed'
        };
        
        if (statusMap[extractedData.status_update]) {
          updateData.status = statusMap[extractedData.status_update];
        }
      }

      // עדכון סכום כלכלי
      if (extractedData?.amount) {
        updateData.financial_impact = extractedData.amount;
      }

      // עדכון פעולה הבאה אם יש המלצה
      if (update.suggested_next_action) {
        updateData.next_action = update.suggested_next_action;
      }

      // עדכון המשימה ב-unified_dashboard
      const { error: taskError } = await supabaseAdmin
        .from('unified_dashboard')
        .update(updateData)
        .eq('id', taskId);

      if (taskError) {
        console.error('❌ Error updating task:', taskId, taskError);
        results.push({ taskId, success: false, error: taskError.message });
        continue;
      }

      // אם זה חוב, נסה לעדכן גם בטבלת debts (אם קיים קישור)
      if (extractedData?.amount || extractedData?.deadline || extractedData?.status_update) {
        const { data: task } = await supabaseAdmin
          .from('unified_dashboard')
          .select('linked_debt_id')
          .eq('id', taskId)
          .single();

        if (task?.linked_debt_id) {
          const debtUpdate: any = {};
          
          if (extractedData.amount) {
            debtUpdate.amount = extractedData.amount;
            if (extractedData.currency) {
              debtUpdate.currency = extractedData.currency;
            }
          }
          
          if (extractedData.deadline) {
            debtUpdate.deadline = extractedData.deadline;
          }
          
          if (extractedData.status_update) {
            const debtStatusMap: any = {
              'paid': 'settled',
              'settled': 'settled',
              'pending': 'active',
              'overdue': 'active'
            };
            
            if (debtStatusMap[extractedData.status_update]) {
              debtUpdate.status = debtStatusMap[extractedData.status_update];
            }
          }

          if (Object.keys(debtUpdate).length > 0) {
            await supabaseAdmin
              .from('debts')
              .update(debtUpdate)
              .eq('id', task.linked_debt_id);
          }
        }
      }

      results.push({ 
        taskId, 
        success: true, 
        updated: Object.keys(updateData)
      });
    }

    console.log(`✅ Updated ${results.filter(r => r.success).length}/${results.length} tasks`);

    return NextResponse.json({ 
      success: true, 
      results,
      message: `עודכנו ${results.filter(r => r.success).length} משימות בהצלחה`
    });

  } catch (error) {
    console.error('❌ Error applying email updates:', error);
    return NextResponse.json(
      { error: 'Failed to apply updates' },
      { status: 500 }
    );
  }
}
