'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getReservations, getRooms } from '@/lib/api'
import toast from 'react-hot-toast'
import { format, addDays, parseISO, startOfDay } from 'date-fns'

interface Reservation {
    id: string
    guest_name: string
    guest_email: string
    source: string
    status: string
    arrival_date: string
    departure_date: string
    number_of_rooms: number
    room_type: string
}

interface Props {
    startDate?: string
    endDate?: string
}

export default function ReservationTapeChart({ startDate: propStartDate, endDate: propEndDate }: Props) {
    const { staff } = useAuth()
    const [allReservations, setAllReservations] = useState<Reservation[]>([])
    const [totalRooms, setTotalRooms] = useState<number>(0)
    const [loading, setLoading] = useState(true)
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
    const [showModal, setShowModal] = useState(false)

    const [startDate, setStartDate] = useState<string>(() => {
        if (propStartDate) return propStartDate
        const date = new Date()
        date.setDate(date.getDate() - 30)
        return date.toISOString().split('T')[0]
    })
    const [endDate, setEndDate] = useState<string>(() => {
        if (propEndDate) return propEndDate
        const date = new Date()
        date.setDate(date.getDate() + 90)
        return date.toISOString().split('T')[0]
    })

    const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([])

    const fetchData = async () => {
        try {
            const [resData, roomsData] = await Promise.all([getReservations({}), getRooms()])
            setAllReservations(resData)
            const availableRooms = roomsData.filter((r: any) => !r.out_of_order).length
            setTotalRooms(availableRooms)
        } catch (err) {
            toast.error('Failed to load data for tape chart')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    useEffect(() => {
        if (propStartDate) setStartDate(propStartDate)
        if (propEndDate) setEndDate(propEndDate)
    }, [propStartDate, propEndDate])

    const applyFilter = () => {
        if (!startDate || !endDate) return
        const start = parseISO(startDate)
        const end = parseISO(endDate)
        const filtered = allReservations.filter(res => {
            const arrival = parseISO(res.arrival_date)
            const departure = parseISO(res.departure_date)
            return (arrival >= start && arrival <= end) ||
                   (departure >= start && departure <= end) ||
                   (arrival <= start && departure >= end)
        })
        setFilteredReservations(filtered)
    }

    const resetFilter = () => {
        const defaultStart = new Date()
        defaultStart.setDate(defaultStart.getDate() - 30)
        const defaultEnd = new Date()
        defaultEnd.setDate(defaultEnd.getDate() + 90)
        setStartDate(defaultStart.toISOString().split('T')[0])
        setEndDate(defaultEnd.toISOString().split('T')[0])
    }

    useEffect(() => {
        applyFilter()
    }, [startDate, endDate, allReservations])

    const { dates, occupiedPerDate, availablePerDate, overbookingsPerDate } = useMemo(() => {
        if (!startDate || !endDate) return { dates: [], occupiedPerDate: [], availablePerDate: [], overbookingsPerDate: [] }

        const start = parseISO(startDate)
        const end = parseISO(endDate)
        const datesArray: Date[] = []
        let current = startOfDay(start)
        while (current <= end) {
            datesArray.push(new Date(current))
            current = addDays(current, 1)
        }

        const occupied = datesArray.map(date => {
            let occ = 0
            for (const r of filteredReservations) {
                const arrival = parseISO(r.arrival_date)
                const departure = parseISO(r.departure_date)
                if (date >= arrival && date < departure) {
                    occ += r.number_of_rooms
                }
            }
            return occ
        })

        const avail = occupied.map(occ => Math.max(0, totalRooms - occ))
        const over = occupied.map(occ => Math.max(0, occ - totalRooms))

        return { dates: datesArray, occupiedPerDate: occupied, availablePerDate: avail, overbookingsPerDate: over }
    }, [filteredReservations, totalRooms, startDate, endDate])

    const getRowColorClass = (status: string) => {
        switch (status) {
            case 'confirmed': return 'bg-green-50 hover:bg-green-100'
            case 'pending_review': return 'bg-yellow-50 hover:bg-yellow-100'
            case 'cancelled': return 'bg-gray-100 hover:bg-gray-200'
            default: return 'bg-white hover:bg-gray-50'
        }
    }

    const handleCellClick = (res: Reservation) => {
        setSelectedReservation(res)
        setShowModal(true)
    }

    if (loading) return <div className="p-8 text-center">Loading tape chart...</div>

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Filter bar */}
            <div className="p-4 bg-gray-50 border-b flex flex-wrap gap-4 items-end justify-between">
                <div className="flex gap-4 flex-wrap">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-1 border rounded" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-1 border rounded" />
                    </div>
                    <button onClick={applyFilter} className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Apply</button>
                    <button onClick={resetFilter} className="px-4 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">Reset</button>
                </div>
                <div className="text-sm text-gray-500">Showing {filteredReservations.length} | Total rooms: {totalRooms}</div>
            </div>

            {dates.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No date range selected</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-100 border-b">
                                <th className="sticky left-0 z-20 bg-gray-100 p-2 border-r text-left min-w-[200px]">Booking Info</th>
                                {dates.map((date, idx) => (
                                    <th key={idx} className="p-2 text-center border-r text-sm font-medium min-w-[80px]">
                                        {format(date, 'MMM dd')}<br />
                                        <span className="text-xs text-gray-500">{format(date, 'EEE')}</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredReservations.map((res) => {
                                const arrival = parseISO(res.arrival_date)
                                const departure = parseISO(res.departure_date)
                                const rowColor = getRowColorClass(res.status)

                                return (
                                    <tr key={res.id} className={`${rowColor} border-b hover:shadow-inner transition`}>
                                        <td className="sticky left-0 z-10 bg-inherit p-2 border-r text-sm">
                                            {/* ✅ Only guest name and room count */}
                                            <div className="font-bold truncate">{res.guest_name}</div>
                                            <div className="text-xs text-gray-500">{res.number_of_rooms} room(s)</div>
                                        </td>
                                        {dates.map((date, idx) => {
                                            const isOccupied = date >= arrival && date < departure
                                            return (
                                                <td
                                                    key={idx}
                                                    onClick={() => isOccupied && handleCellClick(res)}
                                                    className={`p-2 text-center border-r text-sm cursor-pointer ${isOccupied ? 'bg-blue-50 hover:bg-blue-100' : 'bg-gray-50 text-gray-300'}`}
                                                    title={isOccupied ? `Click to view ${res.guest_name}` : ''}
                                                >
                                                    {isOccupied ? res.number_of_rooms : '—'}
                                                </td>
                                            )
                                        })}
                                    </tr>
                                )
                            })}
                            {/* Summary rows unchanged */}
                            <tr className="bg-gray-100 border-t-2 border-gray-300">
                                <td className="sticky left-0 z-10 bg-gray-100 p-2 font-bold border-r">Occupied</td>
                                {occupiedPerDate.map((occ, idx) => (
                                    <td key={idx} className="p-2 text-center border-r font-semibold">{occ}</td>
                                ))}
                            </tr>
                            <tr className="bg-gray-50">
                                <td className="sticky left-0 z-10 bg-gray-50 p-2 font-bold border-r">Available</td>
                                {availablePerDate.map((avail, idx) => (
                                    <td key={idx} className="p-2 text-center border-r text-green-700">{avail}</td>
                                ))}
                            </tr>
                            <tr className="bg-gray-50">
                                <td className="sticky left-0 z-10 bg-gray-50 p-2 font-bold border-r">Overbookings</td>
                                {overbookingsPerDate.map((over, idx) => (
                                    <td key={idx} className={`p-2 text-center border-r font-bold ${over > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                        {over > 0 ? over : '0'}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal (unchanged) */}
            {showModal && selectedReservation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-bold">Reservation Details</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                        </div>
                        <div className="space-y-2">
                            <p><span className="font-semibold">Guest:</span> {selectedReservation.guest_name}</p>
                            <p><span className="font-semibold">Email:</span> {selectedReservation.guest_email || '—'}</p>
                            <p><span className="font-semibold">Source:</span> {selectedReservation.source || 'Direct'}</p>
                            <p><span className="font-semibold">Dates:</span> {format(parseISO(selectedReservation.arrival_date), 'MMM d, yyyy')} – {format(parseISO(selectedReservation.departure_date), 'MMM d, yyyy')}</p>
                            <p><span className="font-semibold">Rooms:</span> {selectedReservation.number_of_rooms}</p>
                            <p><span className="font-semibold">Status:</span> {selectedReservation.status}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}