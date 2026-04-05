'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getScheduleStaff, getShiftTypes, getWeeklySchedule, saveScheduleShifts, publishSchedule, getExpectedArrivals } from '@/lib/api'
import { exportScheduleToPDF } from '@/lib/pdfExport'
import toast from 'react-hot-toast'

interface Staff {
  id: string
  name: string
  role: string
  email: string
}

interface ShiftType {
  id: string
  name: string
  start_time: string
  end_time: string
  color: string
}

interface ScheduleShift {
  staffId: string
  shiftTypeId: string
  shiftDate: string
  staffName?: string
  shiftName?: string
  customStartTime?: string
  customEndTime?: string
}

interface DayArrival {
  date: string
  count: number
  isHeavy: boolean
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Role display names and icons
const roleLabels: Record<string, { label: string; icon: string }> = {
  admin: { label: 'Admin', icon: '👑' },
  manager: { label: 'Manager', icon: '📊' },
  frontdesk: { label: 'Front Desk', icon: '🏨' },
  housekeeping: { label: 'Housekeeping', icon: '🧹' },
  maintenance: { label: 'Maintenance', icon: '🔧' },
}

export default function ScheduleBuilder() {
  const { staff } = useAuth()
  const [allStaff, setAllStaff] = useState<Staff[]>([])
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([])
  const [scheduleId, setScheduleId] = useState<string>('')
  const [shifts, setShifts] = useState<ScheduleShift[]>([])
  const [currentWeekStart, setCurrentWeekStart] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedDayShifts, setSelectedDayShifts] = useState<ScheduleShift[]>([])
  const [arrivals, setArrivals] = useState<DayArrival[]>([])
  const [showModal, setShowModal] = useState(false)
  const [roleFilter, setRoleFilter] = useState<string>('all')

  const getWeekStart = (date: Date = new Date()) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff)).toISOString().split('T')[0]
  }

  const loadData = useCallback(async () => {
    try {
      const weekStart = getWeekStart()
      setCurrentWeekStart(weekStart)
      
      const [staffData, shiftTypesData, scheduleData, arrivalsData] = await Promise.all([
        getScheduleStaff(),
        getShiftTypes(),
        getWeeklySchedule(weekStart),
        getExpectedArrivals(weekStart)
      ])
      
      setAllStaff(staffData)
      setShiftTypes(shiftTypesData)
      setScheduleId(scheduleData.schedule.id)
      setArrivals(arrivalsData)
      
      const existingShifts: ScheduleShift[] = scheduleData.shifts.map((shift: any) => ({
        staffId: shift.staff_id,
        shiftTypeId: shift.shift_type_id,
        shiftDate: shift.shift_date,
        staffName: shift.staff_name,
        shiftName: shift.shift_name,
      }))
      setShifts(existingShifts)
    } catch (error) {
      console.error(error)
      toast.error('Failed to load schedule data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (staff?.role !== 'admin' && staff?.role !== 'manager') return
    loadData()
  }, [staff, loadData])

  const openDayModal = (date: string) => {
    const dayShifts = shifts.filter(s => s.shiftDate === date)
    setSelectedDay(date)
    setSelectedDayShifts(dayShifts)
    setShowModal(true)
  }

  const addShift = (staffId: string, shiftTypeId: string) => {
    if (!selectedDay) return
    const staffMember = allStaff.find(s => s.id === staffId)
    const shiftType = shiftTypes.find(st => st.id === shiftTypeId)
    if (!staffMember || !shiftType) return

    if (shifts.some(s => s.staffId === staffId && s.shiftDate === selectedDay)) {
      toast.error(`${staffMember.name} already assigned this day`)
      return
    }

    const newShift: ScheduleShift = {
      staffId,
      shiftTypeId,
      shiftDate: selectedDay,
      staffName: staffMember.name,
      shiftName: shiftType.name,
    }
    const updatedShifts = [...shifts, newShift]
    setShifts(updatedShifts)
    setSelectedDayShifts([...selectedDayShifts, newShift])
    toast.success(`Assigned ${staffMember.name} to ${shiftType.name}`)
  }

  const removeShift = (index: number) => {
    const toRemove = selectedDayShifts[index]
    const newShifts = shifts.filter(s => !(s.staffId === toRemove.staffId && s.shiftDate === toRemove.shiftDate))
    setShifts(newShifts)
    setSelectedDayShifts(selectedDayShifts.filter((_, i) => i !== index))
    toast.success(`Removed ${toRemove.staffName}`)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveScheduleShifts(scheduleId, shifts)
      toast.success('Schedule saved')
    } catch (error) {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    setSaving(true)
    try {
      await publishSchedule(scheduleId)
      toast.success('Schedule published')
    } catch (error) {
      toast.error('Publish failed')
    } finally {
      setSaving(false)
    }
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const current = new Date(currentWeekStart)
    current.setDate(current.getDate() + (direction === 'prev' ? -7 : 7))
    const newStart = getWeekStart(current)
    setCurrentWeekStart(newStart)
    loadData()
  }

  const getShiftColor = (shiftTypeId: string) => {
    const shift = shiftTypes.find(st => st.id === shiftTypeId)
    const colors: Record<string, string> = {
      emerald: 'bg-emerald-100 text-emerald-800',
      blue: 'bg-blue-100 text-blue-800',
      purple: 'bg-purple-100 text-purple-800',
      orange: 'bg-orange-100 text-orange-800',
    }
    return colors[shift?.color || 'blue'] || 'bg-gray-100 text-gray-800'
  }

  // PDF Export Handler
  const handleExportPDF = async () => {
    // Prepare staff shifts data
    const staffShifts = allStaff.map(staffMember => {
      const staffShiftsForWeek = shifts.filter(s => s.staffId === staffMember.id)
      const shiftsByDay = staffShiftsForWeek.map(s => {
        let shiftTime = ''
        const shiftType = shiftTypes.find(st => st.id === s.shiftTypeId)
        if (shiftType) {
          shiftTime = `${shiftType.start_time.slice(0,5)}-${shiftType.end_time.slice(0,5)}`
        } else if (s.customStartTime && s.customEndTime) {
          shiftTime = `${s.customStartTime}-${s.customEndTime}`
        }
        return {
          day: s.shiftDate,
          shiftName: s.shiftName || '',
          time: shiftTime,
        }
      })
      return {
        staffName: staffMember.name,
        role: staffMember.role,
        shifts: shiftsByDay,
      }
    })
    
    const weekEndDate = new Date(currentWeekStart)
    weekEndDate.setDate(weekEndDate.getDate() + 6)
    
    await exportScheduleToPDF(
      currentWeekStart,
      weekEndDate.toISOString().split('T')[0],
      staffShifts,
      arrivals,
      'THEO Mini Hotel'
    )
  }

  if (loading) return <div className="p-8 text-center text-gray-600">Loading schedule builder...</div>

  const arrivalMap = new Map(arrivals.map(a => [a.date, a]))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">📅 Weekly Staff Schedule</h2>
          <p className="text-sm text-gray-600">Arrivals from actual bookings • Click any day to assign staff</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <button onClick={() => navigateWeek('prev')} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition">← Previous</button>
          <span className="px-4 py-2 font-medium text-gray-800">
            {new Date(currentWeekStart).toLocaleDateString()} - {new Date(new Date(currentWeekStart).setDate(new Date(currentWeekStart).getDate()+6)).toLocaleDateString()}
          </span>
          <button onClick={() => navigateWeek('next')} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition">Next →</button>
          
          {/* Role Filter Dropdown */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">👥 All Departments</option>
            <option value="admin">👑 Admin</option>
            <option value="manager">📊 Manager</option>
            <option value="frontdesk">🏨 Front Desk</option>
            <option value="housekeeping">🧹 Housekeeping</option>
            <option value="maintenance">🔧 Maintenance</option>
          </select>
          
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">💾 Save</button>
          <button onClick={handlePublish} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">📢 Publish</button>
          <button onClick={handleExportPDF} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">📄 Export PDF</button>
        </div>
      </div>

      {/* Active Filter Indicator */}
      {roleFilter !== 'all' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex justify-between items-center">
          <span className="text-sm text-blue-700">
            🔍 Showing only <strong>{roleLabels[roleFilter]?.label || roleFilter}</strong> staff
          </span>
          <button
            onClick={() => setRoleFilter('all')}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear filter ✕
          </button>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-3">
        {daysOfWeek.map((day, idx) => {
          const date = new Date(currentWeekStart)
          date.setDate(date.getDate() + idx)
          const dateStr = date.toISOString().split('T')[0]
          const arrival = arrivalMap.get(dateStr) || { count: 0, isHeavy: false }
          
          // Filter shifts by selected role
          let dayShifts = shifts.filter(s => s.shiftDate === dateStr)
          if (roleFilter !== 'all') {
            dayShifts = dayShifts.filter(shift => {
              const staffMember = allStaff.find(s => s.id === shift.staffId)
              return staffMember?.role === roleFilter
            })
          }

          return (
            <div
              key={day}
              onClick={() => openDayModal(dateStr)}
              className={`rounded-lg shadow overflow-hidden cursor-pointer hover:shadow-lg transition ${arrival.isHeavy ? 'ring-2 ring-red-400' : ''}`}
            >
              <div className="bg-gray-100 p-3 text-center font-semibold text-gray-800 border-b">{day}<br/><span className="text-xs text-gray-500">{dateStr.slice(5)}</span></div>
              <div className="p-3 text-center bg-white">
                <div className="text-2xl font-bold text-gray-800">{arrival.count}</div>
                <div className="text-xs text-gray-600">Arrivals</div>
                {arrival.isHeavy && <div className="text-xs text-red-600 font-medium mt-1">⚠️ Heavy Day</div>}
              </div>
              <div className="p-2 bg-gray-50 min-h-[100px]">
                <div className="text-xs text-gray-600 mb-1">Staff ({dayShifts.length})</div>
                {dayShifts.slice(0, 3).map((s, i) => (
                  <div key={i} className={`text-xs p-1 mb-1 rounded ${getShiftColor(s.shiftTypeId)}`}>{s.staffName}</div>
                ))}
                {dayShifts.length > 3 && <div className="text-xs text-gray-500">+{dayShifts.length-3} more</div>}
                {dayShifts.length === 0 && (
                  <div className="text-xs text-gray-500 text-center py-2">
                    {roleFilter !== 'all' ? `No ${roleLabels[roleFilter]?.label || roleFilter} staff` : 'Tap to assign'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Staff Assignment Modal */}
      {showModal && selectedDay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-xl">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold text-white">Assign Staff</h3>
                <p className="text-blue-100 text-sm mt-1">{new Date(selectedDay).toDateString()}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white hover:text-gray-200 text-2xl leading-none">&times;</button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Currently Assigned Section */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 mb-3">👥 Currently Assigned</h4>
                {selectedDayShifts.length === 0 ? (
                  <p className="text-gray-500 text-sm bg-gray-50 p-3 rounded-lg">No staff assigned yet</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayShifts.map((shift, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                          <span className="font-medium text-gray-800">{shift.staffName}</span>
                          <span className="text-gray-600 text-sm ml-2">- {shift.shiftName}</span>
                        </div>
                        <button onClick={() => removeShift(idx)} className="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available Staff Section */}
              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-800 mb-3">➕ Available Staff</h4>
                <div className="space-y-3">
                  {allStaff.filter(s => !selectedDayShifts.some(ass => ass.staffId === s.id)).map(member => (
                    <div key={member.id} className="border border-gray-200 rounded-lg p-3 bg-white hover:bg-gray-50 transition">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <span className="font-semibold text-gray-800">{member.name}</span>
                          <span className="text-gray-500 text-sm ml-2">({member.role})</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {shiftTypes.map(st => (
                          <button
                            key={st.id}
                            onClick={() => addShift(member.id, st.id)}
                            className={`text-sm px-3 py-1.5 rounded-full transition ${getShiftColor(st.id)} hover:opacity-80 font-medium`}
                          >
                            {st.name} ({st.start_time.slice(0,5)}-{st.end_time.slice(0,5)})
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {allStaff.filter(s => !selectedDayShifts.some(ass => ass.staffId === s.id)).length === 0 && (
                  <p className="text-gray-500 text-center py-6 bg-gray-50 rounded-lg">All staff members are already assigned for this day</p>
                )}
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="border-t p-4 bg-gray-50 flex justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}