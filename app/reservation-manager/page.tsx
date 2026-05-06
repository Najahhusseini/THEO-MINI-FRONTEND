'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import ReservationManagerDashboard from '@/components/ReservationManagerDashboard'

export default function ReservationManagerPage() {
  const { staff, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!staff) {
      router.push('/login')
      return
    }
    if (!['admin', 'manager', 'reservation_manager'].includes(staff.role)) {
      router.push('/dashboard')
    }
  }, [staff, isLoading, router])

  if (isLoading || !staff) return null

  return <ReservationManagerDashboard standalone={true} />
}