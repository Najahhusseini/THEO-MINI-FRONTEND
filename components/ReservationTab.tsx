'use client'

import { useState, useEffect, useCallback } from 'react'
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
import toast from 'react-hot-toast'

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

export default function ReservationTab() {
    const { staff } = useAuth()
    const [reservations, setReservations] = useState<Reservation[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [submitting, setSubmitting] = useState(false)
    
    // Form state
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

    const isManager = staff?.role === 'admin' || staff?.role === 'manager' || staff?.role === 'frontdesk'

    const loadReservations = useCallback(async () => {
        try {
            const filters: any = {}
            if (statusFilter !== 'all') {
                filters.status = statusFilter
            }
            const data = await getReservations(filters)
            setReservations(data)
        } catch (error) {
            console.error('Failed to load reservations:', error)
            toast.error('Failed to load reservations')
        } finally {
            setLoading(false)
        }
    }, [statusFilter])

    useEffect(() => {
        loadReservations()
        
        // Listen for reservation events
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        })
    }

    const checkForConflicts = async (): Promise<boolean> => {
        try {
            const result = await checkConflicts({
                arrival_date: formData.arrival_date,
                departure_date: formData.departure_date,
                room_type: formData.room_type,
                exclude_id: selectedReservation?.id
            })
            if (result.hasConflict) {
                toast.error('⚠️ Conflict detected! This room type is already booked for these dates.')
                return true
            }
            return false
        } catch (error) {
            console.error('Failed to check conflicts:', error)
            return false
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!formData.guest_name || !formData.arrival_date || !formData.departure_date) {
            toast.error('Please fill in all required fields')
            return
        }
        
        // Check for conflicts
        const hasConflict = await checkForConflicts()
        if (hasConflict) return
        
        setSubmitting(true)
        try {
            if (selectedReservation) {
                await updateReservation(selectedReservation.id, formData)
                toast.success('Reservation updated successfully')
            } else {
                await createReservation(formData)
                toast.success('Reservation created successfully')
            }
            setShowForm(false)
            setSelectedReservation(null)
            setFormData({
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
            loadReservations()
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to save reservation')
        } finally {
            setSubmitting(false)
        }
    }

    const handleConfirm = async (id: string) => {
        if (!confirm('Confirm this reservation? This will create a Stay record for Reception.')) return
        
        try {
            await confirmReservation(id)
            toast.success('Reservation confirmed! Stay record created.')
            loadReservations()
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
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to cancel')
        }
    }

    const handleEdit = (reservation: Reservation) => {
        setSelectedReservation(reservation)
        setFormData({
            guest_name: reservation.guest_name,
            guest_email: reservation.guest_email || '',
            guest_phone: reservation.guest_phone || '',
            arrival_date: reservation.arrival_date.split('T')[0],
            departure_date: reservation.departure_date.split('T')[0],
            room_type: reservation.room_type,
            number_of_guests: reservation.number_of_guests,
            number_of_rooms: reservation.number_of_rooms,
            special_requests: reservation.special_requests || ''
        })
        setShowForm(true)
    }

    const getStatusBadge = (status: string) => {
        switch(status) {
            case 'pending_review': return 'bg-yellow-100 text-yellow-800'
            case 'confirmed': return 'bg-green-100 text-green-800'
            case 'cancelled': return 'bg-red-100 text-red-800'
            case 'rejected': return 'bg-gray-100 text-gray-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    if (loading) return <div className="text-center py-12">Loading reservations...</div>

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-light text-gray-800">📅 Reservations</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Manage all guest reservations. Confirm to create Stay records for Reception.
                        </p>
                    </div>
                    {isManager && (
                        <button
                            onClick={() => {
                                setSelectedReservation(null)
                                setFormData({
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
                                setShowForm(true)
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            + New Reservation
                        </button>
                    )}
                </div>

                {/* Filters */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-3 py-1 rounded-full text-sm transition ${
                            statusFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setStatusFilter('pending_review')}
                        className={`px-3 py-1 rounded-full text-sm transition ${
                            statusFilter === 'pending_review' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        Pending Review
                    </button>
                    <button
                        onClick={() => setStatusFilter('confirmed')}
                        className={`px-3 py-1 rounded-full text-sm transition ${
                            statusFilter === 'confirmed' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        Confirmed
                    </button>
                    <button
                        onClick={() => setStatusFilter('cancelled')}
                        className={`px-3 py-1 rounded-full text-sm transition ${
                            statusFilter === 'cancelled' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        Cancelled
                    </button>
                </div>

                {/* Reservation Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {reservations.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-gray-500">
                            No reservations found.
                        </div>
                    ) : (
                        reservations.map(res => (
                            <div
                                key={res.id}
                                className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500 hover:shadow-lg transition"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg">{res.guest_name}</h3>
                                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(res.status)}`}>
                                        {res.status.replace('_', ' ').toUpperCase()}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-600 space-y-1">
                                    <p>📅 {new Date(res.arrival_date).toLocaleDateString()} → {new Date(res.departure_date).toLocaleDateString()}</p>
                                    <p>🏨 {res.room_type} • {res.number_of_guests} guests • {res.number_of_rooms} rooms</p>
                                    {res.guest_email && <p>📧 {res.guest_email}</p>}
                                    {res.special_requests && <p className="text-xs text-gray-500 italic">📝 {res.special_requests.substring(0, 60)}</p>}
                                </div>
                                <div className="flex gap-2 mt-3">
                                    {isManager && res.status === 'pending_review' && (
                                        <>
                                            <button
                                                onClick={() => handleConfirm(res.id)}
                                                className="flex-1 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition"
                                            >
                                                Confirm
                                            </button>
                                            <button
                                                onClick={() => handleEdit(res)}
                                                className="flex-1 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleCancel(res.id)}
                                                className="flex-1 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    )}
                                    {isManager && res.status === 'confirmed' && (
                                        <button
                                            onClick={() => handleCancel(res.id)}
                                            className="w-full bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Reservation Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-bold">
                                        {selectedReservation ? 'Edit Reservation' : 'New Reservation'}
                                    </h2>
                                    <button
                                        onClick={() => setShowForm(false)}
                                        className="text-gray-500 hover:text-gray-700 text-2xl"
                                    >
                                        &times;
                                    </button>
                                </div>
                                
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Guest Name *</label>
                                        <input
                                            type="text"
                                            name="guest_name"
                                            value={formData.guest_name}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Email</label>
                                            <input
                                                type="email"
                                                name="guest_email"
                                                value={formData.guest_email}
                                                onChange={handleInputChange}
                                                className="w-full p-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Phone</label>
                                            <input
                                                type="text"
                                                name="guest_phone"
                                                value={formData.guest_phone}
                                                onChange={handleInputChange}
                                                className="w-full p-2 border rounded-lg"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Arrival Date *</label>
                                            <input
                                                type="date"
                                                name="arrival_date"
                                                value={formData.arrival_date}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full p-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Departure Date *</label>
                                            <input
                                                type="date"
                                                name="departure_date"
                                                value={formData.departure_date}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full p-2 border rounded-lg"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Room Type</label>
                                            <select
                                                name="room_type"
                                                value={formData.room_type}
                                                onChange={handleInputChange}
                                                className="w-full p-2 border rounded-lg"
                                            >
                                                <option value="Standard">Standard</option>
                                                <option value="Deluxe">Deluxe</option>
                                                <option value="Suite">Suite</option>
                                                <option value="Family">Family</option>
                                                <option value="Executive">Executive</option>
                                                <option value="Presidential">Presidential</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Guests</label>
                                            <input
                                                type="number"
                                                name="number_of_guests"
                                                value={formData.number_of_guests}
                                                onChange={handleInputChange}
                                                min="1"
                                                className="w-full p-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Rooms</label>
                                            <input
                                                type="number"
                                                name="number_of_rooms"
                                                value={formData.number_of_rooms}
                                                onChange={handleInputChange}
                                                min="1"
                                                className="w-full p-2 border rounded-lg"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Special Requests</label>
                                        <textarea
                                            name="special_requests"
                                            value={formData.special_requests}
                                            onChange={handleInputChange}
                                            rows={3}
                                            className="w-full p-2 border rounded-lg"
                                        />
                                    </div>
                                    
                                    <div className="flex gap-3 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowForm(false)}
                                            className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                                        >
                                            {submitting ? 'Saving...' : (selectedReservation ? 'Update' : 'Create')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}