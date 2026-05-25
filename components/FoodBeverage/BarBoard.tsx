'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function BarBoard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/food-beverage/bar/orders');
      setOrders(res.data);
    } catch (err) {
      toast.error('Failed to load bar orders');
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
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="p-6 text-center">Loading bar orders...</div>;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">🍸 Bar Board</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {orders.map((order: any) => (
          <div key={order.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-amber-500">
            <div className="flex justify-between">
              <span className="font-bold">Order #{order.id.slice(0,8)}</span>
              <span className={`px-2 py-1 text-xs rounded-full ${
                order.status === 'pending' ? 'bg-yellow-100' : order.status === 'in_progress' ? 'bg-blue-100' : 'bg-green-100'
              }`}>{order.status}</span>
            </div>
            <div>Room: {order.room_number || '—'}</div>
            <div>Total: ${Number(order.total_amount).toFixed(2)}</div>
            <div className="mt-3 flex gap-2">
              {order.status === 'pending' && (
                <button onClick={() => updateStatus(order.id, 'in_progress')} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Start</button>
              )}
              {order.status === 'in_progress' && (
                <button onClick={() => updateStatus(order.id, 'completed')} className="bg-green-600 text-white px-3 py-1 rounded text-sm">Complete</button>
              )}
            </div>
          </div>
        ))}
        {orders.length === 0 && <div className="col-span-full text-center text-gray-500">No pending bar orders</div>}
      </div>
    </div>
  );
}