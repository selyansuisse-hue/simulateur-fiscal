'use client'
import { useState, useEffect } from 'react'
import { SidebarContext } from '@/context/SidebarContext'
import { CabinetSidebar } from './CabinetSidebar'
import type { Cabinet } from '@/lib/types/cabinet'

interface Props {
  cabinet: Cabinet
  children: React.ReactNode
}

export function CabinetShell({ cabinet, children }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(localStorage.getItem('sidebar-collapsed') === 'true')
  }, [])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#060d1a' }}>
        <CabinetSidebar cabinet={cabinet} />
        <main
          data-cabinet-main=""
          style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto', overflowX: 'hidden' }}
        >
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  )
}
