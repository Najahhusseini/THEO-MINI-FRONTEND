'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  getReceptionStats,
  getReservations,
  checkInStay
} from '@/lib/api'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import ReceptionRoomsOverview from '@/components/ReceptionRoomsOverview'
import WalkInCheckInPanel from '@/components/WalkInCheckInPanel'
import CheckedInGuestsPanel from '@/components/CheckedInGuestsPanel'
import TodayArrivalsReception from '@/components/TodayArrivalsReception'   // ✅ NEW

export default function ReceptionDashboard() {
  const { staff } = useAuth()
  const [stats, setStats] = useState<any>({})
  const [showGuestLookup, setShowGuestLookup] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

  useEffect(() => {
    getReceptionStats().then(setStats).catch(console.error)
  }, [])

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

      <div className="flex gap-4">
        <button onClick={() => setShowGuestLookup(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          🔍 Guest Lookup
        </button>
      </div>

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

      {/* Walk‑In, Today's Arrivals, Checked‑In Guests */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        <WalkInCheckInPanel />
        <TodayArrivalsReception />
        <CheckedInGuestsPanel />
      </div>

      {/* 🏨 The same room overview as the reservation manager */}
      <div>
        <h2 className="text-xl font-bold mb-4">🏨 Rooms Overview</h2>
        <ReceptionRoomsOverview />
      </div>
    </div>
  )
}