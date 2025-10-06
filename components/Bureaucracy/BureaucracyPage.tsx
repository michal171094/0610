'use client'

import { useState, useEffect } from 'react'
import TaskModal from '../Dashboard/TaskModal'
import { Task } from '@/lib/supabase'

export default function BureaucracyPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/tasks')
      const data = await response.json()
      
      // Filter only bureaucracy-related tasks
      const bureaucracyTasks = (data.tasks || []).filter((task: Task) => 
        task.domain === 'Bureaucracy' || task.id?.startsWith('bureau-')
      )
      
      setTasks(bureaucracyTasks)
    } catch (error) {
      console.error('Failed to load bureaucracy:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
  }

  const handleTaskUpdate = async (updatedTask: Task) => {
    try {
      await fetch(`/api/tasks/${updatedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTask),
      })
      await loadTasks()
      setSelectedTask(null)
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  }

  const handleTaskDelete = async (taskId: string) => {
    if (!confirm('האם למחוק את המשימה הזו?')) return
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
      await loadTasks()
      setSelectedTask(null)
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; color: string }> = {
      pending: { text: 'ממתין', color: 'bg-gray-100 text-gray-800' },
      in_progress: { text: 'בטיפול', color: 'bg-blue-100 text-blue-800' },
      completed: { text: 'הושלם', color: 'bg-green-100 text-green-800' },
      blocked: { text: 'חסום', color: 'bg-red-100 text-red-800' },
    }
    const badge = badges[status] || badges.pending
    return <span className={`px-3 py-1 rounded-full text-sm font-semibold ${badge.color}`}>{badge.text}</span>
  }

  const getOrganizationIcon = (title: string) => {
    if (title.includes('Jobcenter')) return '💼'
    if (title.includes('LEA')) return '🏛️'
    if (title.includes('ביטוח')) return '🛡️'
    return '📋'
  }

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)
  const activeCount = tasks.filter(t => t.status === 'in_progress' || t.status === 'pending').length

  if (loading) {
    return (
      <div className="page active">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>טוען ביורוקרטיה...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page active">
      <div className="page-header">
        <div>
          <h2>📋 ביורוקרטיה</h2>
          <p className="page-subtitle">מעקב אחר כל התהליכים הממשלתיים</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg shadow-md border-l-4 border-blue-500">
          <p className="text-sm text-blue-600 font-semibold mb-1">סך המשימות</p>
          <p className="text-3xl font-bold text-blue-800">{tasks.length}</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
          <p className="text-sm text-yellow-600 font-semibold mb-1">בטיפול</p>
          <p className="text-3xl font-bold text-yellow-800">{activeCount}</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg shadow-md border-l-4 border-green-500">
          <p className="text-sm text-green-600 font-semibold mb-1">הושלמו</p>
          <p className="text-3xl font-bold text-green-800">{tasks.filter(t => t.status === 'completed').length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {[
          { value: 'all', label: 'הכל' },
          { value: 'pending', label: 'ממתין' },
          { value: 'in_progress', label: 'בטיפול' },
          { value: 'completed', label: 'הושלם' }
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              filter === f.value ? 'bg-[#96758d] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tasks Table */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-500 text-lg">אין משימות ביורוקרטיות להצגה</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="tasks-table w-full">
            <thead>
              <tr>
                <th className="text-right">משימה</th>
                <th className="text-right">סטטוס</th>
                <th className="text-right">עדיפות</th>
                <th className="text-right">תאריך יעד</th>
                <th className="text-right">הערות</th>
                <th className="text-center">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <tr 
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className="cursor-pointer hover:bg-[#e6d3d9] transition"
                >
                  <td className="font-semibold text-[#96758d]">
                    <span className="text-2xl mr-2">{getOrganizationIcon(task.title)}</span>
                    {task.title}
                  </td>
                  <td>{getStatusBadge(task.status)}</td>
                  <td>
                    <span className={`px-2 py-1 rounded text-sm font-semibold ${
                      task.priority_score >= 4 ? 'bg-red-100 text-red-800' :
                      task.priority_score >= 3 ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {task.priority_score}
                    </span>
                  </td>
                  <td>
                    {task.deadline ? (
                      <span className="text-sm">{new Date(task.deadline).toLocaleDateString('he-IL')}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="text-sm text-gray-600 max-w-xs truncate">{task.next_action || '-'}</td>
                  <td className="text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleTaskClick(task)
                      }}
                      className="px-3 py-1 bg-[#75968c] text-white rounded-lg hover:bg-[#96758d] transition text-sm"
                    >
                      פתח
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
          onDelete={handleTaskDelete}
        />
      )}
    </div>
  )
}
