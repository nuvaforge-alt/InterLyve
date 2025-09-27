// sendNotification.js
const admin = require('firebase-admin');

// Path to your service account JSON
const serviceAccount = require('./serviceAccountKey.json'); 

admin.initializeApp({
   credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://interlyve-default-rtdb.firebaseio.com" // <-- check your exact URL
});

const db = admin.database();


db.ref('/').once('value')
  .then(snapshot => console.log("DB connected! Root:", snapshot.val()))
  .catch(err => console.error("DB connection error:", err));


// Function to send FCM notification
async function sendPushNotification(toUid, title, body) {
  try {
    const tokenSnap = await db.ref(`tokens/${toUid}/token`).get();
    if (!tokenSnap.exists()) return console.log("No FCM token for user:", toUid);

    const token = tokenSnap.val();
    const message = {
      notification: { title, body },
      token,
    };

    const response = await admin.messaging().send(message);
    console.log("Notification sent:", response);
  } catch (err) {
    console.error("Error sending notification:", err);
  }
}

// Example usage: send notification when a new message is added
function watchMessages() {
  const chatsRef = db.ref('chats');

  chatsRef.on('child_added', chatSnap => {
    const chatId = chatSnap.key;
    const messagesRef = db.ref(`chats/${chatId}/messages`);
    
    messagesRef.on('child_added', async msgSnap => {
      const msg = msgSnap.val();
      if (!msg || !msg.text || !msg.sender) return;

      // Assume chatId is uid1_uid2
      const [uid1, uid2] = chatId.split('_');
      const recipient = msg.sender === uid1 ? uid2 : uid1;

      await sendPushNotification(recipient, "New Message", msg.text);
    });
  });
}

watchMessages();
