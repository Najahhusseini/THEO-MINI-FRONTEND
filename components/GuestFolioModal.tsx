'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface FolioItem {
  id: string
  description: string
  amount: number
  charge_type: string
  quantity: number
  unit_price: number | null
  created_at: string
}

interface Folio {
  id: string
  stay_id: string
  guest_name: string
  status: string
  items: FolioItem[]
}

export default function GuestFolioModal({ stayId, onClose }: { stayId: string; onClose: () => void }) {
  const [folio, setFolio] = useState<Folio | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ description: '', amount: '', chargeType: 'other' })
  const [submitting, setSubmitting] = useState(false)

  const loadFolio = async () => {
    try {
      const res = await api.get(`/folio/stay/${stayId}`)
      setFolio(res.data)
    } catch (err) {
      toast.error('Failed to load folio')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadFolio() }, [stayId])

  const handleAddCharge = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.description || !form.amount) {
      toast.error('Description and amount required')
      return
    }
    setSubmitting(true)
    try {
      await api.post(`/folio/stay/${stayId}/charge`, {
        description: form.description,
        amount: parseFloat(form.amount),
        chargeType: form.chargeType,
      })
      toast.success('Charge added')
      setForm({ description: '', amount: '', chargeType: 'other' })
      setShowAdd(false)
      await loadFolio()
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to add charge'
      toast.error(errorMsg)
      if (errorMsg.includes('modified by another user') || errorMsg.includes('Please refresh')) {
        await loadFolio()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const totalItems = (folio?.items || []).reduce((sum, item) => sum + Number(item.amount), 0)

  if (loading) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg">Loading folio…</div>
    </div>
  )

  if (!folio) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Folio: {folio.guest_name}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>

        <div className="mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1">Description</th>
                <th className="py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {folio.items.length === 0 ? (
                <tr><td colSpan={2} className="text-center py-4 text-gray-500">No charges yet</td></tr>
              ) : (
                folio.items.map(item => (
                  <tr key={item.id} className="border-b">
                    <td className="py-1">
                      <div>{item.description}</div>
                      <div className="text-xs text-gray-500 capitalize">{item.charge_type.replace('_', ' ')}</div>
                    </td>
                    <td className="py-1 text-right font-mono">${Number(item.amount).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className="py-2">Total</td>
                <td className="py-2 text-right">${totalItems.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Add Charge
          </button>
        ) : (
          <form onSubmit={handleAddCharge} className="space-y-3 border-t pt-4">
            <input
              type="text"
              placeholder="Description (e.g., Mini‑bar, Restaurant)"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              required
              className="w-full p-2 border rounded"
            />
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Amount"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                required
                className="flex-1 p-2 border rounded"
              />
              <select
                value={form.chargeType}
                onChange={e => setForm({ ...form, chargeType: e.target.value })}
                className="p-2 border rounded"
              >
                <option value="other">Other</option>
                <option value="restaurant">Restaurant</option>
                <option value="bar">Bar</option>
                <option value="minibar">Mini‑bar</option>
                <option value="laundry">Laundry</option>
                <option value="service">Service</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2 border rounded">Cancel</button>
              <button type="submit" disabled={submitting} className="flex-1 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}