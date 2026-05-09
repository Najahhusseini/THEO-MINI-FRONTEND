'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface GuestProfile {
  guest_id: string
  guest_name: string
  guest_email: string | null
  guest_phone: string | null
  total_reservations: number
  total_stays: number
  last_arrival: string | null
  last_departure: string | null
  is_in_house: boolean
  is_expected: boolean
  total_folio_amount: number
}

interface ReservationDetail {
  id: string
  guest_name: string
  arrival_date: string
  departure_date: string
  status: string
  room_type: string
  number_of_guests: number
  special_requests: string | null
  stay_status: string | null
  room_number: string | null
  stay_arrival: string | null
  stay_departure: string | null
  folio_id: string | null
}

export default function GuestProfilesTab() {
  const [profiles, setProfiles] = useState<GuestProfile[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null)
  const [guestDetails, setGuestDetails] = useState<ReservationDetail[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)

  useEffect(() => { loadProfiles() }, [])

  const loadProfiles = async () => {
    try {
      const res = await api.get('/guests/profiles')
      setProfiles(res.data)
    } catch (err) {
      toast.error('Failed to load guest profiles')
    } finally {
      setLoading(false)
    }
  }

  const filteredProfiles = profiles.filter(p =>
    p.guest_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.guest_email && p.guest_email.toLowerCase().includes(search.toLowerCase()))
  )

  const openDetails = async (guestId: string) => {
    setSelectedGuestId(guestId)
    setDetailsLoading(true)
    try {
      const res = await api.get(`/guests/${guestId}/details`)
      setGuestDetails(res.data)
    } catch (err) {
      toast.error('Failed to load guest details')
    } finally {
      setDetailsLoading(false)
    }
  }

  const getStatusBadge = (profile: GuestProfile) => {
    if (profile.is_in_house) return { label: 'In‑House', color: 'bg-green-100 text-green-800' }
    if (profile.is_expected) return { label: 'Expected', color: 'bg-blue-100 text-blue-800' }
    if (profile.last_departure && new Date(profile.last_departure) < new Date()) return { label: 'Departed', color: 'bg-gray-100 text-gray-800' }
    return { label: 'No stays', color: 'bg-yellow-100 text-yellow-800' }
  }

  if (loading) return <div className="p-4">Loading guest profiles…</div>

  return (
    <div className="space-y-6">
      <div className="relative">
        <input
          type="text"
          placeholder="Search guests by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full p-3 pl-10 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500"
        />
        <span className="absolute left-3 top-3 text-gray-400">🔍</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProfiles.map(profile => {
          const status = getStatusBadge(profile)
          const isReturning = profile.total_stays > 1
          return (
            <div
              key={profile.guest_id}
              className="bg-white rounded-xl shadow-md border p-5 hover:shadow-lg transition cursor-pointer"
              onClick={() => openDetails(profile.guest_id)}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg text-gray-800">
                    {isReturning && <span className="text-amber-500 mr-1">⭐</span>}
                    {profile.guest_name}
                  </h3>
                  {profile.guest_email && (
                    <p className="text-sm text-gray-500">{profile.guest_email}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.color}`}>
                  {status.label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Reservations</span>
                  <p className="font-semibold">{profile.total_reservations}</p>
                </div>
                <div>
                  <span className="text-gray-500">Stays</span>
                  <p className="font-semibold">{profile.total_stays}</p>
                </div>
                <div>
                  <span className="text-gray-500">Last Visit</span>
                  <p className="font-semibold">
                    {profile.last_arrival
                      ? new Date(profile.last_arrival).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Folio Total</span>
                  <p className="font-semibold">${Number(profile.total_folio_amount || 0).toFixed(2)}</p>
                </div>
              </div>

              {isReturning && (
                <div className="mt-3 pt-3 border-t text-xs text-amber-600 font-medium">
                  ⭐ Returning guest · {profile.total_stays} previous stays
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filteredProfiles.length === 0 && (
        <div className="text-center py-12 text-gray-500">No guests match your search.</div>
      )}

      {selectedGuestId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">Reservation History</h2>
              </div>
              <button onClick={() => setSelectedGuestId(null)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>

            {detailsLoading ? (
              <div className="text-center py-8">Loading details…</div>
            ) : (
              <div className="space-y-4">
                {guestDetails.length === 0 ? (
                  <p className="text-gray-500">No reservations found.</p>
                ) : (
                  guestDetails.map(detail => (
                    <div key={detail.id} className="border rounded-lg p-4">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium">{detail.guest_name}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(detail.arrival_date).toLocaleDateString()} → {new Date(detail.departure_date).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500">Status: {detail.status} | Room type: {detail.room_type}</p>
                        </div>
                        <div className="text-right text-sm">
                          {detail.room_number && <p className="font-bold text-green-700">{detail.room_number}</p>}
                          {detail.stay_status && (
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{detail.stay_status}</span>
                          )}
                          {detail.folio_id && <p className="text-xs text-indigo-600">Folio: {detail.folio_id.slice(0,8)}…</p>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}