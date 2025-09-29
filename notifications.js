// notifications.js
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging.js";
import { db, auth } from './app.js';
import { ref, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const messaging = getMessaging();

// Register Service Worker & get FCM token
async function registerServiceWorkerAndToken() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

  try {
    // 1️⃣ Register SW from GitHub Pages root
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log("Service Worker registered:", swRegistration);

    // 2️⃣ Request notification permission if not granted
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
    }

    // 3️⃣ Get FCM token using the registered SW
    const currentToken = await getToken(messaging, {
      vapidKey: "BOwDQGJ9O1RxBkCcut9R8lJF7AseyyHErMxtllSP14zZ72_-RIb_twPvyp-cdeQDOsDQSXr5zXWWImjdG3B1tZQ",
      serviceWorkerRegistration: swRegistration
    });

    if (currentToken && auth.currentUser) {
      // Save token to Firebase Realtime DB
      await set(ref(db, `tokens/${auth.currentUser.uid}`), { token: currentToken });
      console.log("FCM token saved:", currentToken);

      // Optionally, send token to your Render backend
      await fetch('https://interlyve-1.onrender.com/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: currentToken, uid: auth.currentUser.uid })
      });
      console.log("Token sent to backend");
    } else {
      console.log("No token available.");
    }

  } catch (err) {
    console.error("FCM registration error:", err);
  }
}

// Handle foreground messages
onMessage(messaging, payload => {
  const { title, body, icon } = payload.notification || {};
  const notificationIcon = icon || '/assets/user.png';

  if (title && body) {
    const notification = new Notification(title, { body, icon: notificationIcon });
    notification.onclick = () => { window.focus(); notification.close(); };
  }
});

// Execute immediately
registerServiceWorkerAndToken();
