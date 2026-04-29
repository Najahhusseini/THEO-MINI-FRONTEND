'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface DailyStats {
    arrivals: number;
    departures: number;
    dirty: number;
    ready: number;
}

export default function DailySummary() {
    const { staff } = useAuth();
    const [stats, setStats] = useState<DailyStats>({ arrivals: 0, departures: 0, dirty: 0, ready: 0 });
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [manualRefresh, setManualRefresh] = useState(0);

    const fetchStats = async () => {
        if (!staff) return;
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch('http://localhost:4000/api/cleaning/daily-stats', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                setStats(data);
                setLastUpdated(new Date());
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to load daily stats');
            }
        } catch (error) {
            console.error('Error fetching daily stats:', error);
            toast.error('Network error – could not load daily stats');
        } finally {
            setLoading(false);
        }
    };

    const handleManualRefresh = () => {
        setManualRefresh(prev => prev + 1);
        fetchStats();
        toast.success('Refreshing data...');
    };

    useEffect(() => {
        fetchStats();
        // Poll every 30 seconds (reduced from 10s)
        const interval = setInterval(fetchStats, 30000);
        
        // Listen for manual refresh events from other components
        const handleRefresh = () => {
            console.log('🔄 refresh-daily-stats event received, fetching...');
            fetchStats();
        };
        window.addEventListener('refresh-daily-stats', handleRefresh);
        
        return () => {
            clearInterval(interval);
            window.removeEventListener('refresh-daily-stats', handleRefresh);
        };
    }, [staff]);

    if (loading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-gray-100 rounded-lg p-4 animate-pulse">
                        <div className="h-8 bg-gray-200 rounded mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded"></div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200 hover:shadow-md transition">
                    <div className="text-3xl font-bold text-green-700">{stats.arrivals}</div>
                    <div className="text-sm text-green-600 font-medium">Arrivals Today</div>
                    <div className="text-xs text-green-500 mt-1">🚪 Check-ins</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center border border-red-200 hover:shadow-md transition">
                    <div className="text-3xl font-bold text-red-700">{stats.departures}</div>
                    <div className="text-sm text-red-600 font-medium">Departures Today</div>
                    <div className="text-xs text-red-500 mt-1">🚪 Check-outs</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4 text-center border border-yellow-200 hover:shadow-md transition">
                    <div className="text-3xl font-bold text-yellow-700">{stats.dirty}</div>
                    <div className="text-sm text-yellow-600 font-medium">Dirty Rooms</div>
                    <div className="text-xs text-yellow-500 mt-1">🧹 Need Cleaning</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200 hover:shadow-md transition">
                    <div className="text-3xl font-bold text-blue-700">{stats.ready}</div>
                    <div className="text-sm text-blue-600 font-medium">Ready for Inspection</div>
                    <div className="text-xs text-blue-500 mt-1">✅ Awaiting Review</div>
                </div>
            </div>

            {/* Footer with refresh button and timestamp */}
            <div className="flex justify-between items-center text-xs text-gray-400">
                <div>
                    {lastUpdated && (
                        <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
                    )}
                </div>
                <button
                    onClick={handleManualRefresh}
                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition text-gray-600"
                    title="Refresh stats"
                >
                    🔄 Refresh
                </button>
            </div>
        </div>
    );
}