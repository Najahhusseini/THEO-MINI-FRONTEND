'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { 
    createReservation,
    getReservations,
    updateReservation,
    confirmReservation,
    cancelReservation,
    CreateReservationData,
    waitlistReservation,
    requestDateChange,
    createDraftEmail
} from '@/lib/api'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { format, isWithinInterval, parseISO } from 'date-fns'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import ReservationTapeChart from '@/components/ReservationTapeChart'
import EmailIngestionTab from '@/components/EmailIngestionTab'
import AdminRoomsOverview from '@/components/AdminRoomsOverview'
import TodayArrivals from '@/components/TodayArrivals'
import NotificationBell from '@/components/NotificationBell'
import GuestProfilesTab from '@/components/GuestProfilesTab'

type ViewMode = 'table' | 'threePane' | 'tape' | 'email' | 'roomsOverview' | 'todaysArrivals' | 'waitlist' | 'guests'
type SortField = 'guest_name' | 'arrival_date' | 'departure_date' | 'room_type' | 'status' | 'number_of_guests' | 'number_of_rooms' | 'created_at'
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

    const [threePaneSort, setThreePaneSort] = useState<'status' | 'recent'>('recent')
    const [threePaneStatusFilter, setThreePaneStatusFilter] = useState<string>('all')

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

    const [showAssignRoomModal, setShowAssignRoomModal] = useState(false)
    const [availableRooms, setAvailableRooms] = useState<any[]>([])
    const [selectedRoomNumber, setSelectedRoomNumber] = useState('')

    const [filterRoomType, setFilterRoomType] = useState('')
    const [filterFloor, setFilterFloor] = useState('')

    const [showDraftModal, setShowDraftModal] = useState(false)
    const [draftReservation, setDraftReservation] = useState<Reservation | null>(null)
    const [draftTemplate, setDraftTemplate] = useState<'change_dates' | 'confirm_availability' | 'custom' | null>(null)
    const [newArrival, setNewArrival] = useState('')
    const [newDeparture, setNewDeparture] = useState('')

    const fetchAvailableRooms = async (arrival: string, departure: string) => {
        try {
            const res = await api.get('/rooms/available', { params: { arrival, departure } })
            setAvailableRooms(res.data)
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

    const waitlistReservations = useMemo(() => {
        return reservations.filter(r => r.status === 'waitlist' || r.status === 'date_change_requested')
    }, [reservations])

    const filteredReservations = useMemo(() => {
        let filtered = [...reservations]
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase()
            filtered = filtered.filter(r => r.guest_name.toLowerCase().includes(term))
        }
        filtered.sort((a, b) => {
            let aVal: any = a[sortField]
            let bVal: any = b[sortField]
            if (sortField === 'arrival_date' || sortField === 'departure_date' || sortField === 'created_at') {
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

    const reservationsForDate = useMemo(() => {
        const covering = reservations.filter(r => {
            const arrival = new Date(r.arrival_date)
            const departure = new Date(r.departure_date)
            return isWithinInterval(selectedDate, { start: arrival, end: departure })
        })
        let filtered = covering
        if (threePaneStatusFilter !== 'all') {
            filtered = filtered.filter(r => r.status === threePaneStatusFilter)
        }
        if (threePaneSort === 'recent') {
            filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        } else {
            const statusOrder: Record<string, number> = { 'confirmed': 1, 'pending_review': 2, 'waitlist': 3, 'date_change_requested': 4, 'cancelled': 5 }
            filtered.sort((a, b) => {
                const orderA = statusOrder[a.status] ?? 99
                const orderB = statusOrder[b.status] ?? 99
                if (orderA !== orderB) return orderA - orderB
                return a.guest_name.localeCompare(b.guest_name)
            })
        }
        return filtered
    }, [reservations, selectedDate, threePaneSort, threePaneStatusFilter])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const submitReservation = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.guest_name || !formData.arrival_date || !formData.departure_date) {
            toast.error('Please fill in all required fields')
            return
        }
        setSubmitting(true)
        try {
            const dataToSend = {
                ...formData,
                number_of_guests: parseInt(formData.number_of_guests as any) || 1,
                number_of_rooms: parseInt(formData.number_of_rooms as any) || 1,
                status: confirmNow ? 'confirmed' : 'pending_review'
            }
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
            window.dispatchEvent(new CustomEvent('reservation-confirmed'))
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to save')
        } finally {
            setSubmitting(false)
        }
    }

    const handleConfirm = async (id: string) => {
        if (!confirm('Confirm this reservation?')) return
        try {
            await confirmReservation(id)
            toast.success('Reservation confirmed!')
            loadReservations()
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

    const handleWaitlist = async (id: string) => {
        try {
            await waitlistReservation(id)
            toast.success('Guest moved to waitlist')
            loadReservations()
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to waitlist')
        }
    }

    const handleDateChangeRequest = async (id: string) => {
        const newArrival = prompt('Enter proposed new arrival date (YYYY-MM-DD):')
        if (!newArrival) return
        const newDeparture = prompt('Enter proposed new departure date (YYYY-MM-DD):')
        if (!newDeparture) return
        try {
            await requestDateChange(id, { arrival_date: newArrival, departure_date: newDeparture })
            toast.success('Date change request sent to guest')
            loadReservations()
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to send date change request')
        }
    }

    const handleUpdateWaitlist = async (res: Reservation) => {
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

    const openDraftModal = (res: Reservation) => {
        setDraftReservation(res)
        setDraftTemplate(null)
        setNewArrival('')
        setNewDeparture('')
        setShowDraftModal(true)
    }

    const handleGenerateDraft = async () => {
        if (!draftReservation) return
        let customMessage = ''

        const origArrival = draftReservation.arrival_date ? draftReservation.arrival_date.split('T')[0] : 'N/A'
        const origDeparture = draftReservation.departure_date ? draftReservation.departure_date.split('T')[0] : 'N/A'

        if (draftTemplate === 'change_dates') {
            if (!newArrival || !newDeparture) {
                toast.error('Please fill in both new arrival and departure dates')
                return
            }
            customMessage = `Dear ${draftReservation.guest_name},\n\n`
                + `We received your request to change dates.\n`
                + `Original dates: ${origArrival} to ${origDeparture}\n`
                + `Proposed new dates: ${newArrival} to ${newDeparture}\n\n`
                + `Please let us know if these dates work for you.\n\nThank you,\nTHEO Hotel Team`
        } else if (draftTemplate === 'confirm_availability') {
            customMessage = `Dear ${draftReservation.guest_name},\n\n`
                + `Great news! The original dates you requested (${origArrival} to ${origDeparture}) are now available.\n`
                + `Would you still like to proceed with the booking?\n\n`
                + `Please reply to this email or call us to confirm.\n\nThank you,\nTHEO Hotel Team`
        } else {
            customMessage = `Dear ${draftReservation.guest_name},\n\n`
                + `We are writing to update you about your reservation.\n`
                + `Original dates: ${origArrival} to ${origDeparture}\n`
                + `If you have any questions, please reply to this email.\n\nThank you,\nTHEO Hotel Team`
        }

        try {
            await createDraftEmail(draftReservation.id, customMessage)
            toast.success('Draft email created! Check Email Inbox.')
            setShowDraftModal(false)
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to create draft email')
        }
    }

    const getStatusBadge = (status: string) => {
        switch(status) {
            case 'pending_review': return 'bg-yellow-100 text-yellow-800'
            case 'confirmed': return 'bg-green-100 text-green-800'
            case 'cancelled': return 'bg-red-100 text-red-800'
            case 'waitlist': return 'bg-orange-100 text-orange-800'
            case 'date_change_requested': return 'bg-purple-100 text-purple-800'
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
                {/* Header and view toggle */}
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
                                <button onClick={() => setViewMode('todaysArrivals')} className={`px-4 py-2 transition ${viewMode === 'todaysArrivals' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>📋 Today's Arrivals</button>
                                <button onClick={() => setViewMode('waitlist')} className={`px-4 py-2 transition ${viewMode === 'waitlist' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>⏳ Waitlist</button>
                                <button onClick={() => setViewMode('guests')} className={`px-4 py-2 rounded-r-lg transition ${viewMode === 'guests' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>👥 Guests</button>
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

                {!standalone && (
                    <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                        <div className="flex gap-3 items-center">
                            <div className="flex bg-white rounded-lg shadow-sm">
                                <button onClick={() => setViewMode('threePane')} className={`px-4 py-2 rounded-l-lg transition ${viewMode === 'threePane' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>📆 Three‑Pane</button>
                                <button onClick={() => setViewMode('tape')} className={`px-4 py-2 transition ${viewMode === 'tape' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>📊 Tape Chart</button>
                                <button onClick={() => setViewMode('table')} className={`px-4 py-2 transition ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>📋 Table</button>
                                <button onClick={() => setViewMode('email')} className={`px-4 py-2 transition ${viewMode === 'email' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>📧 Email Inbox</button>
                                <button onClick={() => setViewMode('roomsOverview')} className={`px-4 py-2 transition ${viewMode === 'roomsOverview' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>🏨 Rooms Overview</button>
                                <button onClick={() => setViewMode('todaysArrivals')} className={`px-4 py-2 transition ${viewMode === 'todaysArrivals' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>📋 Today's Arrivals</button>
                                <button onClick={() => setViewMode('waitlist')} className={`px-4 py-2 transition ${viewMode === 'waitlist' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>⏳ Waitlist</button>
                                <button onClick={() => setViewMode('guests')} className={`px-4 py-2 rounded-r-lg transition ${viewMode === 'guests' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>👥 Guests</button>
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
                        <div className="lg:w-1/3 bg-white rounded-lg shadow p-4">
                            <DayPicker
                                mode="single"
                                selected={selectedDate}
                                onSelect={(date) => date && setSelectedDate(date)}
                            />
                        </div>
                        <div className="lg:w-1/3 bg-white rounded-lg shadow p-4 overflow-y-auto max-h-[70vh]">
                            <div className="flex gap-2 mb-3 flex-wrap">
                                <select
                                    value={threePaneStatusFilter}
                                    onChange={(e) => setThreePaneStatusFilter(e.target.value)}
                                    className="p-1 border rounded text-sm"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="pending_review">Pending Review</option>
                                    <option value="waitlist">Waitlist</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                                <button
                                    onClick={() => setThreePaneSort(threePaneSort === 'recent' ? 'status' : 'recent')}
                                    className="px-3 py-1 bg-gray-200 rounded text-sm"
                                >
                                    Sort: {threePaneSort === 'recent' ? 'Most Recent' : 'By Status'}
                                </button>
                            </div>
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
                                                    {res.status.replace('_', ' ').toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
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
                {viewMode === 'guests' && <GuestProfilesTab />}    {/* ✅ NEW */}

                {viewMode === 'waitlist' && (
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-2xl font-bold mb-4">⏳ Waitlist & Date Change Requests</h2>
                        {waitlistReservations.length === 0 ? (
                            <p className="text-gray-500">No waitlisted guests.</p>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-2 text-left">Guest</th>
                                        <th className="px-4 py-2 text-left">Dates</th>
                                        <th className="px-4 py-2 text-left">Status</th>
                                        <th className="px-4 py-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {waitlistReservations.map(res => (
                                        <tr key={res.id} className="border-t">
                                            <td className="px-4 py-2">{res.guest_name}</td>
                                            <td className="px-4 py-2">{res.arrival_date.split('T')[0]} – {res.departure_date.split('T')[0]}</td>
                                            <td className="px-4 py-2">
                                                <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(res.status)}`}>
                                                    {res.status.replace('_', ' ').toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-right space-x-2">
                                                <button onClick={() => handleUpdateWaitlist(res)} className="text-blue-600 text-sm hover:underline">Edit</button>
                                                <button onClick={() => handleConfirm(res.id)} className="text-green-600 text-sm hover:underline">Confirm</button>
                                                <button onClick={() => openDraftModal(res)} className="text-purple-600 text-sm hover:underline">Draft Email</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* ==================== TABLE VIEW ==================== */}
                {viewMode === 'table' && (
                    <>
                        <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
                            <div className="flex gap-2 flex-wrap">
                                {['all','pending_review','confirmed','cancelled','waitlist','date_change_requested'].map(s => (
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
                                            <th key={field} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => { if (field !== 'actions') { setSortField(field as SortField); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc') } }}>
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
                                            <td className="px-4 py-3 text-sm flex gap-2 flex-wrap">
                                                {res.status === 'pending_review' && (
                                                    <><button onClick={() => handleConfirm(res.id)} className="text-green-600 hover:text-green-900">Confirm</button>
                                                    <button onClick={() => handleEdit(res)} className="text-blue-600 hover:text-blue-900">Edit</button>
                                                    <button onClick={() => handleCancel(res.id)} className="text-red-600 hover:text-red-900">Cancel</button>
                                                    <button onClick={() => handleWaitlist(res.id)} className="text-orange-600 hover:text-orange-900">Waitlist</button>
                                                    <button onClick={() => handleDateChangeRequest(res.id)} className="text-purple-600 hover:text-purple-900">Date Change</button></>
                                                )}
                                                {res.status === 'confirmed' && (
                                                    <><button onClick={() => handleCancel(res.id)} className="text-red-600 hover:text-red-900">Cancel</button>
                                                    <button onClick={() => handleWaitlist(res.id)} className="text-orange-600 hover:text-orange-900">Waitlist</button>
                                                    <button onClick={() => handleDateChangeRequest(res.id)} className="text-purple-600 hover:text-purple-900">Date Change</button></>
                                                )}
                                                {res.status === 'waitlist' && (
                                                    <><button onClick={() => handleUpdateWaitlist(res)} className="text-blue-600 hover:text-blue-900">Edit</button>
                                                    <button onClick={() => handleConfirm(res.id)} className="text-green-600 hover:text-green-900">Confirm</button>
                                                    <button onClick={() => openDraftModal(res)} className="text-purple-600 hover:text-purple-900">Draft Email</button></>
                                                )}
                                                {res.status === 'date_change_requested' && (
                                                    <><button onClick={() => handleUpdateWaitlist(res)} className="text-blue-600 hover:text-blue-900">Edit</button>
                                                    <button onClick={() => handleConfirm(res.id)} className="text-green-600 hover:text-green-900">Confirm</button>
                                                    <button onClick={() => openDraftModal(res)} className="text-purple-600 hover:text-purple-900">Draft Email</button></>
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

                {/* Reservation modal – SIMPLIFIED, NO ROOM TYPE */}
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

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Guests</label>
                                            <input type="number" name="number_of_guests" min="1" value={formData.number_of_guests} onChange={handleInputChange} className="w-full p-2 border rounded" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Rooms</label>
                                            <input type="number" name="number_of_rooms" min="1" value={formData.number_of_rooms} onChange={handleInputChange} className="w-full p-2 border rounded" />
                                        </div>
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

                {/* Room Assignment Modal with filters (unchanged) */}
                {showAssignRoomModal && selectedReservation && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl max-w-lg w-full p-6">
                            <h3 className="text-xl font-bold mb-4">Assign Room to {selectedReservation.guest_name}</h3>
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

                {/* ── Draft Email Modal ── */}
                {showDraftModal && draftReservation && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl max-w-md w-full shadow-xl p-6">
                            <h3 className="text-xl font-bold mb-2">Draft Email for {draftReservation.guest_name}</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Original dates: {draftReservation.arrival_date?.split('T')[0]} – {draftReservation.departure_date?.split('T')[0]}
                            </p>

                            {!draftTemplate && (
                                <div className="space-y-2">
                                    <button
                                        onClick={() => setDraftTemplate('change_dates')}
                                        className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-2 rounded-lg"
                                    >
                                        📅 Change / Modify Dates
                                    </button>
                                    <button
                                        onClick={() => setDraftTemplate('confirm_availability')}
                                        className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg"
                                    >
                                        ✅ Confirm Availability
                                    </button>
                                    <button
                                        onClick={() => setDraftTemplate('custom')}
                                        className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg"
                                    >
                                        ✉️ Custom Update
                                    </button>
                                    <button
                                        onClick={() => setShowDraftModal(false)}
                                        className="w-full py-2 border rounded-lg mt-2"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}

                            {draftTemplate === 'change_dates' && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">New Arrival Date</label>
                                        <input
                                            type="date"
                                            value={newArrival}
                                            onChange={(e) => setNewArrival(e.target.value)}
                                            className="w-full p-2 border rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">New Departure Date</label>
                                        <input
                                            type="date"
                                            value={newDeparture}
                                            onChange={(e) => setNewDeparture(e.target.value)}
                                            className="w-full p-2 border rounded"
                                        />
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button onClick={() => setDraftTemplate(null)} className="flex-1 py-2 border rounded">Back</button>
                                        <button onClick={handleGenerateDraft} className="flex-1 bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700">
                                            Generate Draft
                                        </button>
                                    </div>
                                </div>
                            )}

                            {draftTemplate === 'confirm_availability' && (
                                <div className="space-y-3">
                                    <p className="text-sm text-gray-600">This will generate an email telling the guest their original dates are available and ask if they'd still like to proceed.</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => setDraftTemplate(null)} className="flex-1 py-2 border rounded">Back</button>
                                        <button onClick={handleGenerateDraft} className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700">
                                            Generate Draft
                                        </button>
                                    </div>
                                </div>
                            )}

                            {draftTemplate === 'custom' && (
                                <div className="space-y-3">
                                    <p className="text-sm text-gray-600">Generates a general waitlist update email.</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => setDraftTemplate(null)} className="flex-1 py-2 border rounded">Back</button>
                                        <button onClick={handleGenerateDraft} className="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700">
                                            Generate Draft
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}