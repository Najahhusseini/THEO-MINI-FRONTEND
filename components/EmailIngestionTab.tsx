'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  getEmails,
  updateEmailParsedData,
  processEmail,
  getStays,
  sendDraftEmail,
  createDraftEmail,
  getReservations
} from '@/lib/api'
import api from '@/lib/api'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import ReservationTapeChart from '@/components/ReservationTapeChart'

interface Email {
  id: string
  sender: string
  subject: string
  body: string
  parsed_data: any
  confidence_score: number
  status: string
  created_at: string
  reservation_id?: string
}

export default function EmailIngestionTab() {
  const { staff } = useAuth()
  const [emails, setEmails] = useState<Email[]>([])
  const [drafts, setDrafts] = useState<Email[]>([])
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editedData, setEditedData] = useState<any>({})
  const [creating, setCreating] = useState(false)
  const [activeList, setActiveList] = useState<'pending' | 'drafts'>('pending')

  const [availableRooms, setAvailableRooms] = useState<any[]>([])
  const [selectedRoomNumber, setSelectedRoomNumber] = useState('')
  const [currentReservationId, setCurrentReservationId] = useState<string | null>(null)
  const [assignedRoom, setAssignedRoom] = useState<string | null>(null)

  const isAdmin = staff?.role === 'admin' || staff?.role === 'manager' || staff?.role === 'reservation_manager'

  const fetchEmails = async () => {
    try {
      const data = await getEmails('pending')
      setEmails(data)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load emails')
    } finally {
      setLoading(false)
    }
  }

  const fetchDrafts = async () => {
    try {
      const data = await getEmails('draft')
      setDrafts(data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      fetchEmails()
      fetchDrafts()
    }
  }, [isAdmin])

  useEffect(() => {
    if (!selectedEmail) return
    const resId = selectedEmail.reservation_id
    setCurrentReservationId(resId || null)
    if (resId) {
      getStays().then(stays => {
        const stay = stays.find((s: any) => s.reservation_id === resId)
        setAssignedRoom(stay ? stay.room_number : null)
        setSelectedRoomNumber(stay ? stay.room_number : '')
      }).catch(console.error)
    } else {
      setAssignedRoom(null)
      setSelectedRoomNumber('')
    }
  }, [selectedEmail])

  const fetchAvailableRooms = async (arrival: string, departure: string) => {
    try {
      const res = await api.get('/rooms/available', { params: { arrival, departure } })
      setAvailableRooms(res.data)
    } catch (err) {
      toast.error('Failed to load available rooms')
    }
  }

  useEffect(() => {
    if (editing && editedData.arrival_date && editedData.departure_date) {
      fetchAvailableRooms(editedData.arrival_date, editedData.departure_date)
    }
  }, [editing, editedData.arrival_date, editedData.departure_date])

  const handleSelectEmail = (email: Email) => {
    setSelectedEmail(email)
    const parsed = email.parsed_data || {}
    setEditedData({
      ...parsed,
      arrival_date: parsed.arrival_date ? new Date(parsed.arrival_date).toISOString().split('T')[0] : '',
      departure_date: parsed.departure_date ? new Date(parsed.departure_date).toISOString().split('T')[0] : ''
    })
    setEditing(false)
  }

  const handleEditField = (field: string, value: any) => {
    setEditedData({ ...editedData, [field]: value })
  }

  const saveParsedData = async () => {
    if (!selectedEmail) return
    try {
      await updateEmailParsedData(selectedEmail.id, editedData)
      toast.success('Parsed data updated')
      setEditing(false)
      fetchEmails()
    } catch (err) {
      toast.error('Failed to save')
    }
  }

  const extractEmailAddress = (sender: string) => {
    const match = sender.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    return match ? match[0] : ''
  }

  const extractSenderName = (sender: string) => {
    const match = sender.match(/^"?([a-zA-Z\s]+)"?\s*</)
    return match ? match[1].trim() : sender.split('@')[0]
  }

  // ✨ Updated: creates reservation AND a confirmation draft email
  const createDraftReservation = async () => {
    if (!selectedEmail) return
    const arrivalDate = editedData.arrival_date || ''
    const departureDate = editedData.departure_date || ''
    const guestName = editedData.guest_name || extractSenderName(selectedEmail.sender)
    const guestEmail = extractEmailAddress(selectedEmail.sender)
    const reservationData = {
      guest_name: guestName,
      guest_email: guestEmail,
      arrival_date: arrivalDate,
      departure_date: departureDate,
      room_type: 'Standard',
      number_of_guests: 1,
      number_of_rooms: editedData.number_of_rooms || 1,
      special_requests: '',
      status: 'pending_review'
    }
    if (!arrivalDate || !departureDate) {
      toast.error('Please set arrival and departure dates first')
      return
    }
    setCreating(true)
    try {
      const result = await processEmail(selectedEmail.id, true, reservationData)
      toast.success(`Draft reservation created for ${result.guest_name}`)

      // Auto‑generate confirmation draft
      if (result && result.id) {
        const confirmMessage = `Dear ${guestName},\n\n`
          + `🎉 We are thrilled to confirm your reservation at THEO Hotel!\n\n`
          + `Your stay: ${arrivalDate} to ${departureDate}\n`
          + `Room type: Standard\n`
          + `Number of rooms: ${editedData.number_of_rooms || 1}\n`
          + `Guests: 1\n`
          + `\nWe look forward to welcoming you. Should you have any questions, please reply to this email.\n\n`
          + `Warm regards,\nTHEO Hotel Team`

        await createDraftEmail(result.id, confirmMessage)
        toast.success('Confirmation draft created! Check Drafts.')
        fetchDrafts()
      }

      // Refresh emails to get updated reservation_id
      await fetchEmails()
      const updatedEmails = await getEmails('pending')
      const updatedEmail = updatedEmails.find((e: Email) => e.id === selectedEmail.id)
      if (updatedEmail) {
        setSelectedEmail(updatedEmail)
      }
    } catch (err) {
      toast.error('Failed to create reservation')
    } finally {
      setCreating(false)
    }
  }

  const ignoreEmail = async () => {
    if (!selectedEmail) return
    try {
      await processEmail(selectedEmail.id, false)
      toast.success('Email marked as processed')
      fetchEmails()
      setSelectedEmail(null)
    } catch (err) {
      toast.error('Failed to ignore email')
    }
  }

  const handleAssignRoom = async (roomNumber: string) => {
    if (!currentReservationId || !roomNumber) return
    setSelectedRoomNumber(roomNumber)
    try {
      await api.post(`/reservations/${currentReservationId}/assign-room`, { roomNumber })
      toast.success(`Room ${roomNumber} assigned`)
      setAssignedRoom(roomNumber)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Assignment failed')
      setSelectedRoomNumber(assignedRoom || '')
    }
  }

  const handleSendDraft = async (emailId: string) => {
    try {
      await sendDraftEmail(emailId)
      toast.success('Email sent!')
      fetchDrafts()
      if (selectedEmail?.id === emailId) setSelectedEmail(null)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send')
    }
  }

  const handleGenerateConfirmationEmail = async () => {
    if (!currentReservationId) return
    try {
      const reservations = await getReservations({})
      const reservation = reservations.find((r: any) => r.id === currentReservationId)
      if (!reservation) {
        toast.error('Reservation not found')
        return
      }

      const arrival = reservation.arrival_date.split('T')[0]
      const departure = reservation.departure_date.split('T')[0]
      const roomType = reservation.room_type || 'Standard'
      const guestName = reservation.guest_name
      const rooms = reservation.number_of_rooms || 1
      const guests = reservation.number_of_guests || 1

      const message = `Dear ${guestName},\n\n`
        + `🎉 We are delighted to confirm your reservation at THEO Hotel!\n\n`
        + `Your stay: ${arrival} to ${departure}\n`
        + `Room type: ${roomType}\n`
        + `Number of rooms: ${rooms}\n`
        + `Guests: ${guests}\n`
        + (reservation.special_requests ? `Special requests: ${reservation.special_requests}\n` : '')
        + `\nWe look forward to welcoming you. Should you have any questions, feel free to reply to this email.\n\n`
        + `Warm regards,\nTHEO Hotel Team`

      await createDraftEmail(currentReservationId, message)
      toast.success('Confirmation draft created! Check Drafts.')
      fetchDrafts()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to generate confirmation')
    }
  }

  const formatConfidence = (score: number) => {
    const percent = Math.round(score * 100)
    const color = percent >= 80 ? 'bg-green-100 text-green-800' : percent >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
    return <span className={`px-2 py-0.5 rounded-full text-xs ${color}`}>{percent}%</span>
  }

  if (!isAdmin) return <div className="text-center py-12">You don't have permission to access this page.</div>
  if (loading) return <div className="text-center py-12">Loading emails...</div>

  const listToShow = activeList === 'pending' ? emails : drafts

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-6">
        <div className="w-1/3 bg-white rounded-lg shadow overflow-y-auto max-h-[80vh]">
          <div className="flex border-b">
            <button
              onClick={() => { setActiveList('pending'); setSelectedEmail(null) }}
              className={`flex-1 px-4 py-2 font-semibold text-sm ${activeList === 'pending' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
            >
              📧 Pending ({emails.length})
            </button>
            <button
              onClick={() => { setActiveList('drafts'); setSelectedEmail(null) }}
              className={`flex-1 px-4 py-2 font-semibold text-sm ${activeList === 'drafts' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
            >
              ✏️ Drafts ({drafts.length})
            </button>
          </div>
          {listToShow.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {activeList === 'pending' ? 'No pending emails.' : 'No drafts.'}
            </div>
          ) : (
            listToShow.map(email => (
              <div
                key={email.id}
                onClick={() => handleSelectEmail(email)}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition ${selectedEmail?.id === email.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
              >
                <div className="font-medium truncate">{email.subject}</div>
                <div className="text-sm text-gray-600 truncate">{email.sender}</div>
                <div className="flex justify-between items-center mt-1">
                  <div className="text-xs text-gray-400">{format(parseISO(email.created_at), 'MMM d, h:mm a')}</div>
                  {email.status === 'draft' ? (
                    <span className="text-xs text-purple-600">Draft</span>
                  ) : (
                    formatConfidence(email.confidence_score)
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="w-2/3 bg-white rounded-lg shadow flex flex-col max-h-[80vh]">
          {selectedEmail ? (
            <>
              <div className="p-4 border-b bg-gray-50 flex-shrink-0">
                <h2 className="text-lg font-semibold mb-2">{selectedEmail.subject}</h2>
                <div className="text-sm text-gray-600">
                  <div><span className="font-medium">From:</span> {selectedEmail.sender}</div>
                  <div><span className="font-medium">Received:</span> {format(parseISO(selectedEmail.created_at), 'MMM d, yyyy h:mm a')}</div>
                </div>
                {selectedEmail.status !== 'draft' && (
                  <div className="mt-2">Extraction confidence: {formatConfidence(selectedEmail.confidence_score)}</div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div>
                  <h3 className="text-md font-semibold mb-2 text-gray-700">
                    {selectedEmail.status === 'draft' ? '✏️ Email Body' : '📧 Original Email'}
                  </h3>
                  {selectedEmail.status === 'draft' ? (
                    <textarea
                      value={selectedEmail.body}
                      onChange={(e) => {
                        setSelectedEmail({ ...selectedEmail, body: e.target.value })
                      }}
                      className="w-full p-3 border rounded-lg font-mono text-sm h-64 resize-y"
                    />
                  ) : (
                    <div className="p-4 bg-gray-100 rounded-lg whitespace-pre-wrap font-mono text-sm border max-h-64 overflow-auto">
                      {selectedEmail.body}
                    </div>
                  )}
                </div>

                {selectedEmail.status !== 'draft' && (
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-md font-semibold text-gray-700">📋 Extracted Information</h3>
                      <button onClick={() => setEditing(!editing)} className="text-sm text-blue-600 hover:text-blue-800">
                        {editing ? 'Cancel' : '✏️ Edit'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Guest Name</label>
                        {editing ? (
                          <input type="text" value={editedData.guest_name || ''} onChange={(e) => handleEditField('guest_name', e.target.value)} className="w-full p-2 border rounded" />
                        ) : (
                          <div className="p-2 bg-gray-50 rounded">{editedData.guest_name || '—'}</div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <div className="p-2 bg-gray-50 rounded">{extractEmailAddress(selectedEmail.sender)}</div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Date</label>
                        {editing ? (
                          <input type="date" value={editedData.arrival_date || ''} onChange={(e) => handleEditField('arrival_date', e.target.value)} className="w-full p-2 border rounded" />
                        ) : (
                          <div className="p-2 bg-gray-50 rounded">{editedData.arrival_date ? format(parseISO(editedData.arrival_date), 'MMM d, yyyy') : '—'}</div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Departure Date</label>
                        {editing ? (
                          <input type="date" value={editedData.departure_date || ''} onChange={(e) => handleEditField('departure_date', e.target.value)} className="w-full p-2 border rounded" />
                        ) : (
                          <div className="p-2 bg-gray-50 rounded">{editedData.departure_date ? format(parseISO(editedData.departure_date), 'MMM d, yyyy') : '—'}</div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rooms</label>
                        {editing ? (
                          <input type="number" min="1" value={editedData.number_of_rooms || 1} onChange={(e) => handleEditField('number_of_rooms', parseInt(e.target.value))} className="w-full p-2 border rounded" />
                        ) : (
                          <div className="p-2 bg-gray-50 rounded">{editedData.number_of_rooms || 1}</div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Group Booking</label>
                        {editing ? (
                          <label className="flex items-center gap-2 p-2">
                            <input type="checkbox" checked={editedData.is_group || false} onChange={(e) => handleEditField('is_group', e.target.checked)} className="w-4 h-4" />
                            <span>Group booking</span>
                          </label>
                        ) : (
                          <div className="p-2 bg-gray-50 rounded">{editedData.is_group ? 'Yes' : 'No'}</div>
                        )}
                      </div>
                    </div>

                    {/* Room assignment dropdown */}
                    {editing && currentReservationId && editedData.arrival_date && editedData.departure_date && (
                      <div className="mt-6 border-t pt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">🏨 Assign Room</label>
                        <select
                          value={selectedRoomNumber}
                          onChange={(e) => handleAssignRoom(e.target.value)}
                          className="w-full p-2 border rounded"
                        >
                          <option value="">-- Select a room --</option>
                          {availableRooms.map((room: any) => (
                            <option key={room.room_number} value={room.room_number}>
                              {room.room_number} – {room.room_type} (Floor {room.floor})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {editing && (
                      <div className="mt-4">
                        <button onClick={saveParsedData} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Save Changes</button>
                      </div>
                    )}

                    {!editing && currentReservationId && (
                      <div className="mt-4 border-t pt-4">
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">🏨 Room:</span>{' '}
                          {assignedRoom ? `Room ${assignedRoom}` : 'Not assigned'}
                        </div>
                      </div>
                    )}

                    {/* Generate Confirmation Email */}
                    {currentReservationId && !editing && (
                      <div className="mt-4 pt-4 border-t">
                        <button
                          onClick={handleGenerateConfirmationEmail}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg transition"
                        >
                          📨 Generate Confirmation Email
                        </button>
                      </div>
                    )}

                    {editing && !currentReservationId && editedData.arrival_date && editedData.departure_date && (
                      <div className="mt-4 text-sm text-yellow-600">
                        Create a reservation to assign a room.
                      </div>
                    )}
                  </div>
                )}

                {selectedEmail.status === 'draft' && (
                  <button
                    onClick={() => handleSendDraft(selectedEmail.id)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition"
                  >
                    📨 Send Email to Guest
                  </button>
                )}

                {selectedEmail.status !== 'draft' && editedData.arrival_date && editedData.departure_date && (
                  <div>
                    <h3 className="text-md font-semibold mb-2 text-gray-700">📊 Availability Preview</h3>
                    <div className="border rounded overflow-hidden">
                      <ReservationTapeChart startDate={editedData.arrival_date} endDate={editedData.departure_date} />
                    </div>
                  </div>
                )}
              </div>

              {selectedEmail.status !== 'draft' && (
                <div className="p-4 border-t bg-gray-50 flex gap-3 flex-shrink-0">
                  {!currentReservationId ? (
                    <button onClick={createDraftReservation} disabled={creating} className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50">
                      {creating ? 'Creating...' : '📝 Create Draft Reservation'}
                    </button>
                  ) : (
                    <div className="flex-1 text-sm text-gray-500 flex items-center">
                      Reservation created. {assignedRoom ? `Room ${assignedRoom}.` : 'Assign a room in edit mode.'}
                    </div>
                  )}
                  <button onClick={ignoreEmail} className="flex-1 bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500">
                    ❌ Ignore / Mark Processed
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">Select an email from the left to review</div>
          )}
        </div>
      </div>
    </div>
  )
}