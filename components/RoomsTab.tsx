'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRooms } from '@/contexts/RoomContext'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import {
  getStays,
  getReservations,
  getHousekeepingStaff,
  reassignRoom,
  checkInStay,
  moveStayToRoom,
  setRoomOutOfOrder
} from '@/lib/api'
import api from '@/lib/api'

interface Room {
    id: string
    room_number?: string
    roomNumber?: string
    floor?: number
    room_type?: string
    roomType?: string
    status?: string
    cleaning_status?: string
    out_of_order?: boolean
    out_of_order_reason?: string
    assigned_cleaner_id?: string
}

type OccupancyInfo = {
    status: 'occupied' | 'reserved' | 'vacant' | 'arriving_today'
    guest_name?: string
    arrival_date?: string
    departure_date?: string
    stay_id?: string
}

export default function RoomsTab() {
    const { staff } = useAuth()
    const { rooms, loading, updateRoomStatus, markRoomOutOfOrder, removeRoomOutOfOrder, refreshRooms } = useRooms()
    const [selectedFloor, setSelectedFloor] = useState<number>(1)
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
    const [showRoomModal, setShowRoomModal] = useState(false)
    const [updating, setUpdating] = useState(false)
    const [oooReason, setOooReason] = useState('')
    const [oooSubmitting, setOooSubmitting] = useState(false)

    const [occupancyMap, setOccupancyMap] = useState<Record<string, OccupancyInfo>>({})
    const [specialRequests, setSpecialRequests] = useState<Record<string, string>>({})

    const [staffMap, setStaffMap] = useState<Record<string, string>>({})
    const [showReassignModal, setShowReassignModal] = useState(false)
    const [selectedStaffId, setSelectedStaffId] = useState('')
    const [reassigning, setReassigning] = useState(false)

    const [showReassignGuestModal, setShowReassignGuestModal] = useState(false)
    const [availableNewRooms, setAvailableNewRooms] = useState<any[]>([])
    const [selectedNewRoom, setSelectedNewRoom] = useState('')
    const [markOooChecked, setMarkOooChecked] = useState(false)
    const [reassignGuestSubmitting, setReassignGuestSubmitting] = useState(false)
    const [filterRoomType, setFilterRoomType] = useState('')
    const [filterFloor, setFilterFloor] = useState('')

    const isHead = staff?.role === 'head_housekeeping' || staff?.role === 'admin' || staff?.role === 'manager'
    const isCleaner = staff?.role === 'housekeeping'
    const canCheckIn = staff?.role === 'admin' || staff?.role === 'manager' || staff?.role === 'reservation_manager' || staff?.role === 'frontdesk'

    const getRoomNumber = (room: Room) => room.room_number || room.roomNumber || '?'
    const getRoomType = (room: Room) => room.room_type || room.roomType || 'Standard'
    const getFloor = (room: Room) => room.floor ?? 0
    const getCleaningStatus = (room: Room) => room.cleaning_status || room.status || 'dirty'

    const floors = [...new Set(rooms.map(r => getFloor(r)))].sort((a, b) => a - b)

    useEffect(() => {
        if (!isHead) return
        getHousekeepingStaff()
            .then((data: any[]) => {
                const map: Record<string, string> = {}
                data.forEach(s => { map[s.id] = s.name })
                setStaffMap(map)
            })
            .catch(console.error)
    }, [isHead])

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [stays, reservations] = await Promise.all([
                    getStays(),
                    getReservations({ status: 'confirmed' })
                ])
                const today = format(new Date(), 'yyyy-MM-dd')
                const occMap: Record<string, OccupancyInfo> = {}
                for (const stay of stays) {
                    const num = stay.room_number
                    const arr = stay.arrival_date.split('T')[0]
                    const dep = stay.departure_date.split('T')[0]
                    if (arr <= today && dep >= today && stay.status !== 'checked_out') {
                        if (stay.status === 'checked_in')
                            occMap[num] = { status: 'occupied', guest_name: stay.guest_name, arrival_date: arr, departure_date: dep, stay_id: stay.id }
                        else if (arr === today)
                            occMap[num] = { status: 'arriving_today', guest_name: stay.guest_name, arrival_date: arr, departure_date: dep, stay_id: stay.id }
                        else
                            occMap[num] = { status: 'occupied', guest_name: stay.guest_name, arrival_date: arr, departure_date: dep, stay_id: stay.id }
                    } else if (arr > today && !occMap[num])
                        occMap[num] = { status: 'reserved', guest_name: stay.guest_name, arrival_date: arr, departure_date: dep, stay_id: stay.id }
                }
                for (const room of rooms) {
                    const num = getRoomNumber(room)
                    if (!occMap[num]) occMap[num] = { status: 'vacant' }
                }
                setOccupancyMap(occMap)

                const reqMap: Record<string, string> = {}
                for (const res of reservations) {
                    if (!res.special_requests) continue
                    const stay = stays.find((s: any) => s.reservation_id === res.id)
                    if (stay) reqMap[stay.room_number] = res.special_requests
                }
                setSpecialRequests(reqMap)
            } catch (err) {
                console.error('Failed to fetch occupancy/requests', err)
            }
        }
        if (rooms.length > 0) fetchData()
    }, [rooms])

    const handleStatusChange = async (roomId: string, newStatus: string) => {
        setUpdating(true)
        if (isCleaner && !['cleaning', 'ready'].includes(newStatus)) {
            toast.error('Cleaners can only change to cleaning or ready')
            setUpdating(false)
            return
        }
        if (isHead && !['inspected', 'awaiting', 'dirty'].includes(newStatus)) {
            toast.error('Head can only change to inspected, awaiting, or dirty')
            setUpdating(false)
            return
        }
        try {
            await updateRoomStatus(roomId, newStatus)
            toast.success(`Room status → ${newStatus.toUpperCase()}`)

            // 🏨 AUTO AWAIT: if inspecting and there's a guest arriving today
            if (newStatus === 'inspected' && selectedRoom) {
                const roomNum = getRoomNumber(selectedRoom)
                const occ = occupancyMap[roomNum]
                if (occ && occ.status === 'arriving_today') {
                    await updateRoomStatus(roomId, 'awaiting')
                    toast.success('Guest arriving today – room set to awaiting')
                }
            }

            window.dispatchEvent(new CustomEvent('room-status-changed', { detail: { roomId, newStatus } }))
            window.dispatchEvent(new CustomEvent('refresh-rooms'))
            window.dispatchEvent(new CustomEvent('refresh-tasks'))
            window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
            window.dispatchEvent(new CustomEvent('refresh-notifications'))
            setShowRoomModal(false)
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Update failed')
        } finally {
            setUpdating(false)
        }
    }

    const handleSetOutOfOrder = async () => {
        if (!selectedRoom || !oooReason.trim()) {
            toast.error('Please provide a reason')
            return
        }
        setOooSubmitting(true)
        try {
            await markRoomOutOfOrder(selectedRoom.id, oooReason)
            toast.success(`Room ${getRoomNumber(selectedRoom)} is OUT OF ORDER`)
            window.dispatchEvent(new CustomEvent('room-outoforder-changed', { detail: { roomId: selectedRoom.id, reason: oooReason } }))
            window.dispatchEvent(new CustomEvent('refresh-rooms'))
            window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
            window.dispatchEvent(new CustomEvent('refresh-notifications'))
            setShowRoomModal(false)
            setSelectedRoom(null)
            setOooReason('')
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed')
        } finally {
            setOooSubmitting(false)
        }
    }

    const handleRemoveOutOfOrder = async (roomId: string) => {
        if (!confirm('Restore this room? It will be marked dirty and need cleaning.')) return
        setUpdating(true)
        try {
            await removeRoomOutOfOrder(roomId)
            toast.success('Room back in service')
            window.dispatchEvent(new CustomEvent('room-restored', { detail: { roomId } }))
            window.dispatchEvent(new CustomEvent('refresh-rooms'))
            window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
            window.dispatchEvent(new CustomEvent('refresh-notifications'))
            setShowRoomModal(false)
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed')
        } finally {
            setUpdating(false)
        }
    }

    const handleReassign = async () => {
        if (!selectedRoom || !selectedStaffId) return
        setReassigning(true)
        try {
            await reassignRoom(selectedRoom.id, selectedStaffId)
            toast.success('Room reassigned')
            window.dispatchEvent(new CustomEvent('refresh-rooms'))
            window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
            setShowReassignModal(false)
            setShowRoomModal(false)
            refreshRooms()
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Reassignment failed')
        } finally {
            setReassigning(false)
        }
    }

    const handleCheckIn = async () => {
        const occ = selectedRoom ? occupancyMap[getRoomNumber(selectedRoom)] : null
        if (!occ?.stay_id) return
        try {
            await checkInStay(occ.stay_id)
            toast.success(`${occ.guest_name} checked in!`)
            setOccupancyMap(prev => {
                const updated = { ...prev }
                const num = getRoomNumber(selectedRoom!)
                if (updated[num]) {
                    updated[num] = { ...updated[num], status: 'occupied' }
                }
                return updated
            })
            setShowRoomModal(false)
            window.dispatchEvent(new CustomEvent('refresh-rooms'))
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Check‑in failed')
        }
    }

    const handleReassignGuest = async () => {
        const occ = selectedRoom ? occupancyMap[getRoomNumber(selectedRoom)] : null
        if (!occ?.stay_id || !selectedNewRoom) return
        setReassignGuestSubmitting(true)
        try {
            await moveStayToRoom(occ.stay_id, selectedNewRoom)
            toast.success(`Guest moved to Room ${selectedNewRoom}`)
            if (markOooChecked) {
                await setRoomOutOfOrder(selectedRoom!.id, 'Reassignment – room issue')
                toast.success(`Room ${getRoomNumber(selectedRoom!)} marked Out of Order`)
                window.dispatchEvent(new CustomEvent('refresh-rooms'))
                window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
            }
            setShowReassignGuestModal(false)
            setShowRoomModal(false)
            refreshRooms()
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Reassign failed')
        } finally {
            setReassignGuestSubmitting(false)
        }
    }

    const fetchNewRoomOptions = async (arrival: string, departure: string) => {
        try {
            const res = await api.get('/rooms/available', { params: { arrival, departure } })
            setAvailableNewRooms(res.data)
            setFilterRoomType('')
            setFilterFloor('')
            setSelectedNewRoom('')
        } catch (err) {
            toast.error('Failed to load available rooms')
        }
    }

    const openReassignGuestModal = () => {
        const occ = selectedRoom ? occupancyMap[getRoomNumber(selectedRoom)] : null
        if (!occ) return
        setMarkOooChecked(false)
        fetchNewRoomOptions(occ.arrival_date!, occ.departure_date!)
        setShowReassignGuestModal(true)
    }

    const filteredNewRooms = availableNewRooms.filter(room => {
        if (filterRoomType && room.room_type !== filterRoomType) return false
        if (filterFloor && room.floor !== parseInt(filterFloor)) return false
        return true
    })

    const roomTypes = [...new Set(availableNewRooms.map((r: any) => r.room_type).filter(Boolean))].sort()
    const newRoomFloors = [...new Set(availableNewRooms.map((r: any) => r.floor).filter(Boolean))].sort((a: number, b: number) => a - b)

    const getCardStyle = (room: Room) => {
        if (room.out_of_order) return 'bg-gray-200 border-gray-400'
        const status = getCleaningStatus(room)
        switch (status) {
            case 'dirty': return 'bg-red-100 border-red-300'
            case 'cleaning': return 'bg-yellow-100 border-yellow-300'
            case 'ready': return 'bg-green-100 border-green-300'
            case 'inspected': return 'bg-blue-100 border-blue-300'
            case 'awaiting': return 'bg-purple-100 border-purple-300'
            default: return 'bg-white border-gray-200'
        }
    }

    const getStatusIcon = (room: Room) => {
        if (room.out_of_order) return '🚫'
        const status = getCleaningStatus(room)
        switch (status) {
            case 'dirty': return '⚠️'
            case 'cleaning': return '🧹'
            case 'ready': return '✅'
            case 'inspected': return '🔍'
            case 'awaiting': return '👤'
            default: return '🏨'
        }
    }

    const getStatusLabel = (room: Room) => {
        if (room.out_of_order) return 'OUT OF ORDER'
        return getCleaningStatus(room).toUpperCase()
    }

    const getOccupancyBadge = (info: OccupancyInfo) => {
        switch (info.status) {
            case 'arriving_today': return <span className="px-2 py-0.5 text-sm rounded-full bg-red-100 text-red-800 font-medium">Arriving Today</span>
            case 'occupied': return <span className="px-2 py-0.5 text-sm rounded-full bg-purple-100 text-purple-800 font-medium">Occupied</span>
            case 'reserved': return <span className="px-2 py-0.5 text-sm rounded-full bg-orange-100 text-orange-800 font-medium">Reserved</span>
            default: return <span className="px-2 py-0.5 text-sm rounded-full bg-gray-100 text-gray-600 font-medium">Vacant</span>
        }
    }

    const filteredRooms = rooms.filter(r => getFloor(r) === selectedFloor)

    if (loading) return <div className="flex justify-center items-center h-64 text-gray-500">Loading rooms...</div>

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto mb-6">
                <h1 className="text-3xl font-light text-gray-800">🏨 Rooms</h1>
                <p className="text-sm text-gray-500 mt-1">
                    {isCleaner ? 'Cleaner: click a room to change status (dirty → cleaning → ready)' :
                        isHead ? 'Head: click a room to inspect, await guest, mark out of order, or reassign guest' :
                            'View only'}
                </p>
                <button onClick={refreshRooms} className="mt-2 text-xs text-blue-600 hover:text-blue-800">↻ Refresh</button>
            </div>

            <div className="max-w-7xl mx-auto mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
                {floors.map(floor => (
                    <button key={floor} onClick={() => setSelectedFloor(floor)}
                        className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${selectedFloor === floor ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                        Floor {floor}
                    </button>
                ))}
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredRooms.map(room => {
                    const roomNumber = getRoomNumber(room)
                    const occupancy = occupancyMap[roomNumber] || { status: 'vacant' }
                    const request = specialRequests[roomNumber]
                    const cleanerName = room.assigned_cleaner_id ? staffMap[room.assigned_cleaner_id] : null
                    const priority = occupancy.status === 'arriving_today' && !['ready', 'inspected'].includes(getCleaningStatus(room))
                    const cardBaseStyle = getCardStyle(room)
                    const priorityGlow = priority ? 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.8)] animate-pulse' : ''

                    return (
                        <div key={room.id} onClick={() => { setSelectedRoom(room); setShowRoomModal(true) }}
                            className={`cursor-pointer rounded-xl border-2 shadow-sm p-4 transition hover:shadow-md hover:-translate-y-1 ${cardBaseStyle} ${priorityGlow}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-3xl font-black text-gray-800">{roomNumber}</div>
                                    <div className="text-sm text-gray-600 mt-0.5">{getRoomType(room)}</div>
                                    <div className="text-xs text-gray-500">Floor {getFloor(room)}</div>
                                </div>
                                <div className="text-3xl">{getStatusIcon(room)}</div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/70">
                                    {getStatusLabel(room)}
                                </span>
                                {getOccupancyBadge(occupancy)}
                                {room.out_of_order && room.out_of_order_reason && (
                                    <span className="text-xs text-red-600 truncate max-w-[120px]">⚠️ {room.out_of_order_reason}</span>
                                )}
                            </div>
                            {occupancy.status !== 'vacant' && occupancy.guest_name && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                    <div className="text-base font-semibold text-gray-800">🧳 {occupancy.guest_name}</div>
                                    <div className="text-sm text-gray-600 mt-1">
                                        📅 {format(parseISO(occupancy.arrival_date!), 'MMM d')} – {format(parseISO(occupancy.departure_date!), 'MMM d')}
                                    </div>
                                </div>
                            )}
                            {request && (
                                <div className="mt-2 text-xs text-gray-500 italic">📝 {request}</div>
                            )}
                            {isHead && cleanerName && (
                                <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                                    🧹 Assigned to: {cleanerName}
                                </div>
                            )}
                            {priority && (
                                <div className="mt-2 text-xs text-red-600 font-bold">
                                    ⚠️ Priority Cleaning
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* DETAIL MODAL */}
            {showRoomModal && selectedRoom && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
                        <div className={`px-6 py-4 ${selectedRoom.out_of_order ? 'bg-gray-700' : 'bg-blue-600'} text-white`}>
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold">Room {getRoomNumber(selectedRoom)}</h2>
                                <button onClick={() => setShowRoomModal(false)} className="text-white/80 hover:text-white text-2xl">&times;</button>
                            </div>
                            <p className="text-white/80 text-sm">{getRoomType(selectedRoom)} • Floor {getFloor(selectedRoom)}</p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="font-semibold text-gray-600">Cleaning Status:</span>
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${selectedRoom.out_of_order ? 'bg-gray-200 text-gray-800' : 'bg-blue-100 text-blue-800'}`}>
                                    {getStatusLabel(selectedRoom)} {getStatusIcon(selectedRoom)}
                                </span>
                            </div>

                            {occupancyMap[getRoomNumber(selectedRoom)] && (
                                <div className="bg-gray-50 p-3 rounded-lg border">
                                    <p className="text-sm font-semibold text-gray-700">Occupancy</p>
                                    <div className="mt-1">{getOccupancyBadge(occupancyMap[getRoomNumber(selectedRoom)])}</div>
                                    {occupancyMap[getRoomNumber(selectedRoom)].guest_name && (
                                        <p className="text-base font-medium text-gray-800 mt-2">
                                            {occupancyMap[getRoomNumber(selectedRoom)].guest_name}
                                        </p>
                                    )}
                                    {occupancyMap[getRoomNumber(selectedRoom)].arrival_date && (
                                        <p className="text-sm text-gray-600 mt-1">
                                            {format(parseISO(occupancyMap[getRoomNumber(selectedRoom)].arrival_date!), 'MMM d')} – {format(parseISO(occupancyMap[getRoomNumber(selectedRoom)].departure_date!), 'MMM d')}
                                        </p>
                                    )}
                                    {occupancyMap[getRoomNumber(selectedRoom)].status === 'arriving_today' && canCheckIn && (
                                        <button onClick={handleCheckIn} className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition">
                                            ✅ Check In Guest
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* 🔄 REASSIGN GUEST */}
                            {!selectedRoom.out_of_order &&
                             (occupancyMap[getRoomNumber(selectedRoom)]?.status === 'occupied' ||
                              occupancyMap[getRoomNumber(selectedRoom)]?.status === 'arriving_today') &&
                             isHead && (
                                <button
                                    onClick={openReassignGuestModal}
                                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg transition"
                                >
                                    🔄 Reassign Guest
                                </button>
                            )}

                            {selectedRoom.out_of_order && selectedRoom.out_of_order_reason && (
                                <div className="bg-red-50 p-3 rounded-lg border-l-4 border-red-500">
                                    <p className="text-sm font-semibold text-red-800">Reason:</p>
                                    <p className="text-sm text-gray-700">{selectedRoom.out_of_order_reason}</p>
                                </div>
                            )}

                            {specialRequests[getRoomNumber(selectedRoom)] && (
                                <div className="bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-500">
                                    <p className="text-sm font-semibold text-yellow-800">Special Requests:</p>
                                    <p className="text-sm text-gray-700">{specialRequests[getRoomNumber(selectedRoom)]}</p>
                                </div>
                            )}

                            {isHead && (
                                <div className="bg-gray-50 p-3 rounded-lg border">
                                    <p className="text-sm font-semibold text-gray-700">Assigned Cleaner</p>
                                    {selectedRoom.assigned_cleaner_id && staffMap[selectedRoom.assigned_cleaner_id] ? (
                                        <p className="text-sm text-gray-600 mt-1">{staffMap[selectedRoom.assigned_cleaner_id]}</p>
                                    ) : (
                                        <p className="text-sm text-gray-400 italic">Unassigned</p>
                                    )}
                                    <button
                                        onClick={() => { setSelectedStaffId(''); setShowReassignModal(true) }}
                                        className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                                    >
                                        {selectedRoom.assigned_cleaner_id ? 'Reassign Room' : 'Assign Cleaner'}
                                    </button>
                                </div>
                            )}

                            {!selectedRoom.out_of_order ? (
                                <>
                                    {isCleaner && (
                                        <div className="space-y-2">
                                            {getCleaningStatus(selectedRoom) === 'dirty' && (
                                                <button onClick={() => handleStatusChange(selectedRoom.id, 'cleaning')} disabled={updating}
                                                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded-lg transition">🧹 Start Cleaning</button>
                                            )}
                                            {getCleaningStatus(selectedRoom) === 'cleaning' && (
                                                <button onClick={() => handleStatusChange(selectedRoom.id, 'ready')} disabled={updating}
                                                    className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg transition">✅ Mark Ready</button>
                                            )}
                                        </div>
                                    )}

                                    {isHead && (
                                        <div className="space-y-2">
                                            {getCleaningStatus(selectedRoom) === 'ready' && (
                                                <button onClick={() => handleStatusChange(selectedRoom.id, 'inspected')} disabled={updating}
                                                    className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg transition">🔍 Inspect Room</button>
                                            )}
                                            <button onClick={() => handleStatusChange(selectedRoom.id, 'dirty')} disabled={updating}
                                                className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg transition">🟡 Mark Dirty (needs cleaning)</button>
                                            <hr className="my-2" />
                                            <button onClick={() => { setOooReason(''); const reason = prompt('Enter reason for out of order:'); if (reason && reason.trim()) { setOooReason(reason); handleSetOutOfOrder() } }} disabled={oooSubmitting}
                                                className="w-full bg-gray-700 hover:bg-gray-800 text-white py-2 rounded-lg transition">🚫 Mark Out of Order</button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                isHead && (
                                    <button onClick={() => handleRemoveOutOfOrder(selectedRoom.id)} disabled={updating}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition">✅ Restore to Service</button>
                                )
                            )}

                            {updating && <p className="text-center text-sm text-gray-500">Updating...</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* REASSIGN CLEANER MODAL */}
            {showReassignModal && selectedRoom && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-6">
                        <h3 className="text-lg font-bold mb-4">Assign Cleaner for Room {getRoomNumber(selectedRoom)}</h3>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Select Staff</label>
                            <select
                                value={selectedStaffId}
                                onChange={(e) => setSelectedStaffId(e.target.value)}
                                className="w-full p-2 border rounded"
                            >
                                <option value="">-- Choose a cleaner --</option>
                                {Object.entries(staffMap).map(([id, name]) => (
                                    <option key={id} value={id}>{name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowReassignModal(false)}
                                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                            <button onClick={handleReassign}
                                disabled={!selectedStaffId || reassigning}
                                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                {reassigning ? 'Assigning...' : 'Assign'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🔄 REASSIGN GUEST MODAL */}
            {showReassignGuestModal && selectedRoom && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
                        <div className="bg-orange-600 px-6 py-4 text-white">
                            <h3 className="text-xl font-bold">Reassign Guest – Room {getRoomNumber(selectedRoom)}</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-600">
                                Moving <strong>{occupancyMap[getRoomNumber(selectedRoom)]?.guest_name}</strong> to a different room.
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Room Type</label>
                                    <select
                                        value={filterRoomType}
                                        onChange={(e) => { setFilterRoomType(e.target.value); setSelectedNewRoom('') }}
                                        className="w-full p-2 border rounded"
                                    >
                                        <option value="">All Types</option>
                                        {roomTypes.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Floor</label>
                                    <select
                                        value={filterFloor}
                                        onChange={(e) => { setFilterFloor(e.target.value); setSelectedNewRoom('') }}
                                        className="w-full p-2 border rounded"
                                    >
                                        <option value="">All Floors</option>
                                        {newRoomFloors.map(floor => (
                                            <option key={floor} value={floor}>Floor {floor}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Room</label>
                                <select
                                    value={selectedNewRoom}
                                    onChange={(e) => setSelectedNewRoom(e.target.value)}
                                    className="w-full p-2 border rounded"
                                >
                                    <option value="">-- Choose a room --</option>
                                    {filteredNewRooms.map((room: any) => (
                                        <option key={room.room_number} value={room.room_number}>
                                            {room.room_number} – {room.room_type} (Floor {room.floor})
                                        </option>
                                    ))}
                                </select>
                                {filteredNewRooms.length === 0 && (
                                    <p className="text-xs text-gray-500 mt-1">No rooms match the selected filters.</p>
                                )}
                            </div>

                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={markOooChecked}
                                    onChange={(e) => setMarkOooChecked(e.target.checked)}
                                    className="w-4 h-4"
                                />
                                Mark current room (Room {getRoomNumber(selectedRoom)}) as <strong>Out of Order</strong>
                            </label>

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowReassignGuestModal(false)}
                                    className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                                <button
                                    onClick={handleReassignGuest}
                                    disabled={!selectedNewRoom || reassignGuestSubmitting}
                                    className="flex-1 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                                >
                                    {reassignGuestSubmitting ? 'Moving...' : 'Move Guest'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}