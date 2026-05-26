'use client'

import { useState, useEffect } from 'react'
import { getStays, toggleKeyIssued } from '@/lib/api'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { format, parseISO, differenceInDays } from 'date-fns'
import GuestFolioModal from './GuestFolioModal'

interface Stay {
  id: string
  guest_name: string
  room_number: string
  departure_date: string
  key_issued: boolean
  status: string
}

export default function CheckedInGuestsPanel() {
  const [stays, setStays] = useState<Stay[]>([])
  const [loading, setLoading] = useState(true)
  const [folioStayId, setFolioStayId] = useState<string | null>(null)

  // Extend stay state
  const [extendStayId, setExtendStayId] = useState<string | null>(null)
  const [extendRoomNumber, setExtendRoomNumber] = useState('')
  const [extendCurrentDeparture, setExtendCurrentDeparture] = useState('')
  const [extendNewDeparture, setExtendNewDeparture] = useState('')
  const [extendPricePerNight, setExtendPricePerNight] = useState(0)
  const [extendSubmitting, setExtendSubmitting] = useState(false)

  const loadStays = async () => {
    try {
      const all = await getStays()
      setStays(all.filter((s: any) => s.status === 'checked_in'))
    } catch (err) {
      toast.error('Failed to load stays')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    loadStays()
    const interval = setInterval(loadStays, 15000)
    const handler = () => loadStays()
    window.addEventListener('guest-checked-in', handler)
    window.addEventListener('refresh-rooms', handler)
    return () => {
      clearInterval(interval)
      window.removeEventListener('guest-checked-in', handler)
      window.removeEventListener('refresh-rooms', handler)
    }
  }, [])

  const handleToggleKey = async (stayId: string, current: boolean) => {
    try {
      await toggleKeyIssued(stayId, !current)
      toast.success(!current ? 'Key issued' : 'Key returned')
      loadStays()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update key')
    }
  }

  const handleCheckOut = async (stayId: string) => {
    const stay = stays.find(s => s.id === stayId)
    if (stay && stay.key_issued) {
      toast.error('Please return the key before checkout')
      return
    }
    if (!confirm('Check out this guest?')) return
    try {
      await api.post(`/reservations/stays/${stayId}/check-out`)
      toast.success('Guest checked out')
      loadStays()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Check‑out failed')
    }
  }

  const openExtendModal = (stay: Stay) => {
    setExtendStayId(stay.id)
    setExtendRoomNumber(stay.room_number)
    setExtendCurrentDeparture(stay.departure_date.split('T')[0])
    setExtendNewDeparture(stay.departure_date.split('T')[0])
    // Fetch price per night for this room
    fetchRoomPrice(stay.room_number)
  }

  const fetchRoomPrice = async (roomNumber: string) => {
    try {
      const res = await api.get(`/rooms/price?room_number=${roomNumber}`) // You may need an endpoint
      // Fallback: if no endpoint, we can assume a default or calculate later
      setExtendPricePerNight(res.data.price_per_night || 0)
    } catch {
      setExtendPricePerNight(0)
    }
  }

  const calculateExtraCost = () => {
    if (!extendCurrentDeparture || !extendNewDeparture) return 0
    const current = parseISO(extendCurrentDeparture)
    const newDate = parseISO(extendNewDeparture)
    if (newDate <= current) return 0
    const extraDays = differenceInDays(newDate, current)
    return extraDays * extendPricePerNight
  }

  const handleExtendStay = async () => {
    if (!extendStayId || !extendNewDeparture) return
    const currentDate = parseISO(extendCurrentDeparture)
    const newDate = parseISO(extendNewDeparture)
    if (newDate <= currentDate) {
      toast.error('New departure date must be after current departure')
      return
    }
    setExtendSubmitting(true)
    try {
      await api.post(`/reservations/stays/${extendStayId}/extend`, {
        newDepartureDate: extendNewDeparture
      })
      toast.success('Stay extended successfully')
      setExtendStayId(null)
      loadStays()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to extend stay')
    } finally {
      setExtendSubmitting(false)
    }
  }

  if (loading) return <div className="text-center py-4 text-gray-500">Loading checked‑in guests…</div>

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-gray-800">🔑 Checked‑In Guests</h2>
      {stays.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No guests are currently checked in.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stays.map(stay => (
            <div key={stay.id} className="bg-gray-50 rounded-xl p-4 border">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-gray-800">{stay.guest_name}</h3>
                  <p className="text-sm text-gray-600">Room {stay.room_number}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Departure: {stay.departure_date ? format(parseISO(stay.departure_date), 'MMM d, yyyy') : 'N/A'}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stay.key_issued || false}
                    onChange={() => handleToggleKey(stay.id, stay.key_issued)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className={stay.key_issued ? 'text-green-700 font-medium' : 'text-gray-500'}>
                    {stay.key_issued ? 'Key issued' : 'Key returned'}
                  </span>
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFolioStayId(stay.id)}
                  className="flex-1 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 transition"
                >
                  📋 Folio
                </button>
                <button
                  onClick={() => openExtendModal(stay)}
                  className="flex-1 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition"
                >
                  ➕ Extend
                </button>
                <button
                  onClick={() => handleCheckOut(stay.id)}
                  disabled={stay.key_issued}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                    stay.key_issued
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                >
                  🏁 Check‑Out
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {folioStayId && <GuestFolioModal stayId={folioStayId} onClose={() => setFolioStayId(null)} />}

      {/* Extend Stay Modal */}
      {extendStayId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Extend Stay</h3>
              <button onClick={() => setExtendStayId(null)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
                <input type="text" value={extendRoomNumber} disabled className="w-full p-2 border rounded bg-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Departure Date</label>
                <input type="date" value={extendCurrentDeparture} disabled className="w-full p-2 border rounded bg-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Departure Date</label>
                <input
                  type="date"
                  value={extendNewDeparture}
                  onChange={(e) => setExtendNewDeparture(e.target.value)}
                  min={extendCurrentDeparture}
                  className="w-full p-2 border rounded"
                />
              </div>
              {extendPricePerNight > 0 && (
                <div className="text-sm text-gray-600">
                  Extra nights: {Math.max(0, differenceInDays(parseISO(extendNewDeparture), parseISO(extendCurrentDeparture)))}<br />
                  Price per night: ${extendPricePerNight}<br />
                  <span className="font-bold">Additional charge: ${calculateExtraCost().toFixed(2)}</span>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button onClick={() => setExtendStayId(null)} className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleExtendStay} disabled={extendSubmitting} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {extendSubmitting ? 'Extending...' : 'Confirm Extension'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}