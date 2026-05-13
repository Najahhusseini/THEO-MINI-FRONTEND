'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface StaffMember {
  id: string
  name: string
  email: string
  role: string
  phone: string | null
  active: boolean
}

const ALL_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'frontdesk', label: 'Front Desk' },
  { value: 'reservation_manager', label: 'Reservation Manager' },
  { value: 'head_housekeeping', label: 'Head Housekeeping' },
  { value: 'housekeeping', label: 'Housekeeping' },
]

export default function AdminStaffManager() {
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [maxStaff, setMaxStaff] = useState(20)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'housekeeping', phone: '' })
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)

  useEffect(() => { loadStaff() }, [])

  const loadStaff = async () => {
    try {
      const res = await api.get('/admin-staff')
      setStaffList(res.data.staff)
      setMaxStaff(res.data.maxStaff)
    } catch (err) {
      toast.error('Failed to load staff')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/admin-staff', form)
      toast.success('Staff added')
      setShowAdd(false)
      setForm({ name: '', email: '', password: '', role: 'housekeeping', phone: '' })
      loadStaff()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add staff')
    }
  }

  const handleEdit = (staff: StaffMember) => {
    setEditingStaff(staff)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStaff) return
    try {
      await api.patch(`/admin-staff/${editingStaff.id}`, {
        role: editingStaff.role,
        phone: editingStaff.phone,
        active: editingStaff.active,
      })
      toast.success('Staff updated')
      setEditingStaff(null)
      loadStaff()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update staff')
    }
  }

  const toggleActive = async (staff: StaffMember) => {
    try {
      await api.patch(`/admin-staff/${staff.id}`, { active: !staff.active })
      loadStaff()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to toggle status')
    }
  }

  if (loading) return <div className="p-4">Loading staff...</div>

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold">Staff Management</h2>
          <p className="text-sm text-gray-500">{staffList.length} / {maxStaff} staff members</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          disabled={staffList.length >= maxStaff}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add Staff
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Phone</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map(s => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2">{s.name}</td>
                <td className="px-4 py-2">{s.email}</td>
                <td className="px-4 py-2 capitalize">{s.role.replace(/_/g, ' ')}</td>
                <td className="px-4 py-2">{s.phone || '—'}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => toggleActive(s)}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      s.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {s.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleEdit(s)}
                    className="text-blue-600 hover:underline text-xs"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {staffList.length === 0 && (
          <p className="text-center text-gray-500 py-4">No staff members yet.</p>
        )}
      </div>

      {/* Add Staff Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Add New Staff</h3>
            <form onSubmit={handleAdd} className="space-y-3">
              <input
                type="text" placeholder="Full Name *" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required className="w-full p-2 border rounded"
              />
              <input
                type="email" placeholder="Email *" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required className="w-full p-2 border rounded"
              />
              <input
                type="password" placeholder="Password *" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required className="w-full p-2 border rounded"
              />
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full p-2 border rounded">
                {ALL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <input
                type="text" placeholder="Phone (optional)" value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full p-2 border rounded"
              />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2 border rounded hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Edit Staff: {editingStaff.name}</h3>
            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select value={editingStaff.role} onChange={e => setEditingStaff({ ...editingStaff, role: e.target.value })} className="w-full p-2 border rounded">
                  {ALL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input type="text" value={editingStaff.phone || ''} onChange={e => setEditingStaff({ ...editingStaff, phone: e.target.value })} className="w-full p-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select value={editingStaff.active ? 'active' : 'inactive'} onChange={e => setEditingStaff({ ...editingStaff, active: e.target.value === 'active' })} className="w-full p-2 border rounded">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditingStaff(null)} className="flex-1 py-2 border rounded hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}