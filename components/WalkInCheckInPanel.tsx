'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getRoomsWithCleaning, getStays, createReservation, confirmReservation, checkInStay } from '@/lib/api'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface Room {
  id: string
  room_number: string
  floor: number
  room_type: string
  cleaning_status: string
  out_of_order: boolean
}

export default function WalkInCheckInPanel() {
  const { staff } = useAuth()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [guestName, setGuestName] = useState('')
  const [checkInNow, setCheckInNow] = useState(true)
  const [creating, setCreating] = useState(false)

  // ── Build occupancy map so we can filter to vacant only ──
  const [occupancyMap, setOccupancyMap] = useState<Record<string, string>>({})

  const loadRooms = async () => {
    try {
      const [allRooms, stays] = await Promise.all([
        getRoomsWithCleaning(),
        getStays()
      ])

      // Mark rooms that have an active stay (occupied / arriving today)
      const occMap: Record<string, string> = {}
      const today = new Date().toISOString().split('T')[0]
      for (const stay of stays) {
        const arr = stay.arrival_date?.split('T')[0]
        const dep = stay.departure_date?.split('T')[0]
        if (arr <= today && dep >= today && stay.status !== 'checked_out') {
          occMap[stay.room_number] = stay.status === 'checked_in' ? 'occupied' : 'arriving_today'
        }
      }
      setOccupancyMap(occMap)

      // Show only rooms that are vacant AND ready/inspected/awaiting
      const available = allRooms.filter((r: any) =>
        !r.out_of_order &&
        ['ready', 'inspected', 'awaiting'].includes(r.cleaning_status || r.status) &&
        !occMap[r.room_number]   // vacant
      )
      setRooms(available)
    } catch (err) {
      toast.error('Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRooms()
    const interval = setInterval(loadRooms, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleCreate = async () => {
    if (!selectedRoom || !guestName.trim()) return
    setCreating(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

      const reservation = await createReservation({
        guest_name: guestName,
        arrival_date: today,
        departure_date: tomorrow,
        room_type: selectedRoom.room_type,
        number_of_guests: 1,
        number_of_rooms: 1,
        status: 'confirmed'
      })
      await confirmReservation(reservation.id)

      await api.post(`/reservations/${reservation.id}/assign-room`, {
        roomNumber: selectedRoom.room_number
      })

      if (checkInNow) {
        const staysRes = await api.get('/reservations/stays')
        const stay = staysRes.data.find((s: any) => s.reservation_id === reservation.id)
        if (stay) {
          await checkInStay(stay.id)
          toast.success(`${guestName} checked into Room ${selectedRoom.room_number}`)
        } else {
          toast.success(`Room ${selectedRoom.room_number} assigned to ${guestName}`)
        }
      } else {
        toast.success(`Room ${selectedRoom.room_number} assigned to ${guestName}`)
      }

      setSelectedRoom(null)
      setGuestName('')
      loadRooms()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Walk‑in failed')
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <div className="text-center py-8">Loading available rooms…</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">🚶 Walk‑In & Check‑In</h2>
        <button onClick={loadRooms} className="text-xs text-blue-600 hover:underline">↻ Refresh</button>
      </div>

      {rooms.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No vacant, clean rooms right now.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2">
          {rooms.map(room => (
            <div
              key={room.id}
              onClick={() => {
                setSelectedRoom(room)
                setGuestName('')
                setCheckInNow(true)
              }}
              className={`cursor-pointer rounded-xl border-2 p-3 transition hover:shadow-md hover:-translate-y-1 bg-green-50 border-green-300 ${
                selectedRoom?.id === room.id ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="text-xl font-black text-gray-800">{room.room_number}</div>
              <div className="text-sm text-gray-600">{room.room_type} • Floor {room.floor}</div>
              <div className="mt-1">
                <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                  {room.cleaning_status?.toUpperCase() || 'READY'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-2">Check‑in to Room {selectedRoom.room_number}</h3>
            <p className="text-sm text-gray-500 mb-4">{selectedRoom.room_type} • Floor {selectedRoom.floor}</p>

            <input
              type="text"
              placeholder="Guest name *"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full p-2 border rounded mb-3"
              autoFocus
            />

            <label className="flex items-center gap-2 text-sm mb-4">
              <input
                type="checkbox"
                checked={checkInNow}
                onChange={(e) => setCheckInNow(e.target.checked)}
              />
              Check in immediately
            </label>

            <div className="flex gap-3">
              <button onClick={() => setSelectedRoom(null)} className="flex-1 py-2 border rounded-lg">Cancel</button>
              <button onClick={handleCreate} disabled={!guestName.trim() || creating} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {creating ? 'Creating…' : checkInNow ? 'Check In Now' : 'Assign Room'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}