import { auth, db } from './app.js';
import { ref, get, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const BATCH_SIZE = 20;
let allUsers = [];
let filteredUsers = [];
let loadedCount = 0;

// Fetch all users except the current user
async function fetchAllUsers() {
  try {
    const snapshot = await get(ref(db, 'users/'));
    if (!snapshot.exists()) return [];
    const users = snapshot.val();
    const currentUserId = auth.currentUser?.uid;
    return Object.entries(users)
                 .filter(([uid]) => uid !== currentUserId)
                 .map(([uid, user]) => ({ uid, ...user }));
  } catch (err) {
    console.error(err);
    return [];
  }
}

// Render a batch of users
async function renderUsersBatch(container, start, end, friends = {}) {
  const batch = filteredUsers.slice(start, end);

  batch.forEach(user => {
    const card = document.createElement('div');
    card.classList.add('user-card');

    const img = document.createElement('img');
    img.src = user.photoURL || './assets/user.png';
    img.alt = user.displayName || 'User';
    img.classList.add('user-card-img');

    const name = document.createElement('span');
    name.textContent = user.displayName || 'Unnamed';
    name.classList.add('user-card-name');

    // Open chat page when clicking anywhere on the card except the buttons
card.addEventListener('click', async (e) => {
  if (e.target !== addBtn && e.target !== removeBtn) {
    const selectedFriendData = {
      uid: user.uid,
      displayName: user.displayName || 'Unnamed',
      photoURL: user.photoURL || './assets/user.png',
      email: user.email || ''
    };

    // Save current chat for the logged-in user
    const currentChatRef = ref(db, `users/${auth.currentUser.uid}/currentChat`);
    await set(currentChatRef, selectedFriendData);

    // Switch to chat page
    window.location.href = 'chat.html';
  }
});



    // --- ADD & REMOVE BUTTONS ---
    const addBtn = document.createElement('button');
    addBtn.textContent = '+';
    addBtn.classList.add('friend-btn');

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '–';
    removeBtn.classList.add('friend-btn', 'remove-btn');

    // Set initial button states
    if (!friends[user.uid]) removeBtn.disabled = true;
    if (friends[user.uid]) addBtn.disabled = true;

    // Add friend (two-way)
    addBtn.addEventListener('click', async () => {
      try {
        const myFriendRef = ref(db, `users/${auth.currentUser.uid}/friends/${user.uid}`);
        const theirFriendRef = ref(db, `users/${user.uid}/friends/${auth.currentUser.uid}`);

        // Add to your friends
        await set(myFriendRef, {
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL || './assets/user.png'
        });

        // Add yourself to their friends
        await set(theirFriendRef, {
          uid: auth.currentUser.uid,
          displayName: auth.currentUser.displayName || 'Unnamed',
          photoURL: auth.currentUser.photoURL || './assets/user.png'
        });

        friends[user.uid] = true;
        addBtn.disabled = true;
        removeBtn.disabled = false;

        // Optional: trigger push notification here

      } catch (err) {
        console.error(err);
        alert('Error adding friend: ' + err.message);
      }
    });

    // Remove friend (two-way)
    removeBtn.addEventListener('click', async () => {
      try {
        const myFriendRef = ref(db, `users/${auth.currentUser.uid}/friends/${user.uid}`);
        const theirFriendRef = ref(db, `users/${user.uid}/friends/${auth.currentUser.uid}`);

        // Remove from your friends
        await set(myFriendRef, null);

        // Remove yourself from their friends
        await set(theirFriendRef, null);

        delete friends[user.uid];
        addBtn.disabled = false;
        removeBtn.disabled = true;

      } catch (err) {
        console.error(err);
        alert('Error removing friend: ' + err.message);
      }
    });

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.classList.add('user-card-buttons');
    buttonContainer.appendChild(addBtn);
    buttonContainer.appendChild(removeBtn);

    // Append all elements
    card.appendChild(img);
    card.appendChild(name);
    card.appendChild(buttonContainer);

    container.appendChild(card);
  });
}


// Load Explore Users
async function loadExploreUsers() {
  const exploreContainer = document.getElementById('exploreContainer');
  const searchInput = document.getElementById('exploreSearchInput');
  if (!exploreContainer || !auth.currentUser) return;

  exploreContainer.innerHTML = '';
  loadedCount = 0;

  allUsers = await fetchAllUsers();

  // Load current friends
  const friendsSnapshot = await get(ref(db, `users/${auth.currentUser.uid}/friends`));
  const friends = friendsSnapshot.exists() ? friendsSnapshot.val() : {};

  filteredUsers = allUsers;

  // Initial render
  await renderUsersBatch(exploreContainer, 0, BATCH_SIZE, friends);
  loadedCount += BATCH_SIZE;

  // Search filter
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase();
      filteredUsers = allUsers.filter(u => (u.displayName || '').toLowerCase().includes(query));

      exploreContainer.innerHTML = '';
      loadedCount = 0;
      renderUsersBatch(exploreContainer, 0, BATCH_SIZE, friends);
      loadedCount += BATCH_SIZE;
    });
  }

  // Lazy load on scroll
  exploreContainer.addEventListener('scroll', async () => {
    if (exploreContainer.scrollTop + exploreContainer.clientHeight >= exploreContainer.scrollHeight - 50) {
      if (loadedCount >= filteredUsers.length) return;
      await renderUsersBatch(exploreContainer, loadedCount, loadedCount + BATCH_SIZE, friends);
      loadedCount += BATCH_SIZE;
    }
  });
}

// Trigger loading when Explore tab is clicked
const exploreTab = document.getElementById('exploreTab');
if (exploreTab) exploreTab.addEventListener('click', loadExploreUsers);

export { loadExploreUsers };
