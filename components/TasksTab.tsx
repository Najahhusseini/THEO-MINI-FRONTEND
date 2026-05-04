'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { 
    getRoomsWithCleaning, 
    assignCleaning, 
    updateCleaningTaskStatus, 
    completeCleaning,
    updateRoomCleaningStatus,
    markRoomAwaitingGuest,
    getHousekeepingStaff,
    reassignRoom,
    getStays
} from '@/lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

interface CleaningTask {
    id: string
    room_id: string
    room_number: string
    floor: number
    room_type: string
    guest_name: string
    request_type: 'stay_over' | 'checkout'
    status: 'pending' | 'assigned' | 'in_progress' | 'completed'
    assigned_to_name?: string
    assigned_to_id?: string
    created_at: string
}

interface InspectionTask {
    room_id: string
    room_number: string
    guest_name: string
    cleaning_status: string
    assigned_cleaner_id?: string
    assigned_cleaner_name?: string
    last_cleaning_update?: string
}

interface Staff {
    id: string
    name: string
    sub_role?: string
}

type OccupancyInfo = {
    status: 'occupied' | 'reserved' | 'vacant' | 'arriving_today'
    guest_name?: string
    arrival_date?: string
    departure_date?: string
}

export default function TasksTab() {
    const { staff } = useAuth()
    const [cleaningTasks, setCleaningTasks] = useState<CleaningTask[]>([])
    const [inspectionTasks, setInspectionTasks] = useState<InspectionTask[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'cleaning' | 'inspection'>('cleaning')
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [housekeepingStaff, setHousekeepingStaff] = useState<Staff[]>([])
    const [showReassignModal, setShowReassignModal] = useState(false)
    const [reassignRoomId, setReassignRoomId] = useState<string | null>(null)
    const [reassignStaffId, setReassignStaffId] = useState('')
    const [reassigning, setReassigning] = useState(false)
    const [occupancyMap, setOccupancyMap] = useState<Record<string, OccupancyInfo>>({})

    const isHead = staff?.role === 'head_housekeeping'
    const isCleaningStaff = staff?.role === 'housekeeping'

    const loadStaff = useCallback(async () => {
        if (!isHead) return
        try {
            const data = await getHousekeepingStaff()
            setHousekeepingStaff(data)
        } catch (error) {
            console.error('Failed to load staff', error)
        }
    }, [isHead])

    const loadData = useCallback(async () => {
        if (!staff) return
        try {
            const rooms = await getRoomsWithCleaning()
            
            const cleaning = rooms
                .filter(room => room.cleaning_request_id && room.request_status !== 'completed')
                .map(room => ({
                    id: room.cleaning_request_id!,
                    room_id: room.id,
                    room_number: room.room_number,
                    floor: room.floor,
                    room_type: room.room_type,
                    guest_name: room.guest_name,
                    request_type: room.request_type || 'stay_over',
                    status: room.request_status!,
                    assigned_to_name: room.assigned_to_name,
                    assigned_to_id: room.assigned_to_id,
                    created_at: room.last_cleaning_update || new Date().toISOString(),
                }))
            setCleaningTasks(cleaning)

            const inspected = rooms.filter(room => 
                room.cleaning_status === 'ready' || room.cleaning_status === 'inspected' || room.cleaning_status === 'awaiting'
            ).map(room => ({
                room_id: room.id,
                room_number: room.room_number,
                guest_name: room.guest_name,
                cleaning_status: room.cleaning_status,
                assigned_cleaner_id: room.assigned_cleaner_id,
                assigned_cleaner_name: room.assigned_cleaner_name,
                last_cleaning_update: room.last_cleaning_update,
            }))
            setInspectionTasks(inspected)

            const stays = await getStays()
            const today = format(new Date(), 'yyyy-MM-dd')
            const occMap: Record<string, OccupancyInfo> = {}
            for (const stay of stays) {
                const num = stay.room_number
                const arr = stay.arrival_date.split('T')[0]
                const dep = stay.departure_date.split('T')[0]
                if (arr <= today && dep >= today && stay.status !== 'checked_out') {
                    if (stay.status === 'checked_in')
                        occMap[num] = { status: 'occupied', guest_name: stay.guest_name, arrival_date: arr, departure_date: dep }
                    else if (arr === today)
                        occMap[num] = { status: 'arriving_today', guest_name: stay.guest_name, arrival_date: arr, departure_date: dep }
                    else
                        occMap[num] = { status: 'occupied', guest_name: stay.guest_name, arrival_date: arr, departure_date: dep }
                } else if (arr > today && !occMap[num]) {
                    occMap[num] = { status: 'reserved', guest_name: stay.guest_name, arrival_date: arr, departure_date: dep }
                }
            }
            for (const room of rooms) {
                const num = room.room_number
                if (!occMap[num]) occMap[num] = { status: 'vacant' }
            }
            setOccupancyMap(occMap)

        } catch (error) {
            console.error('Failed to load tasks:', error)
            toast.error('Failed to load tasks')
        } finally {
            setLoading(false)
        }
    }, [staff])

    useEffect(() => {
        loadData()
        loadStaff()
        const interval = setInterval(loadData, 30000)
        const handleRefresh = () => loadData()
        window.addEventListener('refresh-tasks', handleRefresh)
        window.addEventListener('refresh-cleaning-board', handleRefresh)
        window.addEventListener('refresh-rooms', handleRefresh)
        return () => {
            clearInterval(interval)
            window.removeEventListener('refresh-tasks', handleRefresh)
            window.removeEventListener('refresh-cleaning-board', handleRefresh)
            window.removeEventListener('refresh-rooms', handleRefresh)
        }
    }, [loadData, loadStaff])

    // ✅ NEW: Auto‑await any room that is "inspected" but has a guest arriving today
    useEffect(() => {
        if (!isHead) return
        const fixInspectedRooms = async () => {
            let changed = false
            for (const room of inspectionTasks) {
                if (room.cleaning_status !== 'inspected') continue
                const occ = occupancyMap[room.room_number]
                if (occ && occ.status === 'arriving_today') {
                    try {
                        await markRoomAwaitingGuest(room.room_id)
                        console.log(`Auto‑awaited Room ${room.room_number}`)
                        changed = true
                    } catch (err) {
                        console.error('Failed to auto‑await', err)
                    }
                }
            }
            if (changed) loadData()
        }
        fixInspectedRooms()
    }, [inspectionTasks, occupancyMap, isHead, loadData])

    const handleAcceptTask = async (requestId: string, roomId: string) => {
        setActionLoading(requestId)
        try {
            await assignCleaning(requestId, staff!.id)
            toast.success('Task accepted. You can now start cleaning.')
            await loadData()
            window.dispatchEvent(new CustomEvent('refresh-rooms'))
            window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
            window.dispatchEvent(new CustomEvent('refresh-notifications'))
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to accept task')
        } finally {
            setActionLoading(null)
        }
    }

    const handleStartCleaning = async (requestId: string) => {
        setActionLoading(requestId)
        try {
            await updateCleaningTaskStatus(requestId, 'in_progress')
            toast.success('Cleaning started')
            await loadData()
            window.dispatchEvent(new CustomEvent('refresh-rooms'))
            window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
            window.dispatchEvent(new CustomEvent('refresh-notifications'))
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to start cleaning')
        } finally {
            setActionLoading(null)
        }
    }

    const handleCompleteCleaning = async (requestId: string) => {
        setActionLoading(requestId)
        try {
            await completeCleaning(requestId)
            toast.success('Cleaning completed. Room is now ready for inspection.')
            await loadData()
            window.dispatchEvent(new CustomEvent('refresh-rooms'))
            window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
            window.dispatchEvent(new CustomEvent('refresh-daily-stats'))
            window.dispatchEvent(new CustomEvent('refresh-notifications'))
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to complete cleaning')
        } finally {
            setActionLoading(null)
        }
    }

    const handleInspect = async (roomId: string, roomNumber: string) => {
        setActionLoading(roomId)
        try {
            await updateRoomCleaningStatus(roomId, 'inspected')
            toast.success('Room marked as inspected')

            // Auto‑await
            const occ = occupancyMap[roomNumber]
            if (occ && occ.status === 'arriving_today') {
                await markRoomAwaitingGuest(roomId)
                toast.success('Guest arriving today – room set to awaiting')
            }

            await loadData()
            window.dispatchEvent(new CustomEvent('refresh-rooms'))
            window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
            window.dispatchEvent(new CustomEvent('refresh-daily-stats'))
            window.dispatchEvent(new CustomEvent('refresh-notifications'))
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to inspect')
        } finally {
            setActionLoading(null)
        }
    }

    const handleReassign = async () => {
        if (!reassignRoomId || !reassignStaffId) return
        setReassigning(true)
        try {
            await reassignRoom(reassignRoomId, reassignStaffId)
            toast.success('Room reassigned')
            await loadData()
            window.dispatchEvent(new CustomEvent('refresh-rooms'))
            setShowReassignModal(false)
            setReassignRoomId(null)
            setReassignStaffId('')
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Reassignment failed')
        } finally {
            setReassigning(false)
        }
    }

    const getStatusBadge = (status: string) => {
        switch(status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800'
            case 'assigned': return 'bg-blue-100 text-blue-800'
            case 'in_progress': return 'bg-purple-100 text-purple-800'
            case 'completed': return 'bg-green-100 text-green-800'
            default: return 'bg-gray-100'
        }
    }

    const getCleaningStatusBadge = (status: string) => {
        switch(status) {
            case 'ready': return 'bg-green-100 text-green-800'
            case 'inspected': return 'bg-blue-100 text-blue-800'
            case 'awaiting': return 'bg-purple-100 text-purple-800'
            default: return 'bg-gray-100'
        }
    }

    const getOccupancyBadge = (info: OccupancyInfo) => {
        switch (info.status) {
            case 'arriving_today': return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800 font-medium">Arriving Today</span>
            case 'occupied': return <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800 font-medium">Occupied</span>
            case 'reserved': return <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800 font-medium">Reserved</span>
            default: return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 font-medium">Vacant</span>
        }
    }

    if (loading) return <div className="text-center py-12">Loading tasks...</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">✅ Task Center</h2>
                    <p className="text-sm text-gray-500">Cleaning & inspection workflow</p>
                </div>
                <button onClick={loadData} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">🔄 Refresh</button>
            </div>

            <div className="flex gap-2 border-b pb-2">
                <button onClick={() => setActiveTab('cleaning')} className={`px-4 py-2 rounded-t-lg font-medium transition ${activeTab === 'cleaning' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                    🧹 Cleaning Tasks ({cleaningTasks.length})
                </button>
                {isHead && (
                    <button onClick={() => setActiveTab('inspection')} className={`px-4 py-2 rounded-t-lg font-medium transition ${activeTab === 'inspection' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                        🔍 Inspection & Ready ({inspectionTasks.length})
                    </button>
                )}
            </div>

            {activeTab === 'cleaning' && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Room</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Guest</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Assigned To</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {cleaningTasks.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-gray-500">No cleaning tasks</td>
                                    </tr>
                                ) : (
                                    cleaningTasks.map(task => (
                                        <tr key={task.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-medium">Room {task.room_number}</div>
                                                <div className="text-xs text-gray-500">{task.room_type} • Floor {task.floor}</div>
                                            </td>
                                            <td className="px-6 py-4">{task.guest_name}</td>
                                            <td className="px-6 py-4 capitalize">{task.request_type === 'stay_over' ? 'Stay‑Over' : 'Checkout'}</td>
                                            <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(task.status)}`}>{task.status}</span></td>
                                            <td className="px-6 py-4">{task.assigned_to_name || '—'}</td>
                                            <td className="px-6 py-4 space-x-2">
                                                {isCleaningStaff && task.status === 'pending' && (
                                                    <button onClick={() => handleAcceptTask(task.id, task.room_id)} disabled={actionLoading === task.id} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50">
                                                        Accept
                                                    </button>
                                                )}
                                                {isCleaningStaff && task.status === 'assigned' && task.assigned_to_id === staff?.id && (
                                                    <button onClick={() => handleStartCleaning(task.id)} disabled={actionLoading === task.id} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                                                        Start
                                                    </button>
                                                )}
                                                {isCleaningStaff && task.status === 'in_progress' && task.assigned_to_id === staff?.id && (
                                                    <button onClick={() => handleCompleteCleaning(task.id)} disabled={actionLoading === task.id} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50">
                                                        Complete
                                                    </button>
                                                )}
                                                {isCleaningStaff && task.status !== 'pending' && task.status !== 'assigned' && task.status !== 'in_progress' && task.status !== 'completed' && (
                                                    <span className="text-xs text-gray-400">Not assigned to you</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'inspection' && isHead && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Room</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Occupancy</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Cleaning Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Assigned To</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Last Update</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {inspectionTasks.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-gray-500">No rooms ready for inspection</td>
                                    </tr>
                                ) : (
                                    inspectionTasks.map(room => (
                                        <tr key={room.room_id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap font-medium">Room {room.room_number}</td>
                                            <td className="px-6 py-4">{getOccupancyBadge(occupancyMap[room.room_number] || { status: 'vacant' })}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCleaningStatusBadge(room.cleaning_status)}`}>
                                                    {room.cleaning_status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">{room.assigned_cleaner_name || '—'}</td>
                                            <td className="px-6 py-4 text-sm">{room.last_cleaning_update ? new Date(room.last_cleaning_update).toLocaleString() : '—'}</td>
                                            <td className="px-6 py-4 space-x-2">
                                                {room.cleaning_status === 'ready' && (
                                                    <button onClick={() => handleInspect(room.room_id, room.room_number)} disabled={actionLoading === room.room_id} className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700 disabled:opacity-50">
                                                        Inspect
                                                    </button>
                                                )}
                                                {room.assigned_cleaner_id && (
                                                    <button
                                                        onClick={() => {
                                                            setReassignRoomId(room.room_id);
                                                            setShowReassignModal(true);
                                                        }}
                                                        className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                                                    >
                                                        Reassign
                                                    </button>
                                                )}
                                                {room.cleaning_status === 'awaiting' && (
                                                    <span className="text-green-600 text-sm font-medium">✓ Ready for guest</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showReassignModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
                        <div className="bg-yellow-600 px-6 py-4 rounded-t-xl">
                            <h3 className="text-xl font-semibold text-white">Reassign Room</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Select New Staff</label>
                                <select
                                    value={reassignStaffId}
                                    onChange={(e) => setReassignStaffId(e.target.value)}
                                    className="w-full p-2 border rounded"
                                >
                                    <option value="">Select...</option>
                                    {housekeepingStaff.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} {s.sub_role ? `(${s.sub_role})` : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setShowReassignModal(false)} className="flex-1 px-4 py-2 border rounded">Cancel</button>
                                <button onClick={handleReassign} disabled={!reassignStaffId || reassigning} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
                                    {reassigning ? 'Reassigning...' : 'Reassign'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}