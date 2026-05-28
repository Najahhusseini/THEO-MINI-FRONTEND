'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface ErrorLog {
  id: string;
  severity: string;
  module: string;
  message: string;
  details: any;
  stack: string | null;
  created_at: string;
}

export default function ErrorLogsTab() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('all');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin-staff/error-logs', {
        params: { severity: severityFilter !== 'all' ? severityFilter : undefined, limit: 200 },
      });
      setLogs(res.data.logs);
    } catch (err) {
      toast.error('Failed to load error logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [severityFilter]);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'error': return 'bg-orange-100 text-orange-800';
      case 'warn': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return <div className="p-6 text-center">Loading error logs...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">📋 Error Logs</h2>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="border rounded px-3 py-1"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warn">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No error logs found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Time</th>
                <th className="p-2 text-left">Severity</th>
                <th className="p-2 text-left">Module</th>
                <th className="p-2 text-left">Message</th>
                <th className="p-2 text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="p-2 whitespace-nowrap text-sm">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityBadge(log.severity)}`}>
                      {log.severity.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-2 text-sm">{log.module}</td>
                  <td className="p-2 text-sm max-w-md truncate">{log.message}</td>
                  <td className="p-2 text-sm max-w-md truncate text-gray-500">
                    {log.details ? JSON.stringify(log.details).slice(0, 100) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}