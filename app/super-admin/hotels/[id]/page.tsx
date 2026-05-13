'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import AdminStaffManager from '@/components/AdminStaffManager'
import StickyNoteBadge from '@/components/StickyNoteBadge'

// Types for the hotel object
interface Hotel {
  id: string
  name: string
  subdomain: string
  logo_url: string | null
  phone: string | null
  address: any
  amenities: string[] | null
  email_inbox_config: any
  max_staff: number
  created_at: string
  rooms: Room[]
  staff: StaffMember[]
}

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

// Form blocks (same as registration)
interface FloorEntry { floor: number; count: number }
interface RoomTypeBlock { roomType: string; floors: FloorEntry[] }

const AMENITIES_LIST = [
  'Pool', 'Spa', 'Restaurant', 'Bar', 'Gym', 'Room Service',
  'Laundry', 'Parking', 'Airport Shuttle', 'Business Centre',
  'Meeting Rooms', 'Pet-friendly', 'Wheelchair Accessible',
  'Concierge', 'Currency Exchange', 'Free WiFi', 'Breakfast Included'
]

export default function HotelDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [loading, setLoading] = useState(true)

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editTab, setEditTab] = useState<'info' | 'rooms' | 'staff' | 'amenities' | 'email'>('info')
  const [saving, setSaving] = useState(false)

  // Form data for edit
  const [editData, setEditData] = useState({
    hotelName: '',
    subdomain: '',
    address: { line1: '', line2: '', city: '', state: '', postalCode: '' },
    phone: '',
    logoUrl: '',
    maxStaff: 20,
    emailInboxConfig: { email: '', protocol: 'IMAP', server: '', port: '', username: '', password: '' },
    amenities: [] as string[],
    roomConfiguration: [] as RoomTypeBlock[],
  })

  // Load hotel data
  useEffect(() => {
    loadHotel()
  }, [params.id])

  const loadHotel = async () => {
    try {
      const res = await api.get(`/super-admin/hotels/${params.id}`)
      setHotel(res.data)
      // Pre-fill edit data from hotel
      setEditData({
        hotelName: res.data.name,
        subdomain: res.data.subdomain,
        address: res.data.address || { line1: '', line2: '', city: '', state: '', postalCode: '' },
        phone: res.data.phone || '',
        logoUrl: res.data.logo_url || '',
        maxStaff: res.data.max_staff || 20,
        emailInboxConfig: res.data.email_inbox_config || { email: '', protocol: 'IMAP', server: '', port: '', username: '', password: '' },
        amenities: res.data.amenities || [],
        roomConfiguration: convertRoomsToConfig(res.data.rooms || []),
      })
    } catch (err: any) {
      toast.error('Failed to load hotel details')
      router.push('/super-admin')
    } finally {
      setLoading(false)
    }
  }

  // Convert flat room list back to room type blocks for the editor
  const convertRoomsToConfig = (rooms: Room[]): RoomTypeBlock[] => {
    const map = new Map<string, Map<number, number>>() // roomType -> floor -> count
    for (const room of rooms) {
      if (!map.has(room.room_type)) map.set(room.room_type, new Map())
      const floorMap = map.get(room.room_type)!
      floorMap.set(room.floor, (floorMap.get(room.floor) || 0) + 1)
    }
    const blocks: RoomTypeBlock[] = []
    for (const [roomType, floorMap] of map.entries()) {
      const floors: FloorEntry[] = []
      for (const [floor, count] of floorMap.entries()) {
        floors.push({ floor, count })
      }
      blocks.push({ roomType, floors })
    }
    return blocks.length > 0 ? blocks : [{ roomType: '', floors: [{ floor: 1, count: 1 }] }]
  }

  // Edit helpers (similar to registration form)
  const addRoomTypeBlock = () => setEditData(prev => ({ ...prev, roomConfiguration: [...prev.roomConfiguration, { roomType: '', floors: [{ floor: 1, count: 1 }] }] }))
  const removeRoomTypeBlock = (i: number) => setEditData(prev => ({ ...prev, roomConfiguration: prev.roomConfiguration.filter((_, idx) => idx !== i) }))
  const updateRoomType = (i: number, val: string) => {
    const updated = [...editData.roomConfiguration]
    updated[i] = { ...updated[i], roomType: val }
    setEditData(prev => ({ ...prev, roomConfiguration: updated }))
  }
  const addFloorEntry = (blockIdx: number) => {
    const updated = [...editData.roomConfiguration]
    updated[blockIdx] = { ...updated[blockIdx], floors: [...updated[blockIdx].floors, { floor: 1, count: 1 }] }
    setEditData(prev => ({ ...prev, roomConfiguration: updated }))
  }
  const removeFloorEntry = (blockIdx: number, floorIdx: number) => {
    const updated = [...editData.roomConfiguration]
    updated[blockIdx] = { ...updated[blockIdx], floors: updated[blockIdx].floors.filter((_, idx) => idx !== floorIdx) }
    setEditData(prev => ({ ...prev, roomConfiguration: updated }))
  }
  const updateFloorEntry = (blockIdx: number, floorIdx: number, field: keyof FloorEntry, value: number) => {
    const updated = [...editData.roomConfiguration]
    const floors = [...updated[blockIdx].floors]
    floors[floorIdx] = { ...floors[floorIdx], [field]: value }
    updated[blockIdx] = { ...updated[blockIdx], floors }
    setEditData(prev => ({ ...prev, roomConfiguration: updated }))
  }
  const toggleAmenity = (a: string) => setEditData(prev => ({ ...prev, amenities: prev.amenities.includes(a) ? prev.amenities.filter(x => x !== a) : [...prev.amenities, a] }))

  // Save handler
  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/super-admin/hotels/${params.id}`, {
        hotelName: editData.hotelName,
        subdomain: editData.subdomain,
        address: editData.address,
        phone: editData.phone,
        logoUrl: editData.logoUrl,
        maxStaff: editData.maxStaff,
        emailInboxConfig: editData.emailInboxConfig,
        amenities: editData.amenities,
        roomConfiguration: editData.roomConfiguration
          .filter(b => b.roomType.trim())
          .map(b => ({ roomType: b.roomType.trim(), floors: b.floors.filter(f => f.count > 0) })),
      })
      toast.success('Hotel updated!')
      setShowEditModal(false)
      loadHotel() // refresh
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-12">Loading hotel details…</div>
  if (!hotel) return null

  return (
    <div className="max-w-5xl mx-auto p-6">
      <button onClick={() => router.back()} className="text-blue-600 hover:underline mb-4">&larr; Back</button>

      <div className="bg-white rounded-xl shadow p-6 mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{hotel.name}</h1>
          <p className="text-gray-500">{hotel.subdomain}.theo.local</p>
          <div className="mt-2 text-sm text-gray-600">
            <p>Phone: {hotel.phone || '—'}</p>
            <p>Max Staff: {hotel.max_staff}</p>
            <p>Created: {new Date(hotel.created_at).toLocaleDateString()}</p>
          </div>
          {hotel.amenities && hotel.amenities.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {hotel.amenities.map(a => (
                <span key={a} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{a}</span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowEditModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          ✏️ Edit Hotel
        </button>
      </div>

      {/* Rooms Table */}
      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Rooms ({hotel.rooms.length})</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left border-b"><th className="py-2 pr-4">Room</th><th>Floor</th><th>Type</th><th>Status</th><th>Out of Order</th></tr></thead>
            <tbody>
              {hotel.rooms.map(r => (
                <tr key={r.room_number} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{r.room_number}</td>
                  <td>{r.floor}</td>
                  <td>{r.room_type}</td>
                  <td>{r.status}</td>
                  <td>{r.out_of_order ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-bold mb-4">Staff ({hotel.staff.length})</h2>
        <AdminStaffManager />
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Edit Hotel</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b pb-2">
              {(['info','rooms','staff','amenities','email'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setEditTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg ${editTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  {tab === 'info' ? 'Hotel Info' : tab === 'rooms' ? 'Rooms' : tab === 'staff' ? 'Staff' : tab === 'amenities' ? 'Amenities' : 'Email'}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {editTab === 'info' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Hotel Name *</label>
                    <input type="text" value={editData.hotelName} onChange={e => setEditData(prev => ({...prev, hotelName: e.target.value}))} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Subdomain *</label>
                    <input type="text" value={editData.subdomain} onChange={e => setEditData(prev => ({...prev, subdomain: e.target.value}))} className="w-full p-2 border rounded" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone</label>
                    <input type="text" value={editData.phone} onChange={e => setEditData(prev => ({...prev, phone: e.target.value}))} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Logo URL</label>
                    <input type="text" value={editData.logoUrl} onChange={e => setEditData(prev => ({...prev, logoUrl: e.target.value}))} className="w-full p-2 border rounded" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Staff</label>
                  <input type="number" min="1" value={editData.maxStaff} onChange={e => setEditData(prev => ({...prev, maxStaff: parseInt(e.target.value) || 20}))} className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Line 1" value={editData.address.line1} onChange={e => setEditData(prev => ({...prev, address: {...prev.address, line1: e.target.value}}))} className="p-2 border rounded" />
                    <input type="text" placeholder="Line 2" value={editData.address.line2} onChange={e => setEditData(prev => ({...prev, address: {...prev.address, line2: e.target.value}}))} className="p-2 border rounded" />
                    <input type="text" placeholder="City" value={editData.address.city} onChange={e => setEditData(prev => ({...prev, address: {...prev.address, city: e.target.value}}))} className="p-2 border rounded" />
                    <input type="text" placeholder="State" value={editData.address.state} onChange={e => setEditData(prev => ({...prev, address: {...prev.address, state: e.target.value}}))} className="p-2 border rounded" />
                    <input type="text" placeholder="Postal Code" value={editData.address.postalCode} onChange={e => setEditData(prev => ({...prev, address: {...prev.address, postalCode: e.target.value}}))} className="p-2 border rounded col-span-2" />
                  </div>
                </div>
              </div>
            )}

            {editTab === 'rooms' && (
              <div className="space-y-4">
                {editData.roomConfiguration.map((block, idx) => (
                  <div key={idx} className="p-4 border rounded bg-gray-50">
                    <div className="flex items-center gap-4 mb-2">
                      <label className="text-sm font-medium">Room Type:</label>
                      <input type="text" value={block.roomType} onChange={e => updateRoomType(idx, e.target.value)} className="p-2 border rounded flex-1" />
                      <button onClick={() => removeRoomTypeBlock(idx)} className="text-red-500 text-sm">Remove</button>
                    </div>
                    {block.floors.map((f, fi) => (
                      <div key={fi} className="flex items-center gap-4 ml-4 mb-1">
                        <span className="text-sm">Floor:</span>
                        <input type="number" min="1" value={f.floor} onChange={e => updateFloorEntry(idx, fi, 'floor', parseInt(e.target.value) || 1)} className="w-20 p-1 border rounded" />
                        <span className="text-sm">Rooms:</span>
                        <input type="number" min="1" value={f.count} onChange={e => updateFloorEntry(idx, fi, 'count', parseInt(e.target.value) || 0)} className="w-20 p-1 border rounded" />
                        <button onClick={() => removeFloorEntry(idx, fi)} className="text-red-500 text-sm">Remove</button>
                      </div>
                    ))}
                    <button onClick={() => addFloorEntry(idx)} className="text-sm text-blue-600">+ Add Floor</button>
                  </div>
                ))}
                <button onClick={addRoomTypeBlock} className="text-sm text-blue-600">+ Add Room Type</button>
              </div>
            )}

            {editTab === 'staff' && (
              <div>
                <p className="text-sm text-gray-500 mb-4">Manage staff using the table below. Changes are immediate.</p>
                <AdminStaffManager />
              </div>
            )}

            {editTab === 'amenities' && (
              <div className="grid grid-cols-3 gap-2">
                {AMENITIES_LIST.map(a => (
                  <label key={a} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editData.amenities.includes(a)} onChange={() => toggleAmenity(a)} />
                    {a}
                  </label>
                ))}
              </div>
            )}

            {editTab === 'email' && (
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium mb-1">Email Address</label><input type="email" value={editData.emailInboxConfig.email} onChange={e => setEditData(prev => ({...prev, emailInboxConfig: {...prev.emailInboxConfig, email: e.target.value}}))} className="w-full p-2 border rounded" /></div>
                <div><label className="block text-sm font-medium mb-1">Protocol</label><select value={editData.emailInboxConfig.protocol} onChange={e => setEditData(prev => ({...prev, emailInboxConfig: {...prev.emailInboxConfig, protocol: e.target.value}}))} className="w-full p-2 border rounded"><option value="IMAP">IMAP</option><option value="POP3">POP3</option></select></div>
                <div><label className="block text-sm font-medium mb-1">Server</label><input type="text" value={editData.emailInboxConfig.server} onChange={e => setEditData(prev => ({...prev, emailInboxConfig: {...prev.emailInboxConfig, server: e.target.value}}))} className="w-full p-2 border rounded" /></div>
                <div><label className="block text-sm font-medium mb-1">Port</label><input type="number" value={editData.emailInboxConfig.port} onChange={e => setEditData(prev => ({...prev, emailInboxConfig: {...prev.emailInboxConfig, port: e.target.value}}))} className="w-full p-2 border rounded" /></div>
                <div><label className="block text-sm font-medium mb-1">Username</label><input type="text" value={editData.emailInboxConfig.username} onChange={e => setEditData(prev => ({...prev, emailInboxConfig: {...prev.emailInboxConfig, username: e.target.value}}))} className="w-full p-2 border rounded" /></div>
                <div><label className="block text-sm font-medium mb-1">Password</label><input type="password" value={editData.emailInboxConfig.password} onChange={e => setEditData(prev => ({...prev, emailInboxConfig: {...prev.emailInboxConfig, password: e.target.value}}))} className="w-full p-2 border rounded" /></div>
              </div>
            )}

            {/* Save / Cancel */}
            <div className="flex gap-4 mt-8 pt-4 border-t">
              <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 border rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}