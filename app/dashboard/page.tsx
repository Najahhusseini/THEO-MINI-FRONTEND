'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { getRooms, updateRoomStatus } from '@/lib/api'
import { Room } from '@/types'
import toast from 'react-hot-toast'
import AttendanceCard from '@/components/AttendanceCard'
import ShiftTracker from '@/components/ShiftTracker'
import StaffAttendanceTable from '@/components/StaffAttendanceTable'
import TabBar from '@/components/TabBar'
import RoomsTab from '@/components/RoomsTab'
import ScheduleBuilder from '@/components/ScheduleBuilder'
import MySchedule from '@/components/MySchedule'
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts'

export default function DashboardPage() {
  const { staff, logout } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('rooms')
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFloor, setSelectedFloor] = useState<number>(1)
  const [statusFilter, setStatusFilter] = useState<'all' | 'dirty' | 'cleaning' | 'ready' | 'inspected'>('all')
  const [roomSearch, setRoomSearch] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)

  useEffect(() => {
    if (!staff) {
      router.push('/login')
      return
    }
    fetchRooms()
  }, [staff, router])

  const fetchRooms = async () => {
    try {
      const data = await getRooms()
      setRooms(data)
    } catch (error) {
      toast.error('Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (roomId: string, newStatus: Room['status']) => {
    try {
      setRooms(prev =>
        prev.map(room =>
          room.id === roomId
            ? {
                ...room,
                status: newStatus,
                lastStatusChange: new Date().toISOString(),
                lastUpdatedBy: staff?.name || 'You',
                lastUpdatedRole: staff?.role || 'staff',
                lastUpdatedAt: new Date().toISOString(),
              }
            : room
        )
      )
      await updateRoomStatus(roomId, newStatus)
      toast.success('Room status updated')
    } catch (error) {
      toast.error('Failed to update status')
      fetchRooms()
    }
  }

  const handleKeyboardStatusChange = (status: string) => {
    if (selectedRoomId) {
      handleStatusChange(selectedRoomId, status as Room['status'])
    } else {
      toast.error('Tap a room first to select it, then use number keys (1-4)', { icon: '⌨️', duration: 3000 })
    }
  }

  const roomsByFloor = rooms.reduce((acc: { [key: number]: Room[] }, room) => {
    const floor = room.floor || 1
    if (!acc[floor]) acc[floor] = []
    acc[floor].push(room)
    return acc
  }, {})
  const availableFloors = Object.keys(roomsByFloor).map(Number).sort((a, b) => a - b)

  const currentFloorRooms = roomsByFloor[selectedFloor] || []
  const floorStats = {
    total: currentFloorRooms.length,
    dirty: currentFloorRooms.filter(r => r.status === 'dirty').length,
    cleaning: currentFloorRooms.filter(r => r.status === 'cleaning').length,
    ready: currentFloorRooms.filter(r => r.status === 'ready').length,
    inspected: currentFloorRooms.filter(r => r.status === 'inspected').length,
  }

  const clearFilters = () => {
    setStatusFilter('all')
    setRoomSearch('')
  }

  // Define tabs based on user role
  const getTabs = () => {
    const role = staff?.role || 'staff'
    const baseTabs = [
      { id: 'rooms', label: 'Rooms', icon: '🏠', roles: ['admin', 'manager', 'frontdesk', 'housekeeping'] },
      { id: 'shifts', label: 'My Shifts', icon: '⏱️', roles: ['admin', 'manager', 'frontdesk', 'housekeeping', 'maintenance'] },
      { id: 'tasks', label: 'Tasks', icon: '✅', roles: ['admin', 'manager', 'frontdesk', 'housekeeping', 'maintenance'] },
    ]
    
    // Schedule tab - different view for admin vs staff
    if (role === 'admin' || role === 'manager') {
      baseTabs.push({ id: 'schedule', label: 'Schedule Builder', icon: '📅', roles: ['admin', 'manager'] })
    } else {
      baseTabs.push({ id: 'schedule', label: 'My Schedule', icon: '📅', roles: ['frontdesk', 'housekeeping', 'maintenance'] })
    }
    
    if (role === 'admin' || role === 'manager') {
      baseTabs.push({ id: 'staff', label: 'Staff', icon: '👥', roles: ['admin', 'manager'] })
      baseTabs.push({ id: 'reports', label: 'Reports', icon: '📊', roles: ['admin', 'manager'] })
    }
    return baseTabs
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <KeyboardShortcuts onStatusChange={handleKeyboardStatusChange} enabled={activeTab === 'rooms'} />

      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">THEO Mini</h1>
            <p className="text-xs sm:text-sm text-gray-500">Welcome, {staff?.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="px-2 sm:px-3 py-1 bg-gray-100 rounded-full text-xs sm:text-sm">
              {staff?.role}
            </span>
            <button
              onClick={logout}
              className="px-3 sm:px-4 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Tab Bar */}
        <TabBar
          tabs={getTabs()}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          userRole={staff?.role || 'staff'}
        />

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <div>
            {/* Attendance Card and Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="lg:col-span-1">
                <AttendanceCard />
              </div>
              <div className="lg:col-span-2">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-md p-6 text-white">
                  <h3 className="text-lg font-semibold mb-2">Today's Summary</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-2xl font-bold">{rooms.length}</p>
                      <p className="text-sm opacity-90">Total Rooms</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{rooms.filter(r => r.status === 'dirty').length}</p>
                      <p className="text-sm opacity-90">Dirty</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{rooms.filter(r => r.status === 'ready').length}</p>
                      <p className="text-sm opacity-90">Ready</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{rooms.filter(r => r.status === 'inspected').length}</p>
                      <p className="text-sm opacity-90">Inspected</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rooms Tab Content */}
            <RoomsTab
              rooms={rooms}
              loading={loading}
              selectedFloor={selectedFloor}
              statusFilter={statusFilter}
              roomSearch={roomSearch}
              selectedRoomId={selectedRoomId}
              availableFloors={availableFloors}
              floorStats={floorStats}
              onFloorChange={setSelectedFloor}
              onStatusFilterChange={setStatusFilter}
              onRoomSearchChange={setRoomSearch}
              onRoomSelect={setSelectedRoomId}
              onStatusChange={handleStatusChange}
              onClearFilters={clearFilters}
            />
          </div>
        )}

        {/* My Shifts Tab */}
        {activeTab === 'shifts' && (
          <div className="max-w-3xl mx-auto">
            <ShiftTracker />
          </div>
        )}

        {/* Schedule Tab - Different view based on role */}
        {activeTab === 'schedule' && (
          <div>
            {(staff?.role === 'admin' || staff?.role === 'manager') ? (
              <ScheduleBuilder />
            ) : (
              <MySchedule />
            )}
          </div>
        )}

        {/* Tasks Tab (placeholder) */}
        {activeTab === 'tasks' && (
          <div className="text-center py-12 bg-white rounded-lg border">
            <p className="text-gray-500">Task management coming soon...</p>
          </div>
        )}

        {/* Staff Tab (admin/manager only) */}
        {activeTab === 'staff' && (staff?.role === 'admin' || staff?.role === 'manager') && (
          <StaffAttendanceTable />
        )}

        {/* Reports Tab (placeholder) */}
        {activeTab === 'reports' && (staff?.role === 'admin' || staff?.role === 'manager') && (
          <div className="text-center py-12 bg-white rounded-lg border">
            <p className="text-gray-500">Reports & analytics coming soon...</p>
          </div>
        )}
      </main>
    </div>
  )
}