'use client';

import { useState, useEffect } from 'react';

interface DocumentInsight {
  id: string;
  file_id: string;
  file_name: string;
  relevance: 'high' | 'medium' | 'low';
  category: string;
  summary: string;
  action_items: string[];
  entities: any;
}

interface TaskDocumentsProps {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  domain: string;
}

export default function TaskDocuments({ 
  taskId, 
  taskTitle, 
  taskDescription, 
  domain 
}: TaskDocumentsProps) {
  const [documents, setDocuments] = useState<DocumentInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [searchTriggered, setSearchTriggered] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, [taskId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        taskId,
        taskTitle,
        taskDescription: taskDescription || '',
        domain
      });

      const response = await fetch(`/api/drive/documents?${params}`);
      const data = await response.json();
      
      setDocuments(data.documents || []);
      setSearchTriggered(data.fromCache || data.documents.length > 0);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerSearch = async () => {
    setSearchTriggered(true);
    await loadDocuments();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('taskId', taskId);
      formData.append('fileName', file.name);

      const response = await fetch('/api/drive/documents', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        alert('✅ ' + result.message);
        await loadDocuments(); // רענון רשימת המסמכים
        setShowUpload(false);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('❌ שגיאה בהעלאת הקובץ');
    } finally {
      setUploading(false);
    }
  };

  const getRelevanceBadge = (relevance: string) => {
    const styles = {
      high: { bg: '#d4edda', color: '#155724', icon: '⭐⭐⭐' },
      medium: { bg: '#fff3cd', color: '#856404', icon: '⭐⭐' },
      low: { bg: '#f8d7da', color: '#721c24', icon: '⭐' }
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
        {style.icon} {relevance}
      </span>
    );
  };

  return (
    <div className="task-documents">
      <div className="documents-header">
        <h4>📁 מסמכים קשורים</h4>
        <div className="documents-actions">
          {!searchTriggered && (
            <button 
              className="btn btn--small btn--secondary"
              onClick={triggerSearch}
              disabled={loading}
            >
              🔍 חפש מסמכים ב-Drive
            </button>
          )}
          <button 
            className="btn btn--small btn--primary"
            onClick={() => setShowUpload(!showUpload)}
          >
            📤 העלה מסמך סרוק
          </button>
        </div>
      </div>

      {showUpload && (
        <div className="upload-section">
          <p className="upload-hint">
            📸 העלה מסמך סרוק (תמונה או PDF). המערכת תבצע OCR ותנתח אוטומטית.
          </p>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileUpload}
            disabled={uploading}
            className="file-input"
          />
          {uploading && <p className="uploading-message">מעלה ומנתח מסמך...</p>}
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>מחפש מסמכים רלוונטיים...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="empty-state">
          <p>💡 לא נמצאו מסמכים קשורים למשימה זו</p>
          <small>לחצי על "חפש מסמכים" או העלי מסמך סרוק</small>
        </div>
      ) : (
        <div className="documents-list">
          {documents.map((doc) => (
            <div key={doc.id} className="document-card">
              <div className="document-header">
                <div className="document-info">
                  <h5 className="document-name">📄 {doc.file_name}</h5>
                  {getRelevanceBadge(doc.relevance)}
                </div>
                <a 
                  href={`https://drive.google.com/file/d/${doc.file_id}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--small btn--action"
                >
                  👁️ פתח
                </a>
              </div>

              <p className="document-summary">{doc.summary}</p>

              {doc.action_items && doc.action_items.length > 0 && (
                <div className="action-items">
                  <strong>✅ פעולות לביצוע:</strong>
                  <ul>
                    {doc.action_items.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {doc.entities && (
                <div className="document-entities">
                  {doc.entities.amounts && doc.entities.amounts.length > 0 && (
                    <span className="entity-badge">
                      💰 {doc.entities.amounts.join(', ')}
                    </span>
                  )}
                  {doc.entities.dates && doc.entities.dates.length > 0 && (
                    <span className="entity-badge">
                      📅 {doc.entities.dates.join(', ')}
                    </span>
                  )}
                  {doc.entities.organizations && doc.entities.organizations.length > 0 && (
                    <span className="entity-badge">
                      🏢 {doc.entities.organizations.join(', ')}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .task-documents {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 1.5rem;
          margin-top: 1rem;
        }

        .documents-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .documents-header h4 {
          margin: 0;
          font-size: 1.1rem;
          color: var(--michal-text-primary);
        }

        .documents-actions {
          display: flex;
          gap: 0.5rem;
        }

        .upload-section {
          background: white;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          border: 2px dashed var(--michal-primary);
        }

        .upload-hint {
          margin: 0 0 0.75rem 0;
          color: var(--michal-text-secondary);
          font-size: 0.9rem;
        }

        .file-input {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid var(--michal-border);
          border-radius: 4px;
        }

        .uploading-message {
          margin-top: 0.5rem;
          color: var(--michal-primary);
          font-weight: 600;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 2rem;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f0f0f0;
          border-top-color: var(--michal-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .empty-state {
          text-align: center;
          padding: 2rem;
          color: var(--michal-text-muted);
        }

        .empty-state p {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
        }

        .empty-state small {
          font-size: 0.85rem;
        }

        .documents-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .document-card {
          background: white;
          border-radius: 8px;
          padding: 1rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          transition: box-shadow 0.2s;
        }

        .document-card:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .document-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.75rem;
          gap: 1rem;
        }

        .document-info {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          flex: 1;
        }

        .document-name {
          margin: 0;
          font-size: 1rem;
          color: var(--michal-text-primary);
        }

        .document-summary {
          color: var(--michal-text-secondary);
          font-size: 0.9rem;
          line-height: 1.5;
          margin: 0 0 0.75rem 0;
        }

        .action-items {
          background: #fffbea;
          padding: 0.75rem;
          border-radius: 6px;
          margin-bottom: 0.75rem;
        }

        .action-items strong {
          display: block;
          margin-bottom: 0.5rem;
          color: #856404;
        }

        .action-items ul {
          margin: 0;
          padding-right: 1.5rem;
        }

        .action-items li {
          margin-bottom: 0.25rem;
          color: var(--michal-text-secondary);
          font-size: 0.9rem;
        }

        .document-entities {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .entity-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          background: #e8f4f8;
          color: #0c5460;
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .documents-header {
            flex-direction: column;
            align-items: stretch;
          }

          .documents-actions {
            flex-direction: column;
          }

          .document-header {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
