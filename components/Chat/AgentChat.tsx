'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  metadata?: {
    debtsChecked?: number;
    updatesFound?: number;
    missingInfo?: string[];
  };
}

export default function AgentChat({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'agent',
      content: '👋 שלום! אני הסוכן החכם שלך.\n\nאני כאן כדי:\n• לעזור לך לחפש מיילים ולעדכן חובות\n• לצלוב מידע בין Gmail למאגר\n• ללמוד מטעויות ולהשתפר\n• לוודא שכל חוב מעודכן עם כל הפרטים\n\nמה תרצי לעשות?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          threadId: 'michal-main' // 🧵 LangGraph עם זיכרון מלא!
        })
      });

      const data = await response.json();

      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: data.response,
        timestamp: new Date(),
        metadata: data.metadata
      };

      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: '❌ מצטער, נתקלתי בבעיה. נסי שוב.',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { icon: '🔍', text: 'סרוק חובות חסרים', action: 'scan_missing' },
    { icon: '📊', text: 'עדכן כל החובות', action: 'update_all' },
    { icon: '⚠️', text: 'הצג חובות חסרי מידע', action: 'show_incomplete' },
    { icon: '📧', text: 'חפש מיילים חדשים', action: 'search_emails' }
  ];

  return (
    <div className="agent-chat-container">
      <div className="chat-header">
        <div className="header-info">
          <h3>💬 סוכן AI חכם</h3>
          <span className="status">🟢 מחובר</span>
        </div>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="chat-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'agent' ? '🤖' : '👤'}
            </div>
            <div className="message-content">
              <div className="message-text">{msg.content}</div>
              {msg.metadata && (
                <div className="message-metadata">
                  {msg.metadata.debtsChecked && (
                    <span>✅ נבדקו {msg.metadata.debtsChecked} חובות</span>
                  )}
                  {msg.metadata.updatesFound && (
                    <span>📝 נמצאו {msg.metadata.updatesFound} עדכונים</span>
                  )}
                  {msg.metadata.missingInfo && msg.metadata.missingInfo.length > 0 && (
                    <div className="missing-info">
                      ⚠️ חסר מידע: {msg.metadata.missingInfo.join(', ')}
                    </div>
                  )}
                </div>
              )}
              <div className="message-time">
                {msg.timestamp.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="message agent">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="quick-actions">
        {quickActions.map((action, idx) => (
          <button
            key={idx}
            className="quick-action-btn"
            onClick={() => {
              setInput(action.text);
              setTimeout(() => sendMessage(), 100);
            }}
            disabled={loading}
          >
            <span className="action-icon">{action.icon}</span>
            <span className="action-text">{action.text}</span>
          </button>
        ))}
      </div>

      <div className="chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="שאל אותי משהו או בקש עזרה..."
          disabled={loading}
          rows={2}
        />
        <button 
          className="send-btn" 
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          {loading ? '⏳' : '📤'}
        </button>
      </div>

      <style jsx>{`
        .agent-chat-container {
          position: fixed;
          left: 1rem;
          bottom: 1rem;
          width: 420px;
          height: 600px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          display: flex;
          flex-direction: column;
          z-index: 1000;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 16px 16px 0 0;
        }

        .header-info h3 {
          margin: 0;
          font-size: 1.1rem;
        }

        .status {
          font-size: 0.85rem;
          opacity: 0.9;
          margin-top: 0.25rem;
          display: block;
        }

        .close-btn {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          font-size: 1.5rem;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          cursor: pointer;
          transition: background 0.2s;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          background: #f8f9fa;
        }

        .message {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1rem;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .message.user {
          flex-direction: row-reverse;
        }

        .message-avatar {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          flex-shrink: 0;
        }

        .message.user .message-avatar {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }

        .message-content {
          max-width: 75%;
        }

        .message.user .message-content {
          text-align: right;
        }

        .message-text {
          background: white;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          white-space: pre-wrap;
          line-height: 1.6;
        }

        .message.user .message-text {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .message-metadata {
          margin-top: 0.5rem;
          font-size: 0.85rem;
          color: #666;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .missing-info {
          background: #fff3cd;
          padding: 0.5rem;
          border-radius: 6px;
          border-right: 3px solid #ffc107;
          margin-top: 0.5rem;
        }

        .message-time {
          font-size: 0.75rem;
          color: #999;
          margin-top: 0.25rem;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
          padding: 1rem;
        }

        .typing-indicator span {
          width: 8px;
          height: 8px;
          background: #667eea;
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }

        .typing-indicator span:nth-child(1) {
          animation-delay: -0.32s;
        }

        .typing-indicator span:nth-child(2) {
          animation-delay: -0.16s;
        }

        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }

        .quick-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: white;
          border-top: 1px solid #e5e7eb;
        }

        .quick-action-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: #f8f9fa;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.85rem;
        }

        .quick-action-btn:hover:not(:disabled) {
          background: #667eea;
          color: white;
          border-color: #667eea;
        }

        .quick-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .action-icon {
          font-size: 1.1rem;
        }

        .chat-input {
          display: flex;
          gap: 0.75rem;
          padding: 1rem;
          background: white;
          border-top: 1px solid #e5e7eb;
          border-radius: 0 0 16px 16px;
        }

        .chat-input textarea {
          flex: 1;
          padding: 0.75rem;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          resize: none;
          font-family: inherit;
          font-size: 0.95rem;
          transition: border-color 0.2s;
        }

        .chat-input textarea:focus {
          outline: none;
          border-color: #667eea;
        }

        .chat-input textarea:disabled {
          background: #f8f9fa;
          cursor: not-allowed;
        }

        .send-btn {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 1.25rem;
          cursor: pointer;
          transition: transform 0.2s;
          flex-shrink: 0;
        }

        .send-btn:hover:not(:disabled) {
          transform: scale(1.05);
        }

        .send-btn:active:not(:disabled) {
          transform: scale(0.95);
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
