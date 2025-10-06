'use client'

import { useState, useEffect } from 'react'
import TaskModal from '../Dashboard/TaskModal'
import { Task } from '@/lib/supabase'

export default function ClientsPage() {
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
      
      // Filter only client-related tasks
      const clientTasks = (data.tasks || []).filter((task: Task) => 
        task.domain === 'Client' || task.id?.startsWith('client-')
      )
      
      setTasks(clientTasks)
    } catch (error) {
      console.error('Failed to load clients:', error)
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
      in_progress: { text: 'בעבודה', color: 'bg-blue-100 text-blue-800' },
      completed: { text: 'הושלם', color: 'bg-green-100 text-green-800' },
      blocked: { text: 'חסום', color: 'bg-red-100 text-red-800' },
    }
    const badge = badges[status] || badges.pending
    return <span className={`px-3 py-1 rounded-full text-sm font-semibold ${badge.color}`}>{badge.text}</span>
  }

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)
  const activeCount = tasks.filter(t => t.status === 'in_progress').length
  const completedCount = tasks.filter(t => t.status === 'completed').length

  if (loading) {
    return (
      <div className="page active">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>טוען לקוחות...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page active">
      <div className="page-header">
        <div>
          <h2>👥 ניהול לקוחות</h2>
          <p className="page-subtitle">מעקב אחר פרויקטים ותקשורת עם לקוחות</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg shadow-md border-l-4 border-purple-500">
          <p className="text-sm text-purple-600 font-semibold mb-1">סך הפרויקטים</p>
          <p className="text-3xl font-bold text-purple-800">{tasks.length}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg shadow-md border-l-4 border-blue-500">
          <p className="text-sm text-blue-600 font-semibold mb-1">בעבודה</p>
          <p className="text-3xl font-bold text-blue-800">{activeCount}</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg shadow-md border-l-4 border-green-500">
          <p className="text-sm text-green-600 font-semibold mb-1">הושלמו</p>
          <p className="text-3xl font-bold text-green-800">{completedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {[
          { value: 'all', label: 'הכל' },
          { value: 'pending', label: 'ממתין' },
          { value: 'in_progress', label: 'בעבודה' },
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

      {/* Clients Grid */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-500 text-lg">אין פרויקטי לקוחות להצגה</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => handleTaskClick(task)}
              className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition cursor-pointer border-t-4 border-[#96758d]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-[#96758d] mb-2">{task.title}</h3>
                  {getStatusBadge(task.status)}
                </div>
                <span className="text-3xl">👤</span>
              </div>

              {task.deadline && (
                <div className="mb-3 text-sm text-gray-600">
                  <span className="font-semibold">תאריך יעד:</span>{' '}
                  {new Date(task.deadline).toLocaleDateString('he-IL')}
                </div>
              )}

              {task.next_action && (
                <div className="mb-3 text-sm text-gray-700">
                  <span className="font-semibold">פעולה הבאה:</span>
                  <p className="mt-1">{task.next_action}</p>
                </div>
              )}

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <span className={`text-sm font-semibold ${
                  task.priority_score >= 4 ? 'text-red-600' :
                  task.priority_score >= 3 ? 'text-orange-600' :
                  'text-gray-600'
                }`}>
                  עדיפות: {task.priority_score}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTaskClick(task)
                  }}
                  className="px-3 py-1 bg-[#75968c] text-white rounded-lg hover:bg-[#96758d] transition text-sm"
                >
                  פתח
                </button>
              </div>
            </div>
          ))}
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
