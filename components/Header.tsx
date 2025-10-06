'use client'

import { useState, useEffect } from 'react'

interface HeaderProps {
  currentPage: string
  onPageChange: (page: 'dashboard' | 'debts' | 'clients' | 'bureaucracy') => void
}

export default function Header({ currentPage, onPageChange }: HeaderProps) {
  const [isConnected, setIsConnected] = useState(true)

  useEffect(() => {
    // Check connection status
    checkConnectionStatus()
    const interval = setInterval(checkConnectionStatus, 30000) // Check every 30s
    return () => clearInterval(interval)
  }, [])

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/supabase/sync')
      const data = await response.json()
      const supabaseConnection = data.connections?.find((c: any) => c.name === 'Supabase')
      setIsConnected(supabaseConnection?.status === 'connected')
    } catch (error) {
      setIsConnected(false)
    }
  }

  return (
    <header className="header">
      <div className="container">
        <h1 className="logo">🤖 העוזר האישי של מיכל</h1>
        <nav className="nav">
          <button
            className={`nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => onPageChange('dashboard')}
          >
            דאשבורד ראשי
          </button>
          <button
            className={`nav-btn ${currentPage === 'debts' ? 'active' : ''}`}
            onClick={() => onPageChange('debts')}
          >
            חובות
          </button>
          <button
            className={`nav-btn ${currentPage === 'clients' ? 'active' : ''}`}
            onClick={() => onPageChange('clients')}
          >
            לקוחות
          </button>
          <button
            className={`nav-btn ${currentPage === 'bureaucracy' ? 'active' : ''}`}
            onClick={() => onPageChange('bureaucracy')}
          >
            בירוקרטיה
          </button>
        </nav>
        <div className="header-status">
          <div className="status-indicator" id="connection-status">
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
            <span>{isConnected ? 'מחוברת' : 'מנותק'}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
