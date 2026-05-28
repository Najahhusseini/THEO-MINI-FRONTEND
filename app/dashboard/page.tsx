'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { getRooms, updateRoomStatus } from '@/lib/api'
import { Room } from '@/types'
import toast from 'react-hot-toast'
import AttendanceCard from '@/components/AttendanceCard'
import SuppliesTab from '@/components/SuppliesTab'
import ShiftTracker from '@/components/ShiftTracker'
import StaffAttendanceTable from '@/components/StaffAttendanceTable'
import TabBar from '@/components/TabBar'
import RoomsTab from '@/components/RoomsTab'
import ScheduleBuilder from '@/components/ScheduleBuilder'
import CleaningManagementTab from '@/components/CleaningManagementTab'
import StaffMyRooms from '@/components/StaffMyRooms'
import TasksTab from '@/components/TasksTab'
import MySchedule from '@/components/MySchedule'
import SupplyRequestsTab from '@/components/SupplyRequestsTab'
import StaffSupplyRequest from '@/components/StaffSupplyRequest'
import NotificationBell from '@/components/NotificationBell'
import CleaningPerformance from '@/components/CleaningPerformance'
import ReservationTab from '@/components/ReservationTab'
import ReservationManagerDashboard from '@/components/ReservationManagerDashboard'
import EmailIngestionTab from '@/components/EmailIngestionTab'
import PriorityCleaningList from '@/components/PriorityCleaningList'
import AdminStaffManager from '@/components/AdminStaffManager'
import GuestProfilesTab from '@/components/GuestProfilesTab'
import RestaurantTab from '@/components/FoodBeverage/RestaurantTab'
import BarTab from '@/components/FoodBeverage/BarTab'
import KitchenBoard from '@/components/FoodBeverage/KitchenBoard'
import WaiterOrderPanel from '@/components/FoodBeverage/WaiterOrderPanel'
import BarBoard from '@/components/FoodBeverage/BarBoard'
import BarStaffPanel from '@/components/FoodBeverage/BarStaffPanel'
import KitchenMealPlanner from '@/components/FoodBeverage/KitchenMealPlanner'
import FinancialEventsOutbox from '@/components/FinancialEventsOutbox'
import ErrorLogsTab from '@/components/ErrorLogsTab'

import { KeyboardShortcuts } from '@/components/KeyboardShortcuts'
import { subscribeToPushNotifications, getNotificationPermission, areNotificationsSupported } from '@/lib/notifications'
import { RoomProvider } from '@/contexts/RoomContext'

export default function DashboardPage() {
  const { staff, logout, isLoading } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('rooms')
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFloor, setSelectedFloor] = useState<number>(1)
  const [statusFilter, setStatusFilter] = useState<'all' | 'dirty' | 'cleaning' | 'ready' | 'inspected'>('all')
  const [roomSearch, setRoomSearch] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false)

  useEffect(() => {
    if (isLoading) return
    if (!staff) {
      router.push('/login')
      return
    }
    if (staff.role === 'reservation_manager') {
      router.push('/reservation-manager')
      return
    }
    fetchRooms()
  }, [staff, isLoading, router])

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

  useEffect(() => {
    if (!areNotificationsSupported()) return
    if (getNotificationPermission() === 'default') {
      setShowNotificationPrompt(true)
    }
  }, [])

  const enableNotifications = async () => {
    const success = await subscribeToPushNotifications()
    if (success) {
      setShowNotificationPrompt(false)
      toast.success('Notifications enabled! You will receive schedule updates.')
    } else {
      toast.error('Could not enable notifications. Please check browser settings.')
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

  const getTabs = () => {
    const role = staff?.role || 'staff'
    const baseTabs = [
      { id: 'rooms', label: '🏠 Rooms', icon: '🏠', roles: ['admin', 'manager', 'frontdesk', 'housekeeping', 'head_housekeeping'] },
      { id: 'reservations', label: '📅 Reservations', icon: '📅', roles: ['admin', 'manager', 'frontdesk'] },
      { id: 'shifts', label: '⏱️ My Shifts', icon: '⏱️', roles: ['admin', 'manager', 'frontdesk', 'housekeeping', 'maintenance', 'head_housekeeping'] },
      { id: 'tasks', label: '✅ Tasks', icon: '✅', roles: ['admin', 'manager', 'frontdesk', 'housekeeping', 'maintenance', 'head_housekeeping'] },
    ]
    
    if (['admin', 'manager', 'reservation_manager'].includes(role)) {
      baseTabs.push({ id: 'email-ingestion', label: '📧 Email Inbox', icon: '📧', roles: ['admin', 'manager', 'reservation_manager'] })
    }
    
    if (role === 'admin' || role === 'manager' || role === 'head_housekeeping') {
      baseTabs.push({ id: 'cleaning', label: '🧼 Cleaning Board', icon: '🧹', roles: ['admin', 'manager', 'head_housekeeping'] })
    } else if (role === 'housekeeping') {
      baseTabs.push({ id: 'my-rooms', label: '🧹 My Rooms', icon: '🧹', roles: ['housekeeping'] })
    }

    if (['housekeeping', 'head_housekeeping', 'admin', 'manager'].includes(role)) {
      baseTabs.push({ id: 'priority-cleaning', label: '🧹 Priority Cleaning', icon: '🧹', roles: ['housekeeping', 'head_housekeeping', 'admin', 'manager'] })
    }
    
    if (role === 'admin' || role === 'manager' || role === 'head_housekeeping') {
      baseTabs.push({ id: 'schedule', label: '📅 Schedule Builder', icon: '📅', roles: ['admin', 'manager', 'head_housekeeping'] })
    } else {
      baseTabs.push({ id: 'schedule', label: '📅 My Schedule', icon: '📅', roles: ['frontdesk', 'housekeeping', 'maintenance'] })
    }
    
    if (role === 'admin' || role === 'manager' || role === 'head_housekeeping') {
      baseTabs.push({ id: 'supplies', label: '📦 Supplies', icon: '📦', roles: ['admin', 'manager', 'head_housekeeping'] })
    }
    
    if (role === 'admin' || role === 'manager' || role === 'head_housekeeping') {
      baseTabs.push({ id: 'supply-requests', label: '📋 Supply Requests', icon: '📋', roles: ['admin', 'manager', 'head_housekeeping'] })
    }
    
    if (role === 'housekeeping') {
      baseTabs.push({ id: 'staff-supply', label: '📦 Request Supplies', icon: '📦', roles: ['housekeeping'] })
    }
    
    if (role === 'head_housekeeping') {
      baseTabs.push({ id: 'performance', label: '📊 Performance', icon: '📊', roles: ['head_housekeeping'] })
    }
    
    if (role === 'admin' || role === 'manager') {
      baseTabs.push({ id: 'staff', label: '👥 Staff', icon: '👥', roles: ['admin', 'manager'] })
      baseTabs.push({ id: 'guests', label: '🛎️ Guests', icon: '🛎️', roles: ['admin', 'manager', 'frontdesk', 'reservation_manager'] })
      baseTabs.push({ id: 'reports', label: '📊 Reports', icon: '📊', roles: ['admin', 'manager'] })
      baseTabs.push({ id: 'reservations-admin', label: '📅 Reservations (Admin)', icon: '📅', roles: ['admin', 'manager'] })
      baseTabs.push({ id: 'financial-outbox', label: '💰 Financial Outbox', icon: '💰', roles: ['admin', 'manager'] })
      // ✅ NEW: Error Logs tab
      baseTabs.push({ id: 'error-logs', label: '📋 Error Logs', icon: '📋', roles: ['admin', 'manager'] })
    }

    if (role === 'reservation_manager') {
      baseTabs.push({ id: 'guests', label: '🛎️ Guests', icon: '🛎️', roles: ['reservation_manager'] })
    }

    // ✅ Role‑based F&B tabs (kitchen & bar)
    if (role === 'kitchen_head') {
      baseTabs.push({ id: 'kitchen-board', label: '🍳 Kitchen Board', icon: '🍳', roles: ['kitchen_head'] })
      baseTabs.push({ id: 'kitchen-meal-planner', label: '🥘 Meal Plans', icon: '🥘', roles: ['kitchen_head'] })
    }
    if (role === 'kitchen_staff') {
      baseTabs.push({ id: 'waiter-orders', label: '🍽️ My Waiter Orders', icon: '🍽️', roles: ['kitchen_staff'] })
      baseTabs.push({ id: 'kitchen-meal-planner', label: '🥘 Meal Plans', icon: '🥘', roles: ['kitchen_staff'] })
    }
    if (role === 'bar_head') {
      baseTabs.push({ id: 'bar-board', label: '🍸 Bar Board', icon: '🍸', roles: ['bar_head'] })
    }
    if (role === 'bar_staff') {
      baseTabs.push({ id: 'bar-staff-orders', label: '🍸 My Bar Orders', icon: '🍸', roles: ['bar_staff'] })
    }

    // ✅ Amenity‑based tabs (admin/manager/frontdesk overview)
    const amenities: string[] = staff?.amenities || []
    if (amenities.includes('Restaurant')) {
      baseTabs.push({ id: 'restaurant', label: '🍽️ Restaurant Overview', icon: '🍽️', roles: ['admin', 'manager', 'frontdesk'] })
    }
    if (amenities.includes('Bar')) {
      baseTabs.push({ id: 'bar', label: '🍸 Bar Overview', icon: '🍸', roles: ['admin', 'manager', 'frontdesk'] })
    }
    if (amenities.includes('Room Service')) {
      baseTabs.push({ id: 'room-service', label: '🛎️ Room Service', icon: '🛎️', roles: ['admin', 'manager', 'frontdesk'] })
    }
    if (amenities.includes('Pool')) {
      baseTabs.push({ id: 'pool', label: '🏊 Pool', icon: '🏊', roles: ['admin', 'manager', 'frontdesk'] })
    }
    if (amenities.includes('Spa')) {
      baseTabs.push({ id: 'spa', label: '💆 Spa', icon: '💆', roles: ['admin', 'manager', 'frontdesk'] })
    }
    
    return baseTabs
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <RoomProvider>
      <div className="min-h-screen bg-gray-50">
        <KeyboardShortcuts onStatusChange={handleKeyboardStatusChange} enabled={activeTab === 'rooms'} />

        <header className="bg-white shadow-sm border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">THEO Mini</h1>
              <p className="text-xs sm:text-sm text-gray-500">Welcome, {staff?.name}</p>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <span className="px-2 sm:px-3 py-1 bg-gray-100 rounded-full text-xs sm:text-sm">
                {staff?.role === 'head_housekeeping' ? 'Head of Housekeeping' : staff?.role === 'housekeeping' ? 'Housekeeping Staff' : staff?.role}
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
          {showNotificationPrompt && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-amber-600 text-xl">🔔</span>
                <div>
                  <p className="text-sm text-amber-800 font-medium">Get schedule notifications</p>
                  <p className="text-xs text-amber-600">Receive alerts when new schedules are published</p>
                </div>
              </div>
              <button
                onClick={enableNotifications}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm"
              >
                Enable Notifications
              </button>
            </div>
          )}

          <TabBar
            tabs={getTabs()}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            userRole={staff?.role || 'staff'}
          />

          {activeTab === 'rooms' && (
            <div>
              <div className="mb-8">
                <AttendanceCard />
              </div>
              <RoomsTab />
            </div>
          )}

          {activeTab === 'reservations' && <ReservationTab />}
          {activeTab === 'reservations-admin' && <ReservationManagerDashboard standalone={false} />}
          {activeTab === 'email-ingestion' && <EmailIngestionTab />}
          {activeTab === 'shifts' && <div className="max-w-3xl mx-auto"><ShiftTracker /></div>}
          {activeTab === 'schedule' && (
            <div>
              {(staff?.role === 'admin' || staff?.role === 'manager' || staff?.role === 'head_housekeeping') ? (
                <ScheduleBuilder />
              ) : (
                <MySchedule />
              )}
            </div>
          )}
          {activeTab === 'cleaning' && <CleaningManagementTab />}
          {activeTab === 'my-rooms' && <StaffMyRooms />}
          {activeTab === 'priority-cleaning' && <PriorityCleaningList />}
          {activeTab === 'tasks' && <TasksTab />}
          {activeTab === 'supplies' && <SuppliesTab />}
          {activeTab === 'supply-requests' && (staff?.role === 'admin' || staff?.role === 'manager' || staff?.role === 'head_housekeeping') && <SupplyRequestsTab />}
          {activeTab === 'staff-supply' && staff?.role === 'housekeeping' && <StaffSupplyRequest />}
          {activeTab === 'performance' && staff?.role === 'head_housekeeping' && <CleaningPerformance />}
          {activeTab === 'staff' && (staff?.role === 'admin' || staff?.role === 'manager') && (
            <div className="space-y-8">
              <StaffAttendanceTable />
              <AdminStaffManager />
            </div>
          )}
          {activeTab === 'guests' && (['admin', 'manager', 'frontdesk', 'reservation_manager'].includes(staff?.role || '')) && <GuestProfilesTab />}
          {activeTab === 'reports' && (staff?.role === 'admin' || staff?.role === 'manager') && (
            <div className="text-center py-12 bg-white rounded-lg border">
              <p className="text-gray-500">Reports & analytics coming soon...</p>
            </div>
          )}
          {activeTab === 'financial-outbox' && (staff?.role === 'admin' || staff?.role === 'manager') && <FinancialEventsOutbox />}
          {activeTab === 'error-logs' && (staff?.role === 'admin' || staff?.role === 'manager') && <ErrorLogsTab />}

          {/* ✅ Role‑based F&B components */}
          {activeTab === 'kitchen-board' && <KitchenBoard />}
          {activeTab === 'kitchen-meal-planner' && <KitchenMealPlanner />}
          {activeTab === 'waiter-orders' && <WaiterOrderPanel />}
          {activeTab === 'bar-board' && <BarBoard />}
          {activeTab === 'bar-staff-orders' && <BarStaffPanel />}

          {/* ✅ Admin/Manager overviews (amenity‑based) */}
          {activeTab === 'restaurant' && <RestaurantTab />}
          {activeTab === 'bar' && <BarTab />}

          {/* Placeholders for other amenities */}
          {activeTab === 'room-service' && (
            <div className="text-center py-12 bg-white rounded-lg border">
              <p className="text-gray-500">🛎️ Room Service module coming soon</p>
            </div>
          )}
          {activeTab === 'pool' && (
            <div className="text-center py-12 bg-white rounded-lg border">
              <p className="text-gray-500">🏊 Pool module coming soon</p>
            </div>
          )}
          {activeTab === 'spa' && (
            <div className="text-center py-12 bg-white rounded-lg border">
              <p className="text-gray-500">💆 Spa module coming soon</p>
            </div>
          )}
        </main>
      </div>
    </RoomProvider>
  )
}