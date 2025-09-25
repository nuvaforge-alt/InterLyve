import { auth, db } from './app.js';
import { ref, get, set, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const chatsContainer = document.getElementById('chatsContainer');
let friendsListener = null;

// Render friend cards
function renderFriendCard(friend) {
  const card = document.createElement('div');
  card.classList.add('chat-card');
  card.id = `chat-${friend.uid}`;

  const img = document.createElement('img');
  img.src = friend.photoURL || './assets/user.png';
  img.alt = friend.displayName || 'Friend';
  img.classList.add('chat-card-img');

  const name = document.createElement('span');
  name.textContent = friend.displayName || 'Unnamed';
  name.classList.add('chat-card-name');

  card.appendChild(img);
  card.appendChild(name);

  card.addEventListener('click', async () => {
    await openChat(friend);
  });

  chatsContainer.appendChild(card);
}

// Open chat: save current chat and switch page
async function openChat(friend) {
  if (!auth.currentUser) return;

  try {
    const currentChatRef = ref(db, `users/${auth.currentUser.uid}/currentChat`);
    await set(currentChatRef, {
      uid: friend.uid,
      displayName: friend.displayName,
      photoURL: friend.photoURL || './assets/user.png',
      email: friend.email || ''
    });

    // Redirect to chat page
    window.location.href = './chat.html'; // change to your chat page path
  } catch (err) {
    console.error('Error opening chat:', err);
  }
}

// Load friends
function loadFriends() {
  if (!auth.currentUser || !chatsContainer) return;

  const friendsRef = ref(db, `users/${auth.currentUser.uid}/friends`);

  if (friendsListener) friendsListener();

  friendsListener = onValue(friendsRef, (snapshot) => {
    const friends = snapshot.exists() ? snapshot.val() : {};

    chatsContainer.innerHTML = '';

    if (Object.keys(friends).length === 0) {
      chatsContainer.innerHTML = `<p>No chats yet. Start chatting with AI personalities!</p>`;
    }

    for (const uid in friends) {
      renderFriendCard(friends[uid]);
    }
  });
}

// Load friends when user logs in
auth.onAuthStateChanged(user => {
  if (user) loadFriends();
});

export { loadFriends };
