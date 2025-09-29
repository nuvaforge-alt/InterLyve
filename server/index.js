// server/index.js
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const bodyParser = require('body-parser');
const serviceAccount = require('./serviceAccount.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://interlyve-default-rtdb.firebaseio.com"
});

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Health check route
app.get('/', (req, res) => res.send('Notification server running'));




// Send notification route
app.post('/send-notification', async (req, res) => {
  try {
    const { chatId, senderUid, message } = req.body;
    if (!chatId || !senderUid || !message) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    // Determine recipient UID
    const [uidA, uidB] = chatId.split("_");
    const recipientUid = senderUid === uidA ? uidB : uidA;

    // Get recipient FCM token
    const tokenSnap = await admin.database().ref(`tokens/${recipientUid}/token`).once('value');
    const recipientToken = tokenSnap.val();
    if (!recipientToken) {
      return res.status(404).json({ error: 'Recipient has no FCM token' });
    }

    // Get sender info
    const senderSnap = await admin.database().ref(`users/${senderUid}`).once('value');
    const senderData = senderSnap.val() || {};
    const senderName = senderData.displayName || 'Someone';
     

    // Notification payload
    // Notification payload
const payload = {
  notification: {
    title: `New message from ${senderName}`,
    body: message.text || (message.image ? '📷 Sent you an image' : 'New message')
    // DO NOT include icon here
  },
  webpush: {
    notification: {
      icon: senderData.photoURL || '/assets/user.png' // <-- correct place
    },
    fcmOptions: {
      link: `/chat.html?chatId=${chatId}`
    }
  },
  data: {
    chatId,
    senderUid,
    senderPhoto: senderData.photoURL || '/assets/user.png' // optional backup
  }
};

    // Send FCM message
    const response = await admin.messaging().send({
      token: recipientToken,
      ...payload
    });

    res.json({ success: true, response });
  } catch (err) {
    console.error('Notification error:', err);
    res.status(500).json({ error: err.message || 'Error sending notification' });
  }
});

// Start server
app.listen(PORT, () => console.log(`Notification server running on port ${PORT}`));
