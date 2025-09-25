import { auth, db } from './app.js';
import { ref, get, push, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const friendPhoto = document.getElementById('friendPhoto');
const friendName = document.getElementById('friendName');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const bubbleSound = document.getElementById('bubbleSound');
const callBtn = document.getElementById('callBtn');
const videoBtn = document.getElementById('videoBtn');

let currentFriend = null;

// Helper to get consistent chat ID
function getChatId(uid1, uid2) {
  return uid1 < uid2 ? uid1 + '_' + uid2 : uid2 + '_' + uid1;
}

// Render a single message
function renderMessage(msg, userUid) {
  const div = document.createElement('div');
  div.classList.add('message', msg.sender === userUid ? 'sent' : 'received', 'bubbly');
  
  const img = document.createElement('img');
  img.src = msg.sender === userUid ? auth.currentUser.photoURL : currentFriend.photoURL;
  img.classList.add('msg-profile');
  div.appendChild(img);

  const bubble = document.createElement('div');
  bubble.classList.add('bubble');
  bubble.textContent = msg.text;

  const timestamp = document.createElement('div');
  timestamp.classList.add('timestamp');
  const date = new Date(msg.timestamp);
  timestamp.textContent = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  bubble.appendChild(timestamp);

  div.appendChild(bubble);
  chatMessages.appendChild(div);

  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Bubble animation
  bubble.classList.add('bubble-pop');
  setTimeout(() => bubble.classList.remove('bubble-pop'), 300);
}

// Load friend info & messages
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
    Object.values(data).forEach(msg => renderMessage(msg, user.uid));
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
const bubbleSound = new Audio('./assets/blob sound.mp3');
  bubbleSound.play(); // whoop sound effect
  messageInput.value = '';
});

// Press Enter to send
messageInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') sendBtn.click();
});

// Optional: Call/video button placeholders
callBtn.addEventListener('click', () => alert(`Calling ${currentFriend.displayName}...`));
videoBtn.addEventListener('click', () => alert(`Video calling ${currentFriend.displayName}...`));
