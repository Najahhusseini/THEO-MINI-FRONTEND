'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { login as loginApi, getCurrentStaff } from '@/lib/api'
import { Staff } from '@/types'
import toast from 'react-hot-toast'

interface AuthContextType {
  staff: Staff | null
  isLoading: boolean
  login: (email: string, password: string, subdomain: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      setIsLoading(false)
      return
    }
    try {
      const staffData = await getCurrentStaff()
      setStaff(staffData)
    } catch (error: any) {
      console.error('Auth check failed:', error.message)
      // Only clear token if it's a 401 (invalid/expired), not a network error
      if (error.response?.status === 401) {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
      }
    }
    setIsLoading(false)
  }

  const login = async (email: string, password: string, subdomain: string) => {
    try {
      const data = await loginApi(email, password, subdomain)
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      setStaff(data.staff)
      toast.success(`Welcome back, ${data.staff.name}!`)

      // ✅ Redirect based on role
      const role = data.staff?.role
      if (role === 'reservation_manager') {
        window.location.href = '/reservation-manager'
      } else if (role === 'frontdesk' || role === 'reception') {
        window.location.href = '/reception'
      } else {
        window.location.href = '/dashboard'
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Login failed')
      throw error
    }
  }

  const logout = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setStaff(null)
    toast.success('Logged out successfully')
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ staff, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}