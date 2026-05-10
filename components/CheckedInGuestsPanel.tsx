'use client'

import { useState, useEffect } from 'react'
import { getStays, toggleKeyIssued } from '@/lib/api'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
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

  const loadStays = async () => {
    try {
      const all = await getStays()
      const checkedIn = all.filter((s: any) => s.status === 'checked_in')
      setStays(checkedIn)
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
      toast.error(err.response?.data?.error || 'Failed to update key status')
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

  if (loading) return <div className="text-center py-4">Loading checked‑in guests…</div>

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">🔑 Checked‑In Guests</h2>
      {stays.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No guests are currently checked in.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stays.map(stay => (
            <div key={stay.id} className="bg-white rounded-lg shadow p-4 border">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-gray-800">{stay.guest_name}</div>
                  <div className="text-sm text-gray-600">Room {stay.room_number}</div>
                  <div className="text-xs text-gray-500 mt-1">Departure: {stay.departure_date ? format(parseISO(stay.departure_date), 'MMM d, yyyy') : 'N/A'}</div>
                </div>
                <label className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={stay.key_issued || false} onChange={() => handleToggleKey(stay.id, stay.key_issued)} className="w-4 h-4" />
                  {stay.key_issued ? 'Key issued' : 'Key returned'}
                </label>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setFolioStayId(stay.id)} className="flex-1 px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">📋 Folio</button>
                <button onClick={() => handleCheckOut(stay.id)} disabled={stay.key_issued} className={`flex-1 px-3 py-1.5 text-sm rounded ${stay.key_issued ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>🏁 Check‑Out</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {folioStayId && <GuestFolioModal stayId={folioStayId} onClose={() => setFolioStayId(null)} />}
    </div>
  )
}