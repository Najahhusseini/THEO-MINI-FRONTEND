export function RoomCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md border overflow-hidden animate-pulse">
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="h-5 bg-gray-200 rounded w-20 mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-16"></div>
          </div>
          <div className="h-5 bg-gray-200 rounded-full w-16"></div>
        </div>
        
        <div className="mb-3 p-2 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-3 bg-gray-200 rounded w-24 mb-1"></div>
              <div className="h-2 bg-gray-200 rounded w-16"></div>
            </div>
            <div className="h-4 bg-gray-200 rounded w-12"></div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-2">
          <div className="h-6 bg-gray-200 rounded w-12"></div>
          <div className="h-6 bg-gray-200 rounded w-12"></div>
          <div className="h-6 bg-gray-200 rounded w-12"></div>
          <div className="h-6 bg-gray-200 rounded w-12"></div>
        </div>
      </div>
    </div>
  )
}

export function AttendanceCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
      <div className="flex justify-between items-center mb-4">
        <div className="h-6 bg-gray-200 rounded w-24"></div>
        <div className="h-5 bg-gray-200 rounded-full w-20"></div>
      </div>
      <div className="space-y-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="h-3 bg-gray-200 rounded w-20 mb-1"></div>
          <div className="h-5 bg-gray-200 rounded w-24"></div>
        </div>
        <div className="h-10 bg-gray-200 rounded w-full"></div>
      </div>
    </div>
  )
}

export function StatsCardSkeleton() {
  return (
    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-md p-6 animate-pulse">
      <div className="h-5 bg-white/30 rounded w-32 mb-3"></div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="h-7 bg-white/30 rounded w-12 mb-1"></div>
          <div className="h-3 bg-white/30 rounded w-16"></div>
        </div>
        <div>
          <div className="h-7 bg-white/30 rounded w-12 mb-1"></div>
          <div className="h-3 bg-white/30 rounded w-16"></div>
        </div>
        <div>
          <div className="h-7 bg-white/30 rounded w-12 mb-1"></div>
          <div className="h-3 bg-white/30 rounded w-16"></div>
        </div>
        <div>
          <div className="h-7 bg-white/30 rounded w-12 mb-1"></div>
          <div className="h-3 bg-white/30 rounded w-16"></div>
        </div>
      </div>
    </div>
  )
}

export function StaffTableSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
      <div className="px-6 py-4 border-b bg-gray-50">
        <div className="flex justify-between items-center">
          <div className="h-5 bg-gray-200 rounded w-48"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
        </div>
      </div>
      <div className="p-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
              <div className="h-3 bg-gray-200 rounded w-48"></div>
            </div>
            <div className="h-5 bg-gray-200 rounded-full w-20"></div>
            <div className="h-4 bg-gray-200 rounded w-24"></div>
          </div>
        ))}
      </div>
    </div>
  )
}