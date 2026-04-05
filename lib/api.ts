import axios from 'axios'

const API_BASE_URL = 'http://192.168.8.206:4000/api'

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

export const getScheduleStaff = async () => {
  const response = await api.get('/schedule/staff')
  return response.data
}

export const getWeeklySchedule = async (weekStart: string) => {
  const response = await api.get(`/schedule/weekly/${weekStart}`)
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

export default api