'use client'

import ShiftTracker from './ShiftTracker'

export default function MyShiftsTab() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">My Shifts & Hours</h2>
      <ShiftTracker />
    </div>
  )
}