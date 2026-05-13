'use client'

import { useState, useEffect } from 'react'
import { getReservations, getStays, getRoomsWithCleaning } from '@/lib/api'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import CheckInModal from './CheckInModal'
import type { PendingCheckInGuest } from './ReceptionDashboard'

interface ArrivalData {
  reservationId: string
  guestName: string
  guestEmail?: string
  arrivalDate: string
  departureDate: string
  roomType: string
  guestCount: number
  specialRequests?: string
  status: string
  stayId?: string
  assignedRoom?: string
  cleaningStatus?: string
  source?: string
}

export default function ArrivalGuestCards({
  onAddToQueue,
  pendingQueue,
}: {
  onAddToQueue: (guest: PendingCheckInGuest) => void
  pendingQueue: PendingCheckInGuest[]
}) {
  const [arrivals, setArrivals] = useState<ArrivalData[]>([])
  const [selectedGuest, setSelectedGuest] = useState<ArrivalData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadArrivals = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const [reservations, stays] = await Promise.all([
        getReservations({ status: 'confirmed' }),
        getStays()
      ])
      const todayRes = reservations.filter((r: any) => r.arrival_date.split('T')[0] === today)

      const enriched = await Promise.all(todayRes.map(async (res: any) => {
        const stay = stays.find((s: any) => s.reservation_id === res.id)
        // Skip if already checked in or in queue
        if (stay && stay.status === 'checked_in') return null
        if (pendingQueue.some(g => g.reservationId === res.id)) return null

        let cleaningStatus: string | undefined
        if (stay?.room_number) {
          const roomsData = await getRoomsWithCleaning()
          const room = roomsData.find((r: any) => r.room_number === stay.room_number)
          cleaningStatus = room?.cleaning_status || 'unknown'
        }

        return {
          reservationId: res.id,
          guestName: res.guest_name,
          guestEmail: res.guest_email,
          arrivalDate: res.arrival_date,
          departureDate: res.departure_date,
          roomType: res.room_type || 'Standard',
          guestCount: res.number_of_guests || 1,
          specialRequests: res.special_requests,
          status: res.status,
          stayId: stay?.id,
          assignedRoom: stay?.room_number,
          cleaningStatus,
          source: res.source || 'manual'
        }
      }))

      setArrivals(enriched.filter(Boolean) as ArrivalData[])
    } catch (err) {
      toast.error('Failed to load arrivals')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    loadArrivals()
    const interval = setInterval(loadArrivals, 30000)
    const handler = () => loadArrivals()
    window.addEventListener('guest-checked-in', handler)
    window.addEventListener('reservation-confirmed', handler)
    return () => {
      clearInterval(interval)
      window.removeEventListener('guest-checked-in', handler)
      window.removeEventListener('reservation-confirmed', handler)
    }
  }, [pendingQueue])

  if (loading) return <div className="bg-white rounded-xl shadow p-6 text-center text-gray-500">Loading arrivals…</div>

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">📋 Today's Arrivals ({arrivals.length})</h2>
      {arrivals.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No arrivals today.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {arrivals.map(guest => {
            const isReady = guest.cleaningStatus === 'ready' || guest.cleaningStatus === 'inspected'
            const cardColor = isReady ? 'border-green-300 bg-green-50' : 'border-yellow-300 bg-yellow-50'

            return (
              <div
                key={guest.reservationId}
                className={`rounded-xl border-2 p-4 shadow-sm hover:shadow-md transition cursor-pointer ${cardColor}`}
                onClick={() => setSelectedGuest(guest)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">{guest.guestName}</h3>
                    <p className="text-xs text-gray-500">Res #{guest.reservationId.slice(0,8)}…</p>
                  </div>
                  {!isReady && (
                    <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full font-medium">Cleaning</span>
                  )}
                  {guest.assignedRoom && (
                    <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-medium">Room {guest.assignedRoom}</span>
                  )}
                </div>
                <div className="text-sm space-y-1">
                  <p className="text-gray-600">📅 {format(parseISO(guest.arrivalDate), 'MMM d')} → {format(parseISO(guest.departureDate), 'MMM d')}</p>
                  <p className="text-gray-600">👥 {guest.guestCount} guests · {guest.roomType}</p>
                  {guest.specialRequests && (
                    <p className="text-xs italic text-gray-400 truncate">📝 {guest.specialRequests}</p>
                  )}
                </div>
                <button
                  className="mt-3 w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                  onClick={(e) => { e.stopPropagation(); setSelectedGuest(guest) }}
                >
                  Check In
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Check‑In Modal */}
      {selectedGuest && (
        <CheckInModal
          guest={selectedGuest}
          onClose={() => setSelectedGuest(null)}
          onConfirm={(guest) => {
            onAddToQueue({
              reservationId: guest.reservationId,
              guestName: guest.guestName,
              arrivalDate: guest.arrivalDate,
              departureDate: guest.departureDate,
              roomType: guest.roomType,
              guestCount: guest.guestCount,
              stayId: guest.stayId,
            })
            setSelectedGuest(null)
          }}
        />
      )}
    </div>
  )
}