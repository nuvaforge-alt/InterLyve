import { auth, db } from './app.js';
import { ref, get, push, set, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

/* DOM */
const friendPhoto = document.getElementById('friendPhoto');
const friendName = document.getElementById('friendName');
const chatMessages = document.getElementById('chatMessages');

const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const bubbleSound = document.getElementById('bubbleSound');

const callBtn = document.getElementById('callBtn');
const videoBtn = document.getElementById('videoBtn');

const viewOnceCheckbox = document.getElementById('viewOnceCheckbox');

/* image elements */
const fileBtn = document.getElementById('fileBtn');
const fileInput = document.getElementById('fileInput');
const previewContainer = document.getElementById('previewContainer');
const previewImage = document.getElementById('previewImage');
const previewRemoveBtn = document.getElementById('previewRemoveBtn');

let currentFriend = null;
let pendingImageFile = null; // File object

/* ImgBB key (replace) */
const IMGBB_API_KEY = '66bcddc873ba6b0036e823676c0d6e76';

/* helpers */
function getChatId(uid1, uid2) {
  return uid1 < uid2 ? uid1 + '_' + uid2 : uid2 + '_' + uid1;
}

function playBubbleSound(){
  if (bubbleSound && typeof bubbleSound.play === 'function') {
    bubbleSound.play().catch(()=>{/* ignore autoplay errors */});
  }
}

/* render a message (text/image + timestamp) */
function renderMessage(msg, userUid, key) {
  const div = document.createElement('div');
  div.classList.add('message', msg.sender === userUid ? 'sent' : 'received', 'bubbly');

  div.dataset.key = key;
  if (msg.viewOnce) div.dataset.viewonce = "true";
  if (msg.deleteUrl) div.dataset.deleteurl = msg.deleteUrl;

  const img = document.createElement('img');
  img.src = msg.sender === userUid ? (auth.currentUser?.photoURL || './assets/user.png') : (currentFriend?.photoURL || './assets/user.png');
  img.classList.add('msg-profile');
  div.appendChild(img);

  const bubble = document.createElement('div');
  bubble.classList.add('bubble');

  // 🔥 handle View Once messages
  if (msg.viewOnce && msg.image) {
    if (msg.sender !== userUid) {
      // Receiver sees clickable V1
      const v1Box = document.createElement('div');
      v1Box.classList.add('view-once-box');
      v1Box.textContent = "📷 View Once"; 
      v1Box.style.padding = "20px";
      v1Box.style.textAlign = "center";
      v1Box.style.border = "2px dashed #888";
      v1Box.style.borderRadius = "10px";
      v1Box.style.cursor = "pointer";
      bubble.appendChild(v1Box);

      v1Box.addEventListener('click', () => openViewOnceModal(msg, key));
    } else {
      // Sender sees placeholder only
      const sentBox = document.createElement('div');
      sentBox.classList.add('view-once-sent');
      sentBox.textContent = "✔ View Once sent"; 
      sentBox.style.padding = "15px";
      sentBox.style.textAlign = "center";
      sentBox.style.border = "2px solid #4CAF50";
      sentBox.style.borderRadius = "10px";
      bubble.appendChild(sentBox);
    }

  } else if (msg.image) {
    // normal images
    const mImg = document.createElement('img');
    mImg.src = msg.image;
    mImg.classList.add('message-image');
    mImg.style.width = '280px';
    mImg.style.borderRadius = '10px';
    mImg.style.display = 'block';
    mImg.style.marginBottom = msg.text ? '8px' : '0';
    bubble.appendChild(mImg);
  }

  if (msg.text) {
    const messageText = document.createElement('div');
    messageText.textContent = msg.text;
    bubble.appendChild(messageText);
  }

  const timestamp = document.createElement('div');
  timestamp.classList.add('timestamp');
  const date = new Date(msg.timestamp);
  timestamp.textContent = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  bubble.appendChild(timestamp);

  div.appendChild(bubble);
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  bubble.classList.add('bubble-pop');
  setTimeout(()=> bubble.classList.remove('bubble-pop'), 300);
}

/* 🔥 Open View Once Modal */
async function openViewOnceModal(msg, msgKey) {
  const modal = document.getElementById('imageModal');
  const modalImg = document.getElementById('modalImage');
  const downloadBtn = document.getElementById('downloadLink');
  const modalClose = document.getElementById('modalClose');

  modal.style.display = 'flex';
  modalImg.src = msg.image;

  // download button
  downloadBtn.onclick = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(modalImg.src);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat_image_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed", err);
      alert("Couldn't download image.");
    }
  };

  // close + delete after viewing once
  const closeAndDelete = async () => {
    modal.style.display = 'none';
    try {
      const user = auth.currentUser;
      const chatId = getChatId(user.uid, currentFriend.uid);
      const msgRef = ref(db, `chats/${chatId}/messages/${msgKey}`);
      await set(msgRef, null); // remove from Firebase

      if (msg.deleteUrl) {
        await fetch(msg.deleteUrl, { method: 'GET' }); // remove from ImgBB
      }
    } catch (err) {
      console.error("Error deleting view-once image:", err);
    }

    modalClose.removeEventListener('click', closeAndDelete);
    modal.removeEventListener('click', bgCloseHandler);
  };

  modalClose.addEventListener('click', closeAndDelete);
  const bgCloseHandler = (ev) => {
    if (ev.target.id === 'imageModal') closeAndDelete();
  };
  modal.addEventListener('click', bgCloseHandler);
}


/* Listen for current friend & messages */
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
    Object.entries(data).forEach(([key, msg]) => renderMessage(msg, user.uid, key));
  });

  // ✅ Listen to friend's typing status here
  const chatId = getChatId(user.uid, currentFriend.uid);
  const friendTypingRef = ref(db, `chats/${chatId}/typing/${currentFriend.uid}`);

 // Listen to friend's typing status
onValue(friendTypingRef, (snap) => {
  const isTyping = snap.val();
  const typingIndicator = friendStatus.querySelector('.typing-indicator');

  if (isTyping) {
    typingIndicator.classList.add("active");
  } else {
    typingIndicator.classList.remove("active");
  }
});


});

/* Upload file to ImgBB, return URL */
async function uploadToImgbb(file) {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: formData
  });

  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.error?.message || 'ImgBB upload failed');
  }

  return {
    url: json.data.display_url || json.data.url,
    deleteUrl: json.data.delete_url
  };
}

/* Send message (handles text + optional image) */
sendBtn.addEventListener('click', async () => {
  if (!currentFriend || !auth.currentUser) return;

  const text = messageInput.value.trim();
  if (!text && !pendingImageFile) return; // nothing to send

  sendBtn.disabled = true; // avoid double sends

  const user = auth.currentUser;
  const messagesRef = ref(db, `chats/${getChatId(user.uid, currentFriend.uid)}/messages`);
  const messageData = {
    sender: user.uid,
    timestamp: Date.now()
  };

  try {
    if (pendingImageFile) {
      const { url, deleteUrl } = await uploadToImgbb(pendingImageFile);
      messageData.image = url;
      if (viewOnceCheckbox.checked) {
        messageData.viewOnce = true;
        messageData.deleteUrl = deleteUrl;
      }
      // reset preview
      pendingImageFile = null;
      previewImage.src = '';
      previewContainer.style.display = 'none';
      fileInput.value = '';
      viewOnceCheckbox.checked = false;
    }

    if (text) messageData.text = text;

    await push(messagesRef, messageData);

    // play sound
    playBubbleSound();
    messageInput.value = '';
  } catch (err) {
    console.error('Send error:', err);
    alert('Error sending message: ' + err.message);
  } finally {
    sendBtn.disabled = false;
  }
});

/* Enter key sends */
messageInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') sendBtn.click();
});

/* File pick */
fileBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  pendingImageFile = file;
  previewImage.src = URL.createObjectURL(file);
  previewContainer.style.display = 'flex';
});

/* remove preview before sending */
previewRemoveBtn.addEventListener('click', () => {
  pendingImageFile = null;
  previewImage.src = '';
  previewContainer.style.display = 'none';
  fileInput.value = '';
});

// Open modal when clicking a message image
chatMessages.addEventListener('click', (e) => {
  if (e.target.classList.contains('message-image')) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');

    const messageDiv = e.target.closest('.message');
    const msgKey = messageDiv.dataset.key;
    const isViewOnce = messageDiv.dataset.viewonce === "true";
    const deleteUrl = messageDiv.dataset.deleteurl;

    modal.style.display = 'flex';
    modalImg.src = e.target.src;

    // Set download action
    const downloadBtn = document.getElementById('downloadLink');
    downloadBtn.onclick = async (event) => {
      event.preventDefault();
      try {
        const response = await fetch(modalImg.src);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        // Create temp link for download
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_image_${Date.now()}.png`; // custom filename
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Download failed", err);
        alert("Couldn't download image.");
      }
    };

    // 🔥 handle view-once delete after modal close
    const closeAndDelete = async () => {
      modal.style.display = 'none';
      if (isViewOnce && msgKey) {
        try {
          const user = auth.currentUser;
          const chatId = getChatId(user.uid, currentFriend.uid);
          const msgRef = ref(db, `chats/${chatId}/messages/${msgKey}`);
          await set(msgRef, null);

          if (deleteUrl) {
            await fetch(deleteUrl); // ImgBB delete link
          }
        } catch (err) {
          console.error("Error deleting view-once image:", err);
        }
      }

      // cleanup listeners
      modalClose.removeEventListener('click', closeAndDelete);
      modal.removeEventListener('click', bgCloseHandler);
    };

    const modalClose = document.getElementById('modalClose');
    modalClose.addEventListener('click', closeAndDelete);

    const bgCloseHandler = (ev) => {
      if (ev.target.id === 'imageModal') {
        closeAndDelete();
      }
    };
    modal.addEventListener('click', bgCloseHandler);
  }
});


const friendStatus = document.getElementById('friendStatus');
let typingTimeout = null;

/* --- Typing status --- */
function setTypingStatus(isTyping) {
  if (!auth.currentUser || !currentFriend) return;
  const chatId = getChatId(auth.currentUser.uid, currentFriend.uid);
  const typingRef = ref(db, `chats/${chatId}/typing/${auth.currentUser.uid}`);
  set(typingRef, isTyping);
}

// detect typing
messageInput.addEventListener('input', () => {
  setTypingStatus(true);

  // reset after 2s of no typing
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    setTypingStatus(false);
  }, 2000);
});

// stop typing after sending
sendBtn.addEventListener('click', () => {
  setTypingStatus(false);
});

