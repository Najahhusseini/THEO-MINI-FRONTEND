'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getMySchedule } from '@/lib/api'
import toast from 'react-hot-toast'

interface MyShift {
  week_start_date: string
  week_end_date: string
  shift_date: string
  shift_name: string
  shift_code: string
  start_time: string
  end_time: string
  color: string
  notes: string
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const dayColors = ['bg-red-50', 'bg-orange-50', 'bg-yellow-50', 'bg-green-50', 'bg-blue-50', 'bg-indigo-50', 'bg-purple-50']

export default function MySchedule() {
  const { staff } = useAuth()
  const [shifts, setShifts] = useState<MyShift[]>([])
  const [loading, setLoading] = useState(true)
  const [currentWeekStart, setCurrentWeekStart] = useState<string>('')

  const getWeekStart = (date: Date = new Date()) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff)).toISOString().split('T')[0]
  }

  useEffect(() => {
    loadSchedule()
  }, [])

  const loadSchedule = async () => {
    try {
      const weekStart = getWeekStart()
      setCurrentWeekStart(weekStart)
      const data = await getMySchedule(weekStart)
      setShifts(data)
    } catch (error) {
      toast.error('Failed to load schedule')
    } finally {
      setLoading(false)
    }
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const current = new Date(currentWeekStart)
    if (direction === 'prev') {
      current.setDate(current.getDate() - 7)
    } else {
      current.setDate(current.getDate() + 7)
    }
    const newWeekStart = getWeekStart(current)
    setCurrentWeekStart(newWeekStart)
    loadSchedule()
  }

  const getShiftColor = (color: string) => {
    const colors: { [key: string]: string } = {
      emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      purple: 'bg-purple-100 text-purple-800 border-purple-200',
      orange: 'bg-orange-100 text-orange-800 border-orange-200',
    }
    return colors[color] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-pulse text-gray-600">Loading your schedule...</div>
      </div>
    )
  }

  // Group shifts by day
  const shiftsByDay: { [key: string]: MyShift[] } = {}
  daysOfWeek.forEach(day => { shiftsByDay[day] = [] })
  
  shifts.forEach(shift => {
    const date = new Date(shift.shift_date)
    const dayName = daysOfWeek[date.getDay() === 0 ? 6 : date.getDay() - 1]
    shiftsByDay[dayName].push(shift)
  })

  const weekRange = {
    start: new Date(currentWeekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    end: new Date(new Date(currentWeekStart).setDate(new Date(currentWeekStart).getDate() + 6)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">My Schedule</h2>
          <p className="text-gray-500 text-sm mt-1">{weekRange.start} - {weekRange.end}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigateWeek('prev')}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-medium"
          >
            ← Previous Week
          </button>
          <button
            onClick={() => navigateWeek('next')}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-medium"
          >
            Next Week →
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      {shifts.length > 0 ? (
        <div className="grid grid-cols-7 gap-3">
          {daysOfWeek.map((day, idx) => (
            <div key={day} className={`rounded-lg shadow overflow-hidden ${dayColors[idx]}`}>
              <div className="bg-white/80 p-3 text-center font-semibold text-gray-800 border-b">
                {day}
              </div>
              <div className="p-3 min-h-[200px] space-y-2">
                {shiftsByDay[day].length > 0 ? (
                  shiftsByDay[day].map((shift, shiftIdx) => (
                    <div
                      key={shiftIdx}
                      className={`p-2 rounded-lg border text-sm ${getShiftColor(shift.color)}`}
                    >
                      <div className="font-semibold text-gray-800">{shift.shift_name}</div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        🕐 {shift.start_time.slice(0,5)} - {shift.end_time.slice(0,5)}
                      </div>
                      {shift.notes && (
                        <div className="text-xs text-gray-500 mt-1 italic">{shift.notes}</div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 text-sm py-6">— No shift —</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-lg border">
          <div className="text-5xl mb-4">📅</div>
          <p className="text-gray-500">No schedule published for this week yet.</p>
          <p className="text-sm text-gray-400 mt-1">Check back later or contact your manager.</p>
        </div>
      )}
    </div>
  )
}