import { auth, db } from './app.js';
import { ref, set, onValue, query, limitToLast } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const chatsContainer = document.getElementById('chatsContainer');
let friendsListener = null;

function getChatId(uid1, uid2) {
  return uid1 < uid2 ? uid1 + '_' + uid2 : uid2 + '_' + uid1;
}

// Map to store latest chat data so we can re-render sorted list in real-time
let chatDataMap = {};

// Render friend card
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

  // Update last message text
  if (lastMsg) {
    lastMsgSpan.textContent = lastMsg.text || (lastMsg.image ? "[Image]" : "");
  } else {
    lastMsgSpan.textContent = "";
  }

  // Update timestamp
  if (lastMsg?.timestamp) {
    const date = new Date(lastMsg.timestamp);
    timeEl.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    timeEl.textContent = "";
  }

  // Update tick / unread state
  if (lastMsg) {
    if (lastMsg.sender === auth.currentUser.uid) {
      // Sent by me → show ticks
      if (lastMsg.read) {
        tickEl.textContent = "✔✔";
        tickEl.classList.add("blue");
      } else if (lastMsg.delivered) {
        tickEl.textContent = "✔✔";
        tickEl.classList.remove("blue");
      } else {
        tickEl.textContent = "✔";
        tickEl.classList.remove("blue");
      }
    } else {
      // Sent by friend → unread check
      tickEl.textContent = isUnread ? "✔" : "";
      tickEl.classList.remove("blue");
    }
  } else {
    tickEl.textContent = "";
  }
}

// 🔔 Top sliding notification
function showNotification(message, duration = 3000) {
  const bar = document.getElementById('notifyBar');
  if (!bar) return;

  bar.textContent = message;
  bar.classList.add('show');

  setTimeout(() => {
    bar.classList.remove('show');
  }, duration);
}

// Open chat and mark messages as read
async function openChat(friend) {
  if (!auth.currentUser) return;

  try {
    const chatId = getChatId(auth.currentUser.uid, friend.uid);
    const lastReadRef = ref(db, `users/${auth.currentUser.uid}/lastRead/${chatId}`);
    await set(lastReadRef, Date.now()); // mark read

    const currentChatRef = ref(db, `users/${auth.currentUser.uid}/currentChat`);
    await set(currentChatRef, {
      uid: friend.uid,
      displayName: friend.displayName,
      photoURL: friend.photoURL || './assets/user.png',
      email: friend.email || ''
    });

    window.location.href = './chat.html';
  } catch (err) {
    console.error('Error opening chat:', err);
  }
}

// Attach listeners for each chat
function attachChatListeners(friend) {
  const user = auth.currentUser;
  if (!user) return;

  const chatId = getChatId(user.uid, friend.uid);

  // Last message listener (real-time)
  const lastMsgRef = query(ref(db, `chats/${chatId}/messages`), limitToLast(1));
  onValue(lastMsgRef, (snap) => {
    if (snap.exists()) {
      const lastMsg = Object.values(snap.val())[0];

      // Get read state
      const lastReadRef = ref(db, `users/${user.uid}/lastRead/${chatId}`);
      onValue(lastReadRef, (readSnap) => {
        const lastRead = readSnap.exists() ? readSnap.val() : 0;
        const isUnread = lastMsg.timestamp > lastRead && lastMsg.sender !== user.uid;

        // Save into map
        chatDataMap[friend.uid] = { friend, lastMsg, isUnread };

        // Re-render sorted list
        renderAllChats();
        if (isUnread) {
          showNotification(`New message from ${friend.displayName || "Someone"}`);
        }
      });
    }
  });

  // Typing listener
  const typingRef = ref(db, `chats/${chatId}/typing/${friend.uid}`);
  onValue(typingRef, (snap) => {
    const isTyping = snap.val();
    const card = document.getElementById(`chat-${friend.uid}`);
    if (card) {
      const typingEl = card.querySelector('.chat-card-typing');
      typingEl.textContent = isTyping ? "Typing..." : "";
    }
  });
}

// Re-render sorted chat list
function renderAllChats() {
  chatsContainer.innerHTML = "";

  const chatArr = Object.values(chatDataMap);
  chatArr.sort((a, b) => (b.lastMsg?.timestamp || 0) - (a.lastMsg?.timestamp || 0));

  chatArr.forEach(({ friend, lastMsg, isUnread }) => {
    renderFriendCard(friend, lastMsg, isUnread);
  });
}

// Load friends and attach chat listeners
function loadFriends() {
  if (!auth.currentUser || !chatsContainer) return;

  const user = auth.currentUser;
  const friendsRef = ref(db, `users/${user.uid}/friends`);

  if (friendsListener) friendsListener();

  friendsListener = onValue(friendsRef, (snapshot) => {
    const friends = snapshot.exists() ? snapshot.val() : {};

    chatsContainer.innerHTML = '';

    if (Object.keys(friends).length === 0) {
      chatsContainer.innerHTML = `<p>No chats yet. Start chatting with AI personalities!</p>`;
      return;
    }

    chatDataMap = {}; // reset
    for (const uid in friends) {
      attachChatListeners(friends[uid]);
    }
  });
}

auth.onAuthStateChanged(user => {
  if (user) loadFriends();
});

export { loadFriends };
