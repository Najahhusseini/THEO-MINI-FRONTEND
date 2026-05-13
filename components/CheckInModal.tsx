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
      toast.error('Please verify guest identity before proceeding')
      return
    }
    onConfirm(guest)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Check‑In: {guest.guestName}</h2>
            <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">&times;</button>
          </div>
          <p className="text-blue-100 text-sm mt-1">Res #{guest.reservationId.slice(0,8)}…</p>
        </div>
        <div className="p-6 space-y-5">
          {/* Guest info grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Name" value={guest.guestName} />
            <Info label="Email" value={guest.guestEmail || '—'} />
            <Info label="Arrival" value={guest.arrivalDate} />
            <Info label="Departure" value={guest.departureDate} />
            <Info label="Guests" value={guest.guestCount.toString()} />
            <Info label="Room type" value={guest.roomType} />
            {guest.assignedRoom && <Info label="Pre‑assigned Room" value={guest.assignedRoom} />}
            <div className="col-span-2">
              <Info label="Status" value={guest.status} />
            </div>
          </div>

          {/* Verification */}
          <label className="flex items-center gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200 cursor-pointer">
            <input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} className="w-5 h-5 accent-amber-600" />
            <span className="text-sm text-amber-800 font-medium">I have verified guest identity / passport</span>
          </label>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Check‑in Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full p-3 border rounded-lg text-sm"
              placeholder="Special requests, payment status, room preference…"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition"
            >
              Confirm & Add to Queue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase">{label}</p>
      <p className="font-semibold text-gray-800">{value}</p>
    </div>
  )
}