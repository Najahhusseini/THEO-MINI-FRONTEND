'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { 
    clockIn, 
    clockOut, 
    getAttendanceStatus, 
    getTodayAttendance, 
    getWeeklyHours, 
    getShiftHistory, 
    requestTimeOff 
} from '@/lib/api'
import toast from 'react-hot-toast'

interface AttendanceRecord {
    id: string
    clock_in: string
    clock_out: string | null
    duration_minutes: number | null
    location?: string
    device_info?: string
}

interface WeeklySummary {
    total_hours: number
    total_minutes: number
    days_worked: number
    average_hours: number
}

interface ShiftHistoryItem {
    id: string
    clockIn: string
    clockOut: string | null
    hoursWorked: number
    overtimeHours: number
    shiftType: string
    location: string
}

export default function ShiftTracker() {
    const { staff } = useAuth()
    const [currentStatus, setCurrentStatus] = useState<{ isClockedIn: boolean; clockInTime?: string }>({ isClockedIn: false })
    const [todayShifts, setTodayShifts] = useState<AttendanceRecord[]>([])
    const [weeklySummary, setWeeklySummary] = useState<WeeklySummary>({ total_hours: 0, total_minutes: 0, days_worked: 0, average_hours: 0 })
    const [shiftHistory, setShiftHistory] = useState<ShiftHistoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [showHistory, setShowHistory] = useState(false)
    const [showTimeOffModal, setShowTimeOffModal] = useState(false)
    const [timeOffDates, setTimeOffDates] = useState({ start: '', end: '' })
    const [timeOffReason, setTimeOffReason] = useState('')
    const [manualRefresh, setManualRefresh] = useState(0)

    const formatDuration = (minutes: number) => {
        const hrs = Math.floor(minutes / 60)
        const mins = minutes % 60
        if (hrs === 0) return `${mins} min`
        if (mins === 0) return `${hrs} hr`
        return `${hrs} hr ${mins} min`
    }

    const loadData = useCallback(async () => {
        if (!staff) return
        try {
            const [status, today, weekly, history] = await Promise.all([
                getAttendanceStatus(),
                getTodayAttendance(),
                getWeeklyHours(),
                getShiftHistory(30)
            ])

            setCurrentStatus({ isClockedIn: status.isClockedIn, clockInTime: status.clockInTime })
            setTodayShifts(today || [])

            // Convert weekly total hours to hours+minutes
            const totalMinutes = Math.round(weekly.total_hours * 60)
            const hours = Math.floor(totalMinutes / 60)
            const minutes = totalMinutes % 60
            setWeeklySummary({
                total_hours: hours,
                total_minutes: minutes,
                days_worked: weekly.days_worked || 0,
                average_hours: weekly.average_hours || 0
            })

            // Format shift history (keep original structure for compatibility)
            setShiftHistory(history || [])
        } catch (error) {
            console.error('Failed to load shift data:', error)
            toast.error('Failed to load shift data')
        } finally {
            setLoading(false)
        }
    }, [staff])

    useEffect(() => {
        loadData()
        // Poll every 30 seconds (reduced from 10s)
        const interval = setInterval(loadData, 30000)
        
        const handleRefresh = () => {
            console.log('🔄 Shift tracker refresh triggered')
            loadData()
        }
        window.addEventListener('refresh-attendance', handleRefresh)
        
        return () => {
            clearInterval(interval)
            window.removeEventListener('refresh-attendance', handleRefresh)
        }
    }, [loadData])

    const handleClockIn = async () => {
        try {
            await clockIn()
            toast.success('Clocked in successfully')
            loadData()
            window.dispatchEvent(new CustomEvent('refresh-attendance'))
        } catch (error: any) {
            const errorMsg = error.response?.data?.error || error.message || 'Failed to clock in'
            toast.error(errorMsg)
        }
    }

    const handleClockOut = async () => {
        try {
            await clockOut()
            toast.success('Clocked out successfully')
            loadData()
            window.dispatchEvent(new CustomEvent('refresh-attendance'))
        } catch (error: any) {
            const errorMsg = error.response?.data?.error || error.message || 'Failed to clock out'
            toast.error(errorMsg)
        }
    }

    const handleManualRefresh = () => {
        setManualRefresh(prev => prev + 1)
        loadData()
        toast.success('Data refreshed')
    }

    const handleTimeOffRequest = async () => {
        if (!timeOffDates.start || !timeOffDates.end) {
            toast.error('Please select start and end dates')
            return
        }
        try {
            await requestTimeOff(timeOffDates.start, timeOffDates.end, timeOffReason)
            toast.success('Time off request submitted')
            setShowTimeOffModal(false)
            setTimeOffDates({ start: '', end: '' })
            setTimeOffReason('')
        } catch (error: any) {
            const errorMsg = error.response?.data?.error || error.message || 'Failed to submit request'
            toast.error(errorMsg)
        }
    }

    const calculateTodayTotal = () => {
        let totalMinutes = 0
        todayShifts.forEach(shift => {
            if (shift.duration_minutes) totalMinutes += shift.duration_minutes
        })
        if (currentStatus.isClockedIn && currentStatus.clockInTime) {
            const clockInTime = new Date(currentStatus.clockInTime)
            const now = new Date()
            const minutesSinceClockIn = Math.floor((now.getTime() - clockInTime.getTime()) / 60000)
            totalMinutes += minutesSinceClockIn
        }
        return formatDuration(totalMinutes)
    }

    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString()
    const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-20 bg-gray-200 rounded"></div>
                    <div className="h-40 bg-gray-200 rounded"></div>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                {/* Header with manual refresh */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Shift Tracker</h3>
                        <p className="text-sm text-purple-100 mt-1">Track your hours and overtime</p>
                    </div>
                    <button
                        onClick={handleManualRefresh}
                        className="px-3 py-1 bg-white/20 text-white rounded-md hover:bg-white/30 transition text-sm"
                    >
                        🔄 Refresh
                    </button>
                </div>

                {/* Current status card */}
                <div className={`p-6 border-b ${currentStatus.isClockedIn ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div>
                            <div className="text-sm text-gray-500">Current Status</div>
                            <div className="text-2xl font-bold mt-1">
                                {currentStatus.isClockedIn ? '✅ Clocked In' : '⭕ Clocked Out'}
                            </div>
                            {currentStatus.isClockedIn && currentStatus.clockInTime && (
                                <div className="text-sm text-gray-600 mt-1">
                                    Since: {new Date(currentStatus.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            )}
                        </div>
                        <div className="text-center">
                            <div className="text-sm text-gray-500">Today's Total</div>
                            <div className="text-3xl font-bold text-blue-600">{calculateTodayTotal()}</div>
                        </div>
                        <button
                            onClick={currentStatus.isClockedIn ? handleClockOut : handleClockIn}
                            className={`px-6 py-3 rounded-lg font-semibold transition ${
                                currentStatus.isClockedIn
                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                    : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                        >
                            {currentStatus.isClockedIn ? 'Clock Out' : 'Clock In'}
                        </button>
                    </div>
                </div>

                {/* Today's shifts (detailed) */}
                <div className="p-6 border-b">
                    <h4 className="text-sm font-medium text-gray-500 mb-3">Today's Shifts</h4>
                    {todayShifts.length === 0 && !currentStatus.isClockedIn ? (
                        <p className="text-gray-500 text-sm">No shifts today</p>
                    ) : (
                        <div className="space-y-2">
                            {todayShifts.map(shift => (
                                <div key={shift.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <div>
                                        <div className="font-medium">
                                            {formatTime(shift.clock_in)} 
                                            {shift.clock_out && ` → ${formatTime(shift.clock_out)}`}
                                        </div>
                                        {shift.location && <div className="text-xs text-gray-500">📍 {shift.location}</div>}
                                    </div>
                                    <div className="font-semibold">
                                        {shift.duration_minutes ? formatDuration(shift.duration_minutes) : 'In progress'}
                                    </div>
                                </div>
                            ))}
                            {currentStatus.isClockedIn && currentStatus.clockInTime && (
                                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <div>
                                        <div className="font-medium">
                                            {formatTime(currentStatus.clockInTime)} → (Current)
                                        </div>
                                    </div>
                                    <div className="font-semibold text-blue-600">In progress</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Weekly summary with hours+minutes */}
                <div className="p-6 border-b">
                    <h4 className="text-sm font-medium text-gray-500 mb-3">This Week</h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-gray-800">
                                {weeklySummary.total_hours > 0 ? `${weeklySummary.total_hours}h ${weeklySummary.total_minutes}m` : '0h'}
                            </div>
                            <div className="text-xs text-gray-500">Total Worked</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{weeklySummary.days_worked}</div>
                            <div className="text-xs text-gray-500">Days Worked</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">
                                {Math.floor(weeklySummary.average_hours)}h {Math.round((weeklySummary.average_hours % 1) * 60)}m
                            </div>
                            <div className="text-xs text-gray-500">Daily Average</div>
                        </div>
                    </div>
                </div>

                {/* Shift History + Time Off Request */}
                <div className="p-6">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-medium text-gray-500">Recent Shifts</h4>
                        <button
                            onClick={() => setShowTimeOffModal(true)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                        >
                            Request Time Off
                        </button>
                    </div>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                        {shiftHistory.slice(0, 10).map((shift) => (
                            <div key={shift.id} className="bg-gray-50 rounded-lg p-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs text-gray-500">{formatDate(shift.clockIn)}</p>
                                        <p className="text-sm font-medium text-gray-800">
                                            {formatTime(shift.clockIn)} - {shift.clockOut ? formatTime(shift.clockOut) : 'In Progress'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        {shift.hoursWorked > 0 && (
                                            <p className="text-sm font-semibold text-gray-800">
                                                {Math.floor(shift.hoursWorked)}h {Math.round((shift.hoursWorked % 1) * 60)}m
                                            </p>
                                        )}
                                        {shift.overtimeHours > 0 && (
                                            <p className="text-xs text-orange-600">+{Math.floor(shift.overtimeHours)}h {Math.round((shift.overtimeHours % 1) * 60)}m OT</p>
                                        )}
                                    </div>
                                </div>
                                {shift.shiftType === 'late' && (
                                    <p className="text-xs text-red-500 mt-1">⚠️ Late arrival</p>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Toggle full history */}
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                        {showHistory ? '▼ Hide Full History' : '▶ View Full History'}
                    </button>

                    {showHistory && (
                        <div className="mt-4 overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Clock In</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Clock Out</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Duration</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {shiftHistory.length === 0 ? (
                                        <tr><td colSpan={4} className="text-center py-4 text-gray-500">No history available</td></tr>
                                    ) : (
                                        shiftHistory.map((shift, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 text-sm">{formatDate(shift.clockIn)}</td>
                                                <td className="px-4 py-2 text-sm">{formatTime(shift.clockIn)}</td>
                                                <td className="px-4 py-2 text-sm">{shift.clockOut ? formatTime(shift.clockOut) : '—'}</td>
                                                <td className="px-4 py-2 text-sm font-medium">
                                                    {shift.hoursWorked > 0 
                                                        ? `${Math.floor(shift.hoursWorked)}h ${Math.round((shift.hoursWorked % 1) * 60)}m`
                                                        : '—'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Time Off Modal */}
            {showTimeOffModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">Request Time Off</h3>
                            <button
                                onClick={() => setShowTimeOffModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={timeOffDates.start}
                                    onChange={(e) => setTimeOffDates({ ...timeOffDates, start: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                                <input
                                    type="date"
                                    value={timeOffDates.end}
                                    onChange={(e) => setTimeOffDates({ ...timeOffDates, end: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                                <textarea
                                    value={timeOffReason}
                                    onChange={(e) => setTimeOffReason(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Vacation, sick day, personal, etc."
                                />
                            </div>
                            <button
                                onClick={handleTimeOffRequest}
                                className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
                            >
                                Submit Request
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}