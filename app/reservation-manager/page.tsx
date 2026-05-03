'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import ReservationManagerDashboard from '@/components/ReservationManagerDashboard'

export default function ReservationManagerPage() {
  const { staff } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!staff) {
      router.push('/login')
      return
    }
    if (staff.role !== 'reservation_manager' && staff.role !== 'admin' && staff.role !== 'manager') {
      router.push('/dashboard')
    }
  }, [staff, router])

  if (!staff) return null

  return <ReservationManagerDashboard />
}