'use client'

import { useState, useEffect } from 'react'
import { getReservations, getStays, getRoomsWithCleaning, updateRoomCleaningStatus } from '@/lib/api'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'

interface Arrival {
  reservationId: string
  guestName: string
  roomNumber: string | null
  cleaningStatus: string | null
  roomId: string | null
}

export default function TodayArrivalsReception() {
  const [arrivals, setArrivals] = useState<Arrival[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const [reservations, stays, rooms] = await Promise.all([
        getReservations({ status: 'confirmed' }),
        getStays(),
        getRoomsWithCleaning()
      ])

      // Build a room lookup: room_number → cleaning_status & room id
      const roomMap: Record<string, { cleaningStatus: string; roomId: string }> = {}
      for (const room of rooms) {
        roomMap[room.room_number] = {
          cleaningStatus: room.cleaning_status || room.status || 'dirty',
          roomId: room.id
        }
      }

      const todayArrivals = reservations
        .filter((r: any) => r.arrival_date?.startsWith(today) && r.status === 'confirmed')
        .map((r: any) => {
          const stay = stays.find((s: any) => s.reservation_id === r.id)
          const roomNum = stay ? stay.room_number : null
          const cleaningInfo = roomNum ? roomMap[roomNum] : null
          return {
            reservationId: r.id,
            guestName: r.guest_name,
            roomNumber: roomNum,
            cleaningStatus: cleaningInfo?.cleaningStatus || null,
            roomId: cleaningInfo?.roomId || null
          }
        })
        .filter((a: Arrival) => a.roomNumber)   // only show ones with a room assigned

      setArrivals(todayArrivals)
    } catch (err) {
      toast.error('Failed to load arrivals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const handlePriorityClean = async (roomId: string, roomNumber: string) => {
    if (!roomId) return
    try {
      await updateRoomCleaningStatus(roomId, 'dirty')
      toast.success(`Room ${roomNumber} marked for priority cleaning!`)
      window.dispatchEvent(new CustomEvent('refresh-rooms'))
      window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
      loadData()  // refresh local data
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to request cleaning')
    }
  }

  const getCleaningBadge = (status: string) => {
    switch (status) {
      case 'dirty': return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800">Dirty</span>
      case 'cleaning': return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">Cleaning</span>
      case 'ready': return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">Ready</span>
      case 'inspected': return <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">Inspected</span>
      case 'awaiting': return <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800">Awaiting</span>
      default: return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800">{status}</span>
    }
  }

  if (loading) return <div className="text-center py-4">Loading arrivals…</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">📋 Today's Arrivals</h2>
        <button onClick={loadData} className="text-xs text-blue-600 hover:underline">↻ Refresh</button>
      </div>

      {arrivals.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No arrivals with assigned rooms today.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2">
          {arrivals.map((a, idx) => (
            <div key={idx} className="bg-white rounded-xl border-2 p-3 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-gray-800">{a.guestName}</div>
                  <div className="text-sm text-gray-600">Room {a.roomNumber}</div>
                </div>
                <div>{a.cleaningStatus && getCleaningBadge(a.cleaningStatus)}</div>
              </div>
              {a.roomId && a.cleaningStatus && !['ready', 'inspected', 'awaiting'].includes(a.cleaningStatus) && (
                <button
                  onClick={() => handlePriorityClean(a.roomId!, a.roomNumber!)}
                  className="mt-2 w-full bg-red-500 hover:bg-red-600 text-white text-xs py-1.5 rounded-lg transition"
                >
                  🔔 Alert Priority Cleaning
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}