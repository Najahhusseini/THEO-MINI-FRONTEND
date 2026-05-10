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
  notes?: string[] | null
}

type OccupancyInfo = {
  status: 'occupied' | 'reserved' | 'vacant' | 'arriving_today'
  guest_name?: string
}

export default function ReceptionRoomsOverview({ onDropGuest }: { onDropGuest: (roomNumber: string, reservationId: string) => Promise<void> }) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [occupancyMap, setOccupancyMap] = useState<Record<string, OccupancyInfo>>({})
  const [selectedFloor, setSelectedFloor] = useState<number>(1)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [roomsData, staysData] = await Promise.all([getRoomsWithCleaning(), getStays()])
      const mapped = (roomsData || []).map((r: any) => ({
        id: r.id, room_number: r.room_number, floor: r.floor, room_type: r.room_type,
        cleaning_status: r.cleaning_status || r.status || 'dirty', out_of_order: r.out_of_order || false,
        price_per_night: r.price_per_night || null, notes: r.notes || null,
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
    } catch (err) {
      toast.error('Failed to load rooms')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b)
  const filteredRooms = rooms.filter(r => r.floor === selectedFloor)

  const handleDragOver = (e: React.DragEvent, room: Room) => {
    const occ = occupancyMap[room.room_number]?.status
    if (room.out_of_order || occ !== 'vacant') return
    const cleaning = room.cleaning_status
    if (!['ready', 'inspected'].includes(cleaning)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, room: Room) => {
    e.preventDefault()
    const reservationId = e.dataTransfer.getData('text/plain')
    if (!reservationId) return
    await onDropGuest(room.room_number, reservationId)
    loadData() // immediate refresh
    window.dispatchEvent(new CustomEvent('refresh-rooms'))
  }

  if (loading) return <div className="text-center py-12">Loading rooms…</div>

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {floors.map(floor => (
          <button key={floor} onClick={() => setSelectedFloor(floor)} className={`px-4 py-1.5 text-sm rounded-full ${selectedFloor === floor ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>Floor {floor}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {filteredRooms.map(room => {
          const occ = occupancyMap[room.room_number]?.status || 'vacant'
          const isDropTarget = !room.out_of_order && occ === 'vacant' && ['ready', 'inspected'].includes(room.cleaning_status)
          const cardClass = room.out_of_order ? 'bg-gray-200 border-gray-400' :
            occ === 'occupied' ? 'bg-purple-50 border-purple-300' :
            occ === 'reserved' ? 'bg-orange-50 border-orange-300' :
            'bg-white border-gray-200'
          return (
            <div key={room.id} onDragOver={(e) => handleDragOver(e, room)} onDrop={(e) => handleDrop(e, room)}
              className={`rounded-lg border-2 p-3 text-center ${cardClass} ${isDropTarget ? 'ring-2 ring-green-400 ring-offset-2' : ''} transition`}>
              <div className="font-bold text-lg">{room.room_number}</div>
              <div className="text-xs text-gray-600">{room.room_type}</div>
              <div className="text-xs text-gray-500">Floor {room.floor}</div>
              <div className={`mt-1 text-xs font-medium px-2 py-0.5 rounded-full inline-block ${
                room.cleaning_status === 'dirty' ? 'bg-red-100 text-red-800' :
                room.cleaning_status === 'cleaning' ? 'bg-yellow-100 text-yellow-800' :
                room.cleaning_status === 'ready' ? 'bg-green-100 text-green-800' :
                room.cleaning_status === 'inspected' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'}`}>{room.cleaning_status.toUpperCase()}</div>
              {occ === 'occupied' && <div className="text-xs text-purple-700 mt-1">Occupied</div>}
              {occ === 'reserved' && <div className="text-xs text-orange-700 mt-1">Reserved</div>}
              {isDropTarget && <div className="text-xs text-green-700 mt-1">Drop guest here</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}