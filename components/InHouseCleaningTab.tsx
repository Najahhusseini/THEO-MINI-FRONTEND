'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { 
    getCheckoutCleaning,
    getStayOverCleaning,
    getCheckoutCounts,
    assignCleaning,
    completeCleaning,
    getCleaningStats,
    getHousekeepingStaff  // Changed from getScheduleStaff
} from '@/lib/api'
import toast from 'react-hot-toast'

interface CleaningRequest {
    id: string
    room_id: string
    room_number: string
    floor: number
    room_type: string
    guest_name: string
    check_in_date?: string
    check_out_date: string
    cleaning_status: string
    priority: string
    notes: string
    requested_by_name: string
    requested_at: string
    assigned_to_name?: string
    assigned_to_role?: string
}

interface Staff {
    id: string
    name: string
    role: string
    sub_role?: string
}

const subRoleLabels: Record<string, { label: string; icon: string }> = {
    room_cleaning: { label: 'Room Cleaning', icon: '🛏️' },
    hallway: { label: 'Hallway', icon: '🚪' },
    laundry: { label: 'Laundry', icon: '🧺' },
    general: { label: 'General', icon: '🧹' },
}

export default function InHouseCleaningTab() {
    const { staff } = useAuth()
    const [checkoutRequests, setCheckoutRequests] = useState<CleaningRequest[]>([])
    const [stayoverRequests, setStayoverRequests] = useState<CleaningRequest[]>([])
    const [checkoutCounts, setCheckoutCounts] = useState<{ date: string; count: number }[]>([])
    const [stats, setStats] = useState({ pending: 0, assigned: 0, in_progress: 0, completed_today: 0 })
    const [loading, setLoading] = useState(true)
    const [isLoadingData, setIsLoadingData] = useState(false)
    const [selectedRequest, setSelectedRequest] = useState<CleaningRequest | null>(null)
    const [showAssignModal, setShowAssignModal] = useState(false)
    const [housekeepingStaff, setHousekeepingStaff] = useState<Staff[]>([])
    const [selectedStaffId, setSelectedStaffId] = useState('')
    const [selectedSubRole, setSelectedSubRole] = useState('')
    const [assigning, setAssigning] = useState(false)
    const [activeSection, setActiveSection] = useState<'checkout' | 'stayover'>('stayover')

    const getWeekStart = () => {
        const today = new Date()
        const day = today.getDay()
        const diff = today.getDate() - day + (day === 0 ? -6 : 1)
        return new Date(today.setDate(diff)).toISOString().split('T')[0]
    }

    useEffect(() => {
        loadData()
        loadStaff()
    }, [])

    useEffect(() => {
        const handleRefresh = () => {
            console.log('Refresh cleaning data triggered')
            loadData()
            loadStaff()
        }
        window.addEventListener('refresh-cleaning', handleRefresh)
        return () => window.removeEventListener('refresh-cleaning', handleRefresh)
    }, [])

    const loadData = async () => {
        if (isLoadingData) {
            console.log('loadData already running, skipping')
            return
        }
        setIsLoadingData(true)
        try {
            const weekStart = getWeekStart()
            const [checkout, stayover, checkouts, statsData] = await Promise.all([
                getCheckoutCleaning(),
                getStayOverCleaning(),
                getCheckoutCounts(weekStart),
                getCleaningStats()
            ])
            
            // Group by room_id and keep the most recent request
            const groupedByRoom = new Map()
            if (stayover && Array.isArray(stayover)) {
                stayover.forEach((req: CleaningRequest) => {
                    const existing = groupedByRoom.get(req.room_id)
                    if (!existing || new Date(req.requested_at) > new Date(existing.requested_at)) {
                        groupedByRoom.set(req.room_id, req)
                    }
                })
            }
            const uniqueStayover = Array.from(groupedByRoom.values())
            
            setCheckoutRequests(Array.isArray(checkout) ? checkout : [])
            setStayoverRequests(uniqueStayover)
            setCheckoutCounts(Array.isArray(checkouts) ? checkouts : [])
            setStats(statsData || { pending: 0, assigned: 0, in_progress: 0, completed_today: 0 })
        } catch (error) {
            console.error('Failed to load cleaning data:', error)
            toast.error('Failed to load cleaning data')
        } finally {
            setIsLoadingData(false)
            setLoading(false)
        }
    }

    const loadStaff = async () => {
        try {
            // Use getHousekeepingStaff instead of getScheduleStaff
            const staffData = await getHousekeepingStaff()
            setHousekeepingStaff(staffData || [])
        } catch (error) {
            console.error('Failed to load staff', error)
            toast.error('Failed to load housekeeping staff')
        }
    }

    const handleAssign = async () => {
        if (!selectedRequest || !selectedStaffId) {
            toast.error('Please select a staff member')
            return
        }
        setAssigning(true)
        try {
            await assignCleaning(selectedRequest.id, selectedStaffId, selectedSubRole || undefined)
            const assignedStaff = housekeepingStaff.find(s => s.id === selectedStaffId)
            toast.success(`Cleaning assigned to ${assignedStaff?.name}`)
            setShowAssignModal(false)
            setSelectedRequest(null)
            setSelectedStaffId('')
            setSelectedSubRole('')
            loadData()
        } catch (error) {
            console.error('Assign error:', error)
            toast.error('Failed to assign')
        } finally {
            setAssigning(false)
        }
    }

    const handleComplete = async (requestId: string) => {
        try {
            await completeCleaning(requestId)
            toast.success('Cleaning completed')
            loadData()
        } catch (error) {
            console.error('Complete error:', error)
            toast.error('Failed to complete')
        }
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent': return 'bg-red-100 text-red-800'
            case 'high': return 'bg-orange-100 text-orange-800'
            default: return 'bg-blue-100 text-blue-800'
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800'
            case 'assigned': return 'bg-purple-100 text-purple-800'
            case 'in_progress': return 'bg-blue-100 text-blue-800'
            case 'completed': return 'bg-green-100 text-green-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    const renderTable = (requests: CleaningRequest[], title: string) => (
        <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
            <div className="px-6 py-4 border-b bg-gray-50">
                <h3 className="font-semibold text-gray-800">{title}</h3>
                {requests.length > 0 && (
                    <span className="ml-2 text-sm text-gray-500">({requests.length} rooms)</span>
                )}
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Room</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Guest</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Check Out</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Priority</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Assigned To</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {requests.map((req, index) => (
                            <tr key={req.id || `${req.room_id}-${index}`} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="font-medium text-gray-900">Room {req.room_number}</div>
                                    <div className="text-xs text-gray-500">Floor {req.floor} • {req.room_type}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {req.guest_name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {new Date(req.check_out_date).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(req.priority)}`}>
                                        {req.priority}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(req.cleaning_status)}`}>
                                        {req.cleaning_status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {req.assigned_to_name ? (
                                        <div>
                                            <div className="text-sm font-medium text-gray-800">{req.assigned_to_name}</div>
                                            <div className="text-xs text-gray-500">{req.assigned_to_role}</div>
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 text-sm">—</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap space-x-2">
                                    {req.cleaning_status === 'pending' && (
                                        <button
                                            onClick={() => {
                                                setSelectedRequest(req)
                                                setShowAssignModal(true)
                                            }}
                                            className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700 transition"
                                        >
                                            Assign
                                        </button>
                                    )}
                                    {(req.cleaning_status === 'assigned' || req.cleaning_status === 'in_progress') && (
                                        <button
                                            onClick={() => handleComplete(req.id)}
                                            className="bg-green-600 text-white px-3 py-1 rounded-md text-sm hover:bg-green-700 transition"
                                        >
                                            Complete
                                        </button>
                                    )}
                                    {req.cleaning_status === 'completed' && (
                                        <span className="text-green-600 text-sm font-medium">✓ Done</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {requests.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        No {title.toLowerCase()} requests
                    </div>
                )}
            </div>
        </div>
    )

    if (loading) {
        return <div className="text-center py-12">Loading cleaning dashboard...</div>
    }

    const sortedCheckouts = [...checkoutCounts].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    
    const today = new Date().toISOString().split('T')[0]
    const todayIndex = sortedCheckouts.findIndex(d => d.date >= today)
    const decayFactor = 0.7

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">🧹 Cleaning Management</h2>
                    <p className="text-sm text-gray-500">Manage checkout cleaning and stay-over service requests</p>
                </div>
                <button
                    onClick={() => {
                        console.log('Manual refresh clicked')
                        loadData()
                        loadStaff()
                        toast.success('Refreshing data...')
                    }}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                    🔄 Refresh
                </button>
            </div>

            {/* Debug: Show current stayover requests */}
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-300 text-sm">
                <strong>🔍 Debug Info:</strong><br />
                Stayover requests in state: {stayoverRequests.length}<br />
                {stayoverRequests.slice(0, 5).map((req, i) => (
                    <div key={req.room_id} className="ml-2">
                        • Room {req.room_number} - Status: {req.cleaning_status} - Assigned to: {req.assigned_to_name || 'None'}
                    </div>
                ))}
                {stayoverRequests.length === 0 && <div className="ml-2">No stayover requests in state</div>}
            </div>

            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                    <div className="text-sm text-gray-500">Pending</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">{stats.assigned}</div>
                    <div className="text-sm text-gray-500">Assigned</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.in_progress}</div>
                    <div className="text-sm text-gray-500">In Progress</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.completed_today}</div>
                    <div className="text-sm text-gray-500">Completed Today</div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold text-gray-800 mb-3">📊 Checkouts This Week</h3>
                <div className="flex items-end gap-2">
                    {sortedCheckouts.map((day, idx) => {
                        let sizePercent = 100
                        if (todayIndex !== -1 && idx >= todayIndex) {
                            const daysFromToday = idx - todayIndex
                            sizePercent = Math.max(30, 100 * Math.pow(decayFactor, daysFromToday))
                        } else if (idx < todayIndex) {
                            sizePercent = 50
                        }
                        const height = Math.max(35, Math.min(120, 35 + (sizePercent * 0.85)))
                        return (
                            <div key={day.date} className="flex-1 flex flex-col items-center">
                                <div className="text-center w-full">
                                    <div 
                                        className={`rounded-t-lg transition-all duration-300 cursor-pointer ${idx === todayIndex ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                                        style={{ height: `${height}px`, minHeight: '35px', maxHeight: '120px' }}
                                    >
                                        <div className="flex items-center justify-center h-full">
                                            <span className="text-white font-bold text-sm sm:text-base">{day.count}</span>
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <div className="text-xs font-medium text-gray-700">
                                            {idx === todayIndex ? '🔴 TODAY' : new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}
                                        </div>
                                        <div className="text-xs text-gray-400">{day.count} {day.count === 1 ? 'checkout' : 'checkouts'}</div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="space-y-4">
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-4">
                        <button
                            onClick={() => setActiveSection('checkout')}
                            className={`py-2 px-4 text-sm font-medium rounded-t-lg transition ${activeSection === 'checkout' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            🚪 Checkout Cleaning ({checkoutRequests.length})
                        </button>
                        <button
                            onClick={() => setActiveSection('stayover')}
                            className={`py-2 px-4 text-sm font-medium rounded-t-lg transition ${activeSection === 'stayover' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            🛏️ Stay-Over Cleaning ({stayoverRequests.length})
                        </button>
                    </nav>
                </div>

                {activeSection === 'checkout' && renderTable(checkoutRequests, 'Checkout Cleaning')}
                {activeSection === 'stayover' && renderTable(stayoverRequests, 'Stay-Over Cleaning')}
            </div>

            {showAssignModal && selectedRequest && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                            <h3 className="text-xl font-semibold text-white">Assign Cleaning</h3>
                            <p className="text-blue-100 text-sm">Room {selectedRequest.room_number} - {selectedRequest.guest_name}</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Select Cleaner</label>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {housekeepingStaff.map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => setSelectedStaffId(s.id)}
                                            className={`w-full text-left p-3 rounded-lg border transition ${selectedStaffId === s.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:bg-gray-50'}`}
                                        >
                                            <div className="font-medium text-gray-800">{s.name}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">
                                                {s.sub_role ? `${subRoleLabels[s.sub_role]?.icon} ${subRoleLabels[s.sub_role]?.label}` : s.role}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Team (Optional)</label>
                                <select
                                    value={selectedSubRole}
                                    onChange={(e) => setSelectedSubRole(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                                >
                                    <option value="">Select team...</option>
                                    <option value="room_cleaning">🛏️ Room Cleaning</option>
                                    <option value="hallway">🚪 Hallway</option>
                                    <option value="laundry">🧺 Laundry</option>
                                    <option value="general">🧹 General</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => {
                                        setShowAssignModal(false)
                                        setSelectedRequest(null)
                                        setSelectedStaffId('')
                                    }}
                                    className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAssign}
                                    disabled={!selectedStaffId || assigning}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                                >
                                    {assigning ? 'Assigning...' : 'Assign Cleaning'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}