'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface StaffAssignment {
  role: string
  email: string
}

const AVAILABLE_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'frontdesk', label: 'Front Desk' },
  { value: 'reservation_manager', label: 'Reservation Manager' },
  { value: 'head_housekeeping', label: 'Head Housekeeping' },
  { value: 'housekeeping', label: 'Housekeeping' },
]

export default function RegisterHotelForm() {
  const { staff } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [hotelName, setHotelName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [floors, setFloors] = useState(2)
  const [roomsPerFloor, setRoomsPerFloor] = useState(10)
  const [customRoomNumbers, setCustomRoomNumbers] = useState('') // comma separated
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignment[]>([
    { role: 'admin', email: '' }
  ])
  const [submitting, setSubmitting] = useState(false)

  const canRegister = staff?.role === 'admin' || staff?.role === 'manager'

  if (!canRegister) return null

  const addStaffField = () => {
    setStaffAssignments([...staffAssignments, { role: 'housekeeping', email: '' }])
  }

  const removeStaffField = (index: number) => {
    setStaffAssignments(staffAssignments.filter((_, i) => i !== index))
  }

  const updateStaff = (index: number, field: keyof StaffAssignment, value: string) => {
    const updated = [...staffAssignments]
    updated[index] = { ...updated[index], [field]: value }
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

    const payload = {
      hotelName: hotelName.trim(),
      subdomain: subdomain.trim(),
      floors: customRoomNumbers.trim() ? undefined : floors,
      roomsPerFloor: customRoomNumbers.trim() ? undefined : roomsPerFloor,
      roomNumbers: roomNumbers || undefined,
      staffAssignments: staffAssignments.map(s => ({ role: s.role, email: s.email.trim() })),
      amenities: [],  // future use
    }

    setSubmitting(true)
    try {
      await api.post('/hotel-setup/register', payload)
      toast.success('Hotel registered successfully!')
      // Reset form
      setHotelName('')
      setSubdomain('')
      setFloors(2)
      setRoomsPerFloor(10)
      setCustomRoomNumbers('')
      setStaffAssignments([{ role: 'admin', email: '' }])
      setShowForm(false)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mb-6">
      <button
        onClick={() => setShowForm(!showForm)}
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
      >
        + Register Hotel
      </button>

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
                <label className="block text-sm font-medium mb-1">Custom Room Numbers (comma separated) – overrides floors/rooms</label>
                <input type="text" value={customRoomNumbers} onChange={e => setCustomRoomNumbers(e.target.value)} placeholder="101, 102, 201, 202" className="w-full p-2 border rounded" />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Staff Assignments</h3>
                {staffAssignments.map((assignment, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <select value={assignment.role} onChange={e => updateStaff(index, 'role', e.target.value)} className="p-2 border rounded flex-1">
                      {AVAILABLE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <input type="email" placeholder="email@example.com" value={assignment.email} onChange={e => updateStaff(index, 'email', e.target.value)} className="p-2 border rounded flex-1" required />
                    <button type="button" onClick={() => removeStaffField(index)} className="text-red-500 hover:text-red-700">&times;</button>
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