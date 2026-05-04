'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRooms } from '@/contexts/RoomContext'
import { getStays, getReservations, getHousekeepingStaff, reassignRoom } from '@/lib/api'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

interface Room {
    id: string
    room_number: string
    floor: number
    room_type: string
    status: string
    cleaning_status: string
    out_of_order: boolean
    out_of_order_reason?: string
    assigned_cleaner_id?: string
}

interface PriorityRoom {
    room: Room
    guest_name: string
    arrival_date: string
    departure_date: string
    special_requests?: string
    assigned_cleaner_name?: string
    cleaning_status: string
    urgency: number   // 0 = dirty, 1 = cleaning, 2 = ready, 3 = inspected, 4 = awaiting (highest urgency first)
}

export default function PriorityCleaningList() {
    const { staff } = useAuth()
    const { rooms, loading: roomsLoading, refreshRooms } = useRooms()
    const [priorityRooms, setPriorityRooms] = useState<PriorityRoom[]>([])
    const [staffMap, setStaffMap] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)

    const isHead = staff?.role === 'head_housekeeping' || staff?.role === 'admin' || staff?.role === 'manager'
    const isCleaner = staff?.role === 'housekeeping'

    // Fetch staff name map (for assigned cleaner)
    useEffect(() => {
        getHousekeepingStaff()
            .then((data: any[]) => {
                const map: Record<string, string> = {}
                data.forEach((s: any) => { map[s.id] = s.name })
                setStaffMap(map)
            })
            .catch(console.error)
    }, [])

    // Build priority list whenever rooms or stays change
    useEffect(() => {
        if (!rooms.length) return

        const fetchPriority = async () => {
            try {
                const today = format(new Date(), 'yyyy-MM-dd')
                const stays = await getStays()
                const reservations = await getReservations({ status: 'confirmed' })

                // Map room_number → upcoming stay (only if arrival is today)
                const stayMap: Record<string, any> = {}
                for (const stay of stays) {
                    const arr = stay.arrival_date.split('T')[0]
                    if (arr === today && stay.status !== 'checked_out') {
                        // If multiple stays for same room, keep the one with earliest arrival (should be only one today)
                        if (!stayMap[stay.room_number] || new Date(stay.arrival_date) < new Date(stayMap[stay.room_number].arrival_date)) {
                            stayMap[stay.room_number] = stay
                        }
                    }
                }

                // Map room_number → special requests
                const requestMap: Record<string, string> = {}
                for (const res of reservations) {
                    if (!res.special_requests) continue
                    const stay = stays.find((s: any) => s.reservation_id === res.id)
                    if (stay && stay.room_number) {
                        requestMap[stay.room_number] = res.special_requests
                    }
                }

                // Build priority list from rooms that have a stay arriving today
                const list: PriorityRoom[] = []
                for (const room of rooms) {
                    const stay = stayMap[room.room_number]
                    if (!stay) continue   // not arriving today

                    const cleaningStatus = room.cleaning_status || room.status || 'dirty'
                    // Urgency order: dirty (0) > cleaning (1) > ready (2) > inspected (3) > awaiting (4)
                    const urgencyOrder: Record<string, number> = {
                        dirty: 0,
                        cleaning: 1,
                        ready: 2,
                        inspected: 3,
                        awaiting: 4,
                    }
                    const urgency = urgencyOrder[cleaningStatus] ?? 5

                    list.push({
                        room: {
                            id: room.id,
                            room_number: room.room_number || room.roomNumber,
                            floor: room.floor,
                            room_type: room.room_type || room.roomType,
                            status: room.status,
                            cleaning_status: cleaningStatus,
                            out_of_order: room.out_of_order || false,
                            out_of_order_reason: room.out_of_order_reason,
                            assigned_cleaner_id: room.assigned_cleaner_id,
                        },
                        guest_name: stay.guest_name,
                        arrival_date: stay.arrival_date,
                        departure_date: stay.departure_date,
                        special_requests: requestMap[room.room_number],
                        assigned_cleaner_name: staffMap[room.assigned_cleaner_id] || undefined,
                        cleaning_status: cleaningStatus,
                        urgency,
                    })
                }

                // Sort by urgency (most urgent first = lowest number)
                list.sort((a, b) => a.urgency - b.urgency)
                setPriorityRooms(list)
            } catch (err) {
                console.error('Failed to build priority list', err)
            } finally {
                setLoading(false)
            }
        }

        fetchPriority()
    }, [rooms, staffMap])

    const getCleaningStatusBadge = (status: string) => {
        switch (status) {
            case 'dirty': return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800">Dirty</span>
            case 'cleaning': return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">Cleaning</span>
            case 'ready': return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">Ready</span>
            case 'inspected': return <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">Inspected</span>
            case 'awaiting': return <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800">Awaiting</span>
            default: return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800">{status}</span>
        }
    }

    if (loading || roomsLoading) return <div className="text-center py-12">Loading priority list...</div>

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto mb-6">
                <h1 className="text-3xl font-light text-gray-800">🧹 Priority Cleaning List</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Rooms with guests arriving today, sorted by cleaning urgency. Focus on Dirty and Cleaning rooms first.
                </p>
                <button onClick={refreshRooms} className="mt-2 text-xs text-blue-600 hover:text-blue-800">↻ Refresh</button>
            </div>

            {priorityRooms.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    ✅ All rooms with today's arrivals are ready or no arrivals today.
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {priorityRooms.map(item => {
                        const { room, guest_name, arrival_date, departure_date, special_requests, assigned_cleaner_name, cleaning_status } = item
                        const isUrgent = cleaning_status === 'dirty' || cleaning_status === 'cleaning'

                        return (
                            <div key={room.id}
                                className={`rounded-xl border-2 shadow-sm p-4 transition hover:shadow-md hover:-translate-y-1 ${
                                    room.out_of_order ? 'bg-gray-200 border-gray-400' :
                                    isUrgent ? 'bg-red-50 border-red-400' : 'bg-white border-gray-200'
                                }`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="text-3xl font-black text-gray-800">{room.room_number}</div>
                                        <div className="text-sm text-gray-600 mt-0.5">{room.room_type}</div>
                                        <div className="text-xs text-gray-500">Floor {room.floor}</div>
                                    </div>
                                    <div className="text-3xl">
                                        {room.out_of_order ? '🚫' : isUrgent ? '⚠️' : '✅'}
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    {getCleaningStatusBadge(cleaning_status)}
                                    <span className="px-2 py-0.5 text-sm rounded-full bg-blue-100 text-blue-800 font-medium">
                                        Arriving Today
                                    </span>
                                </div>

                                <div className="mt-3 pt-3 border-t border-gray-200">
                                    <div className="text-base font-semibold text-gray-800">🧳 {guest_name}</div>
                                    <div className="text-sm text-gray-600 mt-1">
                                        📅 {format(parseISO(arrival_date), 'MMM d')} – {format(parseISO(departure_date), 'MMM d')}
                                    </div>
                                </div>

                                {special_requests && (
                                    <div className="mt-2 text-xs text-gray-500 italic">📝 {special_requests}</div>
                                )}

                                {assigned_cleaner_name && (
                                    <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                                        🧹 Assigned to: {assigned_cleaner_name}
                                    </div>
                                )}

                                {isUrgent && !assigned_cleaner_name && isHead && (
                                    <div className="mt-2 text-xs text-red-600 font-medium">
                                        ⚠️ No cleaner assigned – assign in Rooms Tab
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}