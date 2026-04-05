'use client'

import { useState, useEffect } from 'react'
import { clockIn, clockOut, getAttendanceStatus } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

interface AttendanceStatus {
  isClockedIn: boolean
  shift: {
    clockIn: string
  } | null
}

export default function AttendanceCard() {
  const { staff } = useAuth()
  const [status, setStatus] = useState<AttendanceStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    fetchStatus()
    // Refresh status every 60 seconds to sync with server
    const interval = setInterval(fetchStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchStatus = async () => {
    try {
      const data = await getAttendanceStatus()
      setStatus(data)
    } catch (error) {
      console.error('Failed to fetch attendance status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClockIn = async () => {
    if (actionLoading) return
    
    // OPTIMISTIC UPDATE - Update UI instantly
    const now = new Date()
    const timeString = now.toISOString()
    
    setStatus({
      isClockedIn: true,
      shift: { clockIn: timeString }
    })
    
    setActionLoading(true)
    toast.loading('Clocking in...', { id: 'clock-action' })
    
    try {
      await clockIn()
      toast.success(`Clocked in at ${now.toLocaleTimeString()}`, { id: 'clock-action' })
      await fetchStatus() // Sync with server
    } catch (error: any) {
      // Revert on error
      setStatus({
        isClockedIn: false,
        shift: null
      })
      toast.error(error.response?.data?.error || 'Failed to clock in', { id: 'clock-action' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleClockOut = async () => {
    if (actionLoading) return
    
    // OPTIMISTIC UPDATE - Update UI instantly
    setStatus({
      isClockedIn: false,
      shift: null
    })
    
    setActionLoading(true)
    toast.loading('Clocking out...', { id: 'clock-action' })
    
    try {
      await clockOut()
      toast.success(`Clocked out at ${new Date().toLocaleTimeString()}`, { id: 'clock-action' })
      await fetchStatus() // Sync with server
      setShowConfirm(false)
    } catch (error: any) {
      // Revert on error - restore previous state
      const previousClockIn = status?.shift?.clockIn
      setStatus({
        isClockedIn: true,
        shift: previousClockIn ? { clockIn: previousClockIn } : null
      })
      toast.error(error.response?.data?.error || 'Failed to clock out', { id: 'clock-action' })
    } finally {
      setActionLoading(false)
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Attendance</h3>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${status?.isClockedIn ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {status?.isClockedIn ? 'Clocked In' : 'Clocked Out'}
          </span>
        </div>

        <div className="space-y-3">
          {status?.isClockedIn && status?.shift?.clockIn && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Clocked in at:</p>
              <p className="text-lg font-semibold text-gray-800">{formatTime(status.shift.clockIn)}</p>
            </div>
          )}

          <button
            onClick={status?.isClockedIn ? () => setShowConfirm(true) : handleClockIn}
            disabled={actionLoading}
            className={`w-full py-3 rounded-md text-white font-medium transition flex items-center justify-center gap-2 ${
              status?.isClockedIn
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {actionLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              status?.isClockedIn ? 'Clock Out' : 'Clock In'
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Clock Out</h3>
              <p className="text-sm text-gray-500 mb-4">
                Are you sure you want to clock out? You won't be able to clock back in until your next shift.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClockOut}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Yes, Clock Out'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}