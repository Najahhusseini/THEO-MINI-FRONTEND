'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRooms } from '@/contexts/RoomContext'
import toast from 'react-hot-toast'

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

    const isHead = staff?.role === 'head_housekeeping' || staff?.role === 'admin' || staff?.role === 'manager'
    const isCleaner = staff?.role === 'housekeeping'

    // Helper to get room number (supports both snake_case and camelCase)
    const getRoomNumber = (room: Room) => room.room_number || room.roomNumber || '?'
    const getRoomType = (room: Room) => room.room_type || room.roomType || 'Standard'
    const getFloor = (room: Room) => room.floor ?? 0
    const getCleaningStatus = (room: Room) => room.cleaning_status || room.status || 'dirty'

    const floors = [...new Set(rooms.map(r => getFloor(r)))].sort((a, b) => a - b)

    // Debug: Log rooms data to see what's coming from context
    console.log('Rooms in RoomsTab:', rooms.slice(0, 5).map(r => ({
        room_number: getRoomNumber(r),
        cleaning_status: r.cleaning_status,
        status: r.status,
        display_status: getCleaningStatus(r)
    })))

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
            
            // Dispatch events to refresh all components
            window.dispatchEvent(new CustomEvent('room-status-changed', { 
                detail: { roomId, newStatus } 
            }))
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
            
            window.dispatchEvent(new CustomEvent('room-outoforder-changed', { 
                detail: { roomId: selectedRoom.id, reason: oooReason } 
            }))
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

    // Card color based on status (includes out of order)
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
        const status = getCleaningStatus(room)
        return status.toUpperCase()
    }

    const filteredRooms = rooms.filter(r => getFloor(r) === selectedFloor)

    if (loading) return <div className="flex justify-center items-center h-64 text-gray-500">Loading rooms...</div>

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-6">
                <h1 className="text-3xl font-light text-gray-800">🏨 Rooms</h1>
                <p className="text-sm text-gray-500 mt-1">
                    {isCleaner ? 'Cleaner: click a room to change status (dirty → cleaning → ready)' :
                        isHead ? 'Head: click a room to inspect, await guest, or mark out of order' :
                            'View only'}
                </p>
                <button
                    onClick={refreshRooms}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                >
                    ↻ Refresh
                </button>
            </div>

            {/* Floor navigation */}
            <div className="max-w-7xl mx-auto mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
                {floors.map(floor => (
                    <button
                        key={floor}
                        onClick={() => setSelectedFloor(floor)}
                        className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${selectedFloor === floor
                                ? 'bg-blue-600 text-white shadow'
                                : 'bg-white text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        Floor {floor}
                    </button>
                ))}
            </div>

            {/* Card grid */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredRooms.map(room => (
                    <div
                        key={room.id}
                        onClick={() => { setSelectedRoom(room); setShowRoomModal(true) }}
                        className={`cursor-pointer rounded-xl border-2 shadow-sm p-4 transition hover:shadow-md hover:-translate-y-1 ${getCardStyle(room)}`}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="text-3xl font-black text-gray-800">{getRoomNumber(room)}</div>
                                <div className="text-sm text-gray-600 mt-0.5">{getRoomType(room)}</div>
                                <div className="text-xs text-gray-500">Floor {getFloor(room)}</div>
                            </div>
                            <div className="text-3xl">{getStatusIcon(room)}</div>
                        </div>
                        <div className="mt-3 flex justify-between items-center">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/70">
                                {getStatusLabel(room)}
                            </span>
                            {room.out_of_order && room.out_of_order_reason && (
                                <span className="text-xs text-red-600 truncate max-w-[120px]">⚠️ {room.out_of_order_reason}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Room Detail Modal */}
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
                                <span className="font-semibold text-gray-600">Current status:</span>
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${selectedRoom.out_of_order ? 'bg-gray-200 text-gray-800' : 'bg-blue-100 text-blue-800'
                                    }`}>
                                    {getStatusLabel(selectedRoom)} {getStatusIcon(selectedRoom)}
                                </span>
                            </div>

                            {selectedRoom.out_of_order && selectedRoom.out_of_order_reason && (
                                <div className="bg-red-50 p-3 rounded-lg border-l-4 border-red-500">
                                    <p className="text-sm font-semibold text-red-800">Reason:</p>
                                    <p className="text-sm text-gray-700">{selectedRoom.out_of_order_reason}</p>
                                </div>
                            )}

                            {!selectedRoom.out_of_order ? (
                                <>
                                    {isCleaner && (
                                        <div className="space-y-2">
                                            {getCleaningStatus(selectedRoom) === 'dirty' && (
                                                <button
                                                    onClick={() => handleStatusChange(selectedRoom.id, 'cleaning')}
                                                    disabled={updating}
                                                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded-lg transition"
                                                >
                                                    🧹 Start Cleaning
                                                </button>
                                            )}
                                            {getCleaningStatus(selectedRoom) === 'cleaning' && (
                                                <button
                                                    onClick={() => handleStatusChange(selectedRoom.id, 'ready')}
                                                    disabled={updating}
                                                    className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg transition"
                                                >
                                                    ✅ Mark Ready
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {isHead && (
                                        <div className="space-y-2">
                                            {getCleaningStatus(selectedRoom) === 'ready' && (
                                                <button
                                                    onClick={() => handleStatusChange(selectedRoom.id, 'inspected')}
                                                    disabled={updating}
                                                    className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg transition"
                                                >
                                                    🔍 Inspect Room
                                                </button>
                                            )}
                                            {getCleaningStatus(selectedRoom) === 'inspected' && (
                                                <button
                                                    onClick={() => handleStatusChange(selectedRoom.id, 'awaiting')}
                                                    disabled={updating}
                                                    className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 rounded-lg transition"
                                                >
                                                    👤 Mark Awaiting Guest
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleStatusChange(selectedRoom.id, 'dirty')}
                                                disabled={updating}
                                                className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg transition"
                                            >
                                                🟡 Mark Dirty (needs cleaning)
                                            </button>
                                            <hr className="my-2" />
                                            <button
                                                onClick={() => {
                                                    const reason = prompt('Enter reason for out of order:')
                                                    if (reason && reason.trim()) {
                                                        setOooReason(reason)
                                                        handleSetOutOfOrder()
                                                    }
                                                }}
                                                disabled={oooSubmitting}
                                                className="w-full bg-gray-700 hover:bg-gray-800 text-white py-2 rounded-lg transition"
                                            >
                                                🚫 Mark Out of Order
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                isHead && (
                                    <button
                                        onClick={() => handleRemoveOutOfOrder(selectedRoom.id)}
                                        disabled={updating}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition"
                                    >
                                        ✅ Restore to Service
                                    </button>
                                )
                            )}

                            {updating && <p className="text-center text-sm text-gray-500">Updating...</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}