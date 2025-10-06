'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import DashboardPage from '@/components/Dashboard/DashboardPage'
import DebtsPage from '@/components/Debts/DebtsPage'
import ClientsPage from '@/components/Clients/ClientsPage'
import BureaucracyPage from '@/components/Bureaucracy/BureaucracyPage'
import SideChat from '@/components/Chat/SideChat'

export default function Home() {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'debts' | 'clients' | 'bureaucracy'>('dashboard')

  return (
    <>
      <Header currentPage={currentPage} onPageChange={setCurrentPage} />
      
      <div className="main-layout">
        <main className="main-content">
          {currentPage === 'dashboard' && <DashboardPage />}
          {currentPage === 'debts' && <DebtsPage />}
          {currentPage === 'clients' && <ClientsPage />}
          {currentPage === 'bureaucracy' && <BureaucracyPage />}
        </main>

        <SideChat />
      </div>
    </>
  )
}
