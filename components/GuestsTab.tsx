'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'

interface Guest {
  guest_name: string
  reservation_id: string
  stay_status: string
  folio_id: string | null
  room_number: string
  arrival_date: string
  departure_date: string
}

export default function GuestsTab() {
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const res = await api.get('/admin-staff/guests')
      setGuests(res.data)
    } finally { setLoading(false) }
  }

  if (loading) return <div className="p-4">Loading guests...</div>

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-4">Guest Profiles</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left bg-gray-50">
              <th className="py-2 px-3">Guest Name</th>
              <th className="py-2 px-3">Reservation ID</th>
              <th className="py-2 px-3">Folio ID</th>
              <th className="py-2 px-3">Room</th>
              <th className="py-2 px-3">Stay Status</th>
              <th className="py-2 px-3">Dates</th>
            </tr>
          </thead>
          <tbody>
            {guests.map((g, i) => (
              <tr key={i} className="border-t">
                <td className="py-1 px-3">{g.guest_name}</td>
                <td className="py-1 px-3 text-xs font-mono">{g.reservation_id.slice(0,8)}...</td>
                <td className="py-1 px-3 text-xs font-mono">{g.folio_id ? g.folio_id.slice(0,8) + '...' : '-'}</td>
                <td className="py-1 px-3">{g.room_number || '-'}</td>
                <td className="py-1 px-3 capitalize">{g.stay_status.replace('_', ' ')}</td>
                <td className="py-1 px-3 text-xs">{new Date(g.arrival_date).toLocaleDateString()} - {new Date(g.departure_date).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {guests.length === 0 && <p className="text-center text-gray-500 py-4">No guests found.</p>}
      </div>
    </div>
  )
}