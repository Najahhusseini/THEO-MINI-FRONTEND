'use client'

interface TabBarProps {
  tabs: { id: string; label: string; icon: string; roles?: string[] }[]
  activeTab: string
  onTabChange: (tabId: string) => void
  userRole: string
}

export default function TabBar({ tabs, activeTab, onTabChange, userRole }: TabBarProps) {
  const visibleTabs = tabs.filter(tab => 
    !tab.roles || tab.roles.includes(userRole)
  )

  return (
    <div className="border-b border-gray-200 mb-6 overflow-x-auto">
      <nav className="flex space-x-2 sm:space-x-4 min-w-max">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all
              ${activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300'
              }
            `}
          >
            <span className="text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}