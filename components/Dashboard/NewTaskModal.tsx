'use client'

import { useState } from 'react'
import { Task } from '@/lib/supabase'

interface NewTaskModalProps {
  onClose: () => void
  onSave: (taskData: Partial<Task>) => void
}

export default function NewTaskModal({ onClose, onSave }: NewTaskModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    domain: '',
    deadline: '',
    description: '',
    is_urgent: false
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const taskData: Partial<Task> = {
      title: formData.title,
      domain: formData.domain as any,
      deadline: formData.deadline,
      next_action: formData.description,
      is_urgent: formData.is_urgent,
      status: 'pending',
      priority_score: formData.is_urgent ? 80 : 50,
      progress: 0,
      sub_tasks: [],
      ai_recommendations: {},
      tags: [],
      task_chat_history: [],
      ai_reasoning: 'משימה חדשה שנוצרה ידנית',
      financial_impact: 0
    }

    onSave(taskData)
  }

  return (
    <>
      <div className="overlay" onClick={onClose}></div>
      <div className="modal" style={{ display: 'block' }}>
        <div className="modal-content">
          <div className="modal-header">
            <h3>➕ משימה חדשה</h3>
            <button type="button" className="modal-close" onClick={onClose}>
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label" htmlFor="task-title">
                  כותרת המשימה *
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="task-title"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="task-domain">
                  תחום *
                </label>
                <select
                  className="form-control"
                  id="task-domain"
                  required
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                >
                  <option value="">בחרי תחום</option>
                  <option value="Legal">משפטי</option>
                  <option value="Health">בריאות</option>
                  <option value="Debt">חובות</option>
                  <option value="Client">לקוחות</option>
                  <option value="Bureaucracy">בירוקרטיה</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="task-deadline">
                  תאריך יעד
                </label>
                <input
                  type="date"
                  className="form-control"
                  id="task-deadline"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="task-description">
                  תיאור / פעולה הבאה
                </label>
                <textarea
                  className="form-control"
                  id="task-description"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    id="task-urgent"
                    checked={formData.is_urgent}
                    onChange={(e) => setFormData({ ...formData, is_urgent: e.target.checked })}
                  />
                  <span className="checkmark"></span>
                  משימה דחופה
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn--secondary" onClick={onClose}>
                ביטול
              </button>
              <button type="submit" className="btn btn--primary">
                💾 שמור משימה
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
