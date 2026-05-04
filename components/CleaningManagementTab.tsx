'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRooms } from '@/contexts/RoomContext'
import {
  getHousekeepingStaff,
  upsertCleaningRequest,
  assignCleaning,
  completeCleaning,
  updateCleaningTaskStatus,
  getStays
} from '@/lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

interface Room {
  id: string
  room_number: string
  floor: number
  room_type: string
  cleaning_status: 'dirty' | 'cleaning' | 'ready' | 'inspected' | 'awaiting'
  guest_name: string
  cleaning_request_id?: string
  request_status?: string
  request_type?: 'stay_over' | 'checkout'
  assigned_to_name?: string
  assigned_to_id?: string
  out_of_order?: boolean
  out_of_order_reason?: string
}

interface Staff {
  id: string
  name: string
  sub_role?: string
}

type OccupancyInfo = {
  status: 'occupied' | 'reserved' | 'vacant' | 'arriving_today'
  guest_name?: string
}

export default function CleaningManagementTab() {
  const { staff } = useAuth()
  const { rooms, loading, refreshRooms } = useRooms()
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [assigning, setAssigning] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [occupancyMap, setOccupancyMap] = useState<Record<string, OccupancyInfo>>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const isHead = staff?.role === 'head_housekeeping' || staff?.role === 'admin' || staff?.role === 'manager'

  // Load staff list and occupancy data
  useEffect(() => {
    if (!isHead) return
    getHousekeepingStaff()
      .then(data => setStaffList(data))
      .catch(() => toast.error('Failed to load staff'))
  }, [isHead])

  useEffect(() => {
    const fetchOccupancy = async () => {
      try {
        const stays = await getStays()
        const today = format(new Date(), 'yyyy-MM-dd')
        const map: Record<string, OccupancyInfo> = {}
        for (const s of stays) {
          const num = s.room_number
          const arr = s.arrival_date.split('T')[0]
          const dep = s.departure_date.split('T')[0]
          if (arr <= today && dep >= today && s.status !== 'checked_out') {
            if (s.status === 'checked_in')
              map[num] = { status: 'occupied', guest_name: s.guest_name }
            else if (arr === today)
              map[num] = { status: 'arriving_today', guest_name: s.guest_name }
            else
              map[num] = { status: 'occupied', guest_name: s.guest_name }
          } else if (arr > today && !map[num]) {
            map[num] = { status: 'reserved', guest_name: s.guest_name }
          }
        }
        // fill vacant for rooms not in map
        for (const room of rooms) {
          if (!map[room.room_number]) map[room.room_number] = { status: 'vacant' }
        }
        setOccupancyMap(map)
      } catch (err) {
        console.error('Occupancy fetch failed', err)
      }
    }
    if (rooms.length > 0) fetchOccupancy()
  }, [rooms])

  // ── split rooms ──
  const inHouse = rooms.filter(r => {
    if (r.out_of_order) return false
    const occ = occupancyMap[r.room_number]
    return occ?.status === 'occupied' || occ?.status === 'arriving_today'
  })

  const checkout = rooms.filter(r => {
    if (r.out_of_order) return false
    const occ = occupancyMap[r.room_number]
    // vacant rooms that are dirty or need cleaning
    return (occ?.status === 'vacant' || occ?.status === 'reserved') && r.cleaning_status !== 'ready' && r.cleaning_status !== 'inspected' && r.cleaning_status !== 'awaiting'
  })

  // ── helper to ensure a cleaning request exists ──
  const ensureRequest = async (room: Room) => {
    if (room.cleaning_request_id) return room.cleaning_request_id
    try {
      const type = occupancyMap[room.room_number]?.status === 'occupied' ? 'stay_over' : 'checkout'
      const req = await upsertCleaningRequest(room.id, type)
      return req.id
    } catch {
      return null
    }
  }

  // ── actions ──
  const handleAssignClick = async (room: Room) => {
    const reqId = await ensureRequest(room)
    if (!reqId) {
      toast.error('Could not create cleaning request')
      return
    }
    setSelectedRoom({ ...room, cleaning_request_id: reqId })
    setShowAssignModal(true)
  }

  const handleAssign = async () => {
    if (!selectedRoom || !selectedStaffId) return
    setAssigning(true)
    try {
      const reqId = await ensureRequest(selectedRoom)
      if (!reqId) throw new Error('No request')
      await assignCleaning(reqId, selectedStaffId)
      toast.success(`Assigned to ${staffList.find(s => s.id === selectedStaffId)?.name}`)
      setShowAssignModal(false)
      refreshRooms()
      window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
    } catch (err: any) {
      toast.error(err.message || 'Assignment failed')
    } finally {
      setAssigning(false)
    }
  }

  const handleComplete = async (room: Room) => {
    if (!room.cleaning_request_id) return
    setActionLoading(room.id)
    try {
      await completeCleaning(room.cleaning_request_id)
      toast.success(`Room ${room.room_number} completed`)
      refreshRooms()
      window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleStart = async (room: Room) => {
    if (!room.cleaning_request_id) return
    setActionLoading(room.id)
    try {
      await updateCleaningTaskStatus(room.cleaning_request_id, 'in_progress')
      toast.success(`Started ${room.room_number}`)
      refreshRooms()
      window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed')
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'dirty': return 'bg-red-100 text-red-800'
      case 'cleaning': return 'bg-yellow-100 text-yellow-800'
      case 'ready': return 'bg-green-100 text-green-800'
      case 'inspected': return 'bg-blue-100 text-blue-800'
      case 'awaiting': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100'
    }
  }

  const getOccBadge = (info: OccupancyInfo) => {
    switch (info.status) {
      case 'occupied': return <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800">Occupied</span>
      case 'arriving_today': return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800">Arriving Today</span>
      case 'reserved': return <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800">Reserved</span>
      default: return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">Vacant</span>
    }
  }

  if (loading) return <div className="text-center py-12">Loading cleaning board…</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">🧼 Cleaning Management Board</h2>
          <p className="text-sm text-gray-500">In‑House & Checkout rooms that need attention</p>
        </div>
        <button onClick={refreshRooms} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">🔄 Refresh</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{inHouse.length}</div>
          <div className="text-sm text-gray-500">In‑House Rooms</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{checkout.length}</div>
          <div className="text-sm text-gray-500">Checkout Cleaning</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{rooms.filter(r => r.cleaning_status === 'ready' && !r.out_of_order).length}</div>
          <div className="text-sm text-gray-500">Ready for Inspection</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-gray-600">{rooms.filter(r => r.out_of_order).length}</div>
          <div className="text-sm text-gray-500">Out of Order</div>
        </div>
      </div>

      {/* In‑House Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
          <h3 className="font-semibold text-blue-800">🛏️ In‑House Cleaning ({inHouse.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Room</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Guest</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Cleaning</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Assigned To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {inHouse.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-500">No occupied rooms</td></tr>
              ) : (
                inHouse.map(room => {
                  const occ = occupancyMap[room.room_number] || { status: 'vacant' }
                  return (
                    <tr key={room.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium">Room {room.room_number}</div>
                        <div className="text-xs text-gray-500">{room.room_type} • Floor {room.floor}</div>
                      </td>
                      <td className="px-6 py-4">{occ.guest_name || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(room.cleaning_status)}`}>
                          {room.cleaning_status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">{room.assigned_to_name || '—'}</td>
                      <td className="px-6 py-4 space-x-2">
                        {!room.cleaning_request_id || room.request_status === 'pending' ? (
                          <button
                            onClick={() => handleAssignClick(room)}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                          >
                            Assign
                          </button>
                        ) : room.request_status === 'in_progress' ? (
                          <button
                            onClick={() => handleComplete(room)}
                            disabled={actionLoading === room.id}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                          >
                            Complete
                          </button>
                        ) : room.request_status === 'assigned' && room.assigned_to_id === staff?.id ? (
                          <button
                            onClick={() => handleStart(room)}
                            disabled={actionLoading === room.id}
                            className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                          >
                            Start
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Checkout Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-3 bg-orange-50 border-b border-orange-200">
          <h3 className="font-semibold text-orange-800">🚪 Checkout Cleaning ({checkout.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Room</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Occupancy</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Cleaning</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Assigned To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {checkout.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-500">No checkout rooms need cleaning</td></tr>
              ) : (
                checkout.map(room => {
                  const occ = occupancyMap[room.room_number] || { status: 'vacant' }
                  return (
                    <tr key={room.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium">Room {room.room_number}</div>
                        <div className="text-xs text-gray-500">{room.room_type} • Floor {room.floor}</div>
                      </td>
                      <td className="px-6 py-4">{getOccBadge(occ)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(room.cleaning_status)}`}>
                          {room.cleaning_status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">{room.assigned_to_name || '—'}</td>
                      <td className="px-6 py-4 space-x-2">
                        {!room.cleaning_request_id || room.request_status === 'pending' ? (
                          <button
                            onClick={() => handleAssignClick(room)}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                          >
                            Assign
                          </button>
                        ) : room.request_status === 'in_progress' ? (
                          <button
                            onClick={() => handleComplete(room)}
                            disabled={actionLoading === room.id}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                          >
                            Complete
                          </button>
                        ) : room.request_status === 'assigned' && room.assigned_to_id === staff?.id ? (
                          <button
                            onClick={() => handleStart(room)}
                            disabled={actionLoading === room.id}
                            className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                          >
                            Start
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Out of Order */}
      {rooms.filter(r => r.out_of_order).length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-3 bg-gray-700 border-b border-gray-600">
            <h3 className="font-semibold text-white">🚫 Out of Order ({rooms.filter(r => r.out_of_order).length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Room</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rooms.filter(r => r.out_of_order).map(room => (
                  <tr key={room.id} className="bg-gray-100">
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      Room {room.room_number}
                      <div className="text-xs text-gray-500">{room.room_type} • Floor {room.floor}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-red-600">{room.out_of_order_reason}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full text-xs bg-gray-500 text-white">OUT OF ORDER</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-xl">
              <h3 className="text-xl font-semibold text-white">Assign Cleaning</h3>
              <p className="text-blue-100">Room {selectedRoom.room_number}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Staff Member</label>
                <select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)} className="w-full p-2 border rounded">
                  <option value="">Select…</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowAssignModal(false)} className="flex-1 px-4 py-2 border rounded">Cancel</button>
                <button onClick={handleAssign} disabled={!selectedStaffId || assigning} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
                  {assigning ? 'Assigning…' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}