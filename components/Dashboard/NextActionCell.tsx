'use client';

import { useState, useEffect } from 'react';

interface NextActionCellProps {
  taskId: string;
  taskTitle: string;
  taskDomain: string;
  currentNextAction?: string;
  onUpdate?: (taskId: string, nextAction: string) => void;
  // מידע נוסף מהמשימה
  deadline?: string;
  priorityScore?: number;
  progress?: number;
  isUrgent?: boolean;
  financialImpact?: number;
  // מידע מטבלאות הקשורות (חובות/בירוקרטיה/לקוחות)
  additionalContext?: {
    amount?: number;
    currency?: string;
    status?: string;
    paymentStatus?: string;
    company?: string;
    agency?: string;
    caseNumber?: string;
  };
}

export default function NextActionCell({ 
  taskId, 
  taskTitle, 
  taskDomain,
  currentNextAction,
  onUpdate,
  deadline,
  priorityScore,
  progress,
  isUrgent,
  financialImpact,
  additionalContext
}: NextActionCellProps) {
  const [nextAction, setNextAction] = useState(currentNextAction || '');
  const [loading, setLoading] = useState(!currentNextAction);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!currentNextAction) {
      generateNextAction();
    }
  }, [taskId]);

  const generateNextAction = async () => {
    try {
      setLoading(true);
      setError(false);

      const response = await fetch('/api/ai-agent/next-action-for-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          taskTitle,
          taskDomain,
          deadline,
          priorityScore,
          progress,
          isUrgent,
          financialImpact,
          additionalContext
        })
      });

      if (!response.ok) throw new Error('Failed to generate');

      const data = await response.json();
      const generatedAction = data.nextAction;
      
      setNextAction(generatedAction);

      // עדכון אוטומטי בדאטהבייס
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          next_action: generatedAction
        })
      });

      if (onUpdate) {
        onUpdate(taskId, generatedAction);
      }
    } catch (err) {
      console.error('Error generating next action:', err);
      setError(true);
      setNextAction('שגיאה - לחץ לנסות שוב');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="next-action-loading">
        <span className="mini-spinner"></span>
        <span>הסוכן חושב...</span>
        <style jsx>{`
          .next-action-loading {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--michal-text-muted);
            font-size: 0.85rem;
          }
          .mini-spinner {
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid #f0f0f0;
            border-top-color: var(--michal-primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="next-action-error"
        onClick={generateNextAction}
        title="לחץ לנסות שוב"
      >
        ❌ {nextAction}
        <style jsx>{`
          .next-action-error {
            color: #dc2626;
            cursor: pointer;
            font-size: 0.85rem;
          }
          .next-action-error:hover {
            text-decoration: underline;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="next-action-text">
      {nextAction || 'ממתין להגדרה...'}
      <style jsx>{`
        .next-action-text {
          max-width: 300px;
          font-size: 0.9rem;
          line-height: 1.5;
          color: var(--michal-text-primary);
          font-weight: 500;
          white-space: normal;
          word-wrap: break-word;
        }
      `}</style>
    </div>
  );
}
