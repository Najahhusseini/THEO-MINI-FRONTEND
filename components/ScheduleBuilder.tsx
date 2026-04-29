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
  sub_role?: string
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
  notes?: string
}

interface DayArrival {
  date: string
  count: number
  isHeavy: boolean
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Department options - each department corresponds to a staff role
const departments = [
  { value: 'all', label: 'All Departments', icon: '🏢', roles: ['admin', 'manager'] },
  { value: 'admin', label: 'Admin & Management', icon: '👑', roles: ['admin'] },
  { value: 'manager', label: 'Managers', icon: '📊', roles: ['admin', 'manager'] },
  { value: 'frontdesk', label: 'Front Desk', icon: '🏨', roles: ['admin', 'manager', 'frontdesk'] },
  { value: 'housekeeping', label: 'Housekeeping', icon: '🧹', roles: ['admin', 'manager', 'housekeeping', 'head_housekeeping'] },
  { value: 'maintenance', label: 'Maintenance', icon: '🔧', roles: ['admin', 'manager', 'maintenance'] },
]

const subRoleLabels: Record<string, { label: string; icon: string }> = {
  room_cleaning: { label: 'Room Cleaning', icon: '🛏️' },
  hallway: { label: 'Hallway', icon: '🚪' },
  laundry: { label: 'Laundry', icon: '🧺' },
  general: { label: 'General', icon: '🧹' },
}

// Allowed sub‑roles for housekeeping staff (used by Head of Housekeeping)
const ALLOWED_SUB_ROLES = ['room_cleaning', 'hallway', 'laundry', 'general']

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
  const [departures, setDepartures] = useState<{ date: string; count: number }[]>([])
  const [showModal, setShowModal] = useState(false)
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [subRoleFilter, setSubRoleFilter] = useState<string>('all')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
  const [todayDateStr, setTodayDateStr] = useState<string>('')
  
  // Notes modal state
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [pendingShift, setPendingShift] = useState<{ staffId: string; staffName: string; shiftTypeId: string; shiftName: string } | null>(null)
  const [shiftNotes, setShiftNotes] = useState('')
  const [viewingNotes, setViewingNotes] = useState<{ staffName: string; notes: string; shiftName: string } | null>(null)

  const getWeekStart = (date: Date = new Date()) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff)).toISOString().split('T')[0]
  }

  // Mock departures - replace with actual API call when available
  const getExpectedDepartures = async (weekStart: string): Promise<{ date: string; count: number }[]> => {
    // TODO: Replace with actual API call
    return []
  }

  // For head_housekeeping, force department to housekeeping
  useEffect(() => {
    if (staff?.role === 'head_housekeeping') {
      setSelectedDepartment('housekeeping')
    }
  }, [staff])

  // Set today's date
  useEffect(() => {
    setTodayDateStr(new Date().toISOString().split('T')[0])
  }, [])

  // Get available departments based on user role
  const getAvailableDepartments = () => {
    const userRole = staff?.role || 'staff'
    return departments.filter(dept => dept.roles.includes(userRole))
  }

  const loadData = useCallback(async (weekStart?: string) => {
    try {
      const weekStartDate = weekStart || getWeekStart()
      setCurrentWeekStart(weekStartDate)
      
      let departmentRole = selectedDepartment !== 'all' ? selectedDepartment : undefined
      if (staff?.role === 'head_housekeeping') {
        departmentRole = 'housekeeping'
      }
      
      const [staffData, shiftTypesData, scheduleData, arrivalsData, departuresData] = await Promise.all([
        getScheduleStaff(departmentRole),
        getShiftTypes(),
        getWeeklySchedule(weekStartDate, selectedDepartment),
        getExpectedArrivals(weekStartDate),
        getExpectedDepartures(weekStartDate)
      ])
      
      // If head of housekeeping, filter staff to only those with allowed sub‑roles
      let filteredStaff = staffData
      if (staff?.role === 'head_housekeeping') {
        filteredStaff = staffData.filter(s => 
          s.role === 'housekeeping' && ALLOWED_SUB_ROLES.includes(s.sub_role || '')
        )
      }
      
      setAllStaff(filteredStaff)
      setShiftTypes(shiftTypesData)
      setScheduleId(scheduleData.schedule.id)
      setArrivals(arrivalsData)
      setDepartures(departuresData)
      
      // Also filter existing shifts that might reference staff no longer in the list? Keep them for now, but they won't appear in available staff.
      const existingShifts: ScheduleShift[] = scheduleData.shifts.map((shift: any) => ({
        staffId: shift.staff_id,
        shiftTypeId: shift.shift_type_id,
        shiftDate: shift.shift_date,
        staffName: shift.staff_name,
        shiftName: shift.shift_name,
        notes: shift.notes,
      }))
      setShifts(existingShifts)
    } catch (error) {
      console.error('Error loading schedule:', error)
      toast.error('Failed to load schedule data')
    } finally {
      setLoading(false)
    }
  }, [selectedDepartment, staff])

  useEffect(() => {
    if (staff?.role !== 'admin' && staff?.role !== 'manager' && staff?.role !== 'head_housekeeping') {
      return
    }
    loadData()
  }, [staff, loadData, selectedDepartment])

  const navigateWeek = (direction: 'prev' | 'next') => {
    const current = new Date(currentWeekStart)
    current.setDate(current.getDate() + (direction === 'prev' ? -7 : 7))
    const newStart = getWeekStart(current)
    if (newStart !== currentWeekStart) {
      loadData(newStart)
    }
  }

  const jumpToWeek = (date: Date) => {
    const newStart = getWeekStart(date)
    if (newStart !== currentWeekStart) {
      loadData(newStart)
    }
  }

  const handleDatePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value)
    if (!isNaN(date.getTime())) {
      jumpToWeek(date)
    }
  }

  const openDayModal = (date: string) => {
    const dayShifts = shifts.filter(s => s.shiftDate === date)
    setSelectedDay(date)
    setSelectedDayShifts(dayShifts)
    setShowModal(true)
  }

  const initiateAddShift = (staffId: string, staffName: string, shiftTypeId: string, shiftName: string) => {
    setPendingShift({ staffId, staffName, shiftTypeId, shiftName })
    setShiftNotes('')
    setShowNotesModal(true)
  }

  const confirmAddShiftWithNotes = () => {
    if (!pendingShift || !selectedDay) return
    
    if (shifts.some(s => s.staffId === pendingShift.staffId && s.shiftDate === selectedDay)) {
      toast.error(`${pendingShift.staffName} already assigned this day`)
      setShowNotesModal(false)
      setPendingShift(null)
      return
    }

    const newShift: ScheduleShift = {
      staffId: pendingShift.staffId,
      shiftTypeId: pendingShift.shiftTypeId,
      shiftDate: selectedDay,
      staffName: pendingShift.staffName,
      shiftName: pendingShift.shiftName,
      notes: shiftNotes.trim() || undefined,
    }
    
    const updatedShifts = [...shifts, newShift]
    setShifts(updatedShifts)
    setSelectedDayShifts([...selectedDayShifts, newShift])
    toast.success(`Assigned ${pendingShift.staffName} to ${pendingShift.shiftName}${shiftNotes.trim() ? ' with note' : ''}`)
    setShowNotesModal(false)
    setPendingShift(null)
    setShiftNotes('')
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
      const departmentLabel = departments.find(d => d.value === selectedDepartment)?.label || 'All Departments'
      toast.success(`Schedule for ${departmentLabel} published`)
    } catch (error) {
      toast.error('Publish failed')
    } finally {
      setSaving(false)
    }
  }

  const handleExportPDF = async () => {
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
          notes: s.notes,
        }
      })
      return {
        staffName: staffMember.name,
        role: staffMember.role,
        sub_role: staffMember.sub_role,
        shifts: shiftsByDay,
      }
    })
    
    const weekEndDate = new Date(currentWeekStart)
    weekEndDate.setDate(weekEndDate.getDate() + 6)
    const departmentLabel = departments.find(d => d.value === selectedDepartment)?.label || 'All Departments'
    
    await exportScheduleToPDF(
      currentWeekStart,
      weekEndDate.toISOString().split('T')[0],
      staffShifts,
      arrivals,
      `THEO Mini Hotel - ${departmentLabel}`
    )
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

  // Filter staff by sub-role for display in modal (and apply allowed sub-roles for head)
  const getFilteredAvailableStaff = () => {
    let available = allStaff.filter(s => !selectedDayShifts.some(ass => ass.staffId === s.id))
    if (subRoleFilter !== 'all') {
      available = available.filter(s => s.sub_role === subRoleFilter)
    }
    // If head of housekeeping, also ensure only allowed sub_roles (already filtered in loadData, but double-check)
    if (staff?.role === 'head_housekeeping') {
      available = available.filter(s => ALLOWED_SUB_ROLES.includes(s.sub_role || ''))
    }
    return available
  }

  if (loading) return <div className="p-8 text-center text-gray-600">Loading schedule builder...</div>

  const arrivalMap = new Map(arrivals.map(a => [a.date, a]))
  const departureMap = new Map(departures.map(d => [d.date, d.count]))
  const availableDepartments = getAvailableDepartments()
  const currentDepartmentLabel = departments.find(d => d.value === selectedDepartment)?.label || 'All Departments'
  const isHousekeeping = staff?.role === 'head_housekeeping'
  
  const weekEndDate = new Date(currentWeekStart)
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const weekRangeDisplay = `${new Date(currentWeekStart).toLocaleDateString()} - ${weekEndDate.toLocaleDateString()}`
  
  // Calculate max arrivals for scaling the bar chart
  const maxArrivals = Math.max(...arrivals.map(a => a.count), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">📅 Weekly Staff Schedule</h2>
          <p className="text-sm text-gray-600">Manage schedules by department • Click any day to assign staff</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <button onClick={() => navigateWeek('prev')} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition">← Previous</button>
          <span className="px-4 py-2 font-medium text-gray-800">{weekRangeDisplay}</span>
          <button onClick={() => navigateWeek('next')} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition">Next →</button>
          <input
            type="date"
            onChange={handleDatePickerChange}
            className="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            title="Jump to week containing this date"
          />
          {!isHousekeeping && availableDepartments.length > 0 && (
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {availableDepartments.map(dept => (
                <option key={dept.value} value={dept.value}>
                  {dept.icon} {dept.label}
                </option>
              ))}
            </select>
          )}
          {isHousekeeping && (
            <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium">
              🧹 Housekeeping Department
            </div>
          )}
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">💾 Save</button>
          <button onClick={handlePublish} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">📢 Publish</button>
          <button onClick={handleExportPDF} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">📄 Export PDF</button>
        </div>
      </div>

      {/* Arrivals / Departures Summary - Horizontal Bar Chart */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-md font-semibold text-gray-800 mb-3">📊 Expected Activity This Week</h3>
        <div className="space-y-3">
          {daysOfWeek.map((day, idx) => {
            const date = new Date(currentWeekStart)
            date.setDate(date.getDate() + idx)
            const dateStr = date.toISOString().split('T')[0]
            const arrival = arrivalMap.get(dateStr) || { count: 0, isHeavy: false }
            const departureCount = departureMap.get(dateStr) || 0
            const barWidth = maxArrivals > 0 ? (arrival.count / maxArrivals) * 100 : 0
            return (
              <div key={day} className="flex items-center gap-3">
                <div className="w-16 text-sm font-medium text-gray-700">
                  {day}<br/><span className="text-xs text-gray-400">{dateStr.slice(5)}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-7 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full flex items-center justify-end px-2 text-xs font-medium text-white ${arrival.isHeavy ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${barWidth}%` }}
                      >
                        {arrival.count > 0 && <span className="mr-1">{arrival.count}</span>}
                      </div>
                    </div>
                    {arrival.isHeavy && <span className="text-red-500 text-sm" title="Heavy arrival day">⚠️</span>}
                  </div>
                  {departureCount > 0 && (
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <span>🚪 {departureCount} departure{departureCount !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="text-xs text-gray-500 mt-3 text-center border-t pt-2">
          📈 Bar length indicates arrival volume (max {maxArrivals}). Use this to plan daily cleaning staff needs.
        </div>
      </div>

      {/* Department Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{departments.find(d => d.value === selectedDepartment)?.icon || '🏢'}</span>
          <span className="text-sm text-blue-800">
            Currently editing: <strong>{currentDepartmentLabel}</strong> schedule
          </span>
          {selectedDepartment !== 'all' && (
            <span className="text-xs text-blue-600 ml-2">
              (Only {currentDepartmentLabel.toLowerCase()} staff are shown)
            </span>
          )}
        </div>
      </div>

      {/* Sub-Role Filter for Housekeeping */}
      {isHousekeeping && (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Filter by team:</span>
            <select
              value={subRoleFilter}
              onChange={(e) => setSubRoleFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-gray-800 text-sm"
            >
              <option value="all">👥 All Teams</option>
              {ALLOWED_SUB_ROLES.map(sub => (
                <option key={sub} value={sub}>
                  {subRoleLabels[sub]?.icon} {subRoleLabels[sub]?.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Role Filter (only when All Departments is selected) */}
      {!isHousekeeping && selectedDepartment === 'all' && (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Filter by role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-gray-800 text-sm"
            >
              <option value="all">👥 All Roles</option>
              <option value="admin">👑 Admin</option>
              <option value="manager">📊 Manager</option>
              <option value="frontdesk">🏨 Front Desk</option>
              <option value="housekeeping">🧹 Housekeeping</option>
              <option value="maintenance">🔧 Maintenance</option>
            </select>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-3">
        {daysOfWeek.map((day, idx) => {
          const date = new Date(currentWeekStart)
          date.setDate(date.getDate() + idx)
          const dateStr = date.toISOString().split('T')[0]
          const arrival = arrivalMap.get(dateStr) || { count: 0, isHeavy: false }
          const isToday = dateStr === todayDateStr
          
          let dayShifts = shifts.filter(s => s.shiftDate === dateStr)
          if (!isHousekeeping && selectedDepartment === 'all' && roleFilter !== 'all') {
            dayShifts = dayShifts.filter(shift => {
              const staffMember = allStaff.find(s => s.id === shift.staffId)
              return staffMember?.role === roleFilter
            })
          }

          return (
            <div
              key={day}
              onClick={() => openDayModal(dateStr)}
              className={`rounded-lg shadow overflow-hidden cursor-pointer hover:shadow-lg transition ${arrival.isHeavy ? 'ring-2 ring-red-400' : ''} ${isToday ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
            >
              <div className={`p-3 text-center font-semibold border-b ${isToday ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                {day}<br/><span className="text-xs">{dateStr.slice(5)}</span>
              </div>
              <div className="p-3 text-center bg-white">
                <div className="text-2xl font-bold text-gray-800">{arrival.count}</div>
                <div className="text-xs text-gray-600">Arrivals</div>
                {arrival.isHeavy && <div className="text-xs text-red-600 font-medium mt-1">⚠️ Heavy Day</div>}
              </div>
              <div className="p-2 bg-gray-50 min-h-[100px]">
                <div className="text-xs text-gray-600 mb-1">Staff ({dayShifts.length})</div>
                {dayShifts.slice(0, 3).map((s, i) => (
                  <div key={i} className={`text-xs p-1 mb-1 rounded ${getShiftColor(s.shiftTypeId)} flex justify-between items-center`}>
                    <span className="truncate">{s.staffName}</span>
                    {s.notes && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setViewingNotes({ staffName: s.staffName || '', notes: s.notes || '', shiftName: s.shiftName || '' })
                        }}
                        className="text-blue-500 hover:text-blue-700 ml-1 text-xs"
                        title="View note"
                      >
                        📝
                      </button>
                    )}
                  </div>
                ))}
                {dayShifts.length > 3 && <div className="text-xs text-gray-500">+{dayShifts.length-3} more</div>}
                {dayShifts.length === 0 && (
                  <div className="text-xs text-gray-500 text-center py-2">Tap to assign</div>
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
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold text-white">Assign Staff</h3>
                <p className="text-blue-100 text-sm mt-1">{new Date(selectedDay).toDateString()} - {currentDepartmentLabel}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white hover:text-gray-200 text-2xl leading-none">&times;</button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
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
                          {shift.notes && (
                            <div className="text-xs text-blue-600 mt-0.5">📝 {shift.notes}</div>
                          )}
                        </div>
                        <button onClick={() => removeShift(idx)} className="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-800 mb-3">➕ Available Staff</h4>
                <div className="space-y-3">
                  {getFilteredAvailableStaff().map(member => (
                    <div key={member.id} className="border border-gray-200 rounded-lg p-3 bg-white hover:bg-gray-50 transition">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <span className="font-semibold text-gray-800">{member.name}</span>
                          <span className="text-gray-500 text-sm ml-2">({member.role})</span>
                          {member.sub_role && (
                            <span className="text-xs text-blue-600 ml-2">
                              {subRoleLabels[member.sub_role]?.icon} {subRoleLabels[member.sub_role]?.label}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {shiftTypes.map(st => (
                          <button
                            key={st.id}
                            onClick={() => initiateAddShift(member.id, member.name, st.id, st.name)}
                            className={`text-sm px-3 py-1.5 rounded-full transition ${getShiftColor(st.id)} hover:opacity-80 font-medium`}
                          >
                            {st.name} ({st.start_time.slice(0,5)}-{st.end_time.slice(0,5)})
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {getFilteredAvailableStaff().length === 0 && (
                  <p className="text-gray-500 text-center py-6 bg-gray-50 rounded-lg">
                    {subRoleFilter !== 'all' ? 'No staff members in this team available' : 'All staff members are already assigned for this day'}
                  </p>
                )}
              </div>
            </div>
            
            <div className="border-t p-4 bg-gray-50 flex justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal (unchanged) */}
      {showNotesModal && pendingShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
              <h3 className="text-xl font-semibold text-white">Add Shift Note</h3>
              <p className="text-amber-100 text-sm mt-1">For {pendingShift.staffName} - {pendingShift.shiftName}</p>
            </div>
            
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shift Instructions / Notes
              </label>
              <textarea
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                placeholder="e.g., Bring training materials, Cover front desk, Special uniform required..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-gray-900"
              />
              <p className="text-xs text-gray-400 mt-2">Optional - staff will see this note in their schedule</p>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowNotesModal(false)
                    setPendingShift(null)
                    setShiftNotes('')
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAddShiftWithNotes}
                  className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
                >
                  Add Shift {shiftNotes.trim() ? 'with Note' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Notes Modal (unchanged) */}
      {viewingNotes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold text-white">Shift Note</h3>
                <p className="text-blue-100 text-sm mt-1">{viewingNotes.staffName} - {viewingNotes.shiftName}</p>
              </div>
              <button onClick={() => setViewingNotes(null)} className="text-white hover:text-gray-200 text-2xl leading-none">&times;</button>
            </div>
            
            <div className="p-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 text-lg">📝</span>
                  <p className="text-gray-700 whitespace-pre-wrap">{viewingNotes.notes}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingNotes(null)}
                className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}