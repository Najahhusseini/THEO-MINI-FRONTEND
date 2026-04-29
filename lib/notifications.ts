import toast from 'react-hot-toast'

const API_BASE_URL = 'http://192.168.1.112:4000/api'

export async function subscribeToPushNotifications() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications')
    toast.error('Your browser does not support notifications')
    return false
  }
  
  if (!('serviceWorker' in navigator)) {
    console.log('Service workers not supported')
    toast.error('Service workers not supported in this browser')
    return false
  }
  
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    console.log('Notification permission denied')
    toast.error('Please allow notifications to receive schedule updates')
    return false
  }
  
  try {
    const registration = await navigator.serviceWorker.ready
    
    const vapidPublicKey = 'BHjAe60W4F_V0O1vVidmJ-XeSMUukZ0pMk6OjtL4ToA2-GFzMxJYQDjaLoY24gFXz8Wqi7Cr47m3x7HRtH92p1g'
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })
    
    const token = localStorage.getItem('accessToken')
    
    const response = await fetch(`${API_BASE_URL}/notifications/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(subscription),
    })
    
    if (response.ok) {
      console.log('Push subscription saved')
      toast.success('Notifications enabled!')
      return true
    } else {
      console.error('Failed to save subscription:', await response.text())
      toast.error('Failed to enable notifications')
      return false
    }
  } catch (error) {
    console.error('Failed to subscribe to push:', error)
    toast.error('Could not enable notifications')
    return false
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function areNotificationsSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator
}

export function getNotificationPermission() {
  if (!areNotificationsSupported()) return 'unsupported'
  return Notification.permission
}