'use client';

import { useEffect, useState } from 'react';

interface NextActionRecommendation {
  taskId: string;
  taskTitle: string;
  recommendation: string;
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
  reasoning: string;
  suggestedDeadline?: string;
  shouldCheckStatus: boolean;
}

export default function NextActionWidget({ onTaskClick }: { onTaskClick: (taskId: string) => void }) {
  const [recommendation, setRecommendation] = useState<NextActionRecommendation | null>(null);
  const [overdueCount, setOverdueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNextAction = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/ai-agent/next-action');
      if (!response.ok) {
        throw new Error('Failed to load next action');
      }
      const data = await response.json();
      setRecommendation(data.recommendation);
      setOverdueCount(data.overdueCount || 0);
    } catch (err) {
      console.error('Error loading next action:', err);
      setError('לא הצלחתי לטעון את ההמלצה הבאה');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNextAction();
    // Refresh every 5 minutes
    const interval = setInterval(loadNextAction, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getUrgencyStyles = (level: string) => {
    switch (level) {
      case 'critical':
        return {
          bg: 'bg-red-50',
          border: 'border-red-500',
          text: 'text-red-800',
          icon: '🚨',
          label: 'דחוף ביותר!'
        };
      case 'high':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-500',
          text: 'text-orange-800',
          icon: '⚠️',
          label: 'דחוף'
        };
      case 'medium':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-500',
          text: 'text-yellow-800',
          icon: '📌',
          label: 'חשוב'
        };
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-500',
          text: 'text-blue-800',
          icon: '💡',
          label: 'מומלץ'
        };
    }
  };

  if (loading) {
    return (
      <div className="next-action-widget loading">
        <div className="widget-header">
          <h3>🤖 מה המשימה הבאה?</h3>
        </div>
        <div className="widget-body">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>הבינה המלאכותית חושבת...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !recommendation) {
    return (
      <div className="next-action-widget error">
        <div className="widget-header">
          <h3>🤖 מה המשימה הבאה?</h3>
        </div>
        <div className="widget-body">
          <p className="error-message">{error || 'אין המלצות זמינות כרגע'}</p>
          <button className="btn btn--primary" onClick={loadNextAction}>
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  const urgencyStyle = getUrgencyStyles(recommendation.urgencyLevel);

  return (
    <div className={`next-action-widget ${urgencyStyle.bg}`} style={{ borderRight: `4px solid var(--${urgencyStyle.border.split('-')[1]}-500)` }}>
      <div className="widget-header">
        <div className="header-content">
          <h3>🤖 מה המשימה הבאה?</h3>
          {overdueCount > 0 && (
            <span className="overdue-badge">
              ⏰ {overdueCount} משימות עברו deadline
            </span>
          )}
        </div>
        <button 
          className="refresh-btn" 
          onClick={loadNextAction}
          title="רענן המלצה"
        >
          🔄
        </button>
      </div>

      <div className="widget-body">
        <div className="urgency-header">
          <span className="urgency-icon">{urgencyStyle.icon}</span>
          <span className={`urgency-label ${urgencyStyle.text}`}>
            {urgencyStyle.label}
          </span>
        </div>

        <h4 className="task-title">{recommendation.taskTitle}</h4>

        <div className="recommendation-box">
          <p className="recommendation-text">
            {recommendation.recommendation}
          </p>
        </div>

        {recommendation.reasoning && (
          <details className="reasoning-details">
            <summary>למה זו המשימה הבאה? 🤔</summary>
            <p className="reasoning-text">{recommendation.reasoning}</p>
          </details>
        )}

        {recommendation.suggestedDeadline && (
          <div className="deadline-suggestion">
            <span className="deadline-icon">📅</span>
            <span>מומלץ לסיים עד: {new Date(recommendation.suggestedDeadline).toLocaleDateString('he-IL')}</span>
          </div>
        )}

        {recommendation.shouldCheckStatus && (
          <div className="status-check-alert">
            <span>⚠️</span>
            <span>משימה זו עברה deadline - כדאי לבדוק סטטוס</span>
          </div>
        )}

        <div className="action-buttons">
          <button 
            className="btn btn--primary btn--large"
            onClick={() => onTaskClick(recommendation.taskId)}
          >
            ✅ בצע משימה זו
          </button>
          <button 
            className="btn btn--secondary"
            onClick={loadNextAction}
          >
            🔄 הצג משימה אחרת
          </button>
        </div>
      </div>

      <style jsx>{`
        .next-action-widget {
          background: white;
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
          transition: all 0.3s ease;
        }

        .next-action-widget:hover {
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
          transform: translateY(-2px);
        }

        .next-action-widget.loading,
        .next-action-widget.error {
          background: white;
          border-right: 4px solid var(--michal-primary);
        }

        .widget-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid #f0f0f0;
        }

        .header-content {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .widget-header h3 {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--michal-text-primary);
          margin: 0;
        }

        .overdue-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: #fee;
          color: #c00;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .refresh-btn {
          background: transparent;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .refresh-btn:hover {
          background: #f0f0f0;
          transform: rotate(180deg);
        }

        .widget-body {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .loading-spinner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 3rem 0;
        }

        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid #f0f0f0;
          border-top-color: var(--michal-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .loading-spinner p {
          color: var(--michal-text-muted);
          font-size: 1rem;
        }

        .error-message {
          color: #c00;
          text-align: center;
          padding: 2rem 0;
          font-size: 1rem;
        }

        .urgency-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .urgency-icon {
          font-size: 2rem;
        }

        .urgency-label {
          font-size: 1.1rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .task-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--michal-text-primary);
          margin: 0.5rem 0;
        }

        .recommendation-box {
          background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
          border-right: 3px solid var(--michal-primary);
          padding: 1.5rem;
          border-radius: 12px;
          margin: 1rem 0;
        }

        .recommendation-text {
          font-size: 1.15rem;
          line-height: 1.8;
          color: var(--michal-text-primary);
          margin: 0;
          font-weight: 500;
        }

        .reasoning-details {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 8px;
          cursor: pointer;
        }

        .reasoning-details summary {
          font-weight: 600;
          color: var(--michal-primary);
          list-style: none;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .reasoning-details summary::-webkit-details-marker {
          display: none;
        }

        .reasoning-details[open] summary {
          margin-bottom: 0.75rem;
        }

        .reasoning-text {
          color: var(--michal-text-secondary);
          line-height: 1.6;
          margin: 0;
          font-size: 0.95rem;
        }

        .deadline-suggestion {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #fff9e6;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          border-right: 3px solid #ffc107;
          font-size: 0.95rem;
          color: #856404;
          font-weight: 500;
        }

        .deadline-icon {
          font-size: 1.25rem;
        }

        .status-check-alert {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #fee;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          border-right: 3px solid #dc3545;
          font-size: 0.95rem;
          color: #721c24;
          font-weight: 500;
        }

        .action-buttons {
          display: flex;
          gap: 1rem;
          margin-top: 1.5rem;
        }

        .btn--large {
          flex: 1;
          padding: 1rem 2rem;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .btn--secondary {
          background: transparent;
          border: 2px solid var(--michal-primary);
          color: var(--michal-primary);
        }

        .btn--secondary:hover {
          background: var(--michal-hover);
        }

        @media (max-width: 768px) {
          .next-action-widget {
            padding: 1.5rem;
          }

          .action-buttons {
            flex-direction: column;
          }

          .widget-header h3 {
            font-size: 1.25rem;
          }

          .recommendation-text {
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
