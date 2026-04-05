'use client'

import { useState, useEffect } from 'react'
import { getWeeklyHours, getShiftHistory, requestTimeOff } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

interface WeeklyHours {
  totalHours: number
  totalOvertime: number
  remainingHours: number
  daily: Array<{ day: string; hoursWorked: number; overtimeHours: number }>
}

interface ShiftHistory {
  id: string
  clockIn: string
  clockOut: string
  hoursWorked: number
  overtimeHours: number
  shiftType: string
  location: string
}

export default function ShiftTracker() {
  const { staff } = useAuth()
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours | null>(null)
  const [shiftHistory, setShiftHistory] = useState<ShiftHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [showTimeOffModal, setShowTimeOffModal] = useState(false)
  const [timeOffDates, setTimeOffDates] = useState({ start: '', end: '' })
  const [timeOffReason, setTimeOffReason] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [weekly, history] = await Promise.all([
        getWeeklyHours(),
        getShiftHistory(30)
      ])
      setWeeklyHours(weekly)
      setShiftHistory(history)
    } catch (error) {
      toast.error('Failed to load shift data')
    } finally {
      setLoading(false)
    }
  }

  const handleTimeOffRequest = async () => {
    if (!timeOffDates.start || !timeOffDates.end) {
      toast.error('Please select start and end dates')
      return
    }
    try {
      await requestTimeOff(timeOffDates.start, timeOffDates.end, timeOffReason)
      toast.success('Time off request submitted')
      setShowTimeOffModal(false)
      setTimeOffDates({ start: '', end: '' })
      setTimeOffReason('')
    } catch (error) {
      toast.error('Failed to submit request')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-40 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Shift Tracker</h3>
          <p className="text-sm text-purple-100 mt-1">Track your hours and overtime</p>
        </div>

        {/* Weekly Summary */}
        <div className="p-6 border-b">
          <h4 className="text-sm font-medium text-gray-500 mb-3">This Week</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-800">{weeklyHours?.totalHours?.toFixed(1) || 0}</div>
              <div className="text-xs text-gray-500">Hours Worked</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{weeklyHours?.totalOvertime?.toFixed(1) || 0}</div>
              <div className="text-xs text-gray-500">Overtime</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{weeklyHours?.remainingHours?.toFixed(1) || 40}</div>
              <div className="text-xs text-gray-500">Remaining</div>
            </div>
          </div>
        </div>

        {/* Daily Breakdown */}
        <div className="p-6 border-b">
          <h4 className="text-sm font-medium text-gray-500 mb-3">Daily Breakdown</h4>
          <div className="space-y-2">
            {weeklyHours?.daily?.map((day, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                <span className="text-sm text-gray-600">{day.day}</span>
                <div className="flex gap-4">
                  <span className="text-sm font-medium text-gray-800">{day.hoursWorked?.toFixed(1) || 0} hrs</span>
                  {day.overtimeHours > 0 && (
                    <span className="text-xs text-orange-600">+{day.overtimeHours.toFixed(1)} OT</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Shifts */}
        <div className="p-6">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-medium text-gray-500">Recent Shifts</h4>
            <button
              onClick={() => setShowTimeOffModal(true)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Request Time Off
            </button>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {shiftHistory.slice(0, 10).map((shift) => (
              <div key={shift.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-gray-500">{formatDate(shift.clockIn)}</p>
                    <p className="text-sm font-medium text-gray-800">
                      {formatTime(shift.clockIn)} - {shift.clockOut ? formatTime(shift.clockOut) : 'In Progress'}
                    </p>
                  </div>
                  <div className="text-right">
                    {shift.hoursWorked > 0 && (
                      <p className="text-sm font-semibold text-gray-800">{shift.hoursWorked.toFixed(1)} hrs</p>
                    )}
                    {shift.overtimeHours > 0 && (
                      <p className="text-xs text-orange-600">+{shift.overtimeHours.toFixed(1)} OT</p>
                    )}
                  </div>
                </div>
                {shift.shiftType === 'late' && (
                  <p className="text-xs text-red-500 mt-1">⚠️ Late arrival</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Time Off Modal */}
      {showTimeOffModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Request Time Off</h3>
              <button
                onClick={() => setShowTimeOffModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={timeOffDates.start}
                  onChange={(e) => setTimeOffDates({ ...timeOffDates, start: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={timeOffDates.end}
                  onChange={(e) => setTimeOffDates({ ...timeOffDates, end: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={timeOffReason}
                  onChange={(e) => setTimeOffReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Vacation, sick day, personal, etc."
                />
              </div>
              <button
                onClick={handleTimeOffRequest}
                className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}