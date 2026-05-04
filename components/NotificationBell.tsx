'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface Notification {
    id: string
    title: string
    message: string
    type: string
    is_read: boolean
    created_at: string
    data?: any
}

export default function NotificationBell() {
    const { staff } = useAuth()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const dropdownRef = useRef<HTMLDivElement>(null)
    const bellRef = useRef<HTMLButtonElement>(null)

    // ── Fixed dropdown position – safe on all screen sizes ──
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

    const updateDropdownPosition = () => {
        if (bellRef.current) {
            const bellRect = bellRef.current.getBoundingClientRect()
            const dropdownWidth = 340   // same as w-80 + padding
            let left = bellRect.right - dropdownWidth

            // don’t let it go off‑screen to the left or right
            if (left < 8) left = 8
            if (left + dropdownWidth > window.innerWidth - 8) {
                left = window.innerWidth - dropdownWidth - 8
            }

            setDropdownStyle({
                position: 'fixed',
                top: bellRect.bottom + 6,
                left: left,
                width: dropdownWidth,
                maxHeight: '70vh',
                zIndex: 9999,
            })
        }
    }

    useEffect(() => {
        if (isOpen) {
            updateDropdownPosition()
            window.addEventListener('scroll', updateDropdownPosition, true)
            window.addEventListener('resize', updateDropdownPosition)
        }
        return () => {
            window.removeEventListener('scroll', updateDropdownPosition, true)
            window.removeEventListener('resize', updateDropdownPosition)
        }
    }, [isOpen])

    // ── Fetch notifications ──
    const fetchNotifications = async () => {
        if (!staff) return
        setLoading(true)
        try {
            const token = localStorage.getItem('accessToken')
            const response = await fetch('http://localhost:4000/api/notifications', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
            if (response.ok) {
                const data = await response.json()
                const notificationList = data.notifications || data.items || []
                const unread = data.unreadCount !== undefined
                    ? data.unreadCount
                    : notificationList.filter((n: Notification) => !n.is_read).length
                setNotifications(notificationList)
                setUnreadCount(unread)
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error)
        } finally {
            setLoading(false)
        }
    }

    const markAsRead = async (id: string) => {
        try {
            const token = localStorage.getItem('accessToken')
            const response = await fetch(`http://localhost:4000/api/notifications/${id}/read`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
            if (response.ok) {
                setNotifications(prev =>
                    prev.map(n => n.id === id ? { ...n, is_read: true } : n)
                )
                setUnreadCount(prev => Math.max(0, prev - 1))
            }
        } catch (error) {
            console.error('Failed to mark as read:', error)
        }
    }

    const markAllAsRead = async () => {
        try {
            const token = localStorage.getItem('accessToken')
            const response = await fetch('http://localhost:4000/api/notifications/mark-all-read', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
            if (response.ok) {
                setNotifications(prev =>
                    prev.map(n => ({ ...n, is_read: true }))
                )
                setUnreadCount(0)
            }
        } catch (error) {
            console.error('Failed to mark all as read:', error)
        }
    }

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'task': return '🧹'
            case 'supply': return '📦'
            case 'cleaning': return '✨'
            case 'dnd': return '🚫'
            case 'inspection': return '🔍'
            case 'info': return 'ℹ️'
            case 'room_assigned': return '📋'
            case 'room_completed': return '✅'
            case 'room_ready': return '🏨'
            case 'room_out_of_order': return '🚫'
            case 'guest_moved': return '🔄'
            case 'new_reservation': return '📧'
            case 'alert': return '⚠️'
            default: return '🔔'
        }
    }

    useEffect(() => {
        fetchNotifications()
        const interval = setInterval(fetchNotifications, 30000)

        const handleRefresh = () => {
            fetchNotifications()
        }
        window.addEventListener('refresh-notifications', handleRefresh)
        window.addEventListener('room-assigned', handleRefresh)
        window.addEventListener('room-status-changed', handleRefresh)

        return () => {
            clearInterval(interval)
            window.removeEventListener('refresh-notifications', handleRefresh)
            window.removeEventListener('room-assigned', handleRefresh)
            window.removeEventListener('room-status-changed', handleRefresh)
        }
    }, [staff])

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                bellRef.current &&
                !bellRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                ref={bellRef}
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-gray-100 transition focus:outline-none"
            >
                🔔
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full min-w-[18px]">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div style={dropdownStyle} className="bg-white rounded-lg shadow-xl border overflow-hidden">
                    <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-800">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-blue-600 hover:text-blue-800 transition"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 40px)' }}>
                        {loading && notifications.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <div className="animate-pulse">Loading...</div>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <div className="text-2xl mb-2">🔔</div>
                                <p className="text-sm">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map(notif => (
                                <div
                                    key={notif.id}
                                    className={`p-3 border-b hover:bg-gray-50 cursor-pointer transition ${
                                        !notif.is_read ? 'bg-blue-50' : ''
                                    }`}
                                    onClick={() => markAsRead(notif.id)}
                                >
                                    <div className="flex items-start gap-2">
                                        <span className="text-lg">{getNotificationIcon(notif.type)}</span>
                                        <div className="flex-1">
                                            <div className="font-medium text-sm text-gray-800">
                                                {notif.title}
                                            </div>
                                            <div className="text-xs text-gray-600 mt-1">
                                                {notif.message}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1">
                                                {new Date(notif.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                        {!notif.is_read && (
                                            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}