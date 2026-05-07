'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface Hotel {
  id: string
  name: string
  subdomain: string
  created_at: string
  room_count: number
  staff_count: number
}

interface StaffAssignment {
  role: string
  email: string
}

const ALL_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'frontdesk', label: 'Front Desk' },
  { value: 'reservation_manager', label: 'Reservation Manager' },
  { value: 'head_housekeeping', label: 'Head Housekeeping' },
  { value: 'housekeeping', label: 'Housekeeping' },
]

export default function SuperAdminDashboard() {
  const { staff: authStaff } = useAuth()
  const [staff, setStaff] = useState<any>(null)
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [hotelName, setHotelName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [floors, setFloors] = useState(2)
  const [roomsPerFloor, setRoomsPerFloor] = useState(10)
  const [customRoomNumbers, setCustomRoomNumbers] = useState('')
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignment[]>([{ role: 'admin', email: '' }])
  const [submitting, setSubmitting] = useState(false)

  const isSuperAdmin = staff?.isSuperAdmin === true

  useEffect(() => {
    if (authStaff) {
      setStaff(authStaff)
    } else {
      const stored = localStorage.getItem('staff')
      if (stored) {
        try { setStaff(JSON.parse(stored)) } catch {}
      }
    }
  }, [authStaff])

  useEffect(() => {
    if (!isSuperAdmin) return
    loadHotels()
  }, [isSuperAdmin])

  const loadHotels = async () => {
    try {
      const res = await api.get('/super-admin/hotels')
      setHotels(res.data)
    } catch (err) {
      toast.error('Failed to load hotels')
    } finally {
      setLoading(false)
    }
  }

  const addStaffField = () => {
    setStaffAssignments([...staffAssignments, { role: 'housekeeping', email: '' }])
  }
  const removeStaffField = (i: number) => {
    setStaffAssignments(staffAssignments.filter((_, idx) => idx !== i))
  }
  const updateStaff = (i: number, field: keyof StaffAssignment, value: string) => {
    const updated = [...staffAssignments]
    updated[i] = { ...updated[i], [field]: value }
    setStaffAssignments(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hotelName.trim() || !subdomain.trim()) {
      toast.error('Hotel name and subdomain are required')
      return
    }
    if (staffAssignments.some(s => !s.email.trim())) {
      toast.error('All staff emails are required')
      return
    }

    let roomNumbers: string[] | undefined
    if (customRoomNumbers.trim()) {
      roomNumbers = customRoomNumbers.split(',').map(r => r.trim()).filter(Boolean)
    }

    setSubmitting(true)
    try {
      await api.post('/super-admin/register-hotel', {
        hotelName: hotelName.trim(),
        subdomain: subdomain.trim(),
        floors: customRoomNumbers.trim() ? undefined : floors,
        roomsPerFloor: customRoomNumbers.trim() ? undefined : roomsPerFloor,
        roomNumbers: roomNumbers || undefined,
        staffAssignments: staffAssignments.map(s => ({ role: s.role, email: s.email.trim() })),
        amenities: [],
      })
      toast.success('Hotel registered!')
      setShowForm(false)
      loadHotels()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">Access denied. Please log in as a super‑admin.</p>
        <a href="/super-admin/login" className="text-blue-600 hover:underline">Go to Login</a>
      </div>
    )
  }

  if (loading) return <div className="text-center py-12">Loading hotels…</div>

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">THEO Hotel Management</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700"
        >
          + Register New Hotel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {hotels.map(hotel => (
          <Link key={hotel.id} href={`/super-admin/hotels/${hotel.id}`} className="block">
            <div className="bg-white rounded-xl shadow p-5 border hover:shadow-lg transition cursor-pointer">
              <h2 className="text-xl font-bold">{hotel.name}</h2>
              <p className="text-sm text-gray-500">{hotel.subdomain}.theo.local</p>
              <div className="mt-3 text-sm text-gray-600">
                <div>Rooms: {hotel.room_count}</div>
                <div>Staff: {hotel.staff_count}</div>
                <div>Created: {new Date(hotel.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Register New Hotel</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Hotel Name *</label>
                  <input type="text" value={hotelName} onChange={e => setHotelName(e.target.value)} required className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Subdomain *</label>
                  <input type="text" value={subdomain} onChange={e => setSubdomain(e.target.value)} required className="w-full p-2 border rounded" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Floors</label>
                  <input type="number" min="1" value={floors} onChange={e => setFloors(parseInt(e.target.value) || 1)} className="w-full p-2 border rounded" disabled={!!customRoomNumbers.trim()} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rooms per Floor</label>
                  <input type="number" min="1" value={roomsPerFloor} onChange={e => setRoomsPerFloor(parseInt(e.target.value) || 1)} className="w-full p-2 border rounded" disabled={!!customRoomNumbers.trim()} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Custom Room Numbers (comma separated)</label>
                <input type="text" value={customRoomNumbers} onChange={e => setCustomRoomNumbers(e.target.value)} placeholder="101, 102, 201, 202" className="w-full p-2 border rounded" />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Staff Assignments</h3>
                {staffAssignments.map((assign, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <select value={assign.role} onChange={e => updateStaff(idx, 'role', e.target.value)} className="p-2 border rounded flex-1">
                      {ALL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <input type="email" placeholder="email@example.com" value={assign.email} onChange={e => updateStaff(idx, 'email', e.target.value)} className="p-2 border rounded flex-1" required />
                    <button type="button" onClick={() => removeStaffField(idx)} className="text-red-500 hover:text-red-700">&times;</button>
                  </div>
                ))}
                <button type="button" onClick={addStaffField} className="text-sm text-blue-600 hover:text-blue-800">+ Add Staff Member</button>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 disabled:opacity-50">
                  {submitting ? 'Registering...' : 'Register Hotel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}