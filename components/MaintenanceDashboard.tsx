'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import StickyNoteBadge from './StickyNoteBadge'

interface MaintenanceRoom {
  id: string
  room_number: string
  floor: number
  room_type: string
  out_of_order_reason: string | null
  out_of_order_since: string | null
  cleaning_status: string
  task_id: string | null
  task_status: string | null
  task_priority: string | null
  assigned_to_name: string | null
  created_by_name: string | null
  assigned_to_staff_id: string | null
  task_title: string | null
  task_description: string | null
}

export default function MaintenanceDashboard() {
  const { staff } = useAuth()
  const [rooms, setRooms] = useState<MaintenanceRoom[]>([])
  const [staffList, setStaffList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const isHead = staff?.role === 'head_maintenance' || staff?.role === 'admin' || staff?.role === 'manager'

  const loadData = async () => {
    try {
      const [roomsRes, staffRes] = await Promise.all([
        api.get('/maintenance/rooms'),
        api.get('/cleaning/staff/housekeeping')  // reuse staff endpoint; later can be filtered for maintenance only
      ])
      setRooms(roomsRes.data)
      setStaffList(staffRes.data)
    } catch (err) {
      toast.error('Failed to load maintenance data')
    } finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])

  // Save notes handler (reuses room notes API)
  const handleSaveRoomNotes = async (roomId: string, notes: string[]) => {
    try {
      await api.patch(`/rooms/${roomId}/notes`, { notes })
      toast.success('Notes updated')
      loadData()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save notes')
    }
  }

  const handleAssign = async (taskId: string, staffId: string) => {
    if (!staffId) return
    try {
      await api.post(`/maintenance/tasks/${taskId}/assign`, { staffId })
      toast.success('Assigned!')
      loadData()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Assignment failed')
    }
  }

  const handleStatusUpdate = async (taskId: string, status: string) => {
    setActionLoading(taskId)
    try {
      await api.patch(`/maintenance/tasks/${taskId}/status`, { status })
      toast.success(status === 'in_progress' ? 'Work started' : 'Work completed')
      loadData()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed')
    } finally { setActionLoading(null) }
  }

  const handleReturnToHousekeeping = async (roomId: string) => {
    if (!confirm('Return this room to housekeeping? This will mark it dirty and create a cleaning request.')) return
    try {
      await api.post(`/maintenance/rooms/${roomId}/return`)
      toast.success('Room returned to housekeeping')
      loadData()
      window.dispatchEvent(new CustomEvent('refresh-rooms'))
      window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed')
    }
  }

  const getPriorityBadge = (priority: string | null) => {
    if (!priority) return null
    const map: Record<string, string> = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[priority] || ''}`}>
        {priority.toUpperCase()}
      </span>
    )
  }

  if (loading) return <div className="text-center py-12">Loading maintenance board…</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">🔧 Maintenance Board</h2>
          <p className="text-sm text-gray-500">Out of order rooms and ongoing repairs</p>
        </div>
        <button onClick={loadData} className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">🔄 Refresh</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{rooms.length}</div>
          <div className="text-sm text-gray-500">Out of Order</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{rooms.filter(r => r.task_status === 'in_progress').length}</div>
          <div className="text-sm text-gray-500">In Progress</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{rooms.filter(r => r.task_status === 'completed').length}</div>
          <div className="text-sm text-gray-500">Completed</div>
        </div>
      </div>

      {/* Main table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="px-6 py-3 bg-gray-700 border-b border-gray-600">
          <h3 className="font-semibold text-white">🚫 Out of Order Rooms ({rooms.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reported By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rooms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">No rooms need maintenance — great job!</td>
                </tr>
              ) : (
                rooms.map(room => (
                  <tr key={room.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-800">Room {room.room_number}</div>
                      <div className="text-xs text-gray-500">{room.room_type} • Floor {room.floor}</div>
                      <StickyNoteBadge
                        notes={(room as any).notes || null}
                        onSave={async (notes) => await handleSaveRoomNotes(room.id, notes)}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">
                      {room.out_of_order_reason || '—'}
                    </td>
                    <td className="px-6 py-4">{getPriorityBadge(room.task_priority)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{room.created_by_name || '—'}</td>
                    <td className="px-6 py-4 text-sm">
                      {room.assigned_to_name ? (
                        <span className="text-gray-800 font-medium">{room.assigned_to_name}</span>
                      ) : (
                        room.task_id ? (
                          <select
                            onChange={(e) => handleAssign(room.task_id!, e.target.value)}
                            className="p-1.5 border rounded-lg text-xs bg-white"
                            defaultValue=""
                          >
                            <option value="" disabled>Assign…</option>
                            {staffList.map((s: any) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-gray-400 italic">No task</span>
                        )
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {room.task_status ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          room.task_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          room.task_status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          room.task_status === 'completed' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100'
                        }`}>
                          {room.task_status.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2 whitespace-nowrap">
                      {room.task_id && room.task_status === 'pending' && (
                        <button
                          onClick={() => handleStatusUpdate(room.task_id!, 'in_progress')}
                          disabled={actionLoading === room.task_id}
                          className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          Start
                        </button>
                      )}
                      {room.task_id && room.task_status === 'in_progress' && (
                        <button
                          onClick={() => handleStatusUpdate(room.task_id!, 'completed')}
                          disabled={actionLoading === room.task_id}
                          className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs hover:bg-green-700 transition disabled:opacity-50"
                        >
                          Complete
                        </button>
                      )}
                      {room.task_status === 'completed' && isHead && (
                        <button
                          onClick={() => handleReturnToHousekeeping(room.id)}
                          className="bg-purple-600 text-white px-3 py-1 rounded-lg text-xs hover:bg-purple-700 transition"
                        >
                          Return to Housekeeping
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}