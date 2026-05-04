'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRooms } from '@/contexts/RoomContext'
import {
  getMyAssignedRooms,
  updateCleaningTaskStatus,
  releaseRoom,
  upsertCleaningRequest,
  assignCleaning,
  getStays,
  getReservations
} from '@/lib/api'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'

type OccupancyInfo = {
  status: 'occupied' | 'reserved' | 'vacant' | 'arriving_today'
  guest_name?: string
  arrival_date?: string
  departure_date?: string
}

export default function StaffMyRooms() {
  const { staff } = useAuth()
  const { rooms, loading, refreshRooms } = useRooms()
  const [myRooms, setMyRooms] = useState<any[]>([])
  const [updating, setUpdating] = useState<string | null>(null)
  const [showReleaseModal, setShowReleaseModal] = useState<any | null>(null)
  const [localLoading, setLocalLoading] = useState(true)

  const [occupancyMap, setOccupancyMap] = useState<Record<string, OccupancyInfo>>({})
  const [specialRequests, setSpecialRequests] = useState<Record<string, string>>({})

  const loadMyAssignedRooms = useCallback(async () => {
    if (!staff?.id) return
    try {
      const data = await getMyAssignedRooms()
      setMyRooms(data.assignedRooms || [])
    } catch (error) {
      console.error('Failed to load assigned rooms:', error)
      toast.error('Failed to load your rooms')
    } finally {
      setLocalLoading(false)
    }
  }, [staff])

  // Fetch occupancy map & special requests
  useEffect(() => {
    const fetchOccupancy = async () => {
      try {
        const stays = await getStays()
        const reservations = await getReservations({ status: 'confirmed' })
        const today = format(new Date(), 'yyyy-MM-dd')
        const occMap: Record<string, OccupancyInfo> = {}

        for (const stay of stays) {
          const num = stay.room_number
          const arr = stay.arrival_date.split('T')[0]
          const dep = stay.departure_date.split('T')[0]
          if (arr <= today && dep >= today && stay.status !== 'checked_out') {
            if (stay.status === 'checked_in') {
              occMap[num] = { status: 'occupied', guest_name: stay.guest_name, arrival_date: arr, departure_date: dep }
            } else if (arr === today) {
              occMap[num] = { status: 'arriving_today', guest_name: stay.guest_name, arrival_date: arr, departure_date: dep }
            } else {
              occMap[num] = { status: 'occupied', guest_name: stay.guest_name, arrival_date: arr, departure_date: dep }
            }
          } else if (arr > today && !occMap[num]) {
            occMap[num] = { status: 'reserved', guest_name: stay.guest_name, arrival_date: arr, departure_date: dep }
          }
        }
        setOccupancyMap(occMap)

        const reqMap: Record<string, string> = {}
        for (const res of reservations) {
          if (!res.special_requests) continue
          const stay = stays.find((s: any) => s.reservation_id === res.id)
          if (stay) reqMap[stay.room_number] = res.special_requests
        }
        setSpecialRequests(reqMap)
      } catch (err) {
        console.error('Failed to fetch occupancy data', err)
      }
    }

    fetchOccupancy()
  }, [])

  useEffect(() => { loadMyAssignedRooms() }, [loadMyAssignedRooms])

  useEffect(() => {
    const handleRefresh = () => { loadMyAssignedRooms(); refreshRooms() }
    window.addEventListener('room-status-changed', handleRefresh)
    window.addEventListener('room-assigned', handleRefresh)
    window.addEventListener('room-outoforder-changed', handleRefresh)
    window.addEventListener('room-restored', handleRefresh)
    window.addEventListener('refresh-rooms', handleRefresh)
    window.addEventListener('refresh-tasks', handleRefresh)
    const interval = setInterval(loadMyAssignedRooms, 15000)
    return () => {
      window.removeEventListener('room-status-changed', handleRefresh)
      window.removeEventListener('room-assigned', handleRefresh)
      window.removeEventListener('room-outoforder-changed', handleRefresh)
      window.removeEventListener('room-restored', handleRefresh)
      window.removeEventListener('refresh-rooms', handleRefresh)
      window.removeEventListener('refresh-tasks', handleRefresh)
      clearInterval(interval)
    }
  }, [loadMyAssignedRooms, refreshRooms])

  const handleStartCleaning = async (room: any) => {
    setUpdating(room.id)
    try {
      let requestId = room.cleaning_request_id
      if (!requestId) {
        toast.loading('Creating cleaning request...')
        const newRequest = await upsertCleaningRequest(room.id, 'stay_over')
        requestId = newRequest.id
        toast.dismiss()
      }
      await assignCleaning(requestId, staff!.id)
      await updateCleaningTaskStatus(requestId, 'in_progress')
      toast.success(`Started cleaning Room ${room.room_number}`)
      loadMyAssignedRooms(); refreshRooms(); window.dispatchEvent(new CustomEvent('room-status-changed'))
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to start cleaning')
    } finally { setUpdating(null) }
  }

  const handleCompleteCleaning = async (room: any) => {
    if (!room.cleaning_request_id) { toast.error('No cleaning request associated'); return }
    setUpdating(room.id)
    try {
      await updateCleaningTaskStatus(room.cleaning_request_id, 'completed')
      toast.success(`Room ${room.room_number} is ready for inspection`)
      loadMyAssignedRooms(); refreshRooms(); window.dispatchEvent(new CustomEvent('room-status-changed')); window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to complete cleaning') } finally { setUpdating(null) }
  }

  const handleReleaseRoom = async (room: any) => {
    setUpdating(room.id)
    try {
      await releaseRoom(room.id)
      toast.success(`Room ${room.room_number} released`)
      loadMyAssignedRooms(); refreshRooms(); setShowReleaseModal(null); window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to release room') } finally { setUpdating(null) }
  }

  const getCardStyle = (status: string) => {
    switch (status) {
      case 'dirty': return 'bg-red-100 border-red-300'
      case 'cleaning': return 'bg-yellow-100 border-yellow-300'
      case 'ready': return 'bg-green-100 border-green-300'
      default: return 'bg-white border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) { case 'dirty': return '⚠️'; case 'cleaning': return '🧹'; case 'ready': return '✅'; default: return '🏨' }
  }

  const getOccupancyBadge = (info: OccupancyInfo) => {
    switch (info.status) {
      case 'arriving_today': return <span className="px-2 py-0.5 text-sm rounded-full bg-blue-100 text-blue-800 font-medium">Arriving Today</span>
      case 'occupied': return <span className="px-2 py-0.5 text-sm rounded-full bg-blue-100 text-blue-800 font-medium">Occupied</span>
      case 'reserved': return <span className="px-2 py-0.5 text-sm rounded-full bg-green-100 text-green-800 font-medium">Reserved</span>
      default: return <span className="px-2 py-0.5 text-sm rounded-full bg-gray-100 text-gray-600 font-medium">Vacant</span>
    }
  }

  if (loading || localLoading) return <div className="flex justify-center items-center h-64 text-gray-500">Loading your rooms...</div>

  if (myRooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="text-6xl mb-4">🧹</div>
        <h2 className="text-xl font-semibold text-gray-700">No rooms assigned yet</h2>
        <p className="text-gray-500 mt-2">Head of Housekeeping will assign rooms when they need cleaning.</p>
        <button onClick={() => { loadMyAssignedRooms(); refreshRooms() }} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Refresh</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto mb-6">
        <h1 className="text-3xl font-light text-gray-800">🧹 My Assigned Rooms</h1>
        <p className="text-sm text-gray-500 mt-1">Priority rooms glow red. Start cleaning immediately.</p>
        <button onClick={() => { loadMyAssignedRooms(); refreshRooms() }} className="mt-2 text-xs text-blue-600 hover:text-blue-800">↻ Refresh</button>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {myRooms.map((room: any) => {
          const status = room.cleaning_status || room.status || 'dirty'
          const isUpdating = updating === room.id
          const cardBaseStyle = getCardStyle(status)

          const occupancy = occupancyMap[room.room_number] || { status: 'vacant' }
          const priority = occupancy.status === 'arriving_today' && !['ready', 'inspected'].includes(status)
          const priorityGlow = priority ? 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.8)] animate-pulse' : ''

          return (
            <div key={room.id}
              className={`rounded-xl border-2 shadow-sm p-4 transition hover:shadow-md hover:-translate-y-1 ${cardBaseStyle} ${priorityGlow}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-3xl font-black text-gray-800">{room.room_number}</div>
                  <div className="text-sm text-gray-600 mt-0.5">{room.room_type}</div>
                  <div className="text-xs text-gray-500">Floor {room.floor}</div>
                </div>
                <div className="text-3xl">{getStatusIcon(status)}</div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/70">{status.toUpperCase()}</span>
                {getOccupancyBadge(occupancy)}
              </div>

              {(occupancy.status === 'arriving_today' || occupancy.status === 'occupied') && occupancy.guest_name && (
                <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-700">
                  <div>🧳 {occupancy.guest_name}</div>
                  <div className="text-xs text-gray-500 mt-1">📅 {format(parseISO(occupancy.arrival_date!), 'MMM d')} – {format(parseISO(occupancy.departure_date!), 'MMM d')}</div>
                </div>
              )}

              {specialRequests[room.room_number] && <div className="mt-2 text-xs text-gray-500 italic">📝 {specialRequests[room.room_number]}</div>}
              {priority && <div className="mt-2 text-xs text-red-600 font-bold">⚠️ Priority Cleaning</div>}

              <div className="mt-4 space-y-2">
                {status === 'dirty' && (
                  <button onClick={() => handleStartCleaning(room)} disabled={isUpdating} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded-lg transition font-medium">🧹 Start Cleaning</button>
                )}
                {status === 'cleaning' && (
                  <button onClick={() => handleCompleteCleaning(room)} disabled={isUpdating} className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg transition font-medium">✅ Mark Ready</button>
                )}
                <button onClick={() => setShowReleaseModal(room)} disabled={isUpdating} className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg transition font-medium">🚪 Release Room</button>
              </div>

              {isUpdating && <div className="text-center text-sm text-gray-500 mt-2">Updating...</div>}
            </div>
          )
        })}
      </div>

      {showReleaseModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-orange-600 px-6 py-4"><h2 className="text-xl font-bold text-white">🚪 Release Room</h2><p className="text-orange-100 text-sm">Room {showReleaseModal.room_number}</p></div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">Are you sure you want to release <strong>Room {showReleaseModal.room_number}</strong>?</p>
              <p className="text-sm text-gray-500 mb-6">This room will be unassigned from you.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowReleaseModal(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                <button onClick={() => handleReleaseRoom(showReleaseModal)} className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition">Yes, Release Room</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}