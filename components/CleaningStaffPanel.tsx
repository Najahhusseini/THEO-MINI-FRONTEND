'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { 
    getMyCleaningTasks, 
    updateCleaningTaskStatus,
    getTaskMessages,
    sendTaskMessage,
    requestSuppliesForTask,
    updateRoomDoNotDisturb
} from '@/lib/api'
import toast from 'react-hot-toast'

interface CleaningTask {
    request_id: string
    room_id?: string
    room_number: string
    floor: number
    room_type: string
    guest_name: string
    request_status: 'pending' | 'assigned' | 'in_progress' | 'completed'
    priority: string
    notes: string
    requested_at: string
    assigned_at: string
    do_not_disturb?: boolean
}

interface Message {
    id: string
    message: string
    created_at: string
    staff_name: string
    role: string
}

export default function CleaningStaffPanel() {
    const { staff } = useAuth()
    const [tasks, setTasks] = useState<CleaningTask[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedTask, setSelectedTask] = useState<CleaningTask | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [showSupplyModal, setShowSupplyModal] = useState(false)
    const [supplyItem, setSupplyItem] = useState('')
    const [supplyQuantity, setSupplyQuantity] = useState(1)
    const [supplyNotes, setSupplyNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const loadTasks = useCallback(async () => {
        try {
            const data = await getMyCleaningTasks()
            setTasks(data || [])
        } catch (error) {
            console.error('Failed to load tasks:', error)
            toast.error('Failed to load tasks')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadTasks()
        // Poll every 30 seconds (reduced from 10s)
        const interval = setInterval(loadTasks, 30000)
        
        // Listen for refresh events from other components
        const handleRefresh = () => {
            console.log('🔄 Staff panel refresh triggered')
            loadTasks()
        }
        window.addEventListener('refresh-cleaning-board', handleRefresh)
        window.addEventListener('refresh-rooms', handleRefresh)
        
        return () => {
            clearInterval(interval)
            window.removeEventListener('refresh-cleaning-board', handleRefresh)
            window.removeEventListener('refresh-rooms', handleRefresh)
        }
    }, [loadTasks])

    const loadMessages = async (requestId: string) => {
        try {
            const msgs = await getTaskMessages(requestId)
            setMessages(msgs || [])
        } catch (error) {
            console.error('Failed to load messages', error)
        }
    }

    const handleStatusUpdate = async (requestId: string, status: 'accepted' | 'in_progress' | 'completed') => {
        setSubmitting(true)
        try {
            await updateCleaningTaskStatus(requestId, status)
            const statusText = status === 'accepted' ? 'accepted' : status === 'in_progress' ? 'started' : 'completed'
            toast.success(`Task ${statusText}`)
            loadTasks()
            if (status === 'completed' && selectedTask?.request_id === requestId) {
                setSelectedTask(null)
            }
        } catch (error) {
            toast.error('Failed to update status')
        } finally {
            setSubmitting(false)
        }
    }

    const handleSendMessage = async () => {
        if (!selectedTask || !newMessage.trim()) return
        setSubmitting(true)
        try {
            await sendTaskMessage(selectedTask.request_id, newMessage)
            setNewMessage('')
            await loadMessages(selectedTask.request_id)
            toast.success('Message sent')
        } catch (error) {
            toast.error('Failed to send message')
        } finally {
            setSubmitting(false)
        }
    }

    const handleSupplyRequest = async () => {
        if (!selectedTask || !supplyItem) return
        setSubmitting(true)
        try {
            await requestSuppliesForTask(selectedTask.request_id, supplyItem, supplyQuantity, supplyNotes)
            toast.success('Supply request sent to Head of Housekeeping')
            setShowSupplyModal(false)
            setSupplyItem('')
            setSupplyQuantity(1)
            setSupplyNotes('')
        } catch (error) {
            toast.error('Failed to request supplies')
        } finally {
            setSubmitting(false)
        }
    }

    const handleToggleDND = async (roomId: string, doNotDisturb: boolean) => {
        setSubmitting(true)
        try {
            await updateRoomDoNotDisturb(roomId, doNotDisturb)
            toast.success(doNotDisturb ? '🚫 DND activated. Room will not be cleaned.' : '🔔 DND removed. Room can be cleaned.')
            loadTasks()
            // Also refresh the rooms tab / cleaning board
            window.dispatchEvent(new CustomEvent('refresh-rooms'))
            window.dispatchEvent(new CustomEvent('refresh-cleaning-board'))
        } catch (error) {
            toast.error('Failed to update DND status')
        } finally {
            setSubmitting(false)
        }
    }

    const getPriorityBadge = (priority: string) => {
        switch(priority) {
            case 'urgent': return 'bg-red-100 text-red-800'
            case 'high': return 'bg-orange-100 text-orange-800'
            default: return 'bg-gray-100 text-gray-800'
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

    if (loading) {
        return <div className="text-center py-12">Loading your tasks...</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">🧹 My Cleaning Tasks</h2>
                    <p className="text-sm text-gray-500">Accept, start, and complete your assigned rooms</p>
                </div>
                <button 
                    onClick={loadTasks} 
                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition"
                >
                    🔄 Refresh
                </button>
            </div>

            {tasks.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border">
                    <p className="text-gray-500">No assigned tasks at the moment</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {tasks.map(task => (
                        <div
                            key={task.request_id}
                            className={`bg-white rounded-lg shadow p-4 border cursor-pointer transition hover:shadow-md ${
                                selectedTask?.request_id === task.request_id ? 'ring-2 ring-blue-500' : ''
                            } ${task.do_not_disturb ? 'bg-red-50 border-red-300' : ''}`}
                            onClick={() => {
                                setSelectedTask(task)
                                loadMessages(task.request_id)
                            }}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold">
                                        Room {task.room_number}
                                        {task.do_not_disturb && (
                                            <span className="ml-2 text-red-600 text-sm">🚫 DND</span>
                                        )}
                                    </h3>
                                    <p className="text-sm text-gray-600">{task.room_type} • Floor {task.floor}</p>
                                    <p className="text-sm mt-1">Guest: {task.guest_name}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityBadge(task.priority)}`}>
                                        {task.priority.toUpperCase()}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(task.request_status)}`}>
                                        {task.request_status.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                            {task.notes && (
                                <p className="text-sm text-gray-500 mt-2">📝 {task.notes}</p>
                            )}
                            <div className="flex gap-2 mt-3">
                                {!task.do_not_disturb ? (
                                    <>
                                        {task.request_status === 'pending' && (
                                            <button
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    handleStatusUpdate(task.request_id, 'accepted');
                                                }}
                                                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition"
                                                disabled={submitting}
                                            >
                                                Accept
                                            </button>
                                        )}
                                        {task.request_status === 'assigned' && (
                                            <button
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    handleStatusUpdate(task.request_id, 'in_progress');
                                                }}
                                                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition"
                                                disabled={submitting}
                                            >
                                                Start Cleaning
                                            </button>
                                        )}
                                        {task.request_status === 'in_progress' && (
                                            <button
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    handleStatusUpdate(task.request_id, 'completed');
                                                }}
                                                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition"
                                                disabled={submitting}
                                            >
                                                Complete
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                handleToggleDND(task.room_id || task.request_id, true);
                                            }}
                                            className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600 transition"
                                            disabled={submitting}
                                        >
                                            🚫 DND
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            handleToggleDND(task.room_id || task.request_id, false);
                                        }}
                                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition"
                                        disabled={submitting}
                                    >
                                        🔔 Remove DND
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Task Detail Modal with Chat & Supplies */}
            {selectedTask && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center rounded-t-xl">
                            <div>
                                <h3 className="text-xl font-semibold text-white">Room {selectedTask.room_number}</h3>
                                <p className="text-blue-100 text-sm">{selectedTask.room_type} • Floor {selectedTask.floor}</p>
                                {selectedTask.do_not_disturb && (
                                    <p className="text-yellow-200 text-sm mt-1">🚫 Do Not Disturb is active</p>
                                )}
                            </div>
                            <button 
                                onClick={() => setSelectedTask(null)} 
                                className="text-white text-2xl hover:text-gray-200 transition"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Task info */}
                            <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                                <p><span className="font-medium">Guest:</span> {selectedTask.guest_name}</p>
                                <p>
                                    <span className="font-medium">Priority:</span> 
                                    <span className={`ml-2 inline-block px-2 py-0.5 rounded-full text-xs ${getPriorityBadge(selectedTask.priority)}`}>
                                        {selectedTask.priority.toUpperCase()}
                                    </span>
                                </p>
                                <p>
                                    <span className="font-medium">Status:</span> 
                                    <span className={`ml-2 inline-block px-2 py-0.5 rounded-full text-xs ${getStatusBadge(selectedTask.request_status)}`}>
                                        {selectedTask.request_status.replace('_', ' ')}
                                    </span>
                                </p>
                                {selectedTask.notes && (
                                    <p><span className="font-medium">Instructions:</span> {selectedTask.notes}</p>
                                )}
                                {selectedTask.assigned_at && (
                                    <p><span className="font-medium">Assigned:</span> {new Date(selectedTask.assigned_at).toLocaleString()}</p>
                                )}
                            </div>

                            {/* Chat section */}
                            <div>
                                <h4 className="font-semibold text-gray-800 mb-2">💬 Communication with Head of Housekeeping</h4>
                                <div className="bg-gray-50 rounded-lg p-3 h-64 overflow-y-auto space-y-2">
                                    {messages.length === 0 ? (
                                        <p className="text-center text-gray-400 text-sm">No messages yet</p>
                                    ) : (
                                        messages.map(msg => (
                                            <div key={msg.id} className={`flex ${msg.role === 'head_housekeeping' ? 'justify-start' : 'justify-end'}`}>
                                                <div className={`max-w-[70%] rounded-lg p-2 ${
                                                    msg.role === 'head_housekeeping' 
                                                        ? 'bg-white border border-gray-200' 
                                                        : 'bg-blue-600 text-white'
                                                }`}>
                                                    <div className="text-xs opacity-70">
                                                        {msg.staff_name} • {new Date(msg.created_at).toLocaleTimeString()}
                                                    </div>
                                                    <div className="text-sm">{msg.message}</div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Type a message to Head of Housekeeping..."
                                        className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                        disabled={submitting}
                                    />
                                    <button 
                                        onClick={handleSendMessage} 
                                        disabled={submitting || !newMessage.trim()}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition"
                                    >
                                        Send
                                    </button>
                                </div>
                            </div>

                            {/* Supply request button - disabled if DND */}
                            <button
                                onClick={() => setShowSupplyModal(true)}
                                disabled={selectedTask.do_not_disturb}
                                className={`w-full py-2 rounded-lg transition font-medium ${
                                    selectedTask.do_not_disturb 
                                        ? 'bg-gray-300 cursor-not-allowed' 
                                        : 'bg-yellow-600 text-white hover:bg-yellow-700'
                                }`}
                            >
                                📦 Request Supplies
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Supply Request Modal */}
            {showSupplyModal && selectedTask && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
                        <div className="bg-yellow-600 px-6 py-4 rounded-t-xl">
                            <h3 className="text-xl font-semibold text-white">Request Supplies</h3>
                            <p className="text-yellow-100">Room {selectedTask.room_number}</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                                <input
                                    type="text"
                                    value={supplyItem}
                                    onChange={(e) => setSupplyItem(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
                                    placeholder="e.g., Towels, Soap, Trash bags"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                                <input
                                    type="number"
                                    value={supplyQuantity}
                                    onChange={(e) => setSupplyQuantity(parseInt(e.target.value) || 1)}
                                    min="1"
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                                <textarea
                                    value={supplyNotes}
                                    onChange={(e) => setSupplyNotes(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    placeholder="Any additional details..."
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button 
                                    onClick={() => setShowSupplyModal(false)} 
                                    className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleSupplyRequest} 
                                    disabled={!supplyItem || submitting}
                                    className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition"
                                >
                                    Request
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}