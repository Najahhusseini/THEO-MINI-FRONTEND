'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

interface SupplyItem {
    id: string
    item_name: string
    quantity: number
    unit: string
}

export default function StaffSupplyRequest() {
    const { staff } = useAuth()
    const [itemName, setItemName] = useState('')
    const [quantity, setQuantity] = useState(1)
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [customItem, setCustomItem] = useState(false)
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)

    const commonItems = [
        'Towels', 'Soap', 'Shampoo', 'Conditioner', 'Toilet Paper',
        'Trash Bags', 'Hand Sanitizer', 'Laundry Detergent', 'Bleach',
        'Glass Cleaner', 'Disinfectant Spray', 'Paper Towels', 'Sponges',
        'Rubber Gloves', 'Broom', 'Mop', 'Vacuum Bags'
    ]

    const handleItemNameChange = (value: string) => {
        // Limit item name length
        if (value.length > 100) return
        setItemName(value)
        if (value.length > 1) {
            const filtered = commonItems.filter(item => 
                item.toLowerCase().includes(value.toLowerCase())
            )
            setSuggestions(filtered)
            setShowSuggestions(filtered.length > 0)
        } else {
            setShowSuggestions(false)
        }
    }

    const selectSuggestion = (item: string) => {
        setItemName(item)
        setShowSuggestions(false)
    }

    const handleSubmit = async () => {
        // Validation
        if (!itemName.trim()) {
            toast.error('Please enter an item name')
            return
        }
        if (quantity < 1) {
            toast.error('Quantity must be at least 1')
            return
        }
        if (quantity > 999) {
            toast.error('Quantity cannot exceed 999. For larger orders, please contact management directly.')
            return
        }
        if (notes.length > 500) {
            toast.error('Notes are too long. Please keep under 500 characters.')
            return
        }

        // Prevent double submission
        if (submitting) return

        setSubmitting(true)
        try {
            const token = localStorage.getItem('accessToken')
            
            const response = await fetch('http://localhost:4000/api/cleaning/staff-supply-request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    itemName: itemName.trim(),
                    quantity,
                    notes: notes.trim() || null
                })
            })

            if (response.ok) {
                toast.success(`Supply request sent for ${quantity} x ${itemName}`)
                // Reset form
                setItemName('')
                setQuantity(1)
                setNotes('')
                setCustomItem(false)
                setSuggestions([])
                setShowSuggestions(false)
            } else {
                const error = await response.json()
                toast.error(error.error || 'Failed to send request')
            }
        } catch (error) {
            console.error('Error requesting supplies:', error)
            toast.error('Network error – could not send supply request')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-4">
                    <h2 className="text-2xl font-bold text-white">📦 Request Supplies</h2>
                    <p className="text-yellow-100 text-sm">Request cleaning supplies from Head of Housekeeping</p>
                </div>

                <div className="p-6 space-y-6">
                    {/* Info box */}
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">💡</span>
                            <div>
                                <p className="text-sm text-blue-800 font-medium">Need supplies for your cleaning tasks?</p>
                                <p className="text-xs text-blue-600 mt-1">
                                    Submit a request below. Head of Housekeeping will review and approve.
                                    Once approved, supplies will be deducted from inventory.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Supply Request Form */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Item Name *
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={itemName}
                                    onChange={(e) => handleItemNameChange(e.target.value)}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                                    placeholder="e.g., Towels, Soap, Trash Bags"
                                    autoComplete="off"
                                    maxLength={100}
                                    disabled={submitting}
                                />
                                {showSuggestions && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {suggestions.map(item => (
                                            <button
                                                key={item}
                                                onClick={() => selectSuggestion(item)}
                                                className="w-full text-left px-4 py-2 hover:bg-gray-100 transition"
                                                disabled={submitting}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Common items: Towels, Soap, Shampoo, Toilet Paper, Trash Bags
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Quantity *
                            </label>
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(Math.max(1, Math.min(999, parseInt(e.target.value) || 1)))}
                                min="1"
                                max="999"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
                                disabled={submitting}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Enter quantity (max 999). For larger orders, contact management directly.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Notes (optional)
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                                rows={3}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
                                placeholder="e.g., Urgent need, specific brand, location, etc."
                                maxLength={500}
                                disabled={submitting}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                {notes.length}/500 characters
                            </p>
                        </div>

                        {/* Recent Requests Info */}
                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-600">
                                ⏱️ Requests are reviewed by Head of Housekeeping. You'll be notified when approved or denied.
                            </p>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={submitting || !itemName.trim()}
                            className={`w-full py-3 rounded-lg transition font-medium ${
                                submitting || !itemName.trim()
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-yellow-600 text-white hover:bg-yellow-700'
                            }`}
                        >
                            {submitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Sending...
                                </span>
                            ) : (
                                '📤 Submit Supply Request'
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Tips */}
            <div className="mt-6 bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold text-gray-800 mb-2">📋 Quick Tips</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Be specific about the item name for faster processing</li>
                    <li>• Include quantity needed for your cleaning tasks</li>
                    <li>• Add notes if you need items urgently</li>
                    <li>• Check inventory levels in the Supply Requests tab (Head of Housekeeping only)</li>
                </ul>
            </div>
        </div>
    )
}