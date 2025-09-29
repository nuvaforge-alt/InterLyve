// notifications.js
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging.js";
import { db, auth } from './app.js';
import { ref, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const messaging = getMessaging();

// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js
')
    .then(registration => {
      console.log("Service Worker registered for FCM.", registration);
    })
    .catch(err => console.log("SW registration failed:", err));
}

// Request notification permission & save token
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') await saveFCMToken();
  } else if (Notification.permission === 'granted') {
    await saveFCMToken();
  }
}

async function saveFCMToken() {
  try {
    const currentToken = await getToken(messaging, {
      vapidKey: "BOwDQGJ9O1RxBkCcut9R8lJF7AseyyHErMxtllSP14zZ72_-RIb_twPvyp-cdeQDOsDQSXr5zXWWImjdG3B1tZQ"
    });
    if (currentToken && auth.currentUser) {
      await set(ref(db, `tokens/${auth.currentUser.uid}`), { token: currentToken });
      console.log("FCM token saved:", currentToken);
    }
  } catch (err) {
    console.error("Error saving FCM token:", err);
  }
}

// Handle foreground messages
onMessage(messaging, payload => {
  const { title, body, icon } = payload.notification || {};
  const senderPhoto = payload.data?.senderPhoto; // fallback from data
  const notificationIcon = icon || senderPhoto || '/assets/user.png';

  if (title && body) {
    const notification = new Notification(title, {
      body,
      icon: notificationIcon
    });
    notification.onclick = () => { window.focus(); notification.close(); };
  }
});

// Call immediately
requestNotificationPermission();
