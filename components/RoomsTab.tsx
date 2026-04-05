'use client'

import { Room } from '@/types'

interface RoomsTabProps {
  rooms: Room[]
  loading: boolean
  selectedFloor: number
  statusFilter: 'all' | 'dirty' | 'cleaning' | 'ready' | 'inspected'
  roomSearch: string
  selectedRoomId: string | null
  availableFloors: number[]
  floorStats: { total: number; dirty: number; cleaning: number; ready: number; inspected: number }
  onFloorChange: (floor: number) => void
  onStatusFilterChange: (filter: 'all' | 'dirty' | 'cleaning' | 'ready' | 'inspected') => void
  onRoomSearchChange: (search: string) => void
  onRoomSelect: (roomId: string | null) => void
  onStatusChange: (roomId: string, newStatus: Room['status']) => void
  onClearFilters: () => void
}

const statusColors = {
  dirty: 'bg-red-100 text-red-800 border-red-200',
  cleaning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ready: 'bg-green-100 text-green-800 border-green-200',
  inspected: 'bg-blue-100 text-blue-800 border-blue-200',
}

const statusLabels = {
  dirty: 'Dirty',
  cleaning: 'Cleaning',
  ready: 'Ready',
  inspected: 'Inspected',
}

const roleColors: { [key: string]: string } = {
  admin: 'bg-purple-100 text-purple-800',
  manager: 'bg-indigo-100 text-indigo-800',
  frontdesk: 'bg-cyan-100 text-cyan-800',
  housekeeping: 'bg-emerald-100 text-emerald-800',
  maintenance: 'bg-orange-100 text-orange-800',
  auto: 'bg-gray-100 text-gray-600',
}

const getInitial = (name: string) => name.charAt(0).toUpperCase()

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000)
  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} min ago`
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours ago`
  return date.toLocaleDateString()
}

export default function RoomsTab({
  rooms,
  loading,
  selectedFloor,
  statusFilter,
  roomSearch,
  selectedRoomId,
  availableFloors,
  floorStats,
  onFloorChange,
  onStatusFilterChange,
  onRoomSearchChange,
  onRoomSelect,
  onStatusChange,
  onClearFilters,
}: RoomsTabProps) {
  // Filter rooms for current floor and search
  const roomsByFloor = rooms.reduce((acc: { [key: number]: Room[] }, room) => {
    const floor = room.floor || 1
    if (!acc[floor]) acc[floor] = []
    acc[floor].push(room)
    return acc
  }, {})

  let currentFloorRooms = roomsByFloor[selectedFloor] || []
  if (statusFilter !== 'all') {
    currentFloorRooms = currentFloorRooms.filter(room => room.status === statusFilter)
  }
  if (roomSearch.trim() !== '') {
    currentFloorRooms = currentFloorRooms.filter(room =>
      room.roomNumber.toLowerCase().includes(roomSearch.toLowerCase())
    )
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1,2,3,4,5,6,7,8].map(i => <RoomCardSkeleton key={i} />)}
      </div>
    )
  }

  return (
    <div>
      {/* Floor navigation tabs */}
      <div className="border-b border-gray-200 overflow-x-auto mb-4">
        <nav className="flex flex-nowrap gap-1 sm:gap-2 -mb-px min-w-max">
          {availableFloors.map(floor => (
            <button
              key={floor}
              onClick={() => onFloorChange(floor)}
              className={`px-4 sm:px-6 py-2.5 text-sm font-medium rounded-t-lg transition touch-manipulation ${
                selectedFloor === floor
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Floor {floor} <span className="ml-1 text-xs">({roomsByFloor[floor]?.length || 0})</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <input
          type="text"
          placeholder="Search room number..."
          value={roomSearch}
          onChange={(e) => onRoomSearchChange(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
        />
        {roomSearch && (
          <button
            onClick={() => onRoomSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            ✕
          </button>
        )}
      </div>

      {/* Stats filter buttons */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {(['all', 'dirty', 'cleaning', 'ready', 'inspected'] as const).map(filter => (
          <button
            key={filter}
            onClick={() => onStatusFilterChange(filter)}
            className={`rounded-lg p-2 text-center transition touch-manipulation ${
              statusFilter === filter
                ? 'bg-gray-800 text-white ring-2 ring-gray-800'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            <div className="text-xl font-bold">
              {filter === 'all' ? floorStats.total : floorStats[filter]}
            </div>
            <div className="text-xs">{filter === 'all' ? 'Total' : statusLabels[filter]}</div>
          </button>
        ))}
      </div>

      {(statusFilter !== 'all' || roomSearch) && (
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-600">Filtered results</span>
          <button onClick={onClearFilters} className="text-sm text-blue-600">Clear all ✕</button>
        </div>
      )}

      {/* Rooms grid */}
      {currentFloorRooms.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {currentFloorRooms.map(room => (
            <div
              key={room.id}
              onClick={() => onRoomSelect(room.id)}
              className={`bg-white rounded-lg shadow-md border overflow-hidden hover:shadow-lg transition cursor-pointer ${
                selectedRoomId === room.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''
              }`}
            >
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-lg font-bold">Room {room.roomNumber}</h3>
                    <p className="text-xs text-gray-500">{room.roomType}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[room.status]}`}>
                    {statusLabels[room.status]}
                  </span>
                </div>

                <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${roleColors[room.lastUpdatedRole] || 'bg-gray-200'}`}>
                      {getInitial(room.lastUpdatedBy)}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium">Updated by {room.lastUpdatedBy}</p>
                      <p className="text-xs text-gray-400">{formatRelativeTime(room.lastUpdatedAt)}</p>
                    </div>
                    <span className="text-xs px-1 py-0.5 rounded bg-gray-100">{room.lastUpdatedRole}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  {(['dirty', 'cleaning', 'ready', 'inspected'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => onStatusChange(room.id, status)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                        room.status === status
                          ? 'bg-gray-800 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {statusLabels[status]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-500">No rooms match your filters.</p>
          <button onClick={onClearFilters} className="mt-2 text-blue-600">Clear filters</button>
        </div>
      )}
    </div>
  )
}

// Skeleton component for loading
function RoomCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md border overflow-hidden animate-pulse">
      <div className="p-4 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    </div>
  )
}