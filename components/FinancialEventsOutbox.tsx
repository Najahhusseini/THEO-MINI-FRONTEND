'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface FinancialEvent {
  id: string;
  event_type: string;
  status: 'pending' | 'delivered' | 'failed';
  payload: any;
  error_message?: string;
  created_at: string;
}

export default function FinancialEventsOutbox() {
  const [events, setEvents] = useState<FinancialEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = filter ? { status: filter } : {};
      const res = await api.get('/admin/financial-events', { params });
      setEvents(res.data.events || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load financial events');
    } finally {
      setLoading(false);
    }
  };

  const retryEvent = async (id: string) => {
    try {
      await api.post(`/admin/financial-events/${id}/retry`);
      toast.success('Event retry requested');
      fetchEvents(); // refresh list
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Retry failed');
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [filter]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading financial events...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-light text-gray-800">💰 Financial Events Outbox</h1>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1 border rounded-full text-sm bg-white shadow-sm"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {events.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow-sm">
            No financial events found.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payload Preview</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {event.created_at ? new Date(event.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{event.event_type}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          event.status === 'delivered'
                            ? 'bg-green-100 text-green-800'
                            : event.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {event.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        <code className="text-xs">{JSON.stringify(event.payload).slice(0, 80)}...</code>
                      </td>
                      <td className="px-6 py-4 text-sm text-red-600 max-w-xs truncate">
                        {event.error_message || '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {event.status === 'failed' && (
                          <button
                            onClick={() => retryEvent(event.id)}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}