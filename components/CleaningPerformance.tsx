'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getRoomsWithCleaning } from '@/lib/api'
import toast from 'react-hot-toast'

interface CompletedTask {
    id: string
    room_number: string
    staff_name: string
    started_at: string
    completed_at: string
    duration_seconds: number
    request_type: string
}

export default function CleaningPerformance() {
    const { staff } = useAuth()
    const [tasks, setTasks] = useState<CompletedTask[]>([])
    const [loading, setLoading] = useState(true)
    const [filterStaff, setFilterStaff] = useState<string>('all')
    const [staffList, setStaffList] = useState<string[]>([])

    const loadData = async () => {
        try {
            const token = localStorage.getItem('accessToken')
            const response = await fetch('http://localhost:4000/api/cleaning/completed-tasks', {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (response.ok) {
                const data = await response.json()
                setTasks(data)
                const uniqueStaff = [...new Set(data.map((t: any) => t.staff_name))] as string[]
                setStaffList(uniqueStaff)
            } else {
                toast.error('Failed to load performance data')
            }
        } catch (error) {
            console.error(error)
            toast.error('Failed to load performance data')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (staff?.role === 'head_housekeeping') {
            loadData()
            const interval = setInterval(loadData, 60000)
            return () => clearInterval(interval)
        }
    }, [staff])

    const filteredTasks = filterStaff === 'all' ? tasks : tasks.filter(t => t.staff_name === filterStaff)

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins} min ${secs} sec`
    }

    if (loading) return <div className="text-center py-12">Loading performance data...</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">⏱️ Cleaning Performance</h2>
                    <p className="text-sm text-gray-500">Track cleaning times per staff member and room</p>
                </div>
                <button onClick={loadData} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">🔄 Refresh</button>
            </div>

            <div className="flex gap-2 items-center">
                <span className="text-sm text-gray-600">Filter by staff:</span>
                <select
                    value={filterStaff}
                    onChange={(e) => setFilterStaff(e.target.value)}
                    className="px-3 py-1 border rounded text-sm"
                >
                    <option value="all">All Staff</option>
                    {staffList.map(name => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Room</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Staff</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Started</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Duration</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredTasks.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-8 text-gray-500">No completed cleaning tasks yet</td></tr>
                            ) : (
                                filteredTasks.map(task => (
                                    <tr key={task.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">Room {task.room_number}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{task.staff_name}</td>
                                        <td className="px-6 py-4 capitalize">{task.request_type === 'stay_over' ? 'Stay‑Over' : 'Checkout'}</td>
                                        <td className="px-6 py-4 text-sm">{new Date(task.started_at).toLocaleString()}</td>
                                        <td className="px-6 py-4 font-mono">{formatDuration(task.duration_seconds)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}