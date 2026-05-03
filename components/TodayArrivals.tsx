'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getReservations, confirmReservation } from '@/lib/api'
import api from '@/lib/api'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

interface Reservation {
  id: string
  guest_name: string
  guest_email: string
  arrival_date: string
  departure_date: string
  room_type: string
  number_of_rooms: number
  status: string
}

export default function TodayArrivals() {
  const { staff } = useAuth()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [assignedMap, setAssignedMap] = useState<Record<string, string>>({})
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [availableRooms, setAvailableRooms] = useState<any[]>([])
  const [selectedRoomNumber, setSelectedRoomNumber] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Filtering state
  const [filterRoomType, setFilterRoomType] = useState('')
  const [filterFloor, setFilterFloor] = useState('')

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const loadData = async () => {
    try {
      const allRes = await getReservations({ status: 'confirmed' })
      const todayRes = allRes.filter((r: Reservation) => r.arrival_date.split('T')[0] === todayStr)
      setReservations(todayRes)

      const staysRes = await api.get('/reservations/stays')
      const stays = staysRes.data
      const map: Record<string, string> = {}
      for (const stay of stays) {
        if (stay.reservation_id) {
          map[stay.reservation_id] = stay.room_number
        }
      }
      setAssignedMap(map)
    } catch (err) {
      toast.error('Failed to load arrivals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const fetchAvailableRooms = async (arrival: string, departure: string) => {
    try {
      const res = await api.get('/rooms/available', { params: { arrival, departure } })
      setAvailableRooms(res.data)
      // Reset filters when fetching new rooms
      setFilterRoomType('')
      setFilterFloor('')
      setSelectedRoomNumber('')
    } catch (err) {
      toast.error('Failed to load available rooms')
    }
  }

  const openAssignModal = async (reservation: Reservation) => {
    setSelectedReservation(reservation)
    const arrival = reservation.arrival_date.split('T')[0]
    const departure = reservation.departure_date.split('T')[0]
    await fetchAvailableRooms(arrival, departure)
    setShowAssignModal(true)
  }

  const handleAssign = async () => {
    if (!selectedReservation || !selectedRoomNumber) return
    setAssigning(true)
    try {
      if (selectedReservation.status !== 'confirmed') {
        await confirmReservation(selectedReservation.id)
      }
      await api.post(`/reservations/${selectedReservation.id}/assign-room`, {
        roomNumber: selectedRoomNumber,
      })
      toast.success(`Room ${selectedRoomNumber} assigned to ${selectedReservation.guest_name}`)
      setAssignedMap(prev => ({ ...prev, [selectedReservation.id]: selectedRoomNumber }))
      setShowAssignModal(false)
      setSelectedRoomNumber('')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Assignment failed')
    } finally {
      setAssigning(false)
    }
  }

  // Filter available rooms by type and floor
  const filteredRooms = availableRooms.filter(room => {
    if (filterRoomType && room.room_type !== filterRoomType) return false
    if (filterFloor && room.floor !== parseInt(filterFloor)) return false
    return true
  })

  // Derive unique room types and floors from available rooms
  const roomTypes = [...new Set(availableRooms.map(r => r.room_type).filter(Boolean))].sort()
  const floors = [...new Set(availableRooms.map(r => r.floor).filter(Boolean))].sort((a: number, b: number) => a - b)

  if (loading) return <div className="text-center py-8">Loading today's arrivals...</div>

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b bg-gray-50 font-semibold">
        📋 Today's Arrivals ({reservations.length})
      </div>
      {reservations.length === 0 ? (
        <div className="p-8 text-center text-gray-500">No confirmed arrivals today.</div>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check‑in</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned Room</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reservations.map(res => {
              const assignedRoom = assignedMap[res.id]
              return (
                <tr key={res.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {res.guest_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {res.room_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(parseISO(res.arrival_date), 'MMM d')} – {format(parseISO(res.departure_date), 'MMM d')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {assignedRoom ? (
                      <span className="text-sm text-green-700 font-medium">{assignedRoom}</span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {assignedRoom ? (
                      <span className="text-xs text-gray-500">Assigned</span>
                    ) : (
                      <button
                        onClick={() => openAssignModal(res)}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                      >
                        Assign Room
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* Assign Room Modal with Filters */}
      {showAssignModal && selectedReservation && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="bg-blue-600 px-6 py-4 text-white">
              <h3 className="text-xl font-bold">Assign Room for {selectedReservation.guest_name}</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Arrival: {format(parseISO(selectedReservation.arrival_date), 'MMM d')} –{' '}
                {format(parseISO(selectedReservation.departure_date), 'MMM d')}
              </p>

              {/* Filters */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Room Type</label>
                  <select
                    value={filterRoomType}
                    onChange={(e) => {
                      setFilterRoomType(e.target.value)
                      setSelectedRoomNumber('') // reset selection
                    }}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">All Types</option>
                    {roomTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Floor</label>
                  <select
                    value={filterFloor}
                    onChange={(e) => {
                      setFilterFloor(e.target.value)
                      setSelectedRoomNumber('') // reset selection
                    }}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">All Floors</option>
                    {floors.map(floor => (
                      <option key={floor} value={floor}>Floor {floor}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Room selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Room</label>
                <select
                  value={selectedRoomNumber}
                  onChange={(e) => setSelectedRoomNumber(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="">-- Choose a room --</option>
                  {filteredRooms.map((room: any) => (
                    <option key={room.room_number} value={room.room_number}>
                      {room.room_number} – {room.room_type} (Floor {room.floor})
                    </option>
                  ))}
                </select>
                {filteredRooms.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">No rooms match the selected filters.</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssign}
                  disabled={assigning || !selectedRoomNumber}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {assigning ? 'Assigning...' : 'Assign Room'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}