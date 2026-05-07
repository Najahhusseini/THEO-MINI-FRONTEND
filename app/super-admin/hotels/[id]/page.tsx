'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface Room {
  room_number: string
  floor: number
  room_type: string
  status: string
  out_of_order: boolean
}

interface StaffMember {
  id: string
  name: string
  email: string
  role: string
  phone: string | null
  active: boolean
  is_super_admin: boolean
}

interface Hotel {
  id: string
  name: string
  subdomain: string
  logo_url: string | null
  created_at: string
  rooms: Room[]
  staff: StaffMember[]
}

export default function HotelDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHotel()
  }, [params.id])

  const loadHotel = async () => {
    try {
      const res = await api.get(`/super-admin/hotels/${params.id}`)
      setHotel(res.data)
    } catch (err: any) {
      toast.error('Failed to load hotel details')
      router.push('/super-admin')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="text-center py-12">Loading hotel details…</div>
  if (!hotel) return null

  return (
    <div className="max-w-5xl mx-auto p-6">
      <button onClick={() => router.back()} className="text-blue-600 hover:underline mb-4">&larr; Back</button>

      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h1 className="text-3xl font-bold">{hotel.name}</h1>
        <p className="text-gray-500 mt-1">Subdomain: {hotel.subdomain}.theo.local</p>
        <p className="text-gray-500">Created: {new Date(hotel.created_at).toLocaleDateString()}</p>
      </div>

      {/* Rooms Section */}
      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Rooms ({hotel.rooms.length})</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Room Number</th>
                <th className="py-2 pr-4">Floor</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Out of Order</th>
              </tr>
            </thead>
            <tbody>
              {hotel.rooms.map((room) => (
                <tr key={room.room_number} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{room.room_number}</td>
                  <td className="py-2 pr-4">{room.floor}</td>
                  <td className="py-2 pr-4">{room.room_type}</td>
                  <td className="py-2 pr-4">{room.status}</td>
                  <td className="py-2">{room.out_of_order ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Section */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-bold mb-4">Staff ({hotel.staff.length})</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {hotel.staff.map((staff) => (
                <tr key={staff.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{staff.name}</td>
                  <td className="py-2 pr-4">{staff.email}</td>
                  <td className="py-2 pr-4 capitalize">{staff.role.replace('_', ' ')}</td>
                  <td className="py-2 pr-4">{staff.phone || '—'}</td>
                  <td className="py-2">{staff.active ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}