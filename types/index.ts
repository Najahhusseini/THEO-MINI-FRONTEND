export interface Staff {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'frontdesk' | 'housekeeping' | 'maintenance'
  tenantId: string
}

export interface Room {
  id: string
  roomNumber: string
  floor: number
  roomType: string
  status: 'dirty' | 'cleaning' | 'ready' | 'inspected'
  lastStatusChange: string
  lastUpdatedBy: string
  lastUpdatedRole: string
  lastUpdatedAt: string
}

export interface Task {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'escalated'
  priority: 'low' | 'medium' | 'high'
  assignedToStaffId: string
  roomId: string
  createdAt: string
}

export interface Attendance {
  id: string
  staffId: string
  clockIn: string
  clockOut: string
}