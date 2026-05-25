'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import OrderModal from './OrderModal';
import toast from 'react-hot-toast';

export default function WaiterOrderPanel() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/food-beverage/my-orders', { params: { type: 'restaurant' } });
      setOrders(res.data);
    } catch (err) {
      toast.error('Failed to load your orders');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/food-beverage/orders/${id}/status`, { status });
      toast.success(`Order ${status}`);
      fetchOrders();
    } catch (err) {
      toast.error('Update failed');
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="p-6 text-center">Loading your orders...</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">🍽️ My Waiter Orders</h2>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded">+ New Order</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {orders.map((order: any) => (
          <div key={order.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between">
              <span className="font-bold">#{order.id.slice(0,8)}</span>
              <span className={`px-2 py-1 text-xs rounded-full ${
                order.status === 'pending' ? 'bg-yellow-100' : order.status === 'in_progress' ? 'bg-blue-100' : 'bg-green-100'
              }`}>{order.status}</span>
            </div>
            <div>Room {order.room_number}</div>
            <div>Total: ${Number(order.total_amount).toFixed(2)}</div>
            {order.status === 'in_progress' && (
              <button onClick={() => updateStatus(order.id, 'completed')} className="mt-2 bg-green-600 text-white px-3 py-1 rounded text-sm">Mark Completed</button>
            )}
          </div>
        ))}
        {orders.length === 0 && <div className="text-gray-500">No orders assigned to you.</div>}
      </div>
      {showModal && <OrderModal type="restaurant" onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); fetchOrders(); }} />}
    </div>
  );
}