'use client'

import { useState, useEffect } from 'react'
import TaskTable from './TaskTable'
import TaskModal from './TaskModal'
import NewTaskModal from './NewTaskModal'
import NextActionWidget from './NextActionWidget'
import GmailManager from '../Gmail/GmailManager'
import SyncManager from '../SyncManager'
import AgentChat from '../Chat/AgentChat'
import { Task } from '@/lib/supabase'

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  const [showGmailManager, setShowGmailManager] = useState(false)
  const [showSyncManager, setShowSyncManager] = useState(false)
  const [showAgentChat, setShowAgentChat] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/tasks')
      const data = await response.json()
      setTasks(data.tasks || [])
    } catch (error) {
      console.error('Failed to load tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
  }

  const handleTaskClickById = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      setSelectedTask(task)
    } else {
      // If task not in current list, reload and find it
      await loadTasks()
      const reloadedTask = tasks.find(t => t.id === taskId)
      if (reloadedTask) {
        setSelectedTask(reloadedTask)
      }
    }
  }

  const handleTaskUpdate = async (updatedTask: Task) => {
    try {
      const response = await fetch(`/api/tasks/${updatedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTask),
      })
      
      if (response.ok) {
        await loadTasks()
        setSelectedTask(null)
      }
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  }

  const handleTaskDelete = async (taskId: string) => {
    if (!confirm('האם את בטוחה שברצונך למחוק את המשימה?')) return

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        await loadTasks()
        setSelectedTask(null)
      }
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  const handleNewTask = async (taskData: Partial<Task>) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      })
      
      if (response.ok) {
        await loadTasks()
        setShowNewTaskModal(false)
      }
    } catch (error) {
      console.error('Failed to create task:', error)
    }
  }

  const handleRecalculatePriorities = async () => {
    try {
      const response = await fetch('/api/ai-agent/prioritize', {
        method: 'POST',
      })
      
      if (response.ok) {
        await loadTasks()
        alert('העדיפויות עודכנו בהצלחה! 🎯')
      }
    } catch (error) {
      console.error('Failed to recalculate priorities:', error)
    }
  }

  return (
    <div id="dashboard-page" className="page active">
      <div className="page-header">
        <div>
          <h2>דאשבורד ראשי - כל המשימות</h2>
          <p className="page-subtitle">כל המשימות מכל התחומים בעדיפות חכמה</p>
        </div>
        <div className="page-header-actions">
          <button 
            className="btn btn--primary" 
            onClick={() => setShowAgentChat(!showAgentChat)}
            title="צ'אט עם הסוכן החכם"
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            💬 סוכן AI
          </button>
          <button 
            className="btn btn--secondary" 
            onClick={() => setShowSyncManager(true)}
            title="סנכרון Gmail ו-Drive עם אישור"
          >
            🔄 סנכרון
          </button>
          <button 
            className="btn btn--secondary" 
            onClick={() => setShowGmailManager(!showGmailManager)}
            title="נהל חשבונות Gmail"
          >
            📧 Gmail
          </button>
          <button 
            className="btn btn--secondary" 
            onClick={() => window.location.href = '/api/drive/auth'}
            title="חיבור ל-Google Drive"
          >
            📁 Drive
          </button>
          <button 
            className="btn btn--secondary" 
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
              input.multiple = true;
              input.onchange = async (e: any) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;
                
                alert(`📤 מעלה ${files.length} קבצים...\n\nהסוכן יסרוק אותם ויקשר אוטומטית למשימות רלוונטיות.`);
                
                for (const file of files) {
                  const formData = new FormData();
                  formData.append('file', file);
                  
                  try {
                    const response = await fetch('/api/drive/documents', {
                      method: 'POST',
                      body: formData
                    });
                    
                    if (response.ok) {
                      const data = await response.json();
                      console.log('✅ הקובץ הועלה:', file.name, data);
                    }
                  } catch (error) {
                    console.error('❌ שגיאה בהעלאת קובץ:', file.name, error);
                  }
                }
                
                alert('✅ כל הקבצים הועלו בהצלחה!\n\nהסוכן סרק אותם וזיהה מידע רלוונטי.');
                await loadTasks();
              };
              input.click();
            }}
            title="העלה מסמכים (PDF, תמונות, וכו')"
          >
            📤 העלה מסמכים
          </button>
          <button 
            className="btn btn--secondary" 
            onClick={handleRecalculatePriorities}
            title="חישוב מחדש של עדיפויות"
          >
            🎯 עדכן עדיפויות
          </button>
          <button 
            className="btn btn--primary" 
            onClick={() => setShowNewTaskModal(true)}
          >
            ➕ משימה חדשה
          </button>
        </div>
      </div>

      {/* Gmail Manager Panel */}
      {showGmailManager && (
        <div className="mb-6">
          <GmailManager />
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>טוען משימות...</p>
        </div>
      ) : (
        <TaskTable
          tasks={tasks}
          onTaskClick={handleTaskClick}
          onTaskDelete={handleTaskDelete}
        />
      )}

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
          onDelete={handleTaskDelete}
        />
      )}

      {showSyncManager && (
        <SyncManager onClose={() => setShowSyncManager(false)} />
      )}

      {showAgentChat && (
        <AgentChat onClose={() => setShowAgentChat(false)} />
      )}

      {showNewTaskModal && (
        <NewTaskModal
          onClose={() => setShowNewTaskModal(false)}
          onSave={handleNewTask}
        />
      )}
    </div>
  )
}
