'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  getRoomsWithCleaning,
  getStays,
  getReservations,
  createReservation,
  confirmReservation,
  updateRoomCleaningStatus,
  checkInStay,
  moveStayToRoom,
  setRoomOutOfOrder
} from '@/lib/api'
import api from '@/lib/api'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

interface Room {
  id: string
  room_number: string
  floor: number
  room_type: string
  out_of_order: boolean
  cleaning_status?: string
}

type OccupancyInfo = {
  status: 'occupied' | 'reserved' | 'vacant' | 'arriving_today'
  guest_name?: string
  arrival_date?: string
  departure_date?: string
  stay_id?: string
}

interface TodayGuest {
  id: string
  guest_name: string
  arrival_date: string
  departure_date: string
  room_type: string
  status: string
}

// ── colour maps ──────────────────────────────────
const roomTypeColors: Record<string, string> = {
  'Standard':    'bg-blue-400',
  'Deluxe':      'bg-amber-400',
  'Suite':       'bg-purple-400',
  'Family':      'bg-green-400',
  'Executive':   'bg-indigo-400',
  'Presidential':'bg-red-400',
}

const occupancyBg: Record<string, string> = {
  'occupied':       'bg-blue-50',
  'arriving_today': 'bg-green-50',
  'reserved':       'bg-orange-50',
  'vacant':         'bg-gray-50',
}

const cleaningBorder: Record<string, string> = {
  'dirty':    'border-l-red-500',
  'cleaning': 'border-l-yellow-500',
  'ready':    'border-l-green-500',
  'inspected':'border-l-blue-500',
  'awaiting': 'border-l-purple-500',
}
// ─────────────────────────────────────────────────

export default function ReceptionRoomsOverview() {
  const { staff } = useAuth()
  const [rooms, setRooms] = useState<Room[]>([])
  const [occupancyMap, setOccupancyMap] = useState<Record<string, OccupancyInfo>>({})
  const [specialRequests, setSpecialRequests] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [selectedFloor, setSelectedFloor] = useState<number>(1)

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  const [showAssignModal, setShowAssignModal] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [arrivalDate, setArrivalDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [departureDate, setDepartureDate] = useState(format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'))
  const [assigning, setAssigning] = useState(false)
  const [todayGuests, setTodayGuests] = useState<TodayGuest[]>([])

  // ── Reassign Guest state ──
  const [showReassignGuestModal, setShowReassignGuestModal] = useState(false)
  const [availableNewRooms, setAvailableNewRooms] = useState<any[]>([])
  const [selectedNewRoom, setSelectedNewRoom] = useState('')
  const [markOooChecked, setMarkOooChecked] = useState(false)
  const [reassignGuestSubmitting, setReassignGuestSubmitting] = useState(false)
  const [filterRoomType, setFilterRoomType] = useState('')
  const [filterFloor, setFilterFloor] = useState('')

  const canCheckIn = staff?.role === 'admin' || staff?.role === 'manager' || staff?.role === 'reservation_manager' || staff?.role === 'frontdesk'
  const canReassignGuest = staff?.role === 'admin' || staff?.role === 'manager' || staff?.role === 'head_housekeeping' || staff?.role === 'reservation_manager'

  const loadData = useCallback(async () => {
    try {
      const [roomsData, staysData] = await Promise.all([getRoomsWithCleaning(), getStays()])
      const mappedRooms: Room[] = (roomsData || []).map((r: any) => ({
        id: r.id, room_number: r.room_number, floor: r.floor, room_type: r.room_type,
        out_of_order: r.out_of_order || false, cleaning_status: r.cleaning_status || r.status || 'dirty'
      }))
      setRooms(mappedRooms)

      const today = format(new Date(), 'yyyy-MM-dd')
      const map: Record<string, OccupancyInfo> = {}
      for (const stay of staysData) {
        const num = stay.room_number
        const arr = stay.arrival_date.split('T')[0]
        const dep = stay.departure_date.split('T')[0]
        if (arr <= today && dep >= today && stay.status !== 'checked_out') {
          if (stay.status === 'checked_in')
            map[num] = { status: 'occupied', guest_name: stay.guest_name, arrival_date: arr, departure_date: dep, stay_id: stay.id }
          else if (arr === today)
            map[num] = { status: 'arriving_today', guest_name: stay.guest_name, arrival_date: arr, departure_date: dep, stay_id: stay.id }
          else
            map[num] = { status: 'occupied', guest_name: stay.guest_name, arrival_date: arr, departure_date: dep, stay_id: stay.id }
        } else if (arr > today && !map[num])
          map[num] = { status: 'reserved', guest_name: stay.guest_name, arrival_date: arr, departure_date: dep, stay_id: stay.id }
      }
      for (const room of mappedRooms)
        if (!map[room.room_number]) map[room.room_number] = { status: 'vacant' }
      setOccupancyMap(map)

      const reservations = await getReservations({ status: 'confirmed' })
      const reqMap: Record<string, string> = {}
      for (const res of reservations) {
        if (!res.special_requests) continue
        const stay = staysData.find((s: any) => s.reservation_id === res.id)
        if (stay) reqMap[stay.room_number] = res.special_requests
      }
      setSpecialRequests(reqMap)

      setTodayGuests(
        reservations.filter((r: any) => r.arrival_date.split('T')[0] === today)
          .map((r: any) => ({ id: r.id, guest_name: r.guest_name, arrival_date: r.arrival_date, departure_date: r.departure_date, room_type: r.room_type, status: r.status }))
      )
    } catch (err) {
      toast.error('Failed to load data')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b)
  const filteredRooms = rooms.filter(r => r.floor === selectedFloor)

  const handleRoomClick = (room: Room) => { setSelectedRoom(room); setShowDetailModal(true) }

  const openAssignModalFromDetail = () => {
    if (!selectedRoom) return
    const occ = occupancyMap[selectedRoom.room_number]
    if (occ && occ.arrival_date && occ.departure_date) {
      setArrivalDate(occ.arrival_date); setDepartureDate(occ.departure_date); setGuestName(occ.guest_name || '')
    } else {
      setArrivalDate(format(new Date(), 'yyyy-MM-dd')); setDepartureDate(format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')); setGuestName('')
    }
    setShowAssignModal(true)
  }

  const handleAssign = async () => {
    if (!selectedRoom || !guestName.trim() || !arrivalDate || !departureDate) { toast.error('Fill in all fields'); return }
    setAssigning(true)
    try {
      const reservation = await createReservation({ guest_name: guestName, arrival_date: arrivalDate, departure_date: departureDate, room_type: selectedRoom.room_type, number_of_guests: 1, number_of_rooms: 1 })
      await confirmReservation(reservation.id)
      await api.post(`/reservations/${reservation.id}/assign-room`, { roomNumber: selectedRoom.room_number })
      toast.success(`Room ${selectedRoom.room_number} assigned to ${guestName}`)
      setShowAssignModal(false); setGuestName(''); loadData()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Assignment failed') } finally { setAssigning(false) }
  }

  const handleGuestSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const guestId = e.target.value
    if (!guestId) { setGuestName(''); return }
    const guest = todayGuests.find(g => g.id === guestId)
    if (guest) { setGuestName(guest.guest_name); setArrivalDate(guest.arrival_date.split('T')[0]); setDepartureDate(guest.departure_date.split('T')[0]) }
  }

  const handlePriorityClean = async () => {
    if (!selectedRoom) return
    try {
      await updateRoomCleaningStatus(selectedRoom.id, 'dirty')
      toast.success(`Room ${selectedRoom.room_number} marked for priority cleaning!`)
      window.dispatchEvent(new CustomEvent('refresh-rooms')); window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
      setRooms(prev => prev.map(r => r.id === selectedRoom.id ? { ...r, cleaning_status: 'dirty' } : r))
      setShowDetailModal(false)
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to request cleaning') }
  }

  const handleCheckIn = async () => {
    const occ = selectedRoom ? occupancyMap[selectedRoom.room_number] : null
    if (!occ?.stay_id) return
    try {
      await checkInStay(occ.stay_id)
      toast.success(`${occ.guest_name} checked in!`)
      setOccupancyMap(prev => {
        const updated = { ...prev }
        if (selectedRoom && updated[selectedRoom.room_number]) updated[selectedRoom.room_number] = { ...updated[selectedRoom.room_number], status: 'occupied' }
        return updated
      })
      setShowDetailModal(false)
      window.dispatchEvent(new CustomEvent('refresh-rooms'))
    } catch (err: any) { toast.error(err.response?.data?.error || 'Check‑in failed') }
  }

  // ── Reassign Guest handlers ──
  const handleReassignGuest = async () => {
    const occ = selectedRoom ? occupancyMap[selectedRoom.room_number] : null
    if (!occ?.stay_id || !selectedNewRoom) return
    setReassignGuestSubmitting(true)
    try {
      await moveStayToRoom(occ.stay_id, selectedNewRoom)
      toast.success(`Guest moved to Room ${selectedNewRoom}`)
      if (markOooChecked) {
        await setRoomOutOfOrder(selectedRoom!.id, 'Reassignment – room issue')
        toast.success(`Room ${selectedRoom?.room_number} marked Out of Order`)
        window.dispatchEvent(new CustomEvent('refresh-rooms'))
        window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
      }
      setShowReassignGuestModal(false)
      setShowDetailModal(false)
      loadData()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Reassign failed')
    } finally {
      setReassignGuestSubmitting(false)
    }
  }

  const fetchNewRoomOptions = async (arrival: string, departure: string) => {
    try {
      const res = await api.get('/rooms/available', { params: { arrival, departure } })
      setAvailableNewRooms(res.data)
      setFilterRoomType('')
      setFilterFloor('')
      setSelectedNewRoom('')
    } catch (err) {
      toast.error('Failed to load available rooms')
    }
  }

  const openReassignGuestModal = () => {
    const occ = selectedRoom ? occupancyMap[selectedRoom.room_number] : null
    if (!occ) return
    setMarkOooChecked(false)
    fetchNewRoomOptions(occ.arrival_date!, occ.departure_date!)
    setShowReassignGuestModal(true)
  }

  const filteredNewRooms = availableNewRooms.filter(room => {
    if (filterRoomType && room.room_type !== filterRoomType) return false
    if (filterFloor && room.floor !== parseInt(filterFloor)) return false
    return true
  })

  const roomTypes = [...new Set(availableNewRooms.map((r: any) => r.room_type).filter(Boolean))].sort()
  const newRoomFloors = [...new Set(availableNewRooms.map((r: any) => r.floor).filter(Boolean))].sort((a: number, b: number) => a - b)

  const getOccupancyBadge = (info: OccupancyInfo) => {
    switch (info.status) {
      case 'occupied': return <span className="px-2 py-0.5 text-sm rounded-full bg-purple-100 text-purple-800 font-medium">Occupied</span>
      case 'arriving_today': return <span className="px-2 py-0.5 text-sm rounded-full bg-red-100 text-red-800 font-medium">Arriving Today</span>
      case 'reserved': return <span className="px-2 py-0.5 text-sm rounded-full bg-orange-100 text-orange-800 font-medium">Reserved</span>
      default: return <span className="px-2 py-0.5 text-sm rounded-full bg-gray-100 text-gray-600 font-medium">Vacant</span>
    }
  }

  if (loading) return <div className="text-center py-12">Loading rooms overview...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto mb-6">
        <h1 className="text-3xl font-light text-gray-800">🏨 Rooms Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Click a room to view details, assign guest, reassign, or request priority cleaning.</p>
      </div>

      <div className="max-w-7xl mx-auto mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {floors.map(floor => (
          <button key={floor} onClick={() => setSelectedFloor(floor)}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${selectedFloor === floor ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
            Floor {floor}
          </button>
        ))}
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredRooms.map(room => {
          const occupancy = occupancyMap[room.room_number] || { status: 'vacant' }
          const request = specialRequests[room.room_number]
          const cleaningStatus = room.cleaning_status || 'dirty'
          const priority = occupancy.status === 'arriving_today' && !['ready', 'inspected'].includes(cleaningStatus)

          const occBg = occupancyBg[occupancy.status] || 'bg-gray-50'
          const cleanBorder = cleaningBorder[cleaningStatus] || 'border-l-gray-300'
          const typeDot = roomTypeColors[room.room_type] || 'bg-gray-400'

          return (
            <div key={room.id} onClick={() => handleRoomClick(room)}
              className={`cursor-pointer rounded-xl border-l-4 border-r border-t border-b border-gray-200 shadow-sm p-4 transition hover:shadow-md hover:-translate-y-1 ${occBg} ${cleanBorder} ${priority ? 'ring-2 ring-red-500 shadow-[0_0_25px_rgba(239,68,68,0.8)] animate-pulse' : ''}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-3xl font-black text-gray-800">{room.room_number}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${typeDot}`}></span>
                    <span className="text-sm text-gray-600">{room.room_type}</span>
                  </div>
                  <div className="text-xs text-gray-500">Floor {room.floor}</div>
                </div>
                <div className="text-3xl">{room.out_of_order ? '🚫' : '🏨'}</div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {getOccupancyBadge(occupancy)}
                {!room.out_of_order && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    cleaningStatus === 'dirty' ? 'bg-red-100 text-red-800' :
                    cleaningStatus === 'cleaning' ? 'bg-yellow-100 text-yellow-800' :
                    cleaningStatus === 'ready' ? 'bg-green-100 text-green-800' :
                    cleaningStatus === 'inspected' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>{cleaningStatus.toUpperCase()}</span>
                )}
              </div>
              {occupancy.status !== 'vacant' && occupancy.guest_name && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-base font-semibold text-gray-800">🧳 {occupancy.guest_name}</div>
                  <div className="text-sm text-gray-600 mt-1">📅 {format(parseISO(occupancy.arrival_date!), 'MMM d')} – {format(parseISO(occupancy.departure_date!), 'MMM d')}</div>
                </div>
              )}
              {request && <div className="mt-2 text-xs text-gray-500 italic">📝 {request}</div>}
              {priority && <div className="mt-2 text-xs text-red-600 font-bold">⚠️ Priority Cleaning</div>}
            </div>
          )
        })}
      </div>

      {/* DETAIL MODAL */}
      {showDetailModal && selectedRoom && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className={`px-6 py-4 ${selectedRoom.out_of_order ? 'bg-gray-700' : 'bg-blue-600'} text-white`}>
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Room {selectedRoom.room_number}</h2>
                <button onClick={() => setShowDetailModal(false)} className="text-white/80 hover:text-white text-2xl">&times;</button>
              </div>
              <p className="text-white/80 text-sm">{selectedRoom.room_type} • Floor {selectedRoom.floor}</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <span className="font-semibold text-gray-600">Cleaning Status: </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  selectedRoom.cleaning_status === 'dirty' ? 'bg-red-100 text-red-800' :
                  selectedRoom.cleaning_status === 'cleaning' ? 'bg-yellow-100 text-yellow-800' :
                  selectedRoom.cleaning_status === 'ready' ? 'bg-green-100 text-green-800' :
                  selectedRoom.cleaning_status === 'inspected' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>{(selectedRoom.cleaning_status || 'dirty').toUpperCase()}</span>
              </div>

              {occupancyMap[selectedRoom.room_number] && (
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <p className="text-sm font-semibold text-gray-700">Occupancy</p>
                  <div className="mt-1">{getOccupancyBadge(occupancyMap[selectedRoom.room_number])}</div>
                  {occupancyMap[selectedRoom.room_number].guest_name && (
                    <p className="text-base font-medium text-gray-800 mt-2">{occupancyMap[selectedRoom.room_number].guest_name}</p>
                  )}
                  {occupancyMap[selectedRoom.room_number].arrival_date && (
                    <p className="text-sm text-gray-600 mt-1">
                      {format(parseISO(occupancyMap[selectedRoom.room_number].arrival_date!), 'MMM d')} – {format(parseISO(occupancyMap[selectedRoom.room_number].departure_date!), 'MMM d')}
                    </p>
                  )}
                  {occupancyMap[selectedRoom.room_number].status === 'arriving_today' && canCheckIn && (
                    <button onClick={handleCheckIn} className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition">✅ Check In Guest</button>
                  )}
                </div>
              )}

              {/* 🔄 REASSIGN GUEST – same as in housekeeping */}
              {!selectedRoom.out_of_order &&
               (occupancyMap[selectedRoom.room_number]?.status === 'occupied' ||
                occupancyMap[selectedRoom.room_number]?.status === 'arriving_today') &&
               canReassignGuest && (
                <button
                  onClick={openReassignGuestModal}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg transition"
                >
                  🔄 Reassign Guest
                </button>
              )}

              {selectedRoom.out_of_order && <div className="bg-red-50 p-3 rounded-lg border-l-4 border-red-500"><p className="text-sm font-semibold text-red-800">Room is out of order</p></div>}
              {specialRequests[selectedRoom.room_number] && (
                <div className="bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-500"><p className="text-sm font-semibold text-yellow-800">Special Requests:</p><p className="text-sm text-gray-700">{specialRequests[selectedRoom.room_number]}</p></div>
              )}

              {!selectedRoom.out_of_order && (
                <div className="space-y-2 pt-2">
                  <button onClick={() => { setShowDetailModal(false); openAssignModalFromDetail() }} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition">🏨 Assign Guest</button>
                  <button onClick={handlePriorityClean} className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg transition">🧹 Request Priority Cleaning</button>
                </div>
              )}
              <button onClick={() => setShowDetailModal(false)} className="w-full py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN MODAL unchanged */}
      {showAssignModal && selectedRoom && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-blue-600 px-6 py-4 text-white"><h3 className="text-xl font-bold">Assign Guest to Room {selectedRoom.room_number}</h3></div>
            <div className="p-6 space-y-4">
              {todayGuests.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quick Pick – Today's Arrivals</label>
                  <select onChange={handleGuestSelect} className="w-full p-2 border rounded-lg" defaultValue="">
                    <option value="">-- Select a guest --</option>
                    {todayGuests.map(guest => (<option key={guest.id} value={guest.id}>{guest.guest_name} ({guest.room_type})</option>))}
                  </select>
                </div>
              )}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Guest Name</label><input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="Enter guest full name" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Arrival</label><input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} className="w-full p-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Departure</label><input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} className="w-full p-2 border rounded-lg" /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAssignModal(false)} className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleAssign} disabled={assigning || !guestName.trim()} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{assigning ? 'Assigning...' : 'Assign Room'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔄 REASSIGN GUEST MODAL */}
      {showReassignGuestModal && selectedRoom && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="bg-orange-600 px-6 py-4 text-white">
              <h3 className="text-xl font-bold">Reassign Guest – Room {selectedRoom.room_number}</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Moving <strong>{occupancyMap[selectedRoom.room_number]?.guest_name}</strong> to a different room.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Room Type</label>
                  <select value={filterRoomType} onChange={(e) => { setFilterRoomType(e.target.value); setSelectedNewRoom('') }} className="w-full p-2 border rounded">
                    <option value="">All Types</option>
                    {roomTypes.map(type => (<option key={type} value={type}>{type}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Floor</label>
                  <select value={filterFloor} onChange={(e) => { setFilterFloor(e.target.value); setSelectedNewRoom('') }} className="w-full p-2 border rounded">
                    <option value="">All Floors</option>
                    {newRoomFloors.map(floor => (<option key={floor} value={floor}>Floor {floor}</option>))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Room</label>
                <select value={selectedNewRoom} onChange={(e) => setSelectedNewRoom(e.target.value)} className="w-full p-2 border rounded">
                  <option value="">-- Choose a room --</option>
                  {filteredNewRooms.map((room: any) => (<option key={room.room_number} value={room.room_number}>{room.room_number} – {room.room_type} (Floor {room.floor})</option>))}
                </select>
                {filteredNewRooms.length === 0 && <p className="text-xs text-gray-500 mt-1">No rooms match the selected filters.</p>}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={markOooChecked} onChange={(e) => setMarkOooChecked(e.target.checked)} className="w-4 h-4" />
                Mark current room (Room {selectedRoom.room_number}) as <strong>Out of Order</strong>
              </label>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowReassignGuestModal(false)} className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleReassignGuest} disabled={!selectedNewRoom || reassignGuestSubmitting} className="flex-1 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
                  {reassignGuestSubmitting ? 'Moving...' : 'Move Guest'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}