'use client'

import { useState, useEffect } from 'react'
import TaskModal from '../Dashboard/TaskModal'
import { Task } from '@/lib/supabase'

interface Debt {
  id: string
  creditor: string
  amount: number
  currency: string
  status: string
  due_date?: string
  notes?: string
  task_id?: string
}

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    loadDebtsAndTasks()
  }, [])

  const loadDebtsAndTasks = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/tasks')
      const data = await response.json()
      
      // Filter only debt-related tasks
      const debtTasks = (data.tasks || []).filter((task: Task) => 
        task.domain === 'Debt' || task.id?.startsWith('debt-')
      )
      
      setTasks(debtTasks)
      
      // Create debts from tasks
      const debtsFromTasks = debtTasks.map((task: Task) => ({
        id: task.id,
        creditor: task.title.replace('חוב: ', ''),
        amount: task.financial_impact || 0,
        currency: '€',
        status: task.status,
        due_date: task.deadline,
        notes: task.next_action || '',
        task_id: task.id
      }))
      
      setDebts(debtsFromTasks)
    } catch (error) {
      console.error('Failed to load debts:', error)
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
      await loadDebtsAndTasks()
      setSelectedTask(null)
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  }

  const handleTaskDelete = async (taskId: string) => {
    if (!confirm('האם למחוק את החוב הזה?')) return
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
      await loadDebtsAndTasks()
      setSelectedTask(null)
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; color: string }> = {
      active: { text: 'פעיל', color: 'bg-red-100 text-red-800' },
      negotiating: { text: 'במשא ומתן', color: 'bg-yellow-100 text-yellow-800' },
      settled: { text: 'סולק', color: 'bg-green-100 text-green-800' },
      legal: { text: 'משפטי', color: 'bg-purple-100 text-purple-800' },
      pending: { text: 'ממתין', color: 'bg-gray-100 text-gray-800' },
      in_progress: { text: 'בטיפול', color: 'bg-blue-100 text-blue-800' },
    }
    const badge = badges[status] || badges.pending
    return <span className={`px-3 py-1 rounded-full text-sm font-semibold ${badge.color}`}>{badge.text}</span>
  }

  const filteredDebts = filter === 'all' ? debts : debts.filter(d => d.status === filter)
  const totalDebt = debts.reduce((sum, d) => sum + d.amount, 0)
  const activeDebts = debts.filter(d => d.status === 'active').length

  if (loading) {
    return (
      <div className="page active">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>טוען חובות...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page active">
      <div className="page-header">
        <div>
          <h2>💰 ניהול חובות</h2>
          <p className="page-subtitle">מעקב אחר כל החובות והתשלומים</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-lg shadow-md border-l-4 border-red-500">
          <p className="text-sm text-red-600 font-semibold mb-1">סך החוב</p>
          <p className="text-3xl font-bold text-red-800">{totalDebt.toLocaleString()}€</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
          <p className="text-sm text-yellow-600 font-semibold mb-1">חובות פעילים</p>
          <p className="text-3xl font-bold text-yellow-800">{activeDebts}</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg shadow-md border-l-4 border-green-500">
          <p className="text-sm text-green-600 font-semibold mb-1">חובות סולקו</p>
          <p className="text-3xl font-bold text-green-800">{debts.filter(d => d.status === 'settled').length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {[
          { value: 'all', label: 'הכל' },
          { value: 'active', label: 'פעילים' },
          { value: 'negotiating', label: 'במשא ומתן' },
          { value: 'settled', label: 'סולקו' }
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

      {/* Debts Table */}
      {filteredDebts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-500 text-lg">אין חובות להצגה</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="tasks-table w-full">
            <thead>
              <tr>
                <th className="text-right">נושה</th>
                <th className="text-right">סכום</th>
                <th className="text-right">סטטוס</th>
                <th className="text-right">תאריך יעד</th>
                <th className="text-right">הערות</th>
                <th className="text-center">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filteredDebts.map((debt) => (
                <tr 
                  key={debt.id}
                  onClick={() => {
                    const task = tasks.find(t => t.id === debt.task_id)
                    if (task) handleTaskClick(task)
                  }}
                  className="cursor-pointer hover:bg-[#e6d3d9] transition"
                >
                  <td className="font-semibold text-[#96758d]">{debt.creditor}</td>
                  <td className="font-bold text-lg">
                    <span className="text-red-600">{debt.amount.toLocaleString()}{debt.currency}</span>
                  </td>
                  <td>{getStatusBadge(debt.status)}</td>
                  <td>
                    {debt.due_date ? (
                      <span className="text-sm">{new Date(debt.due_date).toLocaleDateString('he-IL')}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="text-sm text-gray-600 max-w-xs truncate">{debt.notes || '-'}</td>
                  <td className="text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const task = tasks.find(t => t.id === debt.task_id)
                        if (task) handleTaskClick(task)
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
