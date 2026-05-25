'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import OrderModal from './OrderModal';
import toast from 'react-hot-toast';

interface Order {
  id: string;
  order_type: string;
  status: string;
  room_number: string;
  total_amount: number;
  created_at: string;
}

export default function RestaurantTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('all');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/food-beverage/orders', { params: { status: filter !== 'all' ? filter : undefined } });
      setOrders(res.data);
    } catch (err) {
      toast.error('Failed to load orders');
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
      toast.error('Failed to update');
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">🍽️ Restaurant Orders</h2>
        <div className="flex gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border rounded px-3 py-1">
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700">
            + New Order
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No orders found.</div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(order.created_at).toLocaleTimeString()}</td>
                  <td className="px-6 py-4 text-sm">Room {order.room_number}</td>
                  <td className="px-6 py-4 text-sm font-semibold">${Number(order.total_amount).toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      order.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>{order.status}</span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {order.status === 'pending' && (
                      <button onClick={() => updateStatus(order.id, 'in_progress')} className="text-blue-600 hover:underline">Start</button>
                    )}
                    {order.status === 'in_progress' && (
                      <button onClick={() => updateStatus(order.id, 'completed')} className="text-green-600 hover:underline">Complete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <OrderModal type="restaurant" onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); fetchOrders(); }} />}
    </div>
  );
}