import { auth, db } from './app.js';
import { ref, get, push, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const friendPhoto = document.getElementById('friendPhoto');
const friendName = document.getElementById('friendName');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const bubbleSound = document.getElementById('bubbleSound');

let currentFriend = null;

// Load friend info
auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  const currentChatRef = ref(db, `users/${user.uid}/currentChat`);
  const snapshot = await get(currentChatRef);
  if (!snapshot.exists()) return;

  currentFriend = snapshot.val();
  friendPhoto.src = currentFriend.photoURL || './assets/user.png';
  friendName.textContent = currentFriend.displayName || 'Friend';

  // Listen to messages
  const messagesRef = ref(db, `chats/${getChatId(user.uid, currentFriend.uid)}/messages`);
  onValue(messagesRef, (snap) => {
    chatMessages.innerHTML = '';
    const data = snap.val();
    if (!data) return;
    Object.values(data).forEach(msg => {
      const div = document.createElement('div');
      div.classList.add('message');
      div.classList.add(msg.sender === user.uid ? 'sent' : 'received');

      const img = document.createElement('img');
      img.src = msg.sender === user.uid ? auth.currentUser.photoURL : currentFriend.photoURL;
      div.appendChild(img);

      const textDiv = document.createElement('div');
      textDiv.textContent = msg.text;
      div.appendChild(textDiv);

      const timestamp = document.createElement('div');
      timestamp.classList.add('timestamp');
      const date = new Date(msg.timestamp);
      timestamp.textContent = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
      div.appendChild(timestamp);

      chatMessages.appendChild(div);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
});

// Send message
sendBtn.addEventListener('click', async () => {
  const text = messageInput.value.trim();
  if (!text || !currentFriend) return;
  const user = auth.currentUser;
  const messagesRef = ref(db, `chats/${getChatId(user.uid, currentFriend.uid)}/messages`);
  await push(messagesRef, {
    text,
    sender: user.uid,
    timestamp: Date.now()
  });

  bubbleSound.play(); // whoop sound effect
  messageInput.value = '';
});

function getChatId(uid1, uid2) {
  return uid1 < uid2 ? uid1 + '_' + uid2 : uid2 + '_' + uid1;
}
