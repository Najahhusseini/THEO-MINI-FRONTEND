'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRooms } from '@/contexts/RoomContext'
import { 
    getHousekeepingStaff,
    upsertCleaningRequest,
    assignCleaning,
    completeCleaning,
    ensureCheckoutRequests,
    ensureDirtyRoomRequests
} from '@/lib/api'
import toast from 'react-hot-toast'

interface Room {
    id: string
    room_number: string
    floor: number
    room_type: string
    cleaning_status: 'dirty' | 'cleaning' | 'ready' | 'inspected' | 'awaiting'
    guest_name: string
    cleaning_request_id?: string
    request_status?: string
    request_type?: 'stay_over' | 'checkout'
    assigned_to_name?: string
    assigned_to_id?: string
    last_cleaning_update?: string
    do_not_disturb?: boolean
    out_of_order?: boolean
    out_of_order_reason?: string
}

interface Staff {
    id: string
    name: string
    sub_role?: string
}

export default function CleaningManagementTab() {
    const { staff } = useAuth()
    const { rooms, loading, refreshRooms } = useRooms()
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
    const [showAssignModal, setShowAssignModal] = useState(false)
    const [staffList, setStaffList] = useState<Staff[]>([])
    const [selectedStaffId, setSelectedStaffId] = useState('')
    const [assignType, setAssignType] = useState<'stay_over' | 'checkout'>('stay_over')
    const [assigning, setAssigning] = useState(false)
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'assigned'>('all')
    const [loadingStaff, setLoadingStaff] = useState(false)

    const isHead = staff?.role === 'head_housekeeping' || staff?.role === 'admin' || staff?.role === 'manager'

    const loadStaff = useCallback(async () => {
        if (!isHead) return
        setLoadingStaff(true)
        try {
            const data = await getHousekeepingStaff()
            setStaffList(data)
        } catch (error) {
            console.error('Failed to load staff:', error)
            toast.error('Failed to load staff list')
        } finally {
            setLoadingStaff(false)
        }
    }, [isHead])

    // Helper function to ensure a cleaning request exists for a room
    const ensureCleaningRequestForRoom = useCallback(async (room: Room): Promise<string | null> => {
        if (room.cleaning_request_id) {
            return room.cleaning_request_id
        }
        
        try {
            const requestType = room.request_type === 'stay_over' ? 'stay_over' : 'checkout'
            const request = await upsertCleaningRequest(room.id, requestType)
            return request.id
        } catch (err) {
            console.error('Failed to create cleaning request:', err)
            toast.error(`Could not create cleaning request for Room ${room.room_number}`)
            return null
        }
    }, [])

    useEffect(() => {
        const init = async () => {
            try {
                await ensureCheckoutRequests()
                const result = await ensureDirtyRoomRequests()
                console.log(`Cleaning requests created: ${result.created}`)
            } catch (error) {
                console.error('Failed to ensure cleaning requests:', error)
            }
            
            refreshRooms()
            if (isHead) await loadStaff()
        }
        init()
        
        const handleStatusChange = () => {
            refreshRooms()
        }
        
        window.addEventListener('room-status-changed', handleStatusChange)
        window.addEventListener('room-outoforder-changed', handleStatusChange)
        window.addEventListener('room-restored', handleStatusChange)
        window.addEventListener('refresh-cleaning-board', handleStatusChange)
        
        const interval = setInterval(refreshRooms, 15000)
        
        return () => {
            clearInterval(interval)
            window.removeEventListener('room-status-changed', handleStatusChange)
            window.removeEventListener('room-outoforder-changed', handleStatusChange)
            window.removeEventListener('room-restored', handleStatusChange)
            window.removeEventListener('refresh-cleaning-board', handleStatusChange)
        }
    }, [refreshRooms, isHead, loadStaff])

    // Handle clicking the Assign button - ensures a cleaning request exists first
    const handleAssignClick = async (room: Room) => {
        if (room.do_not_disturb) {
            toast.error('Cannot assign cleaning – Room has Do Not Disturb active. Remove DND first.')
            return
        }
        
        // Ensure there's a cleaning request
        const requestId = await ensureCleaningRequestForRoom(room)
        if (!requestId) {
            toast.error('Could not create cleaning request for this room')
            return
        }
        
        // Update room with request ID for the modal
        const updatedRoom = { ...room, cleaning_request_id: requestId, request_status: 'pending' }
        setSelectedRoom(updatedRoom)
        setShowAssignModal(true)
    }

    const handleAssign = async () => {
        if (!selectedRoom || !selectedStaffId) return
        
        setAssigning(true)
        try {
            // Ensure request exists one more time before assigning
            const requestId = await ensureCleaningRequestForRoom(selectedRoom)
            if (!requestId) {
                toast.error('Cannot assign - no cleaning request found')
                setAssigning(false)
                return
            }
            
            await assignCleaning(requestId, selectedStaffId)
            toast.success(`Room ${selectedRoom.room_number} assigned to ${staffList.find(s => s.id === selectedStaffId)?.name}`)
            
            // Dispatch events to refresh all views
            window.dispatchEvent(new CustomEvent('room-assigned'))
            window.dispatchEvent(new CustomEvent('refresh-rooms'))
            window.dispatchEvent(new CustomEvent('refresh-tasks'))
            window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
            
            setShowAssignModal(false)
            setSelectedRoom(null)
            setSelectedStaffId('')
            refreshRooms()
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Assignment failed')
        } finally {
            setAssigning(false)
        }
    }

    const handleComplete = async (requestId: string, room: Room) => {
        try {
            await completeCleaning(requestId)
            toast.success(`Room ${room.room_number} cleaning completed`)
            refreshRooms()
            window.dispatchEvent(new CustomEvent('refresh-daily-stats'))
            window.dispatchEvent(new CustomEvent('refresh-notifications'))
            window.dispatchEvent(new CustomEvent('room-status-changed'))
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to complete cleaning')
        }
    }

    const getStatusColor = (status: string, outOfOrder: boolean = false) => {
        if (outOfOrder) return 'bg-gray-400 text-white'
        switch(status) {
            case 'dirty': return 'bg-red-100 text-red-800'
            case 'cleaning': return 'bg-yellow-100 text-yellow-800'
            case 'ready': return 'bg-green-100 text-green-800'
            case 'inspected': return 'bg-blue-100 text-blue-800'
            case 'awaiting': return 'bg-purple-100 text-purple-800'
            default: return 'bg-gray-100'
        }
    }

    // Determine if a room can be assigned (pending or dirty without request)
    const canAssign = (room: Room) => {
        return isHead && (
            room.request_status === 'pending' || 
            (room.cleaning_status === 'dirty' && !room.out_of_order)
        )
    }

    const filteredRooms = rooms.filter(room => {
        if (room.out_of_order) return false
        if (activeTab === 'pending') return room.request_status === 'pending'
        if (activeTab === 'assigned') return room.request_status === 'assigned'
        return true
    })

    const checkoutRooms = filteredRooms.filter(r => r.request_type === 'checkout')
    const stayoverRooms = filteredRooms.filter(r => r.request_type === 'stay_over')

    if (loading) return <div className="text-center py-12">Loading cleaning board...</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">🧼 Cleaning Management Board</h2>
                    <p className="text-sm text-gray-500">Real‑time view of all cleaning tasks – In‑House & Checkout</p>
                </div>
                <button onClick={refreshRooms} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">
                    🔄 Refresh
                </button>
            </div>

            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{rooms.filter(r => r.request_status === 'pending' && !r.out_of_order).length}</div>
                    <div className="text-sm text-gray-500">Pending Requests</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">{rooms.filter(r => r.request_status === 'assigned' && !r.out_of_order).length}</div>
                    <div className="text-sm text-gray-500">Assigned & In Progress</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{rooms.filter(r => r.cleaning_status === 'ready' && !r.out_of_order).length}</div>
                    <div className="text-sm text-gray-500">Ready for Inspection</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                    <div className="text-2xl font-bold text-gray-600">{rooms.filter(r => r.out_of_order).length}</div>
                    <div className="text-sm text-gray-500">Out of Order</div>
                </div>
            </div>

            <div className="flex gap-2 border-b pb-2">
                {['all', 'pending', 'assigned'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-4 py-2 rounded-t-lg font-medium transition ${
                            activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                    >
                        {tab === 'all' ? 'All Rooms' : tab === 'pending' ? 'Pending Assignment' : 'Assigned / In Progress'}
                    </button>
                ))}
            </div>

            {/* Out of Order Rooms Section */}
            {rooms.filter(r => r.out_of_order).length > 0 && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-3 bg-gray-700 border-b border-gray-600">
                        <h3 className="font-semibold text-white">🚫 Out of Order Rooms ({rooms.filter(r => r.out_of_order).length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Room</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Reason</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {rooms.filter(r => r.out_of_order).map(room => (
                                    <tr key={room.id} className="bg-gray-100">
                                        <td className="px-6 py-4 whitespace-nowrap font-medium">
                                            Room {room.room_number}
                                            <div className="text-xs text-gray-500">{room.room_type} • Floor {room.floor}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-red-600">{room.out_of_order_reason}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 rounded-full text-xs bg-gray-500 text-white">OUT OF ORDER</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Checkout Cleaning Section */}
            {checkoutRooms.length > 0 && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-3 bg-red-50 border-b border-red-200">
                        <h3 className="font-semibold text-red-800">🚪 Checkout Cleaning ({checkoutRooms.length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Room</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Guest</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Cleaning Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Assigned To</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {checkoutRooms.map(room => (
                                    <tr key={room.id} className={`hover:bg-gray-50 ${room.do_not_disturb ? 'bg-red-50' : ''}`}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium">Room {room.room_number}</div>
                                            <div className="text-xs text-gray-500">{room.room_type} • Floor {room.floor}</div>
                                        </td>
                                        <td className="px-6 py-4">{room.guest_name}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(room.cleaning_status)}`}>
                                                {room.cleaning_status?.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">{room.assigned_to_name || '—'}</td>
                                        <td className="px-6 py-4 space-x-2">
                                            {canAssign(room) && (
                                                <button 
                                                    onClick={() => handleAssignClick(room)} 
                                                    disabled={room.do_not_disturb}
                                                    className={`px-3 py-1 rounded text-sm ${
                                                        room.do_not_disturb 
                                                            ? 'bg-gray-300 cursor-not-allowed' 
                                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                                    }`}
                                                >
                                                    Assign
                                                </button>
                                            )}
                                            {room.request_status === 'assigned' && (
                                                <button 
                                                    onClick={() => handleComplete(room.cleaning_request_id!, room)} 
                                                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                                                >
                                                    Complete
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Stay‑Over (In‑House) Cleaning Section */}
            {stayoverRooms.length > 0 && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
                        <h3 className="font-semibold text-blue-800">🛏️ Stay‑Over (In‑House) Cleaning ({stayoverRooms.length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Room</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Guest</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Cleaning Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Assigned To</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {stayoverRooms.map(room => (
                                    <tr key={room.id} className={`hover:bg-gray-50 ${room.do_not_disturb ? 'bg-red-50' : ''}`}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium">Room {room.room_number}</div>
                                            <div className="text-xs text-gray-500">{room.room_type} • Floor {room.floor}</div>
                                        </td>
                                        <td className="px-6 py-4">{room.guest_name}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(room.cleaning_status)}`}>
                                                {room.cleaning_status?.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">{room.assigned_to_name || '—'}</td>
                                        <td className="px-6 py-4 space-x-2">
                                            {canAssign(room) && (
                                                <button 
                                                    onClick={() => handleAssignClick(room)} 
                                                    disabled={room.do_not_disturb}
                                                    className={`px-3 py-1 rounded text-sm ${
                                                        room.do_not_disturb 
                                                            ? 'bg-gray-300 cursor-not-allowed' 
                                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                                    }`}
                                                >
                                                    Assign
                                                </button>
                                            )}
                                            {room.request_status === 'assigned' && (
                                                <button 
                                                    onClick={() => handleComplete(room.cleaning_request_id!, room)} 
                                                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                                                >
                                                    Complete
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {filteredRooms.length === 0 && (
                <div className="text-center py-12 text-gray-500">No cleaning requests found.</div>
            )}

            {/* Assignment Modal */}
            {showAssignModal && selectedRoom && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-xl">
                            <h3 className="text-xl font-semibold text-white">Assign Cleaning</h3>
                            <p className="text-blue-100">
                                Room {selectedRoom.room_number} – {selectedRoom.guest_name}
                                {selectedRoom.do_not_disturb && <span className="ml-2 text-red-300">(⚠️ DND Active)</span>}
                            </p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Type</label>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setAssignType('stay_over')} 
                                        className={`flex-1 py-2 rounded ${assignType === 'stay_over' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                                    >
                                        Stay‑Over
                                    </button>
                                    <button 
                                        onClick={() => setAssignType('checkout')} 
                                        className={`flex-1 py-2 rounded ${assignType === 'checkout' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                                    >
                                        Checkout
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Staff Member</label>
                                <select 
                                    value={selectedStaffId} 
                                    onChange={(e) => setSelectedStaffId(e.target.value)} 
                                    className="w-full p-2 border rounded"
                                    disabled={loadingStaff}
                                >
                                    <option value="">Select...</option>
                                    {staffList.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                {loadingStaff && <p className="text-xs text-gray-500 mt-1">Loading staff...</p>}
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button 
                                    onClick={() => setShowAssignModal(false)} 
                                    className="flex-1 px-4 py-2 border rounded"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleAssign} 
                                    disabled={!selectedStaffId || assigning || selectedRoom.do_not_disturb} 
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                                >
                                    {assigning ? 'Assigning...' : 'Assign'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}