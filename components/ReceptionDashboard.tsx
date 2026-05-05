'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  getReceptionStats,
  getReservations,
  createReservation,
  confirmReservation,
  getStays,
  toggleKeyIssued,
  checkInStay,
  getReservationById
} from '@/lib/api'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import RoomsTab from '@/components/RoomsTab'   // we'll make RoomsTab accept readOnly prop

export default function ReceptionDashboard() {
  const { staff } = useAuth()
  const [stats, setStats] = useState<any>({})
  const [showGuestLookup, setShowGuestLookup] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedGuest, setSelectedGuest] = useState<any>(null)
  const [showWalkIn, setShowWalkIn] = useState(false)
  const [keyManagement, setKeyManagement] = useState<any[]>([])

  // Fetch initial stats
  useEffect(() => {
    getReceptionStats().then(setStats).catch(console.error)
    // Load key management data (checked-in stays)
    getStays().then(stays => {
      const checkedIn = stays.filter((s: any) => s.status === 'checked_in').map((s: any) => ({
        ...s,
        arrival_date: s.arrival_date?.split('T')[0],
        departure_date: s.departure_date?.split('T')[0]
      }))
      setKeyManagement(checkedIn)
    })
  }, [])

  // Guest Lookup
  const handleSearch = async () => {
    if (!searchTerm.trim()) return
    try {
      const res = await getReservations({})  // we'll filter client-side for simplicity
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
      // refresh
      const stays = await getStays()
      setKeyManagement(stays.filter((s: any) => s.status === 'checked_in'))
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Check-in failed')
    }
  }

  const handleAssignRoom = async (reservationId: string) => {
    // We can reuse the assign room modal from ReservationManagerDashboard, but for simplicity we'll just prompt
    const roomNumber = prompt('Enter room number:')
    if (!roomNumber) return
    try {
      await api.post(`/reservations/${reservationId}/assign-room`, { roomNumber })
      toast.success('Room assigned')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Assignment failed')
    }
  }

  const handleToggleKey = async (stayId: string, current: boolean) => {
    try {
      await toggleKeyIssued(stayId, !current)
      const stays = await getStays()
      setKeyManagement(stays.filter((s: any) => s.status === 'checked_in'))
    } catch (err: any) {
      toast.error('Failed to update key status')
    }
  }

  // Walk-in form
  const handleWalkInSubmit = async (guestName: string, arrivalDate: string, departureDate: string, roomType: string) => {
    try {
      const res = await createReservation({
        guest_name: guestName,
        arrival_date: arrivalDate,
        departure_date: departureDate,
        room_type: roomType,
        number_of_guests: 1,
        number_of_rooms: 1,
        status: 'confirmed'   // immediately confirm
      })
      await confirmReservation(res.id)
      // attempt to assign a room automatically
      const rooms = await api.get('/rooms/available', { params: { arrival: arrivalDate, departure: departureDate } })
      if (rooms.data.length > 0) {
        await api.post(`/reservations/${res.id}/assign-room`, { roomNumber: rooms.data[0].room_number })
        toast.success(`Walk-in booked & room ${rooms.data[0].room_number} assigned`)
      } else {
        toast.success('Walk-in booked, but no room available – will need assignment')
      }
      setShowWalkIn(false)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Walk-in failed')
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

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button onClick={() => setShowGuestLookup(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          🔍 Guest Lookup
        </button>
        <button onClick={() => setShowWalkIn(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
          + Walk‑In Reservation
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

      {/* Walk-In Modal */}
      {showWalkIn && (
        <WalkInModal
          onClose={() => setShowWalkIn(false)}
          onSubmit={handleWalkInSubmit}
        />
      )}

      {/* Housekeeping Panel (read-only) */}
      <div>
        <h2 className="text-xl font-bold mb-4">🏨 Housekeeping Status</h2>
        <RoomsTab readOnly={true} />
      </div>

      {/* Key Management */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">🔑 Key Management</h2>
        {keyManagement.length === 0 ? (
          <p className="text-gray-500">No checked‑in guests.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">Guest</th>
                <th className="px-4 py-2 text-left">Room</th>
                <th className="px-4 py-2 text-left">Dates</th>
                <th className="px-4 py-2 text-center">Key Issued</th>
              </tr>
            </thead>
            <tbody>
              {keyManagement.map((stay: any) => (
                <tr key={stay.id} className="border-t">
                  <td className="px-4 py-2">{stay.guest_name}</td>
                  <td className="px-4 py-2">{stay.room_number}</td>
                  <td className="px-4 py-2">
                    {stay.arrival_date} – {stay.departure_date}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={stay.key_issued || false}
                      onChange={() => handleToggleKey(stay.id, stay.key_issued)}
                      className="w-4 h-4"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// Separate WalkInModal component (inline for convenience)
function WalkInModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (guestName: string, arrival: string, departure: string, roomType: string) => void }) {
  const [guestName, setGuestName] = useState('')
  const [arrivalDate, setArrivalDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [departureDate, setDepartureDate] = useState(format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'))
  const [roomType, setRoomType] = useState('Standard')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guestName.trim()) return
    setSubmitting(true)
    await onSubmit(guestName, arrivalDate, departureDate, roomType)
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">🚶 Walk‑In Reservation</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Guest Name *"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            required
            className="w-full p-2 border rounded"
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              type="date"
              value={arrivalDate}
              onChange={(e) => setArrivalDate(e.target.value)}
              className="w-full p-2 border rounded"
            />
            <input
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <select
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option>Standard</option>
            <option>Deluxe</option>
            <option>Suite</option>
          </select>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2 border rounded">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 py-2 bg-green-600 text-white rounded disabled:opacity-50">
              {submitting ? 'Creating...' : 'Create & Assign Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}