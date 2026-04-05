'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

interface KeyboardShortcutsProps {
  onStatusChange: (status: string) => void
  enabled?: boolean
}

export function KeyboardShortcuts({ onStatusChange, enabled = true }: KeyboardShortcutsProps) {
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    if (!enabled) return

    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Status shortcuts
      switch (e.key) {
        case '1':
          onStatusChange('dirty')
          toast.success('Shortcut: Marked as Dirty', { icon: '🔴', duration: 1500 })
          break
        case '2':
          onStatusChange('cleaning')
          toast.success('Shortcut: Marked as Cleaning', { icon: '🟡', duration: 1500 })
          break
        case '3':
          onStatusChange('ready')
          toast.success('Shortcut: Marked as Ready', { icon: '🟢', duration: 1500 })
          break
        case '4':
          onStatusChange('inspected')
          toast.success('Shortcut: Marked as Inspected', { icon: '🔵', duration: 1500 })
          break
        case '?':
        case '/':
          setShowHelp(true)
          break
        case 'Escape':
          setShowHelp(false)
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [enabled, onStatusChange])

  return (
    <>
      {/* Help button */}
      <button
        onClick={() => setShowHelp(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg hover:bg-gray-700 transition z-20"
        title="Keyboard Shortcuts (Press ?)"
      >
        <span className="text-lg font-bold">?</span>
      </button>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Keyboard Shortcuts</h3>
                <button
                  onClick={() => setShowHelp(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="border-b pb-2">
                  <p className="text-sm font-medium text-gray-500 mb-2">Room Status Shortcuts</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Mark as Dirty</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">1</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Mark as Cleaning</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">2</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Mark as Ready</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">3</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Mark as Inspected</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">4</kbd>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Other Shortcuts</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Show this menu</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">?</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Close this menu</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">ESC</kbd>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t text-xs text-gray-400">
                  Note: Shortcuts work when no input field is focused
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}