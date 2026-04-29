'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { 
    getRooms, 
    updateRoomCleaningStatus,
    setRoomOutOfOrder,
    removeRoomOutOfOrder,
    getOutOfOrderRooms
} from '@/lib/api'
import toast from 'react-hot-toast'

interface Room {
    id: string
    room_number: string
    floor: number
    room_type: string
    status: string
    cleaning_status?: string
    out_of_order?: boolean
    out_of_order_reason?: string
}

export default function RoomsTab() {
    const { staff } = useAuth()
    const [rooms, setRooms] = useState<Room[]>([])
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState<string | null>(null)
    const [selectedFloor, setSelectedFloor] = useState<number>(1)
    const [showOooModal, setShowOooModal] = useState(false)
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
    const [oooReason, setOooReason] = useState('')
    const [oooSubmitting, setOooSubmitting] = useState(false)

    const isHead = staff?.role === 'head_housekeeping' || staff?.role === 'admin' || staff?.role === 'manager'
    const isCleaner = staff?.role === 'housekeeping'

    const floors = [...new Set(rooms.map(r => r.floor))].sort((a,b) => a-b)

    const loadRooms = useCallback(async () => {
        try {
            const data = await getRooms()
            const oooRooms = await getOutOfOrderRooms()
            const oooMap = new Map(oooRooms.map((r: any) => [r.id, r.out_of_order_reason]))
            const roomsWithStatus = data.map((room: any) => ({
                ...room,
                out_of_order: oooMap.has(room.id),
                out_of_order_reason: oooMap.get(room.id)
            }))
            setRooms(roomsWithStatus)
        } catch (error) {
            toast.error('Failed to load rooms')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadRooms()
        const interval = setInterval(loadRooms, 30000)
        return () => clearInterval(interval)
    }, [loadRooms])

    const handleStatusChange = async (roomId: string, newStatus: string) => {
        setUpdating(roomId)
        if (isCleaner && !['cleaning', 'ready'].includes(newStatus)) {
            toast.error('Cleaners can only change to cleaning or ready')
            setUpdating(null)
            return
        }
        if (isHead && !['inspected', 'awaiting', 'dirty'].includes(newStatus)) {
            toast.error('Head can only change to inspected, awaiting, or dirty')
            setUpdating(null)
            return
        }
        try {
            await updateRoomCleaningStatus(roomId, newStatus)
            toast.success(`Status → ${newStatus.toUpperCase()}`)
            loadRooms()
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Update failed')
        } finally {
            setUpdating(null)
        }
    }

    const handleSetOutOfOrder = async () => {
        if (!selectedRoom || !oooReason.trim()) {
            toast.error('Please provide a reason')
            return
        }
        setOooSubmitting(true)
        try {
            await setRoomOutOfOrder(selectedRoom.id, oooReason)
            toast.success(`Room ${selectedRoom.room_number} is OUT OF ORDER`)
            setShowOooModal(false)
            setSelectedRoom(null)
            setOooReason('')
            loadRooms()
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed')
        } finally {
            setOooSubmitting(false)
        }
    }

    const handleRemoveOutOfOrder = async (room: Room) => {
        if (!confirm(`Restore Room ${room.room_number}? It will need cleaning.`)) return
        setUpdating(room.id)
        try {
            await removeRoomOutOfOrder(room.id)
            toast.success(`Room ${room.room_number} back in service`)
            loadRooms()
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed')
        } finally {
            setUpdating(null)
        }
    }

    const getStatusColor = (status: string, outOfOrder: boolean) => {
        if (outOfOrder) return 'border-l-8 border-gray-700 bg-gray-50'
        switch(status) {
            case 'dirty': return 'border-l-8 border-red-500 bg-red-50'
            case 'cleaning': return 'border-l-8 border-yellow-500 bg-yellow-50'
            case 'ready': return 'border-l-8 border-green-500 bg-green-50'
            case 'inspected': return 'border-l-8 border-blue-500 bg-blue-50'
            case 'awaiting': return 'border-l-8 border-purple-500 bg-purple-50'
            default: return 'border-l-8 border-gray-300 bg-white'
        }
    }

    const getIcon = (status: string, outOfOrder: boolean) => {
        if (outOfOrder) return '🚫'
        switch(status) {
            case 'dirty': return '🟡'
            case 'cleaning': return '🧹'
            case 'ready': return '✅'
            case 'inspected': return '🔍'
            case 'awaiting': return '👤'
            default: return '🏨'
        }
    }

    const getAvailableActions = (room: Room) => {
        if (room.out_of_order) return []
        const status = room.cleaning_status || room.status || 'dirty'
        if (isCleaner) {
            if (status === 'dirty') return [{ label: '🧹 Start', value: 'cleaning' }]
            if (status === 'cleaning') return [{ label: '✅ Ready', value: 'ready' }]
            return []
        }
        if (isHead) {
            if (status === 'ready') return [{ label: '🔍 Inspect', value: 'inspected' }]
            if (status === 'inspected') return [{ label: '👤 Await', value: 'awaiting' }]
            return [{ label: '🟡 Dirty', value: 'dirty' }]
        }
        return []
    }

    const filteredRooms = rooms.filter(r => r.floor === selectedFloor)

    if (loading) return <div className="flex justify-center items-center h-64 text-lg text-gray-500">Loading rooms...</div>

    return (
        <div className="min-h-screen bg-gray-100 p-6 font-sans">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8">
                <h1 className="text-3xl font-light text-gray-800 tracking-wide">🏨 Room Dashboard</h1>
                <div className="text-sm text-gray-500 mt-1">
                    {isCleaner ? 'Cleaner: Dirty → Cleaning → Ready' : 
                     isHead ? 'Head: Ready → Inspected → Awaiting · Out of order' : 
                     'Read-only'}
                </div>
            </div>

            {/* Floor Tabs (like elevator) */}
            <div className="max-w-7xl mx-auto mb-8 flex gap-2 border-b border-gray-300 pb-2">
                {floors.map(floor => (
                    <button
                        key={floor}
                        onClick={() => setSelectedFloor(floor)}
                        className={`px-6 py-2 text-sm font-medium transition-all ${
                            selectedFloor === floor
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        FLOOR {floor}
                    </button>
                ))}
            </div>

            {/* Grid of keycard-style rooms */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredRooms.map(room => {
                    const statusKey = room.cleaning_status || room.status || 'dirty'
                    const statusColorClass = getStatusColor(statusKey, room.out_of_order)
                    const icon = getIcon(statusKey, room.out_of_order)
                    const actions = getAvailableActions(room)
                    const isUpdating = updating === room.id

                    return (
                        <div
                            key={room.id}
                            className={`relative rounded-xl shadow-md overflow-hidden transition-all duration-200 hover:shadow-xl hover:-translate-y-1 ${statusColorClass}`}
                        >
                            {/* Top bar with status icon and label */}
                            <div className="flex items-center justify-between px-4 pt-3 pb-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">{icon}</span>
                                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                                        {room.out_of_order ? 'Out of Order' : statusKey}
                                    </span>
                                </div>
                                {room.out_of_order && room.out_of_order_reason && (
                                    <div className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                        ⚠️ {room.out_of_order_reason.substring(0, 20)}...
                                    </div>
                                )}
                            </div>

                            {/* Hero room number */}
                            <div className="px-4 pb-2">
                                <div className="text-5xl font-black text-gray-800 tracking-tighter">
                                    {room.room_number}
                                </div>
                                <div className="text-sm text-gray-500 flex justify-between mt-1">
                                    <span>{room.room_type}</span>
                                    <span>Floor {room.floor}</span>
                                </div>
                            </div>

                            {/* Action buttons (visible only when not out of order and has actions) */}
                            {!room.out_of_order && actions.length > 0 && (
                                <div className="px-4 pb-3 pt-1 flex gap-2">
                                    {actions.map(action => (
                                        <button
                                            key={action.value}
                                            onClick={() => handleStatusChange(room.id, action.value)}
                                            disabled={isUpdating}
                                            className="flex-1 bg-white border border-gray-300 rounded-lg py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
                                        >
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Out of order / restore button (head only) */}
                            {isHead && (
                                <div className="px-4 pb-4 pt-0">
                                    {!room.out_of_order ? (
                                        <button
                                            onClick={() => { setSelectedRoom(room); setShowOooModal(true) }}
                                            disabled={isUpdating}
                                            className="w-full bg-red-500 hover:bg-red-600 text-white rounded-lg py-1.5 text-sm font-medium transition"
                                        >
                                            🚫 Out of Order
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleRemoveOutOfOrder(room)}
                                            disabled={isUpdating}
                                            className="w-full bg-green-500 hover:bg-green-600 text-white rounded-lg py-1.5 text-sm font-medium transition"
                                        >
                                            ✅ Restore
                                        </button>
                                    )}
                                </div>
                            )}

                            {isUpdating && (
                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center text-sm text-gray-500">
                                    Updating...
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Out of Order Modal */}
            {showOooModal && selectedRoom && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-white max-w-md w-full rounded-xl shadow-2xl overflow-hidden">
                        <div className="bg-red-600 px-6 py-4">
                            <h3 className="text-white text-xl font-bold">🚫 Mark Out of Order</h3>
                        </div>
                        <div className="p-6">
                            <p className="mb-3 text-gray-700">Room <strong>{selectedRoom.room_number}</strong></p>
                            <textarea
                                value={oooReason}
                                onChange={(e) => setOooReason(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                                rows={4}
                                placeholder="Reason for out of order..."
                                autoFocus
                            />
                            <div className="flex gap-3 mt-5">
                                <button
                                    onClick={() => setShowOooModal(false)}
                                    className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSetOutOfOrder}
                                    disabled={!oooReason.trim() || oooSubmitting}
                                    className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                    {oooSubmitting ? 'Marking...' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}