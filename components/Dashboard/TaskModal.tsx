'use client'

import { useState, useEffect } from 'react'
import { Task, ChatMessage } from '@/lib/supabase'
import TaskDocuments from './TaskDocuments'

interface TaskModalProps {
  task: Task
  onClose: () => void
  onUpdate: (task: Task) => void
  onDelete: (taskId: string) => void
}

export default function TaskModal({ task, onClose, onUpdate, onDelete }: TaskModalProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(task.task_chat_history || [])
  const [chatInput, setChatInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Load existing chat history
    setChatMessages(task.task_chat_history || [])
  }, [task])

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      type: 'user',
      message: chatInput,
      timestamp: new Date().toISOString(),
      task_context: task.id
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsLoading(true)

    try {
      // Send to task-specific chat endpoint
      const response = await fetch(`/api/tasks/${task.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: chatInput, type: 'user' })
      })

      if (response.ok) {
        // Get AI response
        const aiResponse = await fetch('/api/ai-agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: chatInput, 
            context: task,
            history: chatMessages 
          })
        })

        const aiData = await aiResponse.json()

        const aiMessage: ChatMessage = {
          id: `msg_${Date.now()}_ai`,
          type: 'ai',
          message: aiData.response,
          timestamp: new Date().toISOString(),
          task_context: task.id
        }

        // Save AI message
        await fetch(`/api/tasks/${task.id}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: aiData.response, type: 'ai' })
        })

        setChatMessages(prev => [...prev, aiMessage])
      }
    } catch (error) {
      console.error('Chat error:', error)
      alert('שגיאה בשליחת ההודעה')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSubTask = (subTaskId: string) => {
    const updatedSubTasks = task.sub_tasks.map(st =>
      st.id === subTaskId
        ? { ...st, status: st.status === 'completed' ? 'pending' : 'completed' as any }
        : st
    )
    onUpdate({ ...task, sub_tasks: updatedSubTasks })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    const notification = document.getElementById('copy-notification')
    if (notification) {
      notification.classList.remove('hidden')
      notification.classList.add('show')
      setTimeout(() => {
        notification.classList.remove('show')
        notification.classList.add('hidden')
      }, 2000)
    }
  }

  const generateDraft = async (messageType: 'email' | 'whatsapp' | 'phone') => {
    try {
      const response = await fetch('/api/ai-agent/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          taskId: task.id, 
          messageType,
          language: task.domain === 'Legal' ? 'de' : 'he'
        })
      })

      const data = await response.json()
      
      // Update task with new draft
      const updatedRecommendations = {
        ...task.ai_recommendations,
        [`message_draft_${messageType}`]: data.draft
      }
      
      onUpdate({ ...task, ai_recommendations: updatedRecommendations })
    } catch (error) {
      console.error('Failed to generate draft:', error)
      alert('שגיאה ביצירת הטיוטה')
    }
  }

  return (
    <>
      <div className="overlay" onClick={onClose}></div>
      <div className="modal" style={{ display: 'block' }}>
        <div className="modal-content enhanced-modal">
          <div className="modal-header">
            <h3>{task.title}</h3>
            <button type="button" className="modal-close" onClick={onClose}>✕</button>
          </div>

          <div className="modal-body enhanced-modal-body">
            {/* Left side - Task details */}
            <div className="task-main-section">
              <div className="task-details">
                <div className="detail-row">
                  <strong>תחום:</strong>
                  <span>{task.domain}</span>
                </div>
                <div className="detail-row">
                  <strong>דדליין:</strong>
                  <span>{new Date(task.deadline).toLocaleDateString('he-IL')}</span>
                </div>
                <div className="detail-row">
                  <strong>עדיפות:</strong>
                  <span>{task.priority_score}/100</span>
                </div>
                <div className="detail-row">
                  <strong>פעולה הבאה:</strong>
                  <span>{task.next_action}</span>
                </div>
                <div className="detail-row">
                  <strong>הנמקת AI:</strong>
                  <p>{task.ai_reasoning}</p>
                </div>
              </div>

              {/* Sub-tasks */}
              {task.sub_tasks && task.sub_tasks.length > 0 && (
                <div className="sub-tasks-section">
                  <h4>תת-משימות</h4>
                  <div className="sub-tasks-list">
                    {task.sub_tasks.map(subTask => (
                      <div key={subTask.id} className="sub-task-item">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={subTask.status === 'completed'}
                            onChange={() => toggleSubTask(subTask.id)}
                          />
                          <span className={subTask.status === 'completed' ? 'completed' : ''}>
                            {subTask.title}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Recommendations */}
              <div className="ai-recommendations">
                <h4>🤖 המלצות והטיוטות</h4>
                <div className="recommendations-content">
                  {task.ai_recommendations?.message_draft_email && (
                    <div className="recommendation-item">
                      <strong>📧 טיוטת מייל:</strong>
                      <pre className="draft-text">{task.ai_recommendations.message_draft_email}</pre>
                      <button 
                        className="btn btn--small btn--secondary"
                        onClick={() => copyToClipboard(task.ai_recommendations.message_draft_email!)}
                      >
                        📋 העתק
                      </button>
                    </div>
                  )}
                  
                  {task.ai_recommendations?.phone_script && (
                    <div className="recommendation-item">
                      <strong>📞 תסריט שיחה:</strong>
                      <pre className="draft-text">{task.ai_recommendations.phone_script}</pre>
                      <button 
                        className="btn btn--small btn--secondary"
                        onClick={() => copyToClipboard(task.ai_recommendations.phone_script!)}
                      >
                        📋 העתק
                      </button>
                    </div>
                  )}

                  <div className="draft-actions">
                    <button 
                      className="btn btn--small btn--primary"
                      onClick={() => generateDraft('email')}
                    >
                      ✍️ צור טיוטת מייל
                    </button>
                    <button 
                      className="btn btn--small btn--primary"
                      onClick={() => generateDraft('whatsapp')}
                    >
                      💬 צור הודעת WhatsApp
                    </button>
                    <button 
                      className="btn btn--small btn--primary"
                      onClick={() => generateDraft('phone')}
                    >
                      📞 צור תסריט שיחה
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Documents Section */}
            <TaskDocuments 
              taskId={task.id}
              taskTitle={task.title}
              taskDescription={task.next_action}
              domain={task.domain}
            />

            {/* Right side - Task chat */}
            <div className="task-chat-section">
              <div className="task-chat-header">
                <h4>💬 צ'אט עם AI למשימה זו</h4>
              </div>
              <div className="task-chat-messages">
                {chatMessages.length === 0 ? (
                  <p className="chat-empty">שאלי משהו על המשימה הזו...</p>
                ) : (
                  chatMessages.map(msg => (
                    <div key={msg.id} className={`chat-message ${msg.type}`}>
                      <strong>{msg.type === 'user' ? 'את' : 'AI'}:</strong>
                      <span>{msg.message}</span>
                    </div>
                  ))
                )}
                {isLoading && <div className="chat-loading">הסוכן חושב...</div>}
              </div>
              <div className="task-chat-input-container">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="שאלי על המשימה הזו..."
                  disabled={isLoading}
                />
                <button onClick={sendChatMessage} disabled={isLoading}>
                  📤
                </button>
              </div>
            </div>
          </div>

          <div className="modal-footer enhanced-modal-footer">
            <button 
              className="btn btn--secondary"
              onClick={() => onUpdate({ ...task, status: 'completed' })}
            >
              ✅ סמן כהושלם
            </button>
            <button 
              className="btn btn--danger"
              onClick={() => {
                if (confirm('האם למחוק את המשימה?')) {
                  onDelete(task.id)
                }
              }}
            >
              🗑️ מחק משימה
            </button>
            <button className="btn btn--primary" onClick={onClose}>
              💾 סגור
            </button>
          </div>
        </div>
      </div>

      {/* Copy Notification */}
      <div id="copy-notification" className="notification hidden">
        📋 הועתק ללוח
      </div>
    </>
  )
}
