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
  phone?: string | null
  address?: any
  amenities?: string[]
  email_inbox_config?: any
}

interface StaffAssignment {
  name: string
  email: string
  role: string
  password: string
  phone: string
}

interface FloorEntry {
  floor: number
  count: number
}

interface RoomTypeBlock {
  roomType: string
  floors: FloorEntry[]
}

const ALL_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'frontdesk', label: 'Front Desk' },
  { value: 'reservation_manager', label: 'Reservation Manager' },
  { value: 'head_housekeeping', label: 'Head Housekeeping' },
  { value: 'housekeeping', label: 'Housekeeping' },
]

const AMENITIES_LIST = [
  'Pool', 'Spa', 'Restaurant', 'Bar', 'Gym', 'Room Service',
  'Laundry', 'Parking', 'Airport Shuttle', 'Business Centre',
  'Meeting Rooms', 'Pet-friendly', 'Wheelchair Accessible',
  'Concierge', 'Currency Exchange', 'Free WiFi', 'Breakfast Included'
]

export default function SuperAdminDashboard() {
  const { staff: authStaff } = useAuth()
  const [staff, setStaff] = useState<any>(null)
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [hotelName, setHotelName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [address, setAddress] = useState({ line1: '', line2: '', city: '', state: '', postalCode: '' })
  const [phone, setPhone] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  // Email inbox
  const [emailInbox, setEmailInbox] = useState({
    email: '', protocol: 'IMAP', server: '', port: '', username: '', password: ''
  })

  // Amenities
  const [amenities, setAmenities] = useState<string[]>([])

  // Staff
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignment[]>([
    { name: '', email: '', role: 'admin', password: '', phone: '' }
  ])

  // Room configuration
  const [roomConfiguration, setRoomConfiguration] = useState<RoomTypeBlock[]>([
    { roomType: '', floors: [{ floor: 1, count: 1 }] }
  ])

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

  // --- Staff helpers ---
  const addStaffField = () => {
    setStaffAssignments([...staffAssignments, { name: '', email: '', role: 'housekeeping', password: '', phone: '' }])
  }
  const removeStaffField = (i: number) => {
    setStaffAssignments(staffAssignments.filter((_, idx) => idx !== i))
  }
  const updateStaff = (i: number, field: keyof StaffAssignment, value: string) => {
    const updated = [...staffAssignments]
    updated[i] = { ...updated[i], [field]: value }
    setStaffAssignments(updated)
  }

  // --- Room type block helpers ---
  const addRoomTypeBlock = () => {
    setRoomConfiguration([...roomConfiguration, { roomType: '', floors: [{ floor: 1, count: 1 }] }])
  }
  const removeRoomTypeBlock = (blockIndex: number) => {
    setRoomConfiguration(roomConfiguration.filter((_, idx) => idx !== blockIndex))
  }
  const updateRoomType = (blockIndex: number, value: string) => {
    const updated = [...roomConfiguration]
    updated[blockIndex].roomType = value
    setRoomConfiguration(updated)
  }
  const addFloorEntry = (blockIndex: number) => {
    const updated = [...roomConfiguration]
    updated[blockIndex].floors.push({ floor: 1, count: 1 })
    setRoomConfiguration(updated)
  }
  const removeFloorEntry = (blockIndex: number, floorIndex: number) => {
    const updated = [...roomConfiguration]
    updated[blockIndex].floors = updated[blockIndex].floors.filter((_, idx) => idx !== floorIndex)
    setRoomConfiguration(updated)
  }
  const updateFloorEntry = (blockIndex: number, floorIndex: number, field: keyof FloorEntry, value: number) => {
    const updated = [...roomConfiguration]
    updated[blockIndex].floors[floorIndex] = { ...updated[blockIndex].floors[floorIndex], [field]: value }
    setRoomConfiguration(updated)
  }

  const toggleAmenity = (amenity: string) => {
    setAmenities(prev => prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity])
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
    if (roomConfiguration.some(block => !block.roomType.trim())) {
      toast.error('All room types must have a name')
      return
    }

    const payload = {
      hotelName: hotelName.trim(),
      subdomain: subdomain.trim(),
      address: Object.values(address).some(v => v) ? address : undefined,
      phone: phone.trim() || undefined,
      logoUrl: logoUrl.trim() || undefined,
      emailInboxConfig: emailInbox.email ? emailInbox : undefined,
      amenities: amenities.length > 0 ? amenities : undefined,
      staffAssignments: staffAssignments.map(s => ({
        name: s.name.trim() || undefined,
        email: s.email.trim(),
        role: s.role,
        password: s.password || undefined,
        phone: s.phone.trim() || undefined,
      })),
      roomConfiguration: roomConfiguration
        .filter(block => block.roomType.trim())
        .map(block => ({
          roomType: block.roomType.trim(),
          floors: block.floors.filter(f => f.count > 0).map(f => ({ floor: f.floor, count: f.count })),
        })),
    }

    setSubmitting(true)
    try {
      await api.post('/super-admin/register-hotel', payload)
      toast.success('Hotel registered!')
      resetForm()
      setShowForm(false)
      loadHotels()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setHotelName('')
    setSubdomain('')
    setAddress({ line1: '', line2: '', city: '', state: '', postalCode: '' })
    setPhone('')
    setLogoUrl('')
    setEmailInbox({ email: '', protocol: 'IMAP', server: '', port: '', username: '', password: '' })
    setAmenities([])
    setStaffAssignments([{ name: '', email: '', role: 'admin', password: '', phone: '' }])
    setRoomConfiguration([{ roomType: '', floors: [{ floor: 1, count: 1 }] }])
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

      {/* Registration Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Register New Hotel</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Hotel Info */}
              <section>
                <h3 className="text-lg font-semibold mb-3 border-b pb-1">Hotel Information</h3>
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
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone</label>
                    <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Logo URL</label>
                    <input type="text" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className="w-full p-2 border rounded" />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Line 1" value={address.line1} onChange={e => setAddress({...address, line1: e.target.value})} className="p-2 border rounded" />
                    <input type="text" placeholder="Line 2" value={address.line2} onChange={e => setAddress({...address, line2: e.target.value})} className="p-2 border rounded" />
                    <input type="text" placeholder="City" value={address.city} onChange={e => setAddress({...address, city: e.target.value})} className="p-2 border rounded" />
                    <input type="text" placeholder="State" value={address.state} onChange={e => setAddress({...address, state: e.target.value})} className="p-2 border rounded" />
                    <input type="text" placeholder="Postal Code" value={address.postalCode} onChange={e => setAddress({...address, postalCode: e.target.value})} className="p-2 border rounded col-span-2" />
                  </div>
                </div>
              </section>

              {/* Email Inbox */}
              <section>
                <h3 className="text-lg font-semibold mb-3 border-b pb-1">Email Inbox (THEO Integration)</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Email Address</label>
                    <input type="email" value={emailInbox.email} onChange={e => setEmailInbox({...emailInbox, email: e.target.value})} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Protocol</label>
                    <select value={emailInbox.protocol} onChange={e => setEmailInbox({...emailInbox, protocol: e.target.value})} className="w-full p-2 border rounded">
                      <option value="IMAP">IMAP</option>
                      <option value="POP3">POP3</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Server</label>
                    <input type="text" value={emailInbox.server} onChange={e => setEmailInbox({...emailInbox, server: e.target.value})} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Port</label>
                    <input type="number" value={emailInbox.port} onChange={e => setEmailInbox({...emailInbox, port: e.target.value})} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Username</label>
                    <input type="text" value={emailInbox.username} onChange={e => setEmailInbox({...emailInbox, username: e.target.value})} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Password</label>
                    <input type="password" value={emailInbox.password} onChange={e => setEmailInbox({...emailInbox, password: e.target.value})} className="w-full p-2 border rounded" />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">All fields optional – configure later if needed.</p>
              </section>

              {/* Amenities */}
              <section>
                <h3 className="text-lg font-semibold mb-3 border-b pb-1">Amenities</h3>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {AMENITIES_LIST.map(amenity => (
                    <label key={amenity} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={amenities.includes(amenity)}
                        onChange={() => toggleAmenity(amenity)}
                        className="rounded"
                      />
                      {amenity}
                    </label>
                  ))}
                </div>
              </section>

              {/* Staff */}
              <section>
                <h3 className="text-lg font-semibold mb-3 border-b pb-1">Staff Assignments</h3>
                {staffAssignments.map((assign, idx) => (
                  <div key={idx} className="grid grid-cols-5 gap-2 mb-3 items-start">
                    <input type="text" placeholder="Name" value={assign.name} onChange={e => updateStaff(idx, 'name', e.target.value)} className="p-2 border rounded" />
                    <input type="email" placeholder="Email *" value={assign.email} onChange={e => updateStaff(idx, 'email', e.target.value)} required className="p-2 border rounded" />
                    <select value={assign.role} onChange={e => updateStaff(idx, 'role', e.target.value)} className="p-2 border rounded">
                      {ALL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <input type="password" placeholder="Password (default: changeme123)" value={assign.password} onChange={e => updateStaff(idx, 'password', e.target.value)} className="p-2 border rounded" />
                    <div className="flex gap-2">
                      <input type="text" placeholder="Phone" value={assign.phone} onChange={e => updateStaff(idx, 'phone', e.target.value)} className="p-2 border rounded flex-1" />
                      <button type="button" onClick={() => removeStaffField(idx)} className="text-red-500 hover:text-red-700 px-2">&times;</button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addStaffField} className="text-sm text-blue-600 hover:text-blue-800">+ Add Staff Member</button>
              </section>

              {/* Room Configuration */}
              <section>
                <h3 className="text-lg font-semibold mb-3 border-b pb-1">Room Configuration</h3>
                {roomConfiguration.map((block, blockIndex) => (
                  <div key={blockIndex} className="mb-6 p-4 border rounded-lg bg-gray-50">
                    <div className="flex items-center gap-4 mb-3">
                      <label className="text-sm font-medium">Room Type:</label>
                      <input
                        type="text"
                        placeholder="e.g. Deluxe, Standard"
                        value={block.roomType}
                        onChange={e => updateRoomType(blockIndex, e.target.value)}
                        className="p-2 border rounded flex-1"
                        required
                      />
                      <button type="button" onClick={() => removeRoomTypeBlock(blockIndex)} className="text-red-500 hover:text-red-700 text-sm">
                        Remove Type
                      </button>
                    </div>
                    <div className="space-y-2">
                      {block.floors.map((floorEntry, floorIndex) => (
                        <div key={floorIndex} className="flex items-center gap-4">
                          <span className="text-sm w-24">Floor:</span>
                          <input
                            type="number"
                            min="1"
                            value={floorEntry.floor}
                            onChange={e => updateFloorEntry(blockIndex, floorIndex, 'floor', parseInt(e.target.value) || 1)}
                            className="p-2 border rounded w-20"
                          />
                          <span className="text-sm">Rooms:</span>
                          <input
                            type="number"
                            min="1"
                            value={floorEntry.count}
                            onChange={e => updateFloorEntry(blockIndex, floorIndex, 'count', parseInt(e.target.value) || 0)}
                            className="p-2 border rounded w-20"
                          />
                          <button type="button" onClick={() => removeFloorEntry(blockIndex, floorIndex)} className="text-red-500 hover:text-red-700 text-sm">
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => addFloorEntry(blockIndex)} className="text-sm text-blue-600 hover:text-blue-800 mt-2">
                      + Add Floor for this Type
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addRoomTypeBlock} className="text-sm text-blue-600 hover:text-blue-800">
                  + Add Another Room Type
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Room numbers generated as Floor + sequence (e.g., 101, 102, 201...). Custom numbering can be added later.
                </p>
              </section>

              <div className="flex gap-4">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
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