'use client';

import { useState } from 'react';

interface EmailInsight {
  id: string;
  subject: string;
  from: string;
  relevance: 'high' | 'medium' | 'low';
  related_to: string[] | { type?: string; id?: string; name?: string };
  action_items: string[];
  suggested_next_action?: string;
  suggested_task?: any;
  extracted_data?: {
    amount?: number;
    currency?: string;
    deadline?: string;
    is_final_demand?: boolean;
    payment_reference?: string;
    status_update?: string;
  };
}

interface DocumentInsight {
  id: string;
  file_name: string;
  relevance: 'high' | 'medium' | 'low';
  summary: string;
  action_items: string[];
  suggested_tasks: string[];
}

interface SyncUpdate {
  id: string;
  type: 'email' | 'document';
  source: 'gmail' | 'drive';
  title: string;
  summary: string;
  suggestedAction: string;
  relatedTask?: string;
  data: EmailInsight | DocumentInsight;
}

export default function SyncManager({ onClose }: { onClose: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [updates, setUpdates] = useState<SyncUpdate[]>([]);
  const [selectedUpdates, setSelectedUpdates] = useState<Set<string>>(new Set());
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');
  const [includeRead, setIncludeRead] = useState(false);

  const startSync = async () => {
    try {
      setSyncing(true);
      setUpdates([]);
      setSelectedUpdates(new Set());

      // בדיקה אם Gmail מחובר
      const accountsResponse = await fetch('/api/gmail/accounts');
      const accountsData = await accountsResponse.json();
      
      if (!accountsData.accounts || accountsData.accounts.length === 0) {
        alert('❌ אין חשבון Gmail מחובר!\n\n📧 לחצי על הכפתור "Gmail" בראש הדף כדי להתחבר.\nאחרי ההתחברות, תוכלי להריץ סנכרון ולקבל עדכונים אוטומטיים.');
        setSyncing(false);
        return;
      }

      // סנכרון Gmail עם טווח זמן ואפשרות מיילים שנקראו
      const gmailResponse = await fetch('/api/gmail/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          timeRange, 
          includeRead,
          showLastEmailPerCompany: true // תמיד להראות מייל אחרון מכל חברה
        })
      });

      if (gmailResponse.ok) {
        const gmailData = await gmailResponse.json();
        
        // גרסה חדשה - מבנה updates מהסורק החכם
        if (gmailData.updates && gmailData.updates.length > 0) {
          const smartUpdates = gmailData.updates.map((update: any) => ({
            id: `update-${Date.now()}-${Math.random()}`,
            type: update.type, // 'new' | 'update' | 'status_change'
            source: 'gmail' as const,
            title: update.email_subject,
            summary: update.summary,
            suggestedAction: update.action,
            relatedTask: update.entity_id,
            entityType: update.entity_type,
            entityName: update.entity_name,
            changes: update.changes,
            priority: update.priority,
            emailFrom: update.email_from,
            extractedData: update.extracted_data,
            data: update
          }));
          
          setUpdates(smartUpdates);
          
          // בחר הכל אוטומטית
          setSelectedUpdates(new Set(smartUpdates.map((u: any) => u.id)));
        } else if (!gmailData.updates || gmailData.updates.length === 0) {
          alert(`ℹ️ לא נמצאו עדכונים חדשים\n\nהסוכן סרק ${gmailData.totalEmails || 0} מיילים ולא מצא שום דבר שדורש תשומת לב.`);
          setSyncing(false);
          return;
        }
      } else {
        const errorData = await gmailResponse.json();
        alert(`❌ שגיאה בסריקת Gmail:\n${errorData.error || 'שגיאה לא ידועה'}`);
      }

      // סנכרון Drive (אם מחובר)
      // TODO: להוסיף כשיהיה endpoint לסריקה כללית של Drive

    } catch (error) {
      console.error('Sync error:', error);
      alert('❌ שגיאה בסנכרון\n\nוודאי שהשרת רץ ושחשבון Gmail מחובר.');
    } finally {
      setSyncing(false);
    }
  };

  const toggleUpdate = (id: string) => {
    const newSelected = new Set(selectedUpdates);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedUpdates(newSelected);
  };

  const selectAll = () => {
    if (selectedUpdates.size === updates.length) {
      setSelectedUpdates(new Set());
    } else {
      setSelectedUpdates(new Set(updates.map(u => u.id)));
    }
  };

  const applySelected = async () => {
    const selectedData = updates.filter(u => selectedUpdates.has(u.id));
    
    try {
      // הכנת מערך עדכונים לשליחה ל-API
      const emailUpdates = selectedData
        .filter(u => u.type === 'email' && u.relatedTask)
        .map(u => {
          const emailData = u.data as EmailInsight;
          return {
            taskId: u.relatedTask,
            extractedData: (emailData as any).extracted_data || {},
            suggested_next_action: u.suggestedAction
          };
        });

      // שליחת כל העדכונים ב-batch אחד
      if (emailUpdates.length > 0) {
        const response = await fetch('/api/tasks/apply-email-updates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: emailUpdates })
        });

        if (!response.ok) {
          throw new Error('Failed to apply updates');
        }

        const result = await response.json();
        console.log('✅ Updates applied:', result);
      }

      // יצירת משימות חדשות אם צריך
      const newTasks = selectedData.filter(u => !u.relatedTask && u.type === 'email');
      for (const update of newTasks) {
        const emailData = update.data as EmailInsight;
        if (emailData.suggested_task) {
          await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...emailData.suggested_task,
              domain: !Array.isArray(emailData.related_to) && emailData.related_to?.type === 'debt' ? 'Debt' : 
                      !Array.isArray(emailData.related_to) && emailData.related_to?.type === 'bureaucracy' ? 'Bureaucracy' :
                      !Array.isArray(emailData.related_to) && emailData.related_to?.type === 'client' ? 'Client' : 'Health'
            })
          });
        }
      }

      alert(`✅ עודכנו ${emailUpdates.length} משימות קיימות\n✨ נוצרו ${newTasks.length} משימות חדשות`);
      onClose();
      window.location.reload(); // רענון הדף
    } catch (error) {
      console.error('Apply error:', error);
      alert('❌ שגיאה בעדכון המשימות');
    }
  };

  const getRelevanceBadge = (relevance: string) => {
    const styles = {
      high: { bg: '#d4edda', color: '#155724', text: 'רלוונטי מאוד' },
      medium: { bg: '#fff3cd', color: '#856404', text: 'רלוונטי' },
      low: { bg: '#f8d7da', color: '#721c24', text: 'פחות רלוונטי' }
    };
    const style = styles[relevance as keyof typeof styles] || styles.low;
    return (
      <span style={{
        background: style.bg,
        color: style.color,
        padding: '0.25rem 0.5rem',
        borderRadius: '4px',
        fontSize: '0.85rem',
        fontWeight: 600
      }}>
        {style.text}
      </span>
    );
  };

  return (
    <div className="sync-manager-overlay">
      <div className="sync-manager-modal">
        <div className="sync-manager-header">
          <h2>🔄 סנכרון Gmail ו-Drive</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="sync-manager-body">
          {!syncing && updates.length === 0 && (
            <div className="sync-initial">
              <p className="sync-description">
                לחצי על "התחל סנכרון" כדי לסרוק מיילים חדשים ומסמכים ב-Drive.
                <br />
                הסוכן יציג לך עדכונים מומלצים ואת תאשרי מה להוסיף.
              </p>

              <div className="sync-options">
                <div className="option-group">
                  <label>📅 טווח זמן לסריקה:</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input 
                        type="radio" 
                        value="day" 
                        checked={timeRange === 'day'}
                        onChange={(e) => setTimeRange(e.target.value as any)}
                      />
                      <span>יום אחרון</span>
                    </label>
                    <label className="radio-option">
                      <input 
                        type="radio" 
                        value="week" 
                        checked={timeRange === 'week'}
                        onChange={(e) => setTimeRange(e.target.value as any)}
                      />
                      <span>שבוע אחרון</span>
                    </label>
                    <label className="radio-option">
                      <input 
                        type="radio" 
                        value="month" 
                        checked={timeRange === 'month'}
                        onChange={(e) => setTimeRange(e.target.value as any)}
                      />
                      <span>חודש אחרון</span>
                    </label>
                  </div>
                </div>

                <div className="option-group">
                  <label className="checkbox-option">
                    <input 
                      type="checkbox" 
                      checked={includeRead}
                      onChange={(e) => setIncludeRead(e.target.checked)}
                    />
                    <span>📖 כלול גם מיילים שנקראו (לא רק חדשים)</span>
                  </label>
                </div>
              </div>

              <button 
                className="btn btn--primary btn--large"
                onClick={startSync}
              >
                🚀 התחל סנכרון
              </button>
            </div>
          )}

          {syncing && (
            <div className="sync-loading">
              <div className="spinner-large"></div>
              <p>סורק מיילים ומסמכים...</p>
              <small>זה עשוי לקחת כמה שניות</small>
            </div>
          )}

          {!syncing && updates.length > 0 && (
            <>
              <div className="sync-controls">
                <div className="sync-summary">
                  נמצאו <strong>{updates.length}</strong> עדכונים אפשריים
                  {selectedUpdates.size > 0 && ` | נבחרו ${selectedUpdates.size}`}
                </div>
                <div className="sync-actions">
                  <button 
                    className="btn btn--small btn--secondary"
                    onClick={selectAll}
                  >
                    {selectedUpdates.size === updates.length ? '☐ בטל הכל' : '☑ בחר הכל'}
                  </button>
                  <button 
                    className="btn btn--small btn--primary"
                    onClick={applySelected}
                    disabled={selectedUpdates.size === 0}
                  >
                    ✅ אשר {selectedUpdates.size > 0 && `(${selectedUpdates.size})`}
                  </button>
                </div>
              </div>

              <div className="sync-updates-list">
                {updates.map((update: any) => {
                  const isNew = update.type === 'new';
                  const isUpdate = update.type === 'update';
                  const isStatusChange = update.type === 'status_change';
                  const priority = update.priority || 'medium';
                  
                  return (
                    <div 
                      key={update.id} 
                      className={`sync-update-card ${selectedUpdates.has(update.id) ? 'selected' : ''} priority-${priority}`}
                      onClick={() => toggleUpdate(update.id)}
                    >
                      <div className="update-checkbox">
                        <input 
                          type="checkbox" 
                          checked={selectedUpdates.has(update.id)}
                          onChange={() => toggleUpdate(update.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>

                      <div className="update-content">
                        {/* סוג עדכון */}
                        <div className="update-header">
                          <div className="update-badges">
                            <span className={`badge badge-${update.type}`}>
                              {isNew && '✨ חדש'}
                              {isUpdate && '🔄 עדכון'}
                              {isStatusChange && '⚡ שינוי סטטוס'}
                            </span>
                            <span className={`badge badge-${update.entityType}`}>
                              {update.entityType === 'debt' && '� חוב'}
                              {update.entityType === 'task' && '� משימה'}
                              {update.entityType === 'bureaucracy' && '📄 ביורוקרטיה'}
                              {update.entityType === 'client' && '👤 לקוח'}
                            </span>
                            {priority === 'high' && <span className="badge badge-urgent">⚠️ דחוף</span>}
                          </div>
                        </div>

                        {/* שם הישות */}
                        <h4 className="update-entity-name">
                          {update.entityName}
                          {update.relatedTask && <span className="entity-id">#{update.relatedTask.slice(0, 8)}</span>}
                        </h4>

                        {/* מקור */}
                        <div className="update-source-info">
                          📧 מאת: <strong>{update.emailFrom}</strong>
                          <br />
                          נושא: {update.title}
                        </div>

                        {/* סיכום */}
                        <p className="update-summary">{update.summary}</p>

                        {/* שינויים מפורטים */}
                        {update.changes && Object.keys(update.changes).length > 0 && (
                          <div className="update-changes">
                            <strong>📊 שינויים:</strong>
                            <ul>
                              {update.changes.amount && (
                                <li>סכום: <span className="old-value">{update.changes.amount.from}€</span> → <span className="new-value">{update.changes.amount.to}€</span></li>
                              )}
                              {update.changes.deadline && (
                                <li>דדליין: <span className="old-value">{update.changes.deadline.from}</span> → <span className="new-value">{update.changes.deadline.to}</span></li>
                              )}
                              {update.changes.status && (
                                <li>סטטוס: <span className="old-value">{update.changes.status.from}</span> → <span className="new-value">{update.changes.status.to}</span></li>
                              )}
                              {update.changes.reason && (
                                <li className="change-reason">💡 {update.changes.reason}</li>
                              )}
                            </ul>
                          </div>
                        )}

                        {/* נתונים שחולצו */}
                        {update.extractedData && (
                          <div className="extracted-data">
                            {update.extractedData.amount && <span className="data-pill">💵 {update.extractedData.amount}{update.extractedData.currency || '€'}</span>}
                            {update.extractedData.deadline && <span className="data-pill">📅 {new Date(update.extractedData.deadline).toLocaleDateString('he-IL')}</span>}
                            {update.extractedData.case_number && <span className="data-pill">📋 תיק: {update.extractedData.case_number}</span>}
                            {update.extractedData.payment_reference && <span className="data-pill">🔢 אסמכתא: {update.extractedData.payment_reference}</span>}
                          </div>
                        )}

                        {/* פעולה מוצעת */}
                        <div className="update-action">
                          <strong>🎯 מה לעשות:</strong>
                          <p>{update.suggestedAction}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {!syncing && updates.length === 0 && (
            <div className="sync-empty">
              <p>🎉 אין עדכונים חדשים כרגע</p>
              <button 
                className="btn btn--secondary"
                onClick={startSync}
              >
                🔄 סרוק שוב
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .sync-manager-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .sync-manager-modal {
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          max-width: 900px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        }

        .sync-manager-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 2rem;
          border-bottom: 2px solid #f0f0f0;
        }

        .sync-manager-header h2 {
          margin: 0;
          font-size: 1.5rem;
          color: var(--michal-text-primary);
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 8px;
          transition: background 0.2s;
        }

        .close-btn:hover {
          background: #f0f0f0;
        }

        .sync-manager-body {
          padding: 2rem;
          overflow-y: auto;
          flex: 1;
        }

        .sync-initial, .sync-empty {
          text-align: center;
          padding: 3rem 2rem;
        }

        .sync-description {
          margin-bottom: 2rem;
          line-height: 1.8;
          color: var(--michal-text-secondary);
          font-size: 1rem;
        }

        .sync-options {
          background: #f8f9fa;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          padding: 1.5rem;
          margin: 2rem 0;
          text-align: right;
        }

        .option-group {
          margin-bottom: 1.5rem;
        }

        .option-group:last-child {
          margin-bottom: 0;
        }

        .option-group > label {
          display: block;
          font-weight: 600;
          margin-bottom: 0.75rem;
          color: var(--michal-text-primary);
        }

        .radio-group {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .radio-option {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .radio-option:hover {
          border-color: var(--michal-primary);
        }

        .radio-option input[type="radio"] {
          cursor: pointer;
        }

        .radio-option input[type="radio"]:checked + span {
          font-weight: 600;
          color: var(--michal-primary);
        }

        .checkbox-option {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          justify-content: center;
        }

        .checkbox-option:hover {
          border-color: var(--michal-primary);
        }

        .checkbox-option input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .checkbox-option span {
          font-size: 0.95rem;
        }

        .sync-loading {
          text-align: center;
          padding: 4rem 2rem;
        }

        .spinner-large {
          width: 60px;
          height: 60px;
          border: 6px solid #f0f0f0;
          border-top-color: var(--michal-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1.5rem;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .sync-loading p {
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .sync-loading small {
          color: var(--michal-text-muted);
        }

        .sync-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
          margin-bottom: 1.5rem;
        }

        .sync-summary {
          font-size: 1rem;
          color: var(--michal-text-primary);
        }

        .sync-actions {
          display: flex;
          gap: 0.5rem;
        }

        .sync-updates-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .sync-update-card {
          display: flex;
          gap: 1rem;
          padding: 1.5rem;
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .sync-update-card:hover {
          border-color: var(--michal-primary);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .sync-update-card.selected {
          border-color: var(--michal-primary);
          background: #f8f6f7;
        }

        .update-checkbox {
          display: flex;
          align-items: flex-start;
          padding-top: 0.25rem;
        }

        .update-checkbox input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
        }

        .update-content {
          flex: 1;
        }

        .update-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .update-source {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--michal-primary);
        }

        .update-title {
          margin: 0 0 0.5rem 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--michal-text-primary);
        }

        .update-summary {
          margin: 0 0 1rem 0;
          color: var(--michal-text-secondary);
          font-size: 0.95rem;
          line-height: 1.6;
        }

        /* New badges */
        .update-badges {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 0.75rem;
        }

        .badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .badge-new {
          background: #d4edda;
          color: #155724;
        }

        .badge-update {
          background: #fff3cd;
          color: #856404;
        }

        .badge-status_change {
          background: #d1ecf1;
          color: #0c5460;
        }

        .badge-debt {
          background: #f8d7da;
          color: #721c24;
        }

        .badge-task {
          background: #cce5ff;
          color: #004085;
        }

        .badge-bureaucracy {
          background: #e2e3e5;
          color: #383d41;
        }

        .badge-client {
          background: #d4edda;
          color: #155724;
        }

        .badge-urgent {
          background: #ff6b6b;
          color: white;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .priority-high {
          border-left: 4px solid #ff6b6b;
        }

        .priority-medium {
          border-left: 4px solid #ffa500;
        }

        .priority-low {
          border-left: 4px solid #90ee90;
        }

        .update-entity-name {
          margin: 0 0 0.75rem 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--michal-text-primary);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .entity-id {
          font-size: 0.75rem;
          font-weight: 400;
          color: var(--michal-text-muted);
          font-family: 'Courier New', monospace;
        }

        .update-source-info {
          background: #f8f9fa;
          padding: 0.75rem;
          border-radius: 6px;
          font-size: 0.85rem;
          color: var(--michal-text-secondary);
          margin-bottom: 1rem;
        }

        .update-changes {
          background: #fff9e6;
          border-left: 3px solid #ffd700;
          padding: 1rem;
          margin: 1rem 0;
          border-radius: 4px;
        }

        .update-changes strong {
          display: block;
          margin-bottom: 0.5rem;
          color: var(--michal-text-primary);
        }

        .update-changes ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .update-changes li {
          padding: 0.25rem 0;
          font-size: 0.9rem;
        }

        .old-value {
          text-decoration: line-through;
          color: #999;
          font-weight: 500;
        }

        .new-value {
          color: #155724;
          font-weight: 700;
        }

        .change-reason {
          font-style: italic;
          color: var(--michal-text-muted);
          margin-top: 0.5rem;
        }

        .extracted-data {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin: 1rem 0;
        }

        .data-pill {
          display: inline-block;
          background: #e7f3ff;
          color: #0056b3;
          padding: 0.35rem 0.75rem;
          border-radius: 16px;
          font-size: 0.85rem;
          font-weight: 600;
          line-height: 1.6;
        }

        .update-action {
          background: #fff9e6;
          padding: 1rem;
          border-radius: 8px;
          border-right: 3px solid #ffc107;
          margin-bottom: 0.75rem;
        }

        .update-action strong {
          display: block;
          margin-bottom: 0.5rem;
          color: #856404;
        }

        .update-action p {
          margin: 0;
          color: var(--michal-text-primary);
          font-weight: 500;
        }

        .update-related {
          font-size: 0.85rem;
          color: var(--michal-text-muted);
        }

        .update-related code {
          background: #f0f0f0;
          padding: 0.125rem 0.5rem;
          border-radius: 4px;
          font-family: monospace;
        }

        .btn--large {
          padding: 1rem 2rem;
          font-size: 1.1rem;
        }

        @media (max-width: 768px) {
          .sync-manager-modal {
            max-width: 100%;
            max-height: 100vh;
            border-radius: 0;
          }

          .sync-controls {
            flex-direction: column;
            align-items: stretch;
            gap: 1rem;
          }

          .sync-actions {
            width: 100%;
            justify-content: stretch;
          }

          .sync-actions button {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}
