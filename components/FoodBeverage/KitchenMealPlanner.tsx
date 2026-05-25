'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface RoomMealInfo {
  room_number: string;
  guest_name: string;
  meal_plan: string;
  food_requests: string | null;
  food_requests_acknowledged: boolean;
  arrival_date: string;
  departure_date: string;
}

export default function KitchenMealPlanner() {
  const [rooms, setRooms] = useState<RoomMealInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await api.get('/food-beverage/kitchen/meal-plans');
      setRooms(res.data);
    } catch (err) {
      toast.error('Failed to load meal plans');
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeRequest = async (stayId: string) => {
    try {
      await api.post('/food-beverage/kitchen/acknowledge-request', { stayId });
      toast.success('Request acknowledged');
      fetchData();
    } catch (err) {
      toast.error('Failed to acknowledge');
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="p-6 text-center">Loading meal plans...</div>;

  const mealPlanIcon = (plan: string) => {
    switch(plan) {
      case 'breakfast': return '🍳';
      case 'lunch': return '🥗';
      case 'dinner': return '🍽️';
      case 'all_inclusive': return '🍴';
      default: return '❌';
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">🥘 Meal Plans & Food Requests</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <div key={room.room_number} className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xl font-bold">Room {room.room_number}</div>
                <div className="text-gray-600">{room.guest_name}</div>
              </div>
              <div className="text-2xl">{mealPlanIcon(room.meal_plan)}</div>
            </div>
            <div className="mt-2 text-sm">
              <span className="font-semibold">Meal plan:</span> {room.meal_plan.replace('_', ' ')}
            </div>
            {room.food_requests && (
              <div className="mt-2 p-2 bg-yellow-50 rounded">
                <div className="font-semibold text-sm">🍲 Special request:</div>
                <div className="text-sm">{room.food_requests}</div>
                {!room.food_requests_acknowledged && (
                  <button
                    onClick={() => acknowledgeRequest(room.stay_id)}
                    className="mt-2 text-xs bg-blue-600 text-white px-2 py-1 rounded"
                  >
                    Acknowledge
                  </button>
                )}
                {room.food_requests_acknowledged && (
                  <div className="text-xs text-green-600 mt-1">✓ Acknowledged</div>
                )}
              </div>
            )}
            <div className="text-xs text-gray-400 mt-2">
              Stay: {new Date(room.arrival_date).toLocaleDateString()} – {new Date(room.departure_date).toLocaleDateString()}
            </div>
          </div>
        ))}
        {rooms.length === 0 && (
          <div className="col-span-full text-center text-gray-500">No checked‑in guests with meal plans or requests.</div>
        )}
      </div>
    </div>
  );
}