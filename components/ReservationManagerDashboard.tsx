'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { 
    createReservation, 
    getReservations, 
    updateReservation, 
    confirmReservation, 
    cancelReservation,
    checkConflicts,
    CreateReservationData
} from '@/lib/api'
import api from '@/lib/api'                       // Axios instance
import toast from 'react-hot-toast'
import { format, isWithinInterval, parseISO } from 'date-fns'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import ReservationTapeChart from '@/components/ReservationTapeChart'
import EmailIngestionTab from '@/components/EmailIngestionTab'
import AdminRoomsOverview from '@/components/AdminRoomsOverview'
import TodayArrivals from '@/components/TodayArrivals'
import NotificationBell from '@/components/NotificationBell'

type ViewMode = 'table' | 'threePane' | 'tape' | 'email' | 'roomsOverview' | 'todaysArrivals'
type SortField = 'guest_name' | 'arrival_date' | 'departure_date' | 'room_type' | 'status' | 'number_of_guests' | 'number_of_rooms'
type SortOrder = 'asc' | 'desc'

interface Reservation {
    id: string
    guest_name: string
    guest_email: string
    guest_phone: string
    source: string
    status: string
    arrival_date: string
    departure_date: string
    room_type: string
    number_of_guests: number
    number_of_rooms: number
    special_requests: string
    confirmed_at: string
    created_at: string
}

interface Props {
    standalone?: boolean
}

export default function ReservationManagerDashboard({ standalone = true }: Props) {
    const { staff, logout } = useAuth()
    const [reservations, setReservations] = useState<Reservation[]>([])
    const [loading, setLoading] = useState(true)
    const [viewMode, setViewMode] = useState<ViewMode>('threePane')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [sortField, setSortField] = useState<SortField>('arrival_date')
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
    const [currentPage, setCurrentPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(50)

    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [formData, setFormData] = useState<CreateReservationData>({
        guest_name: '',
        guest_email: '',
        guest_phone: '',
        arrival_date: '',
        departure_date: '',
        room_type: 'Standard',
        number_of_guests: 1,
        number_of_rooms: 1,
        special_requests: ''
    })
    const [confirmNow, setConfirmNow] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Room assignment modal state
    const [showAssignRoomModal, setShowAssignRoomModal] = useState(false)
    const [availableRooms, setAvailableRooms] = useState<any[]>([])
    const [selectedRoomNumber, setSelectedRoomNumber] = useState('')

    // Room filters for assign modal
    const [filterRoomType, setFilterRoomType] = useState('')
    const [filterFloor, setFilterFloor] = useState('')

    // Use Axios instead of bare fetch
    const fetchAvailableRooms = async (arrival: string, departure: string) => {
        try {
            const res = await api.get('/rooms/available', {
                params: { arrival, departure }
            })
            setAvailableRooms(res.data)
            // Reset filters
            setFilterRoomType('')
            setFilterFloor('')
            setSelectedRoomNumber('')
        } catch (err) {
            toast.error('Failed to load available rooms')
        }
    }

    const loadReservations = useCallback(async () => {
        try {
            const filters: any = {}
            if (statusFilter !== 'all') filters.status = statusFilter
            const data = await getReservations(filters)
            setReservations(data)
            setCurrentPage(1)
        } catch (error) {
            toast.error('Failed to load reservations')
        } finally {
            setLoading(false)
        }
    }, [statusFilter])

    useEffect(() => {
        loadReservations()
        const handleRefresh = () => loadReservations()
        window.addEventListener('reservation-updated', handleRefresh)
        window.addEventListener('reservation-confirmed', handleRefresh)
        window.addEventListener('reservation-cancelled', handleRefresh)
        return () => {
            window.removeEventListener('reservation-updated', handleRefresh)
            window.removeEventListener('reservation-confirmed', handleRefresh)
            window.removeEventListener('reservation-cancelled', handleRefresh)
        }
    }, [loadReservations])

    const filteredReservations = useMemo(() => {
        let filtered = [...reservations]
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase()
            filtered = filtered.filter(r => r.guest_name.toLowerCase().includes(term))
        }
        filtered.sort((a, b) => {
            let aVal: any = a[sortField]
            let bVal: any = b[sortField]
            if (sortField === 'arrival_date' || sortField === 'departure_date') {
                aVal = new Date(aVal).getTime()
                bVal = new Date(bVal).getTime()
            }
            if (typeof aVal === 'string') aVal = aVal.toLowerCase()
            if (typeof bVal === 'string') bVal = bVal.toLowerCase()
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
            return 0
        })
        return filtered
    }, [reservations, searchTerm, sortField, sortOrder])

    const paginatedReservations = filteredReservations.slice((currentPage-1)*rowsPerPage, currentPage*rowsPerPage)
    const totalPages = Math.ceil(filteredReservations.length / rowsPerPage)

    // Three‑pane: reservations for selected date, sorted by status
    const reservationsForDate = useMemo(() => {
        const covering = reservations.filter(r => {
            const arrival = new Date(r.arrival_date)
            const departure = new Date(r.departure_date)
            return isWithinInterval(selectedDate, { start: arrival, end: departure })
        })
        const statusOrder: Record<string, number> = { 'confirmed': 1, 'pending_review': 2, 'cancelled': 3 }
        return covering.sort((a, b) => {
            const orderA = statusOrder[a.status] ?? 99
            const orderB = statusOrder[b.status] ?? 99
            if (orderA !== orderB) return orderA - orderB
            return a.guest_name.localeCompare(b.guest_name)
        })
    }, [reservations, selectedDate])

    // Handlers
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const checkConflictsWrapper = async (): Promise<boolean> => {
        try {
            const result = await checkConflicts({
                arrival_date: formData.arrival_date,
                departure_date: formData.departure_date,
                room_type: formData.room_type,
                exclude_id: selectedReservation?.id
            })
            if (result.hasConflict) toast.error('⚠️ Conflict detected! This room type is already booked for these dates.')
            return result.hasConflict
        } catch { return false }
    }

    const submitReservation = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.guest_name || !formData.arrival_date || !formData.departure_date) {
            toast.error('Please fill in all required fields')
            return
        }
        if (await checkConflictsWrapper()) return
        setSubmitting(true)
        try {
            const dataToSend = { ...formData, status: confirmNow ? 'confirmed' : 'pending_review' }
            if (selectedReservation) {
                await updateReservation(selectedReservation.id, dataToSend)
                toast.success('Reservation updated')
            } else {
                await createReservation(dataToSend)
                toast.success(confirmNow ? 'Reservation confirmed immediately!' : 'Reservation created (pending review)')
            }
            setShowForm(false)
            setSelectedReservation(null)
            setFormData({
                guest_name: '', guest_email: '', guest_phone: '', arrival_date: '', departure_date: '',
                room_type: 'Standard', number_of_guests: 1, number_of_rooms: 1, special_requests: ''
            })
            setConfirmNow(false)
            loadReservations()
            // Dispatch so Today's Arrivals can refresh
            window.dispatchEvent(new CustomEvent('reservation-confirmed'))
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to save')
        } finally {
            setSubmitting(false)
        }
    }

    const handleConfirm = async (id: string) => {
        if (!confirm('Confirm this reservation? It will create a Stay record.')) return
        try {
            await confirmReservation(id)
            toast.success('Reservation confirmed!')
            loadReservations()
            // Dispatch event for Today's Arrivals refresh
            window.dispatchEvent(new CustomEvent('reservation-confirmed'))
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to confirm')
        }
    }

    const handleCancel = async (id: string) => {
        if (!confirm('Cancel this reservation?')) return
        try {
            await cancelReservation(id)
            toast.success('Reservation cancelled')
            loadReservations()
            window.dispatchEvent(new CustomEvent('reservation-cancelled'))
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to cancel')
        }
    }

    const handleEdit = (res: Reservation) => {
        setSelectedReservation(res)
        setFormData({
            guest_name: res.guest_name,
            guest_email: res.guest_email || '',
            guest_phone: res.guest_phone || '',
            arrival_date: res.arrival_date.split('T')[0],
            departure_date: res.departure_date.split('T')[0],
            room_type: res.room_type,
            number_of_guests: res.number_of_guests,
            number_of_rooms: res.number_of_rooms,
            special_requests: res.special_requests || ''
        })
        setConfirmNow(false)
        setShowForm(true)
    }

    const getStatusBadge = (status: string) => {
        switch(status) {
            case 'pending_review': return 'bg-yellow-100 text-yellow-800'
            case 'confirmed': return 'bg-green-100 text-green-800'
            case 'cancelled': return 'bg-red-100 text-red-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    const sendPreArrivalEmails = async () => {
        try {
            const res = await fetch('/api/reservations/send-prearrival-emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ daysAhead: 3 }),
            })
            const data = await res.json()
            toast.success(`Sent ${data.count} pre‑arrival email(s)`)
        } catch (err) {
            toast.error('Failed to send pre‑arrival emails')
        }
    }

    if (loading) return <div className="flex justify-center items-center h-64">Loading reservation dashboard...</div>

    const canAssignRoom = selectedReservation?.status === 'confirmed' && ['admin', 'manager', 'reservation_manager'].includes(staff?.role || '')

    // Filtering helpers for assign modal
    const roomTypes = [...new Set(availableRooms.map((r: any) => r.room_type).filter(Boolean))].sort()
    const filterFloors = [...new Set(availableRooms.map((r: any) => r.floor).filter(Boolean))].sort((a: number, b: number) => a - b)

    const filteredRooms = availableRooms.filter((room: any) => {
        if (filterRoomType && room.room_type !== filterRoomType) return false
        if (filterFloor && room.floor !== parseInt(filterFloor)) return false
        return true
    })

    return (
        <div className={standalone ? "min-h-screen bg-gray-100 p-4" : "bg-gray-100 p-4"}>
            <div className="max-w-[1600px] mx-auto">
                {/* Header and view toggle (standalone) */}
                {standalone && (
                    <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">📅 THEO Reservation Manager</h1>
                            <p className="text-sm text-gray-600">Multi‑view dashboard for high‑volume hotels</p>
                        </div>
                        <div className="flex gap-3 flex-wrap items-center">
                            <div className="flex bg-white rounded-lg shadow-sm">
                                <button onClick={() => setViewMode('threePane')} className={`px-4 py-2 rounded-l-lg transition ${viewMode === 'threePane' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>📆 Three‑Pane</button>
                                <button onClick={() => setViewMode('tape')} className={`px-4 py-2 transition ${viewMode === 'tape' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>📊 Tape Chart</button>
                                <button onClick={() => setViewMode('table')} className={`px-4 py-2 transition ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>📋 Table</button>
                                <button onClick={() => setViewMode('email')} className={`px-4 py-2 transition ${viewMode === 'email' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>📧 Email Inbox</button>
                                <button onClick={() => setViewMode('roomsOverview')} className={`px-4 py-2 transition ${viewMode === 'roomsOverview' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>🏨 Rooms Overview</button>
                                <button onClick={() => setViewMode('todaysArrivals')} className={`px-4 py-2 rounded-r-lg transition ${viewMode === 'todaysArrivals' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>📋 Today's Arrivals</button>
                            </div>
                            {['admin', 'manager', 'reservation_manager'].includes(staff?.role || '') && (
                                <button onClick={sendPreArrivalEmails} className="px-3 py-1 bg-purple-600 text-white rounded-lg shadow hover:bg-purple-700">✉️ Send Pre‑arrival Emails</button>
                            )}
                            <button onClick={() => { setSelectedReservation(null); setShowForm(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700">+ New Reservation</button>
                            <button onClick={logout} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">Logout</button>
                            <NotificationBell />
                        </div>
                    </div>
                )}

                {/* Header and view toggle (embedded) */}
                {!standalone && (
                    <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                        <div className="flex gap-3 items-center">
                            <div className="flex bg-white rounded-lg shadow-sm">
                                <button onClick={() => setViewMode('threePane')} className={`px-4 py-2 rounded-l-lg transition ${viewMode === 'threePane' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>📆 Three‑Pane</button>
                                <button onClick={() => setViewMode('tape')} className={`px-4 py-2 transition ${viewMode === 'tape' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>📊 Tape Chart</button>
                                <button onClick={() => setViewMode('table')} className={`px-4 py-2 transition ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>📋 Table</button>
                                <button onClick={() => setViewMode('email')} className={`px-4 py-2 transition ${viewMode === 'email' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>📧 Email Inbox</button>
                                <button onClick={() => setViewMode('roomsOverview')} className={`px-4 py-2 transition ${viewMode === 'roomsOverview' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>🏨 Rooms Overview</button>
                                <button onClick={() => setViewMode('todaysArrivals')} className={`px-4 py-2 rounded-r-lg transition ${viewMode === 'todaysArrivals' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>📋 Today's Arrivals</button>
                            </div>
                            {['admin', 'manager', 'reservation_manager'].includes(staff?.role || '') && (
                                <button onClick={sendPreArrivalEmails} className="px-3 py-1 bg-purple-600 text-white rounded-lg shadow hover:bg-purple-700">✉️ Send Pre‑arrival Emails</button>
                            )}
                            <button onClick={() => { setSelectedReservation(null); setShowForm(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700">+ New Reservation</button>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={logout} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">Logout</button>
                            <NotificationBell />
                        </div>
                    </div>
                )}

                {/* ==================== THREE‑PANE VIEW ==================== */}
                {viewMode === 'threePane' && (
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Left: Mini Calendar */}
                        <div className="lg:w-1/3 bg-white rounded-lg shadow p-4">
                            <DayPicker
                                mode="single"
                                selected={selectedDate}
                                onSelect={(date) => date && setSelectedDate(date)}
                                modifiers={{
                                    booked: (date) => reservations.some(r => 
                                        isWithinInterval(date, { start: new Date(r.arrival_date), end: new Date(r.departure_date) })
                                    )
                                }}
                                modifiersClassNames={{ booked: 'booked-day' }}
                            />
                            <style>{`.booked-day { background-color: #fee2e2 !important; color: #991b1b !important; border-radius: 50%; }`}</style>
                            <div className="mt-4 text-center text-sm text-gray-500">Click a date to see reservations</div>
                        </div>

                        {/* Centre: Sorted list of reservations for the selected date */}
                        <div className="lg:w-1/3 bg-white rounded-lg shadow p-4 overflow-y-auto max-h-[70vh]">
                            <h2 className="text-lg font-semibold mb-3">
                                {format(selectedDate, 'EEEE, MMM d, yyyy')}
                            </h2>
                            {reservationsForDate.length === 0 ? (
                                <div className="text-gray-500 text-center py-8">No reservations on this day</div>
                            ) : (
                                <div className="space-y-2">
                                    {reservationsForDate.map(res => (
                                        <div key={res.id} onClick={() => setSelectedReservation(res)} className={`p-3 rounded-lg border cursor-pointer transition hover:shadow ${selectedReservation?.id === res.id ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}`}>
                                            <div className="font-medium">{res.guest_name}</div>
                                            <div className="text-sm text-gray-500">{res.room_type} · {res.number_of_rooms} room(s)</div>
                                            <div className="text-xs mt-1">
                                                <span className={`px-2 py-0.5 rounded-full ${getStatusBadge(res.status)}`}>
                                                    {res.status === 'pending_review' ? 'Waitlist' : res.status.toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right: Detail sidebar with assign‑room button */}
                        <div className="lg:w-1/3 bg-white rounded-lg shadow p-4 overflow-y-auto max-h-[70vh]">
                            {selectedReservation ? (
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <h2 className="text-xl font-semibold">Reservation Details</h2>
                                        <button onClick={() => setSelectedReservation(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                                    </div>
                                    <div className="space-y-3">
                                        <div><span className="font-medium">Guest:</span> {selectedReservation.guest_name}</div>
                                        <div><span className="font-medium">Email:</span> {selectedReservation.guest_email || '—'}</div>
                                        <div><span className="font-medium">Phone:</span> {selectedReservation.guest_phone || '—'}</div>
                                        <div><span className="font-medium">Dates:</span> {format(parseISO(selectedReservation.arrival_date), 'MMM d')} – {format(parseISO(selectedReservation.departure_date), 'MMM d, yyyy')}</div>
                                        <div><span className="font-medium">Room type:</span> {selectedReservation.room_type}</div>
                                        <div><span className="font-medium">Guests / Rooms:</span> {selectedReservation.number_of_guests} / {selectedReservation.number_of_rooms}</div>
                                        {selectedReservation.special_requests && <div><span className="font-medium">Requests:</span> {selectedReservation.special_requests}</div>}
                                        <div className="pt-4 flex gap-2 flex-wrap">
                                            {selectedReservation.status === 'pending_review' && (
                                                <>
                                                    <button onClick={() => handleConfirm(selectedReservation.id)} className="flex-1 bg-green-600 text-white py-1.5 rounded">Confirm</button>
                                                    <button onClick={() => handleEdit(selectedReservation)} className="flex-1 bg-blue-600 text-white py-1.5 rounded">Edit</button>
                                                    <button onClick={() => handleCancel(selectedReservation.id)} className="flex-1 bg-red-600 text-white py-1.5 rounded">Cancel</button>
                                                </>
                                            )}
                                            {selectedReservation.status === 'confirmed' && (
                                                <>
                                                    <button onClick={() => handleCancel(selectedReservation.id)} className="flex-1 bg-red-600 text-white py-1.5 rounded">Cancel</button>
                                                    {canAssignRoom && (
                                                        <button
                                                            onClick={() => {
                                                                fetchAvailableRooms(
                                                                    selectedReservation.arrival_date.split('T')[0],
                                                                    selectedReservation.departure_date.split('T')[0]
                                                                )
                                                                setShowAssignRoomModal(true)
                                                            }}
                                                            className="w-full bg-purple-600 text-white py-1.5 rounded hover:bg-purple-700 mt-2"
                                                        >
                                                            🏨 Assign Room
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-gray-400 py-12">Select a reservation to view details</div>
                            )}
                        </div>
                    </div>
                )}

                {viewMode === 'tape' && <ReservationTapeChart />}
                {viewMode === 'email' && <EmailIngestionTab />}
                {viewMode === 'roomsOverview' && <AdminRoomsOverview />}
                {viewMode === 'todaysArrivals' && <TodayArrivals />}

                {/* ==================== TABLE VIEW ==================== */}
                {viewMode === 'table' && (
                    <>
                        <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
                            <div className="flex gap-2 flex-wrap">
                                {['all','pending_review','confirmed','cancelled'].map(s => (
                                    <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 rounded-full text-sm ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                                        {s === 'all' ? 'All' : s.replace('_',' ').toUpperCase()}
                                    </button>
                                ))}
                            </div>
                            <input type="text" placeholder="Search guest..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="px-3 py-1 border rounded-lg w-64" />
                            <select value={rowsPerPage} onChange={e => setRowsPerPage(Number(e.target.value))} className="px-3 py-1 border rounded-lg">
                                <option value={20}>20 per page</option>
                                <option value={50}>50 per page</option>
                                <option value={100}>100 per page</option>
                            </select>
                        </div>
                        <div className="bg-white rounded-lg shadow overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {['guest_name','arrival_date','departure_date','room_type','number_of_rooms','number_of_guests','status','actions'].map(field => (
                                            <th key={field} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => { if (field !== 'actions') handleSort(field as SortField) }}>
                                                {field.replace('_',' ')} {sortField === field && (sortOrder === 'asc' ? '↑' : '↓')}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {paginatedReservations.map(res => (
                                        <tr key={res.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm">{res.guest_name}</td>
                                            <td className="px-4 py-3 text-sm">{format(parseISO(res.arrival_date), 'MMM d, yyyy')}</td>
                                            <td className="px-4 py-3 text-sm">{format(parseISO(res.departure_date), 'MMM d, yyyy')}</td>
                                            <td className="px-4 py-3 text-sm">{res.room_type}</td>
                                            <td className="px-4 py-3 text-sm text-center">{res.number_of_rooms}</td>
                                            <td className="px-4 py-3 text-sm text-center">{res.number_of_guests}</td>
                                            <td className="px-4 py-3"><span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(res.status)}`}>{res.status.replace('_',' ').toUpperCase()}</span></td>
                                            <td className="px-4 py-3 text-sm flex gap-2">
                                                {res.status === 'pending_review' && (
                                                    <><button onClick={() => handleConfirm(res.id)} className="text-green-600 hover:text-green-900">Confirm</button>
                                                    <button onClick={() => handleEdit(res)} className="text-blue-600 hover:text-blue-900">Edit</button>
                                                    <button onClick={() => handleCancel(res.id)} className="text-red-600 hover:text-red-900">Cancel</button></>
                                                )}
                                                {res.status === 'confirmed' && (
                                                    <button onClick={() => handleCancel(res.id)} className="text-red-600 hover:text-red-900">Cancel</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="flex justify-between items-center mt-4">
                                <div>Page {currentPage} of {totalPages}</div>
                                <div className="flex gap-2">
                                    <button disabled={currentPage===1} onClick={() => setCurrentPage(p=>p-1)} className="px-3 py-1 border rounded">Prev</button>
                                    <button disabled={currentPage===totalPages} onClick={() => setCurrentPage(p=>p+1)} className="px-3 py-1 border rounded">Next</button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Reservation modal (unchanged) */}
                {showForm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
                            <div className="p-6">
                                <h2 className="text-xl font-bold mb-4">{selectedReservation ? 'Edit Reservation' : 'New Reservation'}</h2>
                                <form onSubmit={submitReservation} className="space-y-4">
                                    <input name="guest_name" placeholder="Guest Name *" value={formData.guest_name} onChange={handleInputChange} required className="w-full p-2 border rounded" />
                                    <div className="grid grid-cols-2 gap-4">
                                        <input name="guest_email" placeholder="Email" value={formData.guest_email} onChange={handleInputChange} className="p-2 border rounded" />
                                        <input name="guest_phone" placeholder="Phone" value={formData.guest_phone} onChange={handleInputChange} className="p-2 border rounded" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="date" name="arrival_date" value={formData.arrival_date} onChange={handleInputChange} required className="p-2 border rounded" />
                                        <input type="date" name="departure_date" value={formData.departure_date} onChange={handleInputChange} required className="p-2 border rounded" />
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <select name="room_type" value={formData.room_type} onChange={handleInputChange} className="p-2 border rounded">
                                            <option>Standard</option><option>Deluxe</option><option>Suite</option><option>Family</option><option>Executive</option><option>Presidential</option>
                                        </select>
                                        <input type="number" name="number_of_guests" min="1" value={formData.number_of_guests} onChange={handleInputChange} className="p-2 border rounded" />
                                        <input type="number" name="number_of_rooms" min="1" value={formData.number_of_rooms} onChange={handleInputChange} className="p-2 border rounded" />
                                    </div>
                                    <textarea name="special_requests" placeholder="Special requests" rows={3} value={formData.special_requests} onChange={handleInputChange} className="w-full p-2 border rounded" />
                                    <label className="flex items-center gap-2"><input type="checkbox" checked={confirmNow} onChange={e=>setConfirmNow(e.target.checked)} /> Confirm immediately (skip pending review)</label>
                                    <div className="flex gap-3 pt-4">
                                        <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded">Cancel</button>
                                        <button type="submit" disabled={submitting} className="flex-1 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{submitting ? 'Saving...' : (selectedReservation ? 'Update' : 'Create')}</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* Room Assignment Modal with filters */}
                {showAssignRoomModal && selectedReservation && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl max-w-lg w-full p-6">
                            <h3 className="text-xl font-bold mb-4">Assign Room to {selectedReservation.guest_name}</h3>

                            {/* Filters */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Room Type</label>
                                    <select
                                        value={filterRoomType}
                                        onChange={(e) => { setFilterRoomType(e.target.value); setSelectedRoomNumber('') }}
                                        className="w-full p-2 border rounded"
                                    >
                                        <option value="">All Types</option>
                                        {roomTypes.map((type: string) => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Floor</label>
                                    <select
                                        value={filterFloor}
                                        onChange={(e) => { setFilterFloor(e.target.value); setSelectedRoomNumber('') }}
                                        className="w-full p-2 border rounded"
                                    >
                                        <option value="">All Floors</option>
                                        {filterFloors.map((floor: number) => (
                                            <option key={floor} value={floor}>Floor {floor}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Room selection */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Select Room</label>
                                <select
                                    value={selectedRoomNumber}
                                    onChange={(e) => setSelectedRoomNumber(e.target.value)}
                                    className="w-full p-2 border rounded"
                                >
                                    <option value="">-- Choose a room --</option>
                                    {filteredRooms.map((room: any) => (
                                        <option key={room.room_number} value={room.room_number}>
                                            {room.room_number} – {room.room_type} (Floor {room.floor})
                                        </option>
                                    ))}
                                </select>
                                {filteredRooms.length === 0 && (
                                    <p className="text-xs text-gray-500 mt-1">No rooms match the selected filters.</p>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setShowAssignRoomModal(false)} className="flex-1 py-2 border rounded">Cancel</button>
                                <button
                                    onClick={async () => {
                                        if (!selectedRoomNumber) return
                                        try {
                                            await api.post(`/reservations/${selectedReservation.id}/assign-room`, {
                                                roomNumber: selectedRoomNumber
                                            })
                                            toast.success(`Room ${selectedRoomNumber} assigned`)
                                            setShowAssignRoomModal(false)
                                            setSelectedRoomNumber('')
                                            loadReservations()
                                            window.dispatchEvent(new CustomEvent('reservation-updated'))
                                        } catch (err: any) {
                                            toast.error(err.response?.data?.error || 'Assignment failed')
                                        }
                                    }}
                                    className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                                >
                                    Assign
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}