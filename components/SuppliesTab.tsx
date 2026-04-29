'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { 
    getSupplyItems, 
    getLowStockItems, 
    createSupplyItem, 
    adjustStock, 
    getTransactionHistory 
} from '@/lib/api'
import toast from 'react-hot-toast'

interface SupplyItem {
    id: string
    name: string
    category_id: string
    category_name: string
    items_per_box: number
    current_boxes: number
    min_threshold_items: number
    total_items: number
}

interface Transaction {
    id: string
    quantity_boxes: number
    reason: string
    staff_name: string
    created_at: string
}

export default function SuppliesTab() {
    const { staff } = useAuth()
    const [items, setItems] = useState<SupplyItem[]>([])
    const [lowStockItems, setLowStockItems] = useState<SupplyItem[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedCategory, setSelectedCategory] = useState('cleaning')
    const [showAddModal, setShowAddModal] = useState(false)
    const [showAdjustModal, setShowAdjustModal] = useState<SupplyItem | null>(null)
    const [adjustQuantity, setAdjustQuantity] = useState(0)
    const [adjustReason, setAdjustReason] = useState('')
    const [showHistory, setShowHistory] = useState<SupplyItem | null>(null)
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [newItem, setNewItem] = useState({
        name: '',
        itemsPerBox: 1,
        initialBoxes: 0,
        minThresholdItems: 0,
    })

    useEffect(() => {
        loadData()
    }, [selectedCategory])

    const loadData = async () => {
        setLoading(true)
        try {
            const [itemsData, lowStockData] = await Promise.all([
                getSupplyItems(selectedCategory),
                getLowStockItems()
            ])
            // Calculate total items for each
            const itemsWithTotal = itemsData.map((item: any) => ({
                ...item,
                total_items: item.current_boxes * item.items_per_box
            }))
            setItems(itemsWithTotal)
            setLowStockItems(lowStockData || [])
        } catch (error) {
            toast.error('Failed to load supplies')
        } finally {
            setLoading(false)
        }
    }

    const loadTransactionHistory = async (itemId: string) => {
        try {
            const history = await getTransactionHistory(itemId, 20)
            setTransactions(history)
        } catch (error) {
            toast.error('Failed to load history')
        }
    }

    const handleCreateItem = async () => {
        if (!newItem.name.trim()) {
            toast.error('Please enter item name')
            return
        }
        // Get category ID for cleaning (we'll hardcode or fetch)
        // For simplicity, we assume the cleaning category is the first one. In real app, fetch categories.
        const categoryId = 'cleaning-category-id' // This will be replaced by actual fetch
        try {
            await createSupplyItem({
                categoryId: 'cleaning-category-id', // TODO: fetch actual ID
                name: newItem.name,
                itemsPerBox: newItem.itemsPerBox,
                initialBoxes: newItem.initialBoxes,
                minThresholdItems: newItem.minThresholdItems,
            })
            toast.success('Item created')
            setShowAddModal(false)
            setNewItem({ name: '', itemsPerBox: 1, initialBoxes: 0, minThresholdItems: 0 })
            loadData()
        } catch (error) {
            toast.error('Failed to create item')
        }
    }

    const handleAdjustStock = async () => {
        if (!showAdjustModal) return
        if (adjustQuantity === 0) {
            toast.error('Quantity cannot be zero')
            return
        }
        if (!adjustReason.trim()) {
            toast.error('Please provide a reason')
            return
        }
        try {
            await adjustStock(showAdjustModal.id, adjustQuantity, adjustReason)
            toast.success('Stock updated')
            setShowAdjustModal(null)
            setAdjustQuantity(0)
            setAdjustReason('')
            loadData()
        } catch (error: any) {
            toast.error(error.message || 'Failed to update stock')
        }
    }

    const getStockStatus = (item: SupplyItem) => {
        if (item.total_items <= 0) return { color: 'bg-red-100 text-red-800', label: 'Out of stock' }
        if (item.total_items < item.min_threshold_items) return { color: 'bg-orange-100 text-orange-800', label: 'Low stock' }
        if (item.total_items < item.min_threshold_items * 2) return { color: 'bg-yellow-100 text-yellow-800', label: 'Getting low' }
        return { color: 'bg-green-100 text-green-800', label: 'In stock' }
    }

    const getItemStatusIcon = (item: SupplyItem) => {
        if (item.total_items <= 0) return '🔴'
        if (item.total_items < item.min_threshold_items) return '⚠️'
        return '✅'
    }

    if (loading && items.length === 0) {
        return <div className="text-center py-12">Loading supplies...</div>
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">📦 Supplies Inventory</h2>
                    <p className="text-sm text-gray-500">Manage cleaning supplies stock</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                    + Add Item
                </button>
            </div>

            {/* Category selector */}
            <div className="flex gap-4 border-b pb-2">
                <button
                    onClick={() => setSelectedCategory('cleaning')}
                    className={`px-4 py-2 font-medium rounded-t-lg transition ${
                        selectedCategory === 'cleaning'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    🧼 Cleaning Supplies
                </button>
                <button
                    onClick={() => setSelectedCategory('maintenance')}
                    className={`px-4 py-2 font-medium rounded-t-lg transition ${
                        selectedCategory === 'maintenance'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    disabled
                    title="Coming soon"
                >
                    🔧 Maintenance (Coming soon)
                </button>
            </div>

            {/* Low stock alert banner */}
            {lowStockItems.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                        <span className="text-red-600 text-xl">⚠️</span>
                        <div>
                            <p className="font-semibold text-red-800">Low Stock Alert</p>
                            <p className="text-sm text-red-600">
                                {lowStockItems.length} item(s) are below threshold. Please reorder soon.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Supplies table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Item</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Total Items</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Boxes</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Items/Box</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Threshold</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {items.map((item) => {
                                const status = getStockStatus(item)
                                return (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <span>{getItemStatusIcon(item)}</span>
                                                <span className="font-medium text-gray-900">{item.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="font-medium text-gray-900">{Math.floor(item.total_items)}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                            {item.current_boxes.toFixed(1)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                            {item.items_per_box}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                            {item.min_threshold_items}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs rounded-full ${status.color}`}>
                                                {status.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap space-x-2">
                                            <button
                                                onClick={() => setShowAdjustModal(item)}
                                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                            >
                                                Adjust
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    await loadTransactionHistory(item.id)
                                                    setShowHistory(item)
                                                }}
                                                className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                                            >
                                                History
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {items.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            No supplies found. Click "Add Item" to create your first supply.
                        </div>
                    )}
                </div>
            </div>

            {/* Add Item Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
                            <h3 className="text-xl font-semibold text-white">Add Supply Item</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-white text-2xl">&times;</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                                <input
                                    type="text"
                                    value={newItem.name}
                                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., Shampoo, Toilet paper, Trash bags"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Items per Box</label>
                                <input
                                    type="number"
                                    value={newItem.itemsPerBox}
                                    onChange={(e) => setNewItem({ ...newItem, itemsPerBox: parseInt(e.target.value) || 1 })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    min="1"
                                />
                                <p className="text-xs text-gray-400 mt-1">How many individual items in one box?</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Boxes</label>
                                <input
                                    type="number"
                                    value={newItem.initialBoxes}
                                    onChange={(e) => setNewItem({ ...newItem, initialBoxes: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    step="0.5"
                                    min="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold (items)</label>
                                <input
                                    type="number"
                                    value={newItem.minThresholdItems}
                                    onChange={(e) => setNewItem({ ...newItem, minThresholdItems: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    min="0"
                                />
                                <p className="text-xs text-gray-400 mt-1">Alert when total items fall below this number.</p>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateItem}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Create Item
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Adjust Stock Modal */}
            {showAdjustModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex justify-between items-center">
                            <h3 className="text-xl font-semibold text-white">Adjust Stock</h3>
                            <button onClick={() => setShowAdjustModal(null)} className="text-white text-2xl">&times;</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-gray-700">
                                <span className="font-semibold">{showAdjustModal.name}</span><br />
                                Current: {showAdjustModal.current_boxes.toFixed(1)} boxes ({Math.floor(showAdjustModal.total_items)} items)
                            </p>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (boxes)</label>
                                <input
                                    type="number"
                                    value={adjustQuantity}
                                    onChange={(e) => setAdjustQuantity(parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    step="0.5"
                                />
                                <p className="text-xs text-gray-400 mt-1">Positive = Add stock, Negative = Remove stock</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                                <input
                                    type="text"
                                    value={adjustReason}
                                    onChange={(e) => setAdjustReason(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    placeholder="e.g., Delivery, Used for cleaning room 101"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowAdjustModal(null)}
                                    className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAdjustStock}
                                    className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                                >
                                    Update Stock
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Transaction History Modal */}
            {showHistory && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-xl">
                        <div className="bg-gradient-to-r from-gray-700 to-gray-800 px-6 py-4 flex justify-between items-center">
                            <h3 className="text-xl font-semibold text-white">Transaction History: {showHistory.name}</h3>
                            <button onClick={() => setShowHistory(null)} className="text-white text-2xl">&times;</button>
                        </div>
                        <div className="overflow-y-auto p-4">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Quantity (boxes)</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Reason</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Staff</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map(tx => (
                                        <tr key={tx.id}>
                                            <td className="px-4 py-2 text-sm text-gray-600">{new Date(tx.created_at).toLocaleString()}</td>
                                            <td className={`px-4 py-2 text-sm font-medium ${tx.quantity_boxes > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {tx.quantity_boxes > 0 ? `+${tx.quantity_boxes}` : tx.quantity_boxes}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-600">{tx.reason}</td>
                                            <td className="px-4 py-2 text-sm text-gray-600">{tx.staff_name || 'System'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {transactions.length === 0 && (
                                <p className="text-center text-gray-500 py-4">No transactions yet.</p>
                            )}
                        </div>
                        <div className="border-t p-4 bg-gray-50 flex justify-end">
                            <button onClick={() => setShowHistory(null)} className="px-4 py-2 bg-gray-200 rounded-lg">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}