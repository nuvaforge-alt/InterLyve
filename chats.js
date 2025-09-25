import { auth, db } from './app.js';
import { ref, get, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// Container for friends
const chatsContainer = document.getElementById('chatsContainer');
let friendsListener = null;

// Function to render friend cards
function renderFriendCard(friend) {
  const card = document.createElement('div');
  card.classList.add('chat-card');
  card.id = `chat-${friend.uid}`; // assign an ID to easily remove later

  const img = document.createElement('img');
  img.src = friend.photoURL || './assets/user.png';
  img.alt = friend.displayName || 'Friend';
  img.classList.add('chat-card-img');

  const name = document.createElement('span');
  name.textContent = friend.displayName || 'Unnamed';
  name.classList.add('chat-card-name');

  card.appendChild(img);
  card.appendChild(name);

  card.addEventListener('click', () => {
    openChat(friend.uid, friend.displayName);
  });

  chatsContainer.appendChild(card);
}

// Open chat placeholder
function openChat(friendUid, friendName) {
  alert(`Opening chat with ${friendName}`);
  // Here you can load messages dynamically or show chat UI
}

// Load friends and listen for changes
function loadFriends() {
  if (!auth.currentUser || !chatsContainer) return;

  const friendsRef = ref(db, `users/${auth.currentUser.uid}/friends`);

  // Remove previous listener if exists
  if (friendsListener) friendsListener();

  // Listen to real-time updates
  friendsListener = onValue(friendsRef, (snapshot) => {
    const friends = snapshot.exists() ? snapshot.val() : {};
    
    // Clear container first
    chatsContainer.innerHTML = '';
    
    if (Object.keys(friends).length === 0) {
      chatsContainer.innerHTML = `<p>No chats yet. Start chatting with AI personalities!</p>`;
    }

    // Render each friend
    for (const uid in friends) {
      renderFriendCard(friends[uid]);
    }
  });
}

// Load friends whenever the user logs in
auth.onAuthStateChanged(user => {
  if (user) loadFriends();
});

export { loadFriends };
