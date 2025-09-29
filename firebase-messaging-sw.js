importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize Firebase
firebase.initializeApp({
  apiKey: "AIzaSyDVfhLFmklJCoU6hsBEWRq5WutjNzNCYH4",
  authDomain: "interlyve.firebaseapp.com",
  projectId: "interlyve",
  storageBucket: "interlyve.appspot.com",
  messagingSenderId: "679492513153",
  appId: "1:679492513153:web:46f2e68a7fc4f79aff8c80",
  databaseURL: "https://interlyve-default-rtdb.firebaseio.com"
});

const messaging = firebase.messaging();

// Background notifications
messaging.onBackgroundMessage(payload => {
  const { title, body, icon, data } = payload.notification || {};
  self.registration.showNotification(title, {
    body,
    icon: icon || '/assets/user.png',
    badge: '/assets/intercon.png', 
    data: data // carry chatId and senderUid
  });
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const chatId = event.notification?.data?.chatId;
  const targetUrl = chatId ? `/chat.html?chatId=${chatId}` : '/chat.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Focus existing tab
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
