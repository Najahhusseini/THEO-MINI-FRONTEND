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
import ArrivalGuestCards from '@/components/ArrivalGuestCards'
import QuickAssignQueue from '@/components/QuickAssignQueue'
import ReceptionRoomsOverview from '@/components/ReceptionRoomsOverview'
import CheckedInGuestsPanel from '@/components/CheckedInGuestsPanel'
import GuestProfilesTab from '@/components/GuestProfilesTab'

export interface PendingCheckInGuest {
  reservationId: string
  guestName: string
  arrivalDate: string
  departureDate: string
  roomType: string
  guestCount: number
  stayId?: string
}

export default function ReceptionDashboard() {
  const { staff } = useAuth()
  const [stats, setStats] = useState<any>({})
  const [pendingQueue, setPendingQueue] = useState<PendingCheckInGuest[]>([])

  const [showGuestLookup, setShowGuestLookup] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

  const [showGuestDirectory, setShowGuestDirectory] = useState(false)

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

  useEffect(() => {
    getReceptionStats().then(setStats).catch(console.error)
  }, [])

  const addToQueue = (guest: PendingCheckInGuest) => {
    let alreadyIn = false
    setPendingQueue(prev => {
      if (prev.some(g => g.reservationId === guest.reservationId)) {
        alreadyIn = true
        return prev
      }
      return [...prev, guest]
    })
    if (alreadyIn) {
      toast.error('Guest is already in the assignment queue')
    } else {
      toast.success(`${guest.guestName} added to queue`)
    }
  }

  const removeFromQueue = (reservationId: string) => {
    setPendingQueue(prev => prev.filter(g => g.reservationId !== reservationId))
  }

  const handleDropOnRoom = async (roomNumber: string, reservationId: string) => {
    const guest = pendingQueue.find(g => g.reservationId === reservationId)
    if (!guest) return
    try {
      await api.post(`/reservations/${reservationId}/assign-room`, { roomNumber })
      toast.success(`Room ${roomNumber} assigned to ${guest.guestName}`)

      const staysRes = await api.get('/reservations/stays')
      const stay = staysRes.data.find((s: any) => s.reservation_id === reservationId && s.status === 'upcoming')
      if (stay) {
        await checkInStay(stay.id)
        toast.success(`${guest.guestName} checked in!`)
      }

      removeFromQueue(reservationId)
      getReceptionStats().then(setStats).catch(console.error)

      window.dispatchEvent(new CustomEvent('guest-checked-in', { detail: { reservationId } }))
      window.dispatchEvent(new CustomEvent('refresh-rooms'))
      window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Assignment / check‑in failed')
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
      const reservation = await createReservation(dataToSend)
      console.log('Reservation created:', reservation)
      toast.success(confirmNow ? 'Reservation confirmed!' : 'Reservation created (pending review)')
      setShowNewReservation(false)
      setFormData({ guest_name: '', guest_email: '', guest_phone: '', arrival_date: '', departure_date: '', room_type: 'Standard', number_of_guests: 1, number_of_rooms: 1, special_requests: '' })
      setConfirmNow(false)
      getReceptionStats().then(setStats).catch(console.error)
      window.dispatchEvent(new CustomEvent('reservation-confirmed'))

      if (dataToSend.status === 'confirmed' && reservation?.id) {
        addToQueue({
          reservationId: reservation.id,
          guestName: dataToSend.guest_name,
          arrivalDate: dataToSend.arrival_date,
          departureDate: dataToSend.departure_date,
          roomType: dataToSend.room_type || 'Standard',
          guestCount: dataToSend.number_of_guests,
        })
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save reservation')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">THEO Reception</h1>
            <p className="text-sm text-gray-500">Welcome, {staff?.name}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowGuestLookup(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">🔍 Guest Lookup</button>
            <button onClick={() => setShowNewReservation(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">+ Walk‑In</button>
            <button onClick={() => setShowGuestDirectory(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">👥 Directory</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Arriving Today', value: stats.arrivingToday || 0, color: 'text-blue-600' },
            { label: 'Checked In', value: stats.checkedIn || 0, color: 'text-green-600' },
            { label: 'Departing Today', value: stats.departingToday || 0, color: 'text-orange-600' },
            { label: 'Rooms Ready', value: stats.roomsReady || 0, color: 'text-emerald-600' },
            { label: 'Vacant Dirty', value: stats.vacantDirty || 0, color: 'text-red-600' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl shadow p-4 text-center hover:shadow-md transition">
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        <ArrivalGuestCards onAddToQueue={addToQueue} pendingQueue={pendingQueue} />
        <QuickAssignQueue guests={pendingQueue} onRemove={removeFromQueue} />

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">🏨 Rooms Overview</h2>
          <ReceptionRoomsOverview onDropGuest={handleDropOnRoom} />
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <CheckedInGuestsPanel />
        </div>
      </div>

      {/* Guest Lookup Modal */}
      {showGuestLookup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowGuestLookup(false)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Guest Lookup</h2><button onClick={() => setShowGuestLookup(false)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button></div>
            <div className="flex gap-2 mb-4"><input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by name, email, or ID" className="flex-1 p-2 border rounded-lg" /><button onClick={handleSearch} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Search</button></div>
            <div className="space-y-3">
              {searchResults.map((r: any) => (
                <div key={r.id} className="border rounded-lg p-3 flex justify-between items-center">
                  <div><div className="font-semibold">{r.guest_name}</div><div className="text-sm text-gray-500">{r.arrival_date?.split('T')[0]} – {r.departure_date?.split('T')[0]}</div><div className="text-xs text-gray-400">{r.status}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Walk‑In Reservation Modal */}
      {showNewReservation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNewReservation(false)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">New Walk‑In Reservation</h2><button onClick={() => setShowNewReservation(false)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button></div>
            <form onSubmit={submitReservation} className="space-y-4">
              <input name="guest_name" placeholder="Guest Name *" value={formData.guest_name} onChange={handleInputChange} required className="w-full p-3 border rounded-lg" />
              <div className="grid grid-cols-2 gap-4"><input name="guest_email" placeholder="Email" value={formData.guest_email} onChange={handleInputChange} className="p-3 border rounded-lg" /><input name="guest_phone" placeholder="Phone" value={formData.guest_phone} onChange={handleInputChange} className="p-3 border rounded-lg" /></div>
              <div className="grid grid-cols-2 gap-4"><input type="date" name="arrival_date" value={formData.arrival_date} onChange={handleInputChange} required className="p-3 border rounded-lg" /><input type="date" name="departure_date" value={formData.departure_date} onChange={handleInputChange} required className="p-3 border rounded-lg" /></div>
              <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium mb-1">Guests</label><input type="number" name="number_of_guests" min="1" value={formData.number_of_guests} onChange={handleInputChange} className="w-full p-3 border rounded-lg" /></div><div><label className="block text-sm font-medium mb-1">Rooms</label><input type="number" name="number_of_rooms" min="1" value={formData.number_of_rooms} onChange={handleInputChange} className="w-full p-3 border rounded-lg" /></div></div>
              <textarea name="special_requests" placeholder="Special requests" rows={3} value={formData.special_requests} onChange={handleInputChange} className="w-full p-3 border rounded-lg" />
              <label className="flex items-center gap-2"><input type="checkbox" checked={confirmNow} onChange={e => setConfirmNow(e.target.checked)} /> Confirm immediately (add to queue)</label>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowNewReservation(false)} className="flex-1 py-3 border rounded-lg">Cancel</button><button type="submit" disabled={submitting} className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{submitting ? 'Saving...' : 'Create Reservation'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Guest Directory Modal */}
      {showGuestDirectory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowGuestDirectory(false)}>
          <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Guest Directory</h2><button onClick={() => setShowGuestDirectory(false)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button></div>
            <GuestProfilesTab />
          </div>
        </div>
      )}
    </div>
  )
}