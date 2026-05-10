'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

interface ArrivalData {
  reservationId: string
  guestName: string
  guestEmail?: string
  arrivalDate: string
  departureDate: string
  roomType: string
  guestCount: number
  specialRequests?: string
  status: string
  stayId?: string
  assignedRoom?: string
  cleaningStatus?: string
  source?: string
}

interface Props {
  guest: ArrivalData
  onClose: () => void
  onConfirm: (guest: ArrivalData) => void
}

export default function CheckInModal({ guest, onClose, onConfirm }: Props) {
  const [notes, setNotes] = useState('')
  const [verified, setVerified] = useState(false)

  const handleConfirm = () => {
    if (!verified) {
      toast.error('Please verify guest information before check‑in')
      return
    }
    onConfirm(guest)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-blue-600 px-6 py-4 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold">Check‑In: {guest.guestName}</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="font-medium">Name:</span> {guest.guestName}</div>
            <div><span className="font-medium">Email:</span> {guest.guestEmail || '—'}</div>
            <div><span className="font-medium">Arrival:</span> {guest.arrivalDate}</div>
            <div><span className="font-medium">Departure:</span> {guest.departureDate}</div>
            <div><span className="font-medium">Guests:</span> {guest.guestCount}</div>
            <div><span className="font-medium">Room type:</span> {guest.roomType}</div>
            <div className="col-span-2"><span className="font-medium">Status:</span> {guest.status}</div>
            {guest.assignedRoom && <div className="col-span-2"><span className="font-medium">Pre‑assigned Room:</span> {guest.assignedRoom}</div>}
          </div>

          <label className="flex items-center gap-3 bg-amber-50 p-3 rounded-lg border border-amber-200">
            <input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} className="w-5 h-5" />
            <span className="text-sm text-amber-800">I have verified guest identity / passport</span>
          </label>

          <div>
            <label className="block text-sm font-medium mb-1">Check‑in Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full p-2 border rounded" placeholder="Special requests, payment status, room preference…" />
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="flex-1 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={handleConfirm} className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Confirm & Proceed to Assignment</button>
          </div>
        </div>
      </div>
    </div>
  )
}