'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { getRoomsWithCleaning, getOutOfOrderRooms, updateRoomCleaningStatus, setRoomOutOfOrder, removeRoomOutOfOrder } from '@/lib/api'
import toast from 'react-hot-toast'

interface Room {
    id: string
    room_number: string
    floor: number
    room_type: string
    status: string
    cleaning_status?: string
    out_of_order?: boolean
    out_of_order_reason?: string
    assigned_cleaner_id?: string
    last_cleaning_update?: string
    guest_name?: string
    request_status?: string
    cleaning_request_id?: string
}

interface RoomContextType {
    rooms: Room[]
    loading: boolean
    refreshRooms: () => Promise<void>
    updateRoomStatus: (roomId: string, newStatus: string) => Promise<void>
    markRoomOutOfOrder: (roomId: string, reason: string) => Promise<void>
    removeRoomOutOfOrder: (roomId: string) => Promise<void>
    getRoomById: (roomId: string) => Room | undefined
    getRoomsByFloor: (floor: number) => Room[]
    getAssignedRooms: (cleanerId: string) => Room[]
}

const RoomContext = createContext<RoomContextType | undefined>(undefined)

export function RoomProvider({ children }: { children: ReactNode }) {
    const [rooms, setRooms] = useState<Room[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshTrigger, setRefreshTrigger] = useState(0)

    const refreshRooms = useCallback(async () => {
        try {
            // Use getRoomsWithCleaning instead of getRooms - this returns the correct cleaning_status
            const [roomsData, oooRooms] = await Promise.all([
                getRoomsWithCleaning(),
                getOutOfOrderRooms()
            ])
            const oooMap = new Map(oooRooms.map((r: any) => [r.id, r.out_of_order_reason]))
            
            const roomsWithStatus = roomsData.map((room: any) => ({
                id: room.id,
                room_number: room.room_number,
                floor: room.floor,
                room_type: room.room_type,
                cleaning_status: room.cleaning_status,
                status: room.status,
                out_of_order: oooMap.has(room.id),
                out_of_order_reason: oooMap.get(room.id),
                assigned_cleaner_id: room.assigned_cleaner_id,
                last_cleaning_update: room.last_cleaning_update,
                guest_name: room.guest_name,
                request_status: room.request_status,
                cleaning_request_id: room.cleaning_request_id
            }))
            
            console.log('Rooms from cleaning API:', roomsWithStatus.slice(0, 5).map(r => ({ 
                room_number: r.room_number, 
                cleaning_status: r.cleaning_status 
            })))
            
            setRooms(roomsWithStatus)
        } catch (error) {
            console.error('Failed to refresh rooms:', error)
            toast.error('Failed to refresh rooms')
        } finally {
            setLoading(false)
        }
    }, [])

    // Initial load
    useEffect(() => {
        refreshRooms()
    }, [refreshRooms, refreshTrigger])

    // Auto-refresh every 10 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            refreshRooms()
        }, 10000)
        return () => clearInterval(interval)
    }, [refreshRooms])

    const updateRoomStatus = async (roomId: string, newStatus: string) => {
        try {
            await updateRoomCleaningStatus(roomId, newStatus)
            toast.success(`Room status updated to ${newStatus}`)
            refreshRooms()
            // Dispatch custom event for other components
            window.dispatchEvent(new CustomEvent('room-status-changed', { detail: { roomId, newStatus } }))
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to update status')
            throw err
        }
    }

    const markRoomOutOfOrder = async (roomId: string, reason: string) => {
        try {
            await setRoomOutOfOrder(roomId, reason)
            toast.success('Room marked out of order')
            refreshRooms()
            window.dispatchEvent(new CustomEvent('room-outoforder-changed', { detail: { roomId, reason } }))
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to mark out of order')
            throw err
        }
    }

    const removeRoomOutOfOrder = async (roomId: string) => {
        try {
            await removeRoomOutOfOrder(roomId)
            toast.success('Room restored to service')
            refreshRooms()
            window.dispatchEvent(new CustomEvent('room-restored', { detail: { roomId } }))
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to restore room')
            throw err
        }
    }

    const getRoomById = (roomId: string) => rooms.find(r => r.id === roomId)
    const getRoomsByFloor = (floor: number) => rooms.filter(r => r.floor === floor)
    const getAssignedRooms = (cleanerId: string) => rooms.filter(r => r.assigned_cleaner_id === cleanerId)

    return (
        <RoomContext.Provider value={{
            rooms,
            loading,
            refreshRooms,
            updateRoomStatus,
            markRoomOutOfOrder,
            removeRoomOutOfOrder,
            getRoomById,
            getRoomsByFloor,
            getAssignedRooms
        }}>
            {children}
        </RoomContext.Provider>
    )
}

export function useRooms() {
    const context = useContext(RoomContext)
    if (context === undefined) {
        throw new Error('useRooms must be used within a RoomProvider')
    }
    return context
}