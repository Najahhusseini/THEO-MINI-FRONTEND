'use client'

import type { PendingCheckInGuest } from './ReceptionDashboard'

export default function QuickAssignQueue({
  guests,
  onRemove,
}: {
  guests: PendingCheckInGuest[]
  onRemove: (reservationId: string) => void
}) {
  const handleDragStart = (e: React.DragEvent, guest: PendingCheckInGuest) => {
    e.dataTransfer.setData('text/plain', guest.reservationId)
    e.dataTransfer.effectAllowed = 'move'
    const el = e.currentTarget as HTMLElement
    requestAnimationFrame(() => { el.style.opacity = '0.6' })
  }

  const handleDragEnd = (e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement
    el.style.opacity = '1'
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-lg font-bold mb-3 text-gray-800">🛎️ Quick Assignment ({guests.length} pending)</h2>
      {guests.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">
          No guests waiting for room assignment. Click <strong>&quot;Check In&quot;</strong> on an arrival card to add them here.
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {guests.map(guest => (
            <div
              key={guest.reservationId}
              draggable
              onDragStart={(e) => handleDragStart(e, guest)}
              onDragEnd={handleDragEnd}
              className="flex-shrink-0 w-64 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-gray-800">{guest.guestName}</p>
                  <p className="text-xs text-gray-500">Res #{guest.reservationId.slice(0,8)}…</p>
                  <div className="mt-2 text-xs space-y-1 text-gray-600">
                    <p>📅 {guest.arrivalDate} → {guest.departureDate}</p>
                    <p>👥 {guest.guestCount} guests · {guest.roomType}</p>
                  </div>
                </div>
                <button
                  onClick={() => onRemove(guest.reservationId)}
                  className="text-gray-400 hover:text-red-500 transition"
                >
                  &times;
                </button>
              </div>
              <p className="text-xs text-blue-600 mt-3 italic">Drag onto a room below</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}