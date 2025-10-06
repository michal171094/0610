'use client'

import { Task } from '@/lib/supabase'
import NextActionCell from './NextActionCell'

interface TaskTableProps {
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onTaskDelete: (taskId: string) => void
}

export default function TaskTable({ tasks, onTaskClick, onTaskDelete }: TaskTableProps) {
  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('he-IL')
  }

  const getPriorityClass = (score: number) => {
    if (score >= 80) return 'priority-high'
    if (score >= 50) return 'priority-medium'
    return 'priority-low'
  }

  const getPriorityText = (score: number) => {
    if (score >= 80) return 'גבוהה'
    if (score >= 50) return 'בינונית'
    return 'נמוכה'
  }

  const getDomainText = (domain: string) => {
    const domainMap: Record<string, string> = {
      'Legal': 'משפטי',
      'Health': 'בריאות',
      'Debt': 'חובות',
      'Client': 'לקוחות',
      'Bureaucracy': 'בירוקרטיה'
    }
    return domainMap[domain] || domain
  }

  const getDomainClass = (domain: string) => {
    const domainMap: Record<string, string> = {
      'Legal': 'domain-legal',
      'Health': 'domain-health',
      'Debt': 'domain-debt',
      'Client': 'domain-client',
      'Bureaucracy': 'domain-bureaucracy'
    }
    return domainMap[domain] || 'domain-bureaucracy'
  }

  return (
    <div className="dashboard-table-container">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>משימה</th>
            <th>תאריך יעד</th>
            <th>תחום</th>
            <th>עדיפות</th>
            <th>התקדמות</th>
            <th>פעולה הבאה</th>
            <th>עדכון</th>
            <th>מחק</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                אין משימות עדיין. לחצי על "➕ משימה חדשה" כדי להתחיל!
              </td>
            </tr>
          ) : (
            tasks.map((task) => (
              <tr key={task.id} className={task.is_urgent ? 'task-urgent' : ''}>
                <td>
                  <div className="task-title-cell">
                    <strong>{task.title}</strong>
                    {task.is_urgent && <span className="urgent-badge">🔴 דחוף</span>}
                  </div>
                </td>
                <td>{formatDate(task.deadline)}</td>
                <td>
                  <span className={`domain-badge ${getDomainClass(task.domain)}`}>
                    {getDomainText(task.domain)}
                  </span>
                </td>
                <td>
                  <span className={`priority-badge ${getPriorityClass(task.priority_score)}`}>
                    {getPriorityText(task.priority_score)} ({task.priority_score})
                  </span>
                </td>
                <td>
                  <div className="progress-container">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${task.progress}%` }}
                      ></div>
                    </div>
                    <span className="progress-text">{task.progress}%</span>
                  </div>
                </td>
                <td>
                  <NextActionCell
                    taskId={task.id}
                    taskTitle={task.title}
                    taskDomain={task.domain}
                    currentNextAction={task.next_action}
                    deadline={task.deadline}
                    priorityScore={task.priority_score}
                    progress={task.progress}
                    isUrgent={task.is_urgent}
                    financialImpact={task.financial_impact}
                    additionalContext={task.additionalContext}
                  />
                </td>
                <td>
                  <button 
                    className="btn btn--small btn--action"
                    onClick={() => onTaskClick(task)}
                  >
                    👁️ פרטים
                  </button>
                </td>
                <td>
                  <button 
                    className="btn btn--small btn--danger"
                    onClick={(e) => {
                      e.stopPropagation()
                      onTaskDelete(task.id)
                    }}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
