'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  getReceptionStats,
  getReservations,
  checkInStay,
  createReservation,
  CreateReservationData,
} from '@/lib/api'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import ReceptionRoomsOverview from '@/components/ReceptionRoomsOverview'
import WalkInCheckInPanel from '@/components/WalkInCheckInPanel'
import CheckedInGuestsPanel from '@/components/CheckedInGuestsPanel'
import TodayArrivalsReception from '@/components/TodayArrivalsReception'
import GuestProfilesTab from '@/components/GuestProfilesTab'

export default function ReceptionDashboard() {
  const { staff } = useAuth()
  const [stats, setStats] = useState<any>({})
  const [showGuestLookup, setShowGuestLookup] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showGuestDirectory, setShowGuestDirectory] = useState(false)

  // New Reservation form
  const [showNewReservation, setShowNewReservation] = useState(false)
  const [formData, setFormData] = useState<CreateReservationData>({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    arrival_date: '',
    departure_date: '',
    room_type: 'Standard',
    number_of_guests: 1,
    number_of_rooms: 1,
    special_requests: '',
  })
  const [confirmNow, setConfirmNow] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ── Direct room assignment for walk‑ins ──
  const [newReservationId, setNewReservationId] = useState<string | null>(null)
  const [availableRooms, setAvailableRooms] = useState<any[]>([])
  const [selectedRoomNumber, setSelectedRoomNumber] = useState('')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    getReceptionStats().then(setStats).catch(console.error)
  }, [])

  // ── fetch only inspected (really clean) rooms ──
  const fetchInspectedRooms = async (arrival: string, departure: string) => {
    try {
      const res = await api.get('/rooms/available', { params: { arrival, departure } })
      // keep only rooms whose cleaning_status is 'inspected' or 'ready'
      const inspected = res.data.filter(
        (room: any) => room.cleaning_status === 'inspected' || room.cleaning_status === 'ready'
      )
      setAvailableRooms(inspected)
      setSelectedRoomNumber('')
    } catch (err) {
      toast.error('Failed to load available rooms')
    }
  }

  const handleSearch = async () => {
    if (!searchTerm.trim()) return
    try {
      const res = await getReservations({})
      const filtered = res.filter((r: any) =>
        r.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.guest_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.id.startsWith(searchTerm)
      )
      setSearchResults(filtered)
      setShowGuestLookup(true)
    } catch (err) {
      toast.error('Search failed')
    }
  }

  const handleCheckIn = async (stayId: string) => {
    try {
      await checkInStay(stayId)
      toast.success('Checked in')
      getReceptionStats().then(setStats).catch(console.error)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Check‑in failed')
    }
  }

  const handleAssignRoom = async (reservationId: string) => {
    const roomNumber = prompt('Enter room number:')
    if (!roomNumber) return
    try {
      await api.post(`/reservations/${reservationId}/assign-room`, { roomNumber })
      toast.success('Room assigned')
      getReceptionStats().then(setStats).catch(console.error)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Assignment failed')
    }
  }

  // ── Form handlers ──
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const submitReservation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.guest_name || !formData.arrival_date || !formData.departure_date) {
      toast.error('Please fill in all required fields')
      return
    }
    setSubmitting(true)
    try {
      const dataToSend = {
        ...formData,
        number_of_guests: parseInt(formData.number_of_guests as any) || 1,
        number_of_rooms: parseInt(formData.number_of_rooms as any) || 1,
        status: confirmNow ? 'confirmed' as const : 'pending_review' as const,
      }
      const reservation = await createReservation(dataToSend)   // returns the created reservation
      toast.success(confirmNow ? 'Reservation confirmed!' : 'Reservation created (pending review)')
      setShowNewReservation(false)
      setFormData({
        guest_name: '', guest_email: '', guest_phone: '',
        arrival_date: '', departure_date: '', room_type: 'Standard',
        number_of_guests: 1, number_of_rooms: 1, special_requests: '',
      })
      setConfirmNow(false)
      getReceptionStats().then(setStats).catch(console.error)
      window.dispatchEvent(new CustomEvent('reservation-confirmed'))

      // ✅ If it was confirmed, immediately open room assignment
      if (dataToSend.status === 'confirmed' && reservation?.id) {
        setNewReservationId(reservation.id)
        await fetchInspectedRooms(dataToSend.arrival_date, dataToSend.departure_date)
        setShowAssignModal(true)
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save reservation')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Handle the direct assignment from walk‑in ──
  const handleWalkInAssign = async () => {
    if (!newReservationId || !selectedRoomNumber) return
    setAssigning(true)
    try {
      await api.post(`/reservations/${newReservationId}/assign-room`, { roomNumber: selectedRoomNumber })
      toast.success('Room assigned!')
      setShowAssignModal(false)
      setNewReservationId(null)
      getReceptionStats().then(setStats).catch(console.error)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Assignment failed')
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.arrivingToday || 0}</div>
          <div className="text-sm text-gray-500">Arriving Today</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.checkedIn || 0}</div>
          <div className="text-sm text-gray-500">Checked In</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{stats.departingToday || 0}</div>
          <div className="text-sm text-gray-500">Departing Today</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.roomsReady || 0}</div>
          <div className="text-sm text-gray-500">Rooms Ready</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{stats.vacantDirty || 0}</div>
          <div className="text-sm text-gray-500">Vacant Dirty</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-4 flex-wrap">
        <button onClick={() => setShowGuestLookup(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          🔍 Guest Lookup
        </button>
        <button
          onClick={() => {
            setShowNewReservation(true)
            setFormData({
              guest_name: '', guest_email: '', guest_phone: '',
              arrival_date: '', departure_date: '', room_type: 'Standard',
              number_of_guests: 1, number_of_rooms: 1, special_requests: '',
            })
            setConfirmNow(false)
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          + New Reservation
        </button>
      </div>

      {/* Guest Lookup Modal */}
      {showGuestLookup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Guest Lookup</h2>
              <button onClick={() => setShowGuestLookup(false)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, or ID"
                className="flex-1 p-2 border rounded"
              />
              <button onClick={handleSearch} className="px-4 py-2 bg-blue-600 text-white rounded">Search</button>
            </div>
            <div className="space-y-2">
              {searchResults.map((r: any) => (
                <div key={r.id} className="border rounded p-3 flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{r.guest_name}</div>
                    <div className="text-sm text-gray-600">{r.arrival_date?.split('T')[0]} – {r.departure_date?.split('T')[0]}</div>
                    <div className="text-xs text-gray-500">{r.status}</div>
                  </div>
                  <div className="flex gap-2">
                    {r.status === 'confirmed' && (
                      <>
                        <button onClick={() => handleCheckIn(r.stay_id)} className="text-green-600 hover:underline">Check In</button>
                        <button onClick={() => handleAssignRoom(r.id)} className="text-blue-600 hover:underline">Assign Room</button>
                      </>
                    )}
                    {r.status === 'waitlist' && (
                      <button onClick={() => handleAssignRoom(r.id)} className="text-blue-600 hover:underline">Assign Room</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New Reservation Modal */}
      {showNewReservation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">New Reservation</h2>
                <button onClick={() => setShowNewReservation(false)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
              </div>
              <form onSubmit={submitReservation} className="space-y-4">
                <input
                  name="guest_name" placeholder="Guest Name *" value={formData.guest_name}
                  onChange={handleInputChange} required className="w-full p-2 border rounded"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input name="guest_email" placeholder="Email" value={formData.guest_email}
                    onChange={handleInputChange} className="p-2 border rounded" />
                  <input name="guest_phone" placeholder="Phone" value={formData.guest_phone}
                    onChange={handleInputChange} className="p-2 border rounded" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input type="date" name="arrival_date" value={formData.arrival_date}
                    onChange={handleInputChange} required className="p-2 border rounded" />
                  <input type="date" name="departure_date" value={formData.departure_date}
                    onChange={handleInputChange} required className="p-2 border rounded" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Number of Guests</label>
                    <input type="number" name="number_of_guests" min="1" value={formData.number_of_guests}
                      onChange={handleInputChange} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Number of Rooms</label>
                    <input type="number" name="number_of_rooms" min="1" value={formData.number_of_rooms}
                      onChange={handleInputChange} className="w-full p-2 border rounded" />
                  </div>
                </div>
                <textarea name="special_requests" placeholder="Special requests" rows={3} value={formData.special_requests}
                  onChange={handleInputChange} className="w-full p-2 border rounded" />
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={confirmNow} onChange={e => setConfirmNow(e.target.checked)} />
                  Confirm immediately (skip pending review)
                </label>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowNewReservation(false)} className="flex-1 py-2 border rounded">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="flex-1 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
                    {submitting ? 'Saving...' : 'Create Reservation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Walk‑In Room Assignment Modal (only inspected/ready rooms) ── */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold mb-4">Assign Room for Walk‑In Guest</h3>
            <p className="text-sm text-gray-600 mb-4">Showing only inspected (clean) rooms available for this period.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Select Room</label>
              <select
                value={selectedRoomNumber}
                onChange={(e) => setSelectedRoomNumber(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">-- Choose a room --</option>
                {availableRooms.map((room: any) => (
                  <option key={room.room_number} value={room.room_number}>
                    {room.room_number} – {room.room_type} (Floor {room.floor}) – {room.cleaning_status}
                  </option>
                ))}
              </select>
              {availableRooms.length === 0 && (
                <p className="text-xs text-red-500 mt-1">No inspected rooms available for these dates.</p>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAssignModal(false)} className="flex-1 py-2 border rounded">Cancel</button>
              <button
                onClick={handleWalkInAssign}
                disabled={assigning || !selectedRoomNumber}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {assigning ? 'Assigning...' : 'Assign Room & Check In'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
        <WalkInCheckInPanel />
        <TodayArrivalsReception />
        <CheckedInGuestsPanel />
        <div
          className="bg-white rounded-lg shadow p-4 text-center hover:shadow-md cursor-pointer flex flex-col items-center justify-center min-h-[200px]"
          onClick={() => setShowGuestDirectory(true)}
        >
          <div className="text-3xl mb-2">👥</div>
          <div className="font-semibold text-gray-800">Guest Directory</div>
          <div className="text-sm text-gray-500">View all guests</div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">🏨 Rooms Overview</h2>
        <ReceptionRoomsOverview />
      </div>

      {showGuestDirectory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Guest Directory</h2>
              <button onClick={() => setShowGuestDirectory(false)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            <GuestProfilesTab />
          </div>
        </div>
      )}
    </div>
  )
}