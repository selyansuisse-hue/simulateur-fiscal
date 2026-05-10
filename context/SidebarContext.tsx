'use client'
import { createContext, useContext } from 'react'

interface SidebarContextValue {
  collapsed: boolean
  toggle: () => void
}

export const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
})

export const useSidebar = () => useContext(SidebarContext)
