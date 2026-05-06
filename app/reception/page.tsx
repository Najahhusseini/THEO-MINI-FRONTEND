'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import ReceptionDashboard from '@/components/ReceptionDashboard'
import NotificationBell from '@/components/NotificationBell'

export default function ReceptionPage() {
  const { staff, isLoading, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!staff) {
      router.push('/login')
      return
    }
    if (!['frontdesk', 'admin', 'manager', 'reception'].includes(staff.role)) {
      router.push('/dashboard')
    }
  }, [staff, isLoading, router])

  if (isLoading || !staff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-500">Loading reception desk…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">🛎️ Reception Desk</h1>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <span className="px-3 py-1 bg-gray-100 rounded-full text-sm">
              {staff.role === 'frontdesk' ? 'Reception' : staff.role}
            </span>
            <button
              onClick={logout}
              className="px-4 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <ReceptionDashboard />
      </main>
    </div>
  )
}