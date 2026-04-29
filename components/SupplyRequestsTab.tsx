'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

interface SupplyRequest {
    id: string
    item_name: string
    quantity: number
    notes: string
    status: 'pending' | 'approved' | 'denied'
    created_at: string
    staff_name: string
    room_number: string
    approved_by_name?: string
    approved_at?: string
}

interface InventoryItem {
    id: string
    item_name: string
    quantity: number
    min_threshold: number
    unit: string
    last_updated: string
}

export default function SupplyRequestsTab() {
    const { staff } = useAuth()
    const [requests, setRequests] = useState<SupplyRequest[]>([])
    const [inventory, setInventory] = useState<InventoryItem[]>([])
    const [filter, setFilter] = useState('all')
    const [loading, setLoading] = useState(true)
    const [showInventory, setShowInventory] = useState(false)
    const [showAddStock, setShowAddStock] = useState(false)
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
    const [addQuantity, setAddQuantity] = useState(0)
    const [addNotes, setAddNotes] = useState('')

    const loadRequests = async () => {
        try {
            const token = localStorage.getItem('accessToken')
            const res = await fetch(`http://localhost:4000/api/cleaning/supply-requests?status=${filter}`, {
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            })
            if (res.ok) {
                const data = await res.json()
                setRequests(data)
            } else {
                toast.error('Failed to load requests')
            }
        } catch (error) {
            console.error('Error loading requests:', error)
            toast.error('Failed to load requests')
        } finally {
            setLoading(false)
        }
    }

    const loadInventory = async () => {
        try {
            const token = localStorage.getItem('accessToken')
            const res = await fetch('http://localhost:4000/api/cleaning/inventory', {
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            })
            if (res.ok) {
                const data = await res.json()
                setInventory(data)
            }
        } catch (error) {
            console.error('Error loading inventory:', error)
        }
    }

    useEffect(() => {
        loadRequests()
        loadInventory()
        const interval = setInterval(loadRequests, 10000)
        return () => clearInterval(interval)
    }, [filter])

    const handleUpdateRequest = async (requestId: string, status: 'approved' | 'denied') => {
        try {
            const token = localStorage.getItem('accessToken')
            const res = await fetch(`http://localhost:4000/api/cleaning/supply-requests/${requestId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            })
            if (res.ok) {
                toast.success(`Request ${status}`)
                loadRequests()
                loadInventory()
            } else {
                toast.error('Failed to update')
            }
        } catch (error) {
            toast.error('Failed to update')
        }
    }

    const handleAddStock = async () => {
        if (!selectedItem || addQuantity <= 0) {
            toast.error('Please enter a valid quantity')
            return
        }
        try {
            const token = localStorage.getItem('accessToken')
            const res = await fetch(`http://localhost:4000/api/cleaning/inventory/${selectedItem.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ quantity: addQuantity, notes: addNotes })
            })
            if (res.ok) {
                toast.success(`Added ${addQuantity} to ${selectedItem.item_name}`)
                setShowAddStock(false)
                setAddQuantity(0)
                setAddNotes('')
                loadInventory()
            } else {
                toast.error('Failed to add stock')
            }
        } catch (error) {
            toast.error('Failed to add stock')
        }
    }

    const getStatusBadge = (status: string) => {
        switch(status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800'
            case 'approved': return 'bg-green-100 text-green-800'
            case 'denied': return 'bg-red-100 text-red-800'
            default: return 'bg-gray-100'
        }
    }

    const getStatusIcon = (status: string) => {
        switch(status) {
            case 'pending': return '⏳'
            case 'approved': return '✅'
            case 'denied': return '❌'
            default: return '📦'
        }
    }

    if (loading) return <div className="text-center py-12">Loading supply requests...</div>

    const pendingCount = requests.filter(r => r.status === 'pending').length
    const approvedCount = requests.filter(r => r.status === 'approved').length
    const deniedCount = requests.filter(r => r.status === 'denied').length

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">📦 Supply Request Management</h2>
                    <p className="text-sm text-gray-500">Approve or deny supply requests from cleaning staff</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            setShowInventory(!showInventory)
                            if (!showInventory) loadInventory()
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        {showInventory ? 'Hide Inventory' : '📊 View Inventory'}
                    </button>
                    <button
                        onClick={loadRequests}
                        className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition"
                    >
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-yellow-50 rounded-lg p-4 text-center border border-yellow-200">
                    <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
                    <div className="text-sm text-yellow-700">Pending</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
                    <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
                    <div className="text-sm text-green-700">Approved</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center border border-red-200">
                    <div className="text-2xl font-bold text-red-600">{deniedCount}</div>
                    <div className="text-sm text-red-700">Denied</div>
                </div>
            </div>

            {/* Inventory View */}
            {showInventory && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-3 bg-blue-50 border-b border-blue-200 flex justify-between items-center">
                        <h3 className="font-semibold text-blue-800">📊 Current Inventory Levels</h3>
                        <button
                            onClick={() => loadInventory()}
                            className="text-blue-600 text-sm hover:text-blue-800"
                        >
                            🔄 Refresh
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Item</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Quantity</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Unit</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Min Threshold</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {inventory.map(item => {
                                    const isLowStock = item.quantity <= item.min_threshold
                                    return (
                                        <tr key={item.id} className={isLowStock ? 'bg-red-50' : ''}>
                                            <td className="px-6 py-4 font-medium">{item.item_name}</td>
                                            <td className="px-6 py-4">
                                                <span className={`font-bold ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                                                    {item.quantity}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">{item.unit}</td>
                                            <td className="px-6 py-4 text-gray-600">{item.min_threshold}</td>
                                            <td className="px-6 py-4">
                                                {isLowStock ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                                                        ⚠️ Low Stock
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                                                        ✓ In Stock
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => {
                                                        setSelectedItem(item)
                                                        setShowAddStock(true)
                                                    }}
                                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                                >
                                                    + Add Stock
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2 border-b pb-2 overflow-x-auto">
                {['all', 'pending', 'approved', 'denied'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setFilter(tab)}
                        className={`px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap ${
                            filter === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        {tab === 'all' ? 'All Requests' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        {tab === 'pending' && pendingCount > 0 && (
                            <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-xs">
                                {pendingCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Requests List */}
            <div className="space-y-3">
                {requests.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-lg border">
                        <p className="text-gray-500">No supply requests found</p>
                    </div>
                ) : (
                    requests.map(req => (
                        <div key={req.id} className="bg-white rounded-lg shadow p-4 border hover:shadow-md transition">
                            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-semibold text-lg">{req.item_name}</h3>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(req.status)}`}>
                                            {getStatusIcon(req.status)} {req.status}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-sm">
                                        <p className="text-gray-600">
                                            📦 Quantity: <span className="font-medium">{req.quantity}</span>
                                        </p>
                                        <p className="text-gray-600">
                                            👤 Requested by: <span className="font-medium">{req.staff_name}</span>
                                        </p>
                                        {req.room_number && (
                                            <p className="text-gray-600">
                                                🏨 Room: <span className="font-medium">{req.room_number}</span>
                                            </p>
                                        )}
                                        <p className="text-gray-600">
                                            🕐 Requested: <span className="font-medium">{new Date(req.created_at).toLocaleString()}</span>
                                        </p>
                                    </div>
                                    {req.notes && (
                                        <p className="text-sm text-gray-500 mt-2 bg-gray-50 p-2 rounded">
                                            📝 Notes: {req.notes}
                                        </p>
                                    )}
                                    {req.approved_by_name && (
                                        <p className="text-xs text-gray-400 mt-1">
                                            {req.status === 'approved' ? 'Approved' : 'Denied'} by {req.approved_by_name} at {new Date(req.approved_at!).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                                {req.status === 'pending' && (
                                    <div className="flex gap-2 self-end md:self-center">
                                        <button
                                            onClick={() => handleUpdateRequest(req.id, 'approved')}
                                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-1"
                                        >
                                            ✅ Approve
                                        </button>
                                        <button
                                            onClick={() => handleUpdateRequest(req.id, 'denied')}
                                            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center gap-1"
                                        >
                                            ❌ Deny
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Add Stock Modal */}
            {showAddStock && selectedItem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
                        <div className="bg-green-600 px-6 py-4 rounded-t-xl flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-semibold text-white">Add Stock</h3>
                                <p className="text-green-100">{selectedItem.item_name}</p>
                            </div>
                            <button onClick={() => setShowAddStock(false)} className="text-white text-2xl">&times;</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Current Quantity</label>
                                <p className="text-lg font-bold">{selectedItem.quantity} {selectedItem.unit}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to Add</label>
                                <input
                                    type="number"
                                    value={addQuantity}
                                    onChange={(e) => setAddQuantity(parseInt(e.target.value) || 0)}
                                    min="1"
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                                    placeholder="Enter quantity"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                                <textarea
                                    value={addNotes}
                                    onChange={(e) => setAddNotes(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    placeholder="Supplier info, delivery notes, etc."
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setShowAddStock(false)} className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">
                                    Cancel
                                </button>
                                <button onClick={handleAddStock} disabled={addQuantity <= 0} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                                    Add Stock
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}