'use client'

import { useState } from 'react'

interface Props {
  notes: string[] | null
  onSave: (notes: string[]) => Promise<void>
}

export default function StickyNoteBadge({ notes, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const activeNotes = (notes || []).filter(n => n.trim())

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    setText(activeNotes.join('\n'))
    setEditing(true)
  }

  const handleSave = async () => {
    const updated = text
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
    await onSave(updated)
    setEditing(false)
    setText('')
  }

  const handleRemove = async (index: number) => {
    const updated = activeNotes.filter((_, i) => i !== index)
    await onSave(updated)
  }

  return (
    <span className="inline-block">
      {/* Trigger icon */}
      <button
        onClick={handleOpen}
        className="text-lg leading-none focus:outline-none hover:scale-110 transition"
        title={activeNotes.length > 0 ? activeNotes.join(' | ') : 'Add note'}
      >
        {activeNotes.length > 0 ? '📝' : '➕'}
      </button>

      {/* Fixed overlay modal */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
          onClick={(e) => e.stopPropagation()}   // prevent card click
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">📝 Sticky Notes</h3>
              <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            {/* Current notes */}
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {activeNotes.length === 0 && (
                <p className="text-sm text-gray-400 italic">No notes yet. Type one below.</p>
              )}
              {activeNotes.map((note, i) => (
                <div key={i} className="flex items-start gap-2 bg-yellow-50 p-3 rounded-lg text-sm">
                  <span className="flex-1 whitespace-pre-wrap break-words">{note}</span>
                  <button
                    onClick={() => handleRemove(i)}
                    className="text-red-400 hover:text-red-600 shrink-0 mt-0.5"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* New note text area */}
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Type a note… (one per line, each line = one note)"
              rows={5}
              className="w-full p-3 border rounded-lg text-sm leading-relaxed resize-y"
              autoFocus
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  )
}