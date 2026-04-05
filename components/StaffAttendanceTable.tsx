'use client'

import { useState, useEffect } from 'react'
import { getTodayAttendance } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

interface StaffAttendance {
  staffId: string
  name: string
  role: string
  email: string
  isClockedIn: boolean
  clockIn: string | null
  clockOut: string | null
}

export default function StaffAttendanceTable() {
  const { staff } = useAuth()
  const [attendance, setAttendance] = useState<StaffAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)

  useEffect(() => {
    if (staff?.role === 'admin' || staff?.role === 'manager') {
      fetchAttendance()
      // Refresh every 60 seconds (reduced from 30s for better performance)
      const interval = setInterval(fetchAttendance, 60000)
      return () => clearInterval(interval)
    }
  }, [staff])

  const fetchAttendance = async () => {
    // Prevent multiple simultaneous requests
    if (isFetching) return
    setIsFetching(true)
    try {
      const data = await getTodayAttendance()
      setAttendance(data)
    } catch (error) {
      toast.error('Failed to load attendance')
    } finally {
      setIsFetching(false)
      setLoading(false)
    }
  }

  // Only show for managers and admins
  if (staff?.role !== 'admin' && staff?.role !== 'manager') {
    return null
  }

  const clockedInCount = attendance.filter(s => s.isClockedIn).length
  const totalStaff = attendance.length

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">Loading staff attendance...</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b bg-gray-50">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">Staff Attendance Today</h3>
          <div className="text-sm text-gray-600">
            <span className="font-medium">{clockedInCount}</span> of <span className="font-medium">{totalStaff}</span> staff clocked in
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock In</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock Out</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {attendance.map((person) => (
              <tr key={person.staffId} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{person.name}</div>
                  <div className="text-sm text-gray-500">{person.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                    {person.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${person.isClockedIn ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {person.isClockedIn ? 'Clocked In' : 'Clocked Out'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {person.clockIn ? new Date(person.clockIn).toLocaleTimeString() : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {person.clockOut ? new Date(person.clockOut).toLocaleTimeString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {attendance.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No staff members found
        </div>
      )}
    </div>
  )
}