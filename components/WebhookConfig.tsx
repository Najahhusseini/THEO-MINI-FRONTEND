'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function WebhookConfig() {
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [retryCount, setRetryCount] = useState(3);
  const [retryDelay, setRetryDelay] = useState(60);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const fetchConfig = async () => {
    const res = await api.get('/admin/webhook');
    const cfg = res.data;
    if (cfg && cfg.url) {
      setUrl(cfg.url);
      setSecret(cfg.secret || '');
      setEnabled(cfg.enabled);
      setRetryCount(cfg.retry_count || 3);
      setRetryDelay(cfg.retry_delay_seconds || 60);
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      await api.post('/admin/webhook', { url, secret, enabled, retry_count: retryCount, retry_delay_seconds: retryDelay });
      toast.success('Webhook configuration saved');
    } catch (err) {
      toast.error('Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const testWebhook = async () => {
    setTesting(true);
    try {
      const res = await api.post('/admin/webhook/test');
      if (res.data.sent) {
        toast.success('Test webhook sent successfully!');
      } else {
        toast.error(`Test failed: ${res.data.error || 'Unknown error'}`);
      }
    } catch (err) {
      toast.error('Test request failed');
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">📡 Financial Webhook</h2>
      <p className="text-gray-500 mb-6">Configure the endpoint where closed folios will be sent.</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Webhook URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-accounting-system.com/webhook"
            className="w-full border rounded-lg p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Secret (optional)</label>
          <input
            type="text"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Used for HMAC signature"
            className="w-full border rounded-lg p-2"
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Enabled
          </label>
          <div>
            <label className="block text-sm">Retry attempts</label>
            <input type="number" value={retryCount} onChange={(e) => setRetryCount(Number(e.target.value))} className="border rounded p-1 w-20" />
          </div>
          <div>
            <label className="block text-sm">Retry delay (seconds)</label>
            <input type="number" value={retryDelay} onChange={(e) => setRetryDelay(Number(e.target.value))} className="border rounded p-1 w-24" />
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button onClick={saveConfig} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            {loading ? 'Saving...' : 'Save Configuration'}
          </button>
          <button onClick={testWebhook} disabled={testing || !url} className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-50">
            {testing ? 'Sending...' : 'Send Test'}
          </button>
        </div>
      </div>
    </div>
  );
}