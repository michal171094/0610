'use client'

import { useState, useEffect, useRef } from 'react'

interface ChatMessage {
  id: string
  type: 'user' | 'ai'
  message: string
  timestamp: string
}

export default function SideChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)
  const [currentStatus, setCurrentStatus] = useState<any>(null)
  const [connections, setConnections] = useState<any[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadCurrentStatus()
    loadConnections()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadCurrentStatus = async () => {
    setCurrentStatus({
      oriyon_situation: 'מחכה לאישור שהייה לאחר חתונה אזרחית',
      financial_overview: 'חובות: ~8,500€ | הכנסה חודשית: ~2,000€',
      urgent_priorities: 'חתונה אזרחית, ביטוח בריאות, עדכון Jobcenter',
      active_projects: '5 לקוחות פעילים'
    })
  }

  const loadConnections = async () => {
    try {
      const response = await fetch('/api/supabase/sync')
      const data = await response.json()
      setConnections(data.connections || [])
    } catch (error) {
      console.error('Failed to load connections:', error)
    }
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      type: 'user',
      message: inputValue,
      timestamp: new Date().toISOString()
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/ai-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputValue,
          threadId: 'michal-sidechat' // ✅ זה התיקון היחיד!
        })
      })

      const data = await response.json()

      const aiMessage: ChatMessage = {
        id: `msg_${Date.now()}_ai`,
        type: 'ai',
        message: data.response,
        timestamp: new Date().toISOString()
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}_error`,
        type: 'ai',
        message: 'מצטערת, יש בעיה זמנית. נסי שוב בעוד רגע 🙏',
        timestamp: new Date().toISOString()
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <aside className={`side-chat ${!isExpanded ? 'collapsed' : ''}`}>
      <div className="chat-header">
        <h3>💬 צ'אט עם העוזר</h3>
        <button
          className="chat-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? 'הסתר' : 'הצג'}
        >
          {isExpanded ? '←' : '→'}
        </button>
      </div>

      {isExpanded && (
        <>
          <div className="chat-content">
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="chat-empty">
                  <p>👋 שלום מיכל!</p>
                  <p>אני כאן לעזור לך. שאלי אותי כל דבר:</p>
                  <ul>
                    <li>מה המשימה הכי דחופה?</li>
                    <li>איך אני מתמודדת עם החובות?</li>
                    <li>מה הסטטוס עם הלקוחות?</li>
                  </ul>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`chat-message ${msg.type}`}>
                    <strong>{msg.type === 'user' ? 'את' : 'AI'}:</strong>
                    <span>{msg.message}</span>
                    <small className="message-time">
                      {new Date(msg.timestamp).toLocaleTimeString('he-IL', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </small>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="chat-message ai">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="כתבי כאן את השאלה שלך..."
                disabled={isLoading}
              />
              <button onClick={sendMessage} disabled={isLoading || !inputValue.trim()}>
                📤
              </button>
            </div>
          </div>

          {/* Status Snapshot - עם max-height */}
          <div className="status-snapshot">
            <h4>מצב נוכחי ⚡</h4>
            {currentStatus && (
              <div className="status-item">
                <div className="status-row">
                  <strong>מצב אוריון:</strong>
                  <span>{currentStatus.oriyon_situation}</span>
                </div>
                <div className="status-row">
                  <strong>כלכלי:</strong>
                  <span>{currentStatus.financial_overview}</span>
                </div>
                <div className="status-row">
                  <strong>עדיפויות:</strong>
                  <span>{currentStatus.urgent_priorities}</span>
                </div>
                <div className="status-row">
                  <strong>פרויקטים:</strong>
                  <span>{currentStatus.active_projects}</span>
                </div>
              </div>
            )}
          </div>

          {/* Connections Status - עם max-height */}
          <div className="connections-status">
            <h4>סטטוס חיבורים 🔗</h4>
            <div className="connections-list">
              {connections.map((conn) => (
                <div key={conn.name} className="connection-item">
                  <span
                    className={`connection-dot ${
                      conn.status === 'connected' || conn.status === 'configured'
                        ? 'connected'
                        : 'disconnected'
                    }`}
                  ></span>
                  <span className="connection-name">{conn.name}</span>
                  <span className="connection-status">
                    {conn.status === 'connected' ? '✅' : 
                     conn.status === 'configured' ? '⚙️' : '❌'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .side-chat {
          position: fixed;
          right: 0;
          top: 80px;
          bottom: 0;
          width: 380px;
          background: white;
          border-left: 1px solid #e0e0e0;
          display: flex;
          flex-direction: column;
          transition: transform 0.3s ease;
          z-index: 100;
          box-shadow: -2px 0 10px rgba(0,0,0,0.1);
        }

        .side-chat.collapsed {
          transform: translateX(330px);
        }

        .chat-header {
          padding: 15px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .chat-header h3 {
          margin: 0;
          font-size: 16px;
        }

        .chat-toggle {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          font-size: 18px;
          cursor: pointer;
          padding: 5px 10px;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .chat-toggle:hover {
          background: rgba(255,255,255,0.3);
        }

        .chat-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 0;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 15px;
          background: #f8f9fa;
          min-height: 300px;
        }

        .chat-empty {
          text-align: center;
          padding: 30px 20px;
          color: #666;
        }

        .chat-empty ul {
          list-style: none;
          padding: 0;
          margin-top: 15px;
        }

        .chat-empty li {
          margin: 8px 0;
          padding: 8px;
          background: white;
          border-radius: 6px;
          font-size: 14px;
        }

        .chat-message {
          margin-bottom: 15px;
          padding: 12px;
          border-radius: 8px;
          background: white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .chat-message.user {
          background: #667eea;
          color: white;
          margin-left: 30px;
        }

        .chat-message.ai {
          background: white;
          margin-right: 30px;
        }

        .chat-message strong {
          display: block;
          margin-bottom: 5px;
          font-size: 12px;
          opacity: 0.8;
        }

        .message-time {
          display: block;
          margin-top: 5px;
          font-size: 11px;
          opacity: 0.6;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
          padding: 10px;
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

        .chat-input-container {
          padding: 15px;
          background: white;
          border-top: 1px solid #e0e0e0;
          display: flex;
          gap: 10px;
        }

        .chat-input-container input {
          flex: 1;
          padding: 10px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          font-size: 14px;
        }

        .chat-input-container input:focus {
          outline: none;
          border-color: #667eea;
        }

        .chat-input-container button {
          padding: 10px 15px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          transition: background 0.2s;
        }

        .chat-input-container button:hover:not(:disabled) {
          background: #5568d3;
        }

        .chat-input-container button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .status-snapshot {
          padding: 15px;
          background: white;
          border-top: 1px solid #e0e0e0;
          font-size: 13px;
          max-height: 150px;
          overflow-y: auto;
        }

        .status-snapshot h4 {
          margin: 0 0 10px 0;
          font-size: 14px;
        }

        .status-row {
          display: flex;
          justify-content: space-between;
          margin: 6px 0;
          padding: 6px;
          background: #f8f9fa;
          border-radius: 4px;
        }

        .status-row strong {
          color: #667eea;
        }

        .connections-status {
          padding: 15px;
          background: white;
          border-top: 1px solid #e0e0e0;
          font-size: 13px;
          max-height: 120px;
          overflow-y: auto;
        }

        .connections-status h4 {
          margin: 0 0 10px 0;
          font-size: 14px;
        }

        .connections-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .connection-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px;
          background: #f8f9fa;
          border-radius: 4px;
        }

        .connection-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .connection-dot.connected {
          background: #4caf50;
        }

        .connection-dot.disconnected {
          background: #f44336;
        }

        .connection-name {
          flex: 1;
        }
      `}</style>
    </aside>
  )
}