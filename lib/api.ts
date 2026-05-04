import axios from 'axios'

const API_BASE_URL = 'http://localhost:4000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle token refresh on 401 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          })
          const { accessToken } = response.data
          localStorage.setItem('accessToken', accessToken)
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        } catch (refreshError) {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          window.location.href = '/login'
        }
      } else {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// ============ AUTH APIs ============
export const login = async (email: string, password: string, subdomain: string) => {
  const response = await api.post('/auth/login', { email, password, subdomain })
  return response.data
}

export const getCurrentStaff = async () => {
  const response = await api.get('/auth/me')
  return response.data
}

// ============ ROOM APIs ============
export const getRooms = async () => {
  const response = await api.get('/rooms')
  return response.data
}

export const updateRoomStatus = async (roomId: string, status: string) => {
  const response = await api.patch(`/rooms/${roomId}/status`, { status })
  return response.data
}

// ============ ATTENDANCE APIs ============
export const clockIn = async () => {
  const response = await api.post('/attendance/clock-in')
  return response.data
}

export const clockOut = async () => {
  const response = await api.post('/attendance/clock-out')
  return response.data
}

export const getAttendanceStatus = async () => {
  const response = await api.get('/attendance/status')
  return response.data
}

export const getTodayAttendance = async () => {
  const response = await api.get('/attendance/today')
  return response.data
}

export const getWeeklyHours = async () => {
  const response = await api.get('/attendance/weekly-hours')
  return response.data
}

export const getShiftHistory = async (days: number = 30) => {
  const response = await api.get(`/attendance/history?days=${days}`)
  return response.data
}

export const requestTimeOff = async (startDate: string, endDate: string, reason: string) => {
  const response = await api.post('/attendance/time-off', { startDate, endDate, reason })
  return response.data
}

export const getTimeOffRequests = async (status?: string) => {
  const url = status ? `/attendance/time-off-requests?status=${status}` : '/attendance/time-off-requests'
  const response = await api.get(url)
  return response.data
}

export const updateTimeOffRequest = async (id: string, status: string) => {
  const response = await api.patch(`/attendance/time-off-requests/${id}`, { status })
  return response.data
}

export const clockInWithLocation = async (location?: string, deviceInfo?: string) => {
  const response = await api.post('/attendance/clock-in', { location, deviceInfo })
  return response.data
}

// ============ SCHEDULE APIs ============
export const getShiftTypes = async () => {
  const response = await api.get('/schedule/shift-types')
  return response.data
}

export const getScheduleStaff = async (role?: string) => {
  const url = role ? `/schedule/staff?role=${role}` : '/schedule/staff'
  const response = await api.get(url)
  return response.data
}

export const getWeeklySchedule = async (weekStart: string, department?: string) => {
  const url = department ? `/schedule/weekly/${weekStart}?department=${department}` : `/schedule/weekly/${weekStart}`
  const response = await api.get(url)
  return response.data
}

export const saveScheduleShifts = async (scheduleId: string, shifts: any[]) => {
  const response = await api.post('/schedule/save', { scheduleId, shifts })
  return response.data
}

export const publishSchedule = async (scheduleId: string) => {
  const response = await api.post(`/schedule/publish/${scheduleId}`)
  return response.data
}

export const getMySchedule = async (weekStart?: string) => {
  const url = weekStart ? `/schedule/my-schedule?weekStart=${weekStart}` : '/schedule/my-schedule'
  const response = await api.get(url)
  return response.data
}

export const getExpectedArrivals = async (weekStart: string) => {
  const response = await api.get(`/schedule/arrivals/${weekStart}`)
  return response.data
}

// ============ CLEANING APIs ============

// --- Head of Housekeeping / Management APIs ---
export const getRoomsWithCleaning = async () => {
  const response = await api.get('/cleaning/rooms')
  return response.data
}

export const getHousekeepingStaff = async () => {
  const response = await api.get('/cleaning/staff/housekeeping')
  return response.data
}

export const getAvailableCleaningStaff = async () => {
  const response = await api.get('/cleaning/staff/available')
  return response.data
}

export const upsertCleaningRequest = async (roomId: string, type: string = 'stay_over', notes?: string) => {
  const response = await api.post('/cleaning/request', { roomId, type, notes })
  return response.data
}

export const assignCleaning = async (requestId: string, assignedTo: string) => {
  const response = await api.post('/cleaning/assign', { requestId, assignedTo })
  return response.data
}

export const updateRoomCleaningStatus = async (roomId: string, cleaningStatus: string) => {
  const response = await api.patch(`/cleaning/rooms/${roomId}/status`, { cleaningStatus })
  return response.data
}

export const completeCleaning = async (requestId: string) => {
  const response = await api.post('/cleaning/complete', { requestId })
  return response.data
}

export const ensureCheckoutRequests = async () => {
  const response = await api.post('/cleaning/ensure-checkouts')
  return response.data
}

export const ensureDirtyRoomRequests = async () => {
  const response = await api.post('/cleaning/ensure-dirty-requests')
  return response.data
}

export const getCleaningStats = async () => {
  const response = await api.get('/cleaning/daily-stats')
  return response.data
}

export const getCompletedCleaningTasks = async () => {
  const response = await api.get('/cleaning/completed-tasks')
  return response.data
}

// --- Cleaning Staff APIs (My Work) ---
export const getMyCleaningTasks = async () => {
  const response = await api.get('/cleaning/my-tasks')
  return response.data
}

export const getMyAssignedRooms = async () => {
  const response = await api.get('/cleaning/my-rooms')
  return response.data
}

export const updateCleaningTaskStatus = async (requestId: string, status: 'accepted' | 'in_progress' | 'completed') => {
  const response = await api.patch(`/cleaning/tasks/${requestId}/status`, { status })
  return response.data
}

export const releaseRoom = async (roomId: string) => {
  const response = await api.post(`/cleaning/rooms/${roomId}/release`)
  return response.data
}

export const reassignRoom = async (roomId: string, newStaffId: string) => {
  const response = await api.patch(`/cleaning/rooms/${roomId}/reassign`, { newStaffId })
  return response.data
}

export const getTaskMessages = async (requestId: string) => {
  const response = await api.get(`/cleaning/tasks/${requestId}/messages`)
  return response.data
}

export const sendTaskMessage = async (requestId: string, message: string) => {
  const response = await api.post(`/cleaning/tasks/${requestId}/messages`, { message })
  return response.data
}

export const requestSuppliesForTask = async (requestId: string, itemName: string, quantity: number, notes?: string) => {
  const response = await api.post(`/cleaning/tasks/${requestId}/supplies`, { itemName, quantity, notes })
  return response.data
}

// --- Do Not Disturb ---
export const updateRoomDoNotDisturb = async (roomId: string, doNotDisturb: boolean) => {
  const response = await api.patch(`/cleaning/rooms/${roomId}/dnd`, { doNotDisturb })
  return response.data
}

export const markRoomAwaitingGuest = async (roomId: string) => {
  const response = await api.patch(`/cleaning/rooms/${roomId}/awaiting`)
  return response.data
}

// --- Out of Order APIs ---
export const setRoomOutOfOrder = async (roomId: string, reason: string) => {
  const response = await api.post(`/cleaning/rooms/${roomId}/out-of-order`, { reason })
  return response.data
}

export const removeRoomOutOfOrder = async (roomId: string) => {
  const response = await api.delete(`/cleaning/rooms/${roomId}/out-of-order`)
  return response.data
}

export const getOutOfOrderRooms = async () => {
  const response = await api.get('/cleaning/out-of-order')
  return response.data
}

// --- Legacy / Compatability APIs ---
export const getPendingCleaning = async () => {
  const response = await api.get('/cleaning/pending')
  return response.data
}

export const getCheckoutCounts = async (weekStart: string) => {
  const response = await api.get(`/cleaning/checkouts/${weekStart}`)
  return response.data
}

export const requestStayOverCleaning = async (roomId: string, notes?: string, type: string = 'stay_over') => {
  const response = await api.post('/cleaning/request', { roomId, notes, type })
  return response.data
}

export const getCleaningRequestsBySubRole = async (subRole: string) => {
  const response = await api.get(`/cleaning/by-subrole/${subRole}`)
  return response.data
}

export const getCheckoutCleaning = async () => {
  const response = await api.get('/cleaning/checkout')
  return response.data
}

export const getStayOverCleaning = async () => {
  const response = await api.get('/cleaning/stayover')
  return response.data
}

// ============ TASKS APIs ============
export const createTask = async (data: {
  title: string
  description: string
  assignedTo?: string
  priority?: string
  dueDate?: string
  mentions?: string[]
}) => {
  const response = await api.post('/tasks', data)
  return response.data
}

export const getTasks = async (assignedTo?: string, status?: string) => {
  let url = '/tasks'
  const params = new URLSearchParams()
  if (assignedTo) params.append('assignedTo', assignedTo)
  if (status && status !== 'all') params.append('status', status)
  if (params.toString()) url += `?${params.toString()}`
  const response = await api.get(url)
  return response.data
}

export const updateTaskStatus = async (taskId: string, status: string) => {
  const response = await api.patch(`/tasks/${taskId}/status`, { status })
  return response.data
}

export const completeInspectionTask = async (taskId: string) => {
  const response = await api.patch(`/tasks/${taskId}/inspect-complete`)
  return response.data
}

// ============ SUPPLIES APIs ============
export const getSupplyItems = async (category?: string) => {
  const url = category ? `/supplies?category=${category}` : '/supplies'
  const response = await api.get(url)
  return response.data
}

export const getLowStockItems = async () => {
  const response = await api.get('/supplies/low-stock')
  return response.data
}

export const createSupplyItem = async (data: {
  categoryId: string
  name: string
  itemsPerBox: number
  initialBoxes: number
  minThresholdItems: number
}) => {
  const response = await api.post('/supplies', data)
  return response.data
}

export const adjustStock = async (itemId: string, quantityBoxes: number, reason: string, referenceType?: string, referenceId?: string) => {
  const response = await api.post(`/supplies/${itemId}/adjust`, { quantityBoxes, reason, referenceType, referenceId })
  return response.data
}

export const getTransactionHistory = async (itemId: string, limit?: number) => {
  const url = limit ? `/supplies/${itemId}/history?limit=${limit}` : `/supplies/${itemId}/history`
  const response = await api.get(url)
  return response.data
}

// ============ RESERVATION APIs ============

export interface CreateReservationData {
    guest_name: string
    guest_email?: string
    guest_phone?: string
    arrival_date: string
    departure_date: string
    room_type: string
    number_of_guests?: number
    number_of_rooms?: number
    special_requests?: string
}

export const createReservation = async (data: CreateReservationData) => {
    const response = await api.post('/reservations', data)
    return response.data
}

export const getReservations = async (filters?: {
    status?: string
    start_date?: string
    end_date?: string
    room_type?: string
}) => {
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.start_date) params.append('start_date', filters.start_date)
    if (filters?.end_date) params.append('end_date', filters.end_date)
    if (filters?.room_type) params.append('room_type', filters.room_type)
    
    const url = params.toString() ? `/reservations?${params.toString()}` : '/reservations'
    const response = await api.get(url)
    return response.data
}

export const getReservationById = async (id: string) => {
    const response = await api.get(`/reservations/${id}`)
    return response.data
}

export const updateReservation = async (id: string, data: Partial<CreateReservationData & { status: string }>) => {
    const response = await api.put(`/reservations/${id}`, data)
    return response.data
}

export const confirmReservation = async (id: string) => {
    const response = await api.post(`/reservations/${id}/confirm`)
    return response.data
}

export const cancelReservation = async (id: string) => {
    const response = await api.post(`/reservations/${id}/cancel`)
    return response.data
}

export const checkConflicts = async (data: {
    arrival_date: string
    departure_date: string
    room_type: string
    exclude_id?: string
}) => {
    const response = await api.post('/reservations/check-conflicts', data)
    return response.data
}

export const getCalendarData = async (start_date: string, end_date: string) => {
    const response = await api.get(`/reservations/calendar?start_date=${start_date}&end_date=${end_date}`)
    return response.data
}

// ============ EMAIL INGESTION APIs ==========

export const getEmails = async (status?: string) => {
    const url = status ? `/emails?status=${status}` : '/emails'
    const response = await api.get(url)
    return response.data
}

export const updateEmailParsedData = async (emailId: string, parsedData: any) => {
    const response = await api.put(`/emails/${emailId}/parsed`, parsedData)
    return response.data
}

export const processEmail = async (emailId: string, createReservation: boolean, reservationData?: any) => {
    const response = await api.post(`/emails/${emailId}/process`, { createReservation, reservationData })
    return response.data
}

// ============ STAYS APIs ===========
export const getStays = async () => {
  const response = await api.get('/reservations/stays')
  return response.data
}

export const checkInStay = async (stayId: string) => {
  const response = await api.post(`/reservations/stays/${stayId}/check-in`)
  return response.data
}

// ✨ NEW: Move a stay to a different room (for guest reassignment)
export const moveStayToRoom = async (stayId: string, roomNumber: string) => {
  const response = await api.patch(`/reservations/stays/${stayId}/move-room`, { roomNumber })
  return response.data
}

export default api