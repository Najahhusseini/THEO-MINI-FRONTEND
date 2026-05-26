'use client';

import { useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useDebouncedClick } from '@/hooks/useDebouncedClick';

interface OrderModalProps {
  type: 'restaurant' | 'bar';
  onClose: () => void;
  onSuccess: () => void;
}

export default function OrderModal({ type, onClose, onSuccess }: OrderModalProps) {
  const [roomNumber, setRoomNumber] = useState('');
  const [items, setItems] = useState([{ name: '', quantity: 1, unitPrice: 0 }]);
  const [loading, setLoading] = useState(false);

  const addItem = () => setItems([...items, { name: '', quantity: 1, unitPrice: 0 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[idx][field] = value;
    setItems(newItems);
  };

  const submit = async () => {
    const validItems = items.filter(i => i.name.trim() && i.quantity > 0 && i.unitPrice > 0);
    if (!roomNumber.trim()) {
      toast.error('Room number is required');
      return;
    }
    if (validItems.length === 0) {
      toast.error('Add at least one valid item');
      return;
    }

    setLoading(true);
    try {
      await api.post('/food-beverage/orders', {
        type,
        roomNumber,
        items: validItems,
      });
      toast.success('Order created');
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const debouncedSubmit = useDebouncedClick(submit, 1000);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
        <div className={`px-6 py-4 ${type === 'restaurant' ? 'bg-green-600' : 'bg-amber-600'} text-white`}>
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold">New {type === 'restaurant' ? 'Restaurant' : 'Bar'} Order</h3>
            <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">&times;</button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
            <input
              type="text"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="e.g., 101"
              className="w-full p-2 border rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Order Items</label>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  placeholder="Item name"
                  value={item.name}
                  onChange={(e) => updateItem(idx, 'name', e.target.value)}
                  className="flex-1 p-2 border rounded-lg"
                />
                <input
                  type="number"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                  className="w-20 p-2 border rounded-lg"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Price"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                  className="w-28 p-2 border rounded-lg"
                />
                {items.length > 1 && (
                  <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700">✕</button>
                )}
              </div>
            ))}
            <button onClick={addItem} className="text-blue-600 text-sm hover:underline">+ Add item</button>
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={debouncedSubmit} disabled={loading} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}