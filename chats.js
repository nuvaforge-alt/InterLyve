// friendslist.js
import { auth, db } from './app.js';
import { ref, set, onValue, query, limitToLast, get } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const chatsContainer = document.getElementById('chatsContainer');
let friendsListener = null;

// Map to store latest chat data for sorted rendering
let chatDataMap = {};

// Helper: Get chat ID
function getChatId(uid1, uid2) {
  return uid1 < uid2 ? uid1 + '_' + uid2 : uid2 + '_' + uid1;
}

// Render a single friend card
function renderFriendCard(friend, lastMsg, isUnread) {
  const cardId = `chat-${friend.uid}`;
  let card = document.getElementById(cardId);

  if (!card) {
    card = document.createElement('div');
    card.classList.add('chat-card');
    card.id = cardId;
    card.innerHTML = `
      <img src="${friend.photoURL || './assets/user.png'}" alt="${friend.displayName || 'Friend'}" class="chat-card-img">
      <div class="chat-card-info">
        <div class="chat-card-top">
          <span class="chat-card-name">${friend.displayName || 'Unnamed'}</span>
          <span class="chat-card-time"></span>
        </div>
        <div class="chat-card-bottom">
          <span class="chat-card-lastmsg"></span>
          <span class="tick"></span>
          <span class="chat-card-typing"></span>
        </div>
      </div>
    `;
    card.addEventListener('click', async () => {
      await openChat(friend);
    });
    chatsContainer.appendChild(card);
  }

  const lastMsgSpan = card.querySelector('.chat-card-lastmsg');
  const timeEl = card.querySelector('.chat-card-time');
  const tickEl = card.querySelector('.tick');

  lastMsgSpan.textContent = lastMsg ? lastMsg.text || (lastMsg.image ? "[Image]" : "") : "";
  timeEl.textContent = lastMsg?.timestamp
    ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : "";

  // Updated tick logic
  if (lastMsg && lastMsg.sender === auth.currentUser.uid) {
    // Sent messages: double blue tick if seen by friend
    if (lastMsg.seen) {
      tickEl.textContent = "✔✔";
      tickEl.style.color = "deepskyblue";
    } else if (lastMsg.status === 'delivered') {
      tickEl.textContent = "✔✔";
      tickEl.style.color = "";
    } else {
      tickEl.textContent = "✔";
      tickEl.style.color = "";
    }
  } else {
    // Received messages: show red dot if unread
    tickEl.textContent = isUnread ? "●" : "";
    tickEl.style.color = isUnread ? "#e0245e" : "";
  }
}

// Show notification bar
function showNotification(message, duration = 3000) {
  const bar = document.getElementById('notifyBar');
  if (!bar) return;
  bar.textContent = message;
  bar.classList.add('show');
  setTimeout(() => bar.classList.remove('show'), duration);
}

// Open chat and mark messages as read
async function openChat(friend) {
  const me = auth.currentUser;
  if (!me) return;
  const chatId = getChatId(me.uid, friend.uid);

  // Set current chat in DB
  await set(ref(db, `users/${me.uid}/currentChat`), {
    uid: friend.uid,
    displayName: friend.displayName,
    photoURL: friend.photoURL || './assets/user.png'
  });

  // Update lastRead using seen messages
  const messagesSnap = await get(ref(db, `chats/${chatId}/messages`));
  if (messagesSnap.exists()) {
    const msgs = messagesSnap.val();
    let maxTs = 0;
    for (const [key, msg] of Object.entries(msgs)) {
      if (msg.sender !== me.uid && !msg.seen) {
        await set(ref(db, `chats/${chatId}/messages/${key}/seen`), true);
      }
      if (msg.timestamp > maxTs) maxTs = msg.timestamp;
    }
    await set(ref(db, `users/${me.uid}/lastRead/${chatId}`), maxTs);
  }

  window.location.href = './chat.html';
}

// Attach listeners to a friend's chat
function attachChatListeners(friend) {
  const me = auth.currentUser;
  if (!me) return;
  const chatId = getChatId(me.uid, friend.uid);
  const lastMsgRef = query(ref(db, `chats/${chatId}/messages`), limitToLast(1));
  const lastReadRef = ref(db, `users/${me.uid}/lastRead/${chatId}`);

  let latestMsg = null;
  let lastRead = 0;

  onValue(lastMsgRef, (snap) => {
    if (!snap.exists()) return;
    latestMsg = Object.values(snap.val())[0];
    updateFriendCard();
  });

  onValue(lastReadRef, (snap) => {
    lastRead = snap.exists() ? snap.val() : 0;
    updateFriendCard();
  });

  function updateFriendCard() {
    if (!latestMsg) return;
    const isUnread = latestMsg.timestamp > lastRead && latestMsg.sender !== me.uid;
    chatDataMap[friend.uid] = { friend, lastMsg: latestMsg, isUnread };
    renderAllChats();
    if (isUnread) showNotification(`New message from ${friend.displayName || "Someone"}`);
  }

  const typingRef = ref(db, `chats/${chatId}/typing/${friend.uid}`);
  onValue(typingRef, (snap) => {
    const card = document.getElementById(`chat-${friend.uid}`);
    if (!card) return;
    card.querySelector('.chat-card-typing').textContent = snap.val() ? "Typing..." : "";
  });
}

// Render all chats sorted by latest message
function renderAllChats() {
  chatsContainer.innerHTML = "";
  Object.values(chatDataMap)
    .sort((a, b) => (b.lastMsg?.timestamp || 0) - (a.lastMsg?.timestamp || 0))
    .forEach(({ friend, lastMsg, isUnread }) => renderFriendCard(friend, lastMsg, isUnread));
}

// Load friends and attach chat listeners
function loadFriends() {
  const me = auth.currentUser;
  if (!me || !chatsContainer) return;
  const friendsRef = ref(db, `users/${me.uid}/friends`);
  if (friendsListener) friendsListener();

  friendsListener = onValue(friendsRef, (snap) => {
    const friends = snap.exists() ? snap.val() : {};
    if (!Object.keys(friends).length) {
      chatsContainer.innerHTML = `<p>No chats yet.</p>`;
      return;
    }
    chatDataMap = {};
    for (const uid in friends) attachChatListeners(friends[uid]);
  });
}

// Initialize
auth.onAuthStateChanged(user => { if (user) loadFriends(); });
export { loadFriends };
