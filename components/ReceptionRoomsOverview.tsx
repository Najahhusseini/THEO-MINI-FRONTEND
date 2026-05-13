'use client'

import { useState, useEffect, useCallback } from 'react'
import { getRoomsWithCleaning, getStays } from '@/lib/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

interface Room {
  id: string
  room_number: string
  floor: number
  room_type: string
  cleaning_status: string
  out_of_order: boolean
  price_per_night?: number | null
}

type OccupancyInfo = {
  status: 'occupied' | 'reserved' | 'vacant' | 'arriving_today'
  guest_name?: string
}

export default function ReceptionRoomsOverview({
  onDropGuest,
}: {
  onDropGuest: (roomNumber: string, reservationId: string) => Promise<void>
}) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [occupancyMap, setOccupancyMap] = useState<Record<string, OccupancyInfo>>({})
  const [selectedFloor, setSelectedFloor] = useState<number>(1)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [roomsData, staysData] = await Promise.all([getRoomsWithCleaning(), getStays()])
      const mapped: Room[] = (roomsData || []).map((r: any) => ({
        id: r.id,
        room_number: r.room_number,
        floor: r.floor,
        room_type: r.room_type,
        cleaning_status: r.cleaning_status || 'dirty',
        out_of_order: r.out_of_order || false,
        price_per_night: r.price_per_night || null,
      }))
      setRooms(mapped)

      const today = format(new Date(), 'yyyy-MM-dd')
      const map: Record<string, OccupancyInfo> = {}
      for (const stay of staysData) {
        const num = stay.room_number
        const arr = stay.arrival_date.split('T')[0]
        const dep = stay.departure_date.split('T')[0]
        if (arr <= today && dep >= today && stay.status !== 'checked_out') {
          map[num] = { status: 'occupied', guest_name: stay.guest_name }
        } else if (arr > today && !map[num]) {
          map[num] = { status: 'reserved', guest_name: stay.guest_name }
        }
      }
      for (const room of mapped) {
        if (!map[room.room_number]) map[room.room_number] = { status: 'vacant' }
      }
      setOccupancyMap(map)
    } catch {
      toast.error('Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Refresh on external events
  useEffect(() => {
    const handler = () => loadData()
    window.addEventListener('guest-checked-in', handler)
    window.addEventListener('refresh-rooms', handler)
    return () => {
      window.removeEventListener('guest-checked-in', handler)
      window.removeEventListener('refresh-rooms', handler)
    }
  }, [loadData])

  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b)
  const filteredRooms = rooms.filter(r => r.floor === selectedFloor)

  const handleDragOver = (e: React.DragEvent, room: Room) => {
    const occ = occupancyMap[room.room_number]?.status
    if (room.out_of_order || occ !== 'vacant') return
    if (!['ready', 'inspected'].includes(room.cleaning_status)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, room: Room) => {
    e.preventDefault()
    const reservationId = e.dataTransfer.getData('text/plain')
    if (!reservationId) return
    await onDropGuest(room.room_number, reservationId)
    loadData()
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading rooms…</div>

  return (
    <div>
      {/* Floor selector */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {floors.map(floor => (
          <button
            key={floor}
            onClick={() => setSelectedFloor(floor)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${
              selectedFloor === floor
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Floor {floor}
          </button>
        ))}
      </div>

      {/* Rooms grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredRooms.map(room => {
          const occ = occupancyMap[room.room_number]?.status || 'vacant'
          const isDropTarget =
            !room.out_of_order &&
            occ === 'vacant' &&
            ['ready', 'inspected'].includes(room.cleaning_status)

          // Card styling
          let cardStyle = 'bg-white border-gray-200'
          if (room.out_of_order) cardStyle = 'bg-gray-200 border-gray-400'
          else if (occ === 'occupied') cardStyle = 'bg-purple-50 border-purple-300'
          else if (occ === 'reserved') cardStyle = 'bg-orange-50 border-orange-300'

          // Cleaning status badge
          const cleaningColors: Record<string, string> = {
            dirty: 'bg-red-100 text-red-800',
            cleaning: 'bg-yellow-100 text-yellow-800',
            ready: 'bg-green-100 text-green-800',
            inspected: 'bg-blue-100 text-blue-800',
            awaiting: 'bg-purple-100 text-purple-800',
          }

          return (
            <div
              key={room.id}
              onDragOver={(e) => handleDragOver(e, room)}
              onDrop={(e) => handleDrop(e, room)}
              className={`rounded-xl border-2 p-4 text-center transition-all duration-200 ${cardStyle} ${
                isDropTarget ? 'ring-2 ring-green-400 ring-offset-2 scale-105' : ''
              }`}
            >
              <div className="text-2xl font-black text-gray-800">{room.room_number}</div>
              <div className="text-xs text-gray-600 mt-1">{room.room_type}</div>
              <div className="text-xs text-gray-400">Floor {room.floor}</div>

              {/* Cleaning badge */}
              <div className="mt-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cleaningColors[room.cleaning_status] || 'bg-gray-100'}`}>
                  {room.cleaning_status.toUpperCase()}
                </span>
              </div>

              {/* Occupancy label */}
              {occ === 'occupied' && <div className="text-xs text-purple-700 font-medium mt-2">Occupied</div>}
              {occ === 'reserved' && <div className="text-xs text-orange-700 font-medium mt-2">Reserved</div>}
              {isDropTarget && <div className="text-xs text-green-700 font-bold mt-2 animate-pulse">Drop guest here</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}