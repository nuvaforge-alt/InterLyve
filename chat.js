// chat.js
import { auth, db } from './app.js';
import { ref, get, push, set, onValue, update } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";


/* DOM Elements */
const friendPhoto = document.getElementById('friendPhoto');
const friendName = document.getElementById('friendName');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const bubbleSound = document.getElementById('bubbleSound');
const viewOnceCheckbox = document.getElementById('viewOnceCheckbox');
const fileBtn = document.getElementById('fileBtn');
const fileInput = document.getElementById('fileInput');
const previewContainer = document.getElementById('previewContainer');
const previewImage = document.getElementById('previewImage');
const previewRemoveBtn = document.getElementById('previewRemoveBtn');

/* Image Modal */
const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const downloadLink = document.getElementById('downloadLink');
const modalClose = document.getElementById('modalClose');




// Function to load chat by chatId directly
async function loadChatFromId(chatId) {
  if (!auth.currentUser) return;

  const [uidA, uidB] = chatId.split("_");
  const otherUid = auth.currentUser.uid === uidA ? uidB : uidA;

  // Get friend's data from DB
  const friendSnap = await get(ref(db, `users/${otherUid}`));
  if (!friendSnap.exists()) return;

  currentFriend = friendSnap.val();
  friendPhoto.src = currentFriend.photoURL || "./assets/user.png";
  friendName.textContent = currentFriend.displayName || "Friend";

  // Start listening for messages
  const messagesRef = ref(db, `chats/${chatId}/messages`);
  onValue(messagesRef, snap => {
    chatMessages.innerHTML = "";
    const data = snap.val();
    if (!data) return;

    Object.entries(data).forEach(([key, msg]) => {
      let div = chatMessages.querySelector(`.message[data-key="${key}"]`);
      if (!div) renderMessage(msg, auth.currentUser.uid, key);
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
    markMessagesAsSeen();
  });
}




let currentFriend = null;
let pendingImageFile = null;
let typingTimeout = null;
const IMGBB_API_KEY = '66bcddc873ba6b0036e823676c0d6e76';

/* Helpers */
function getChatId(uid1, uid2){ return uid1 < uid2 ? uid1+'_'+uid2 : uid2+'_'+uid1; }
function playBubbleSound(){ bubbleSound?.play?.().catch(()=>{}); }

/* Upload to ImgBB */
async function uploadToImgbb(file){
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method:'POST', body: formData });
  const json = await res.json();
  if(!res.ok || !json.success) throw new Error(json.error?.message || 'ImgBB upload failed');
  return { url: json.data.display_url, deleteUrl: json.data.delete_url };
}

/* Render a single message */
function renderMessage(msg, userUid, key){
  const div = document.createElement('div');
  div.classList.add('message', msg.sender===userUid?'sent':'received','bubbly');
  div.dataset.key = key;
  if(msg.viewOnce) div.dataset.viewonce = "true";
  if(msg.deleteUrl) div.dataset.deleteurl = msg.deleteUrl;

  const img = document.createElement('img');
  img.src = msg.sender===userUid ? (auth.currentUser?.photoURL || './assets/user.png') : (currentFriend?.photoURL || './assets/user.png');
  img.classList.add('msg-profile');
  div.appendChild(img);

  const bubble = document.createElement('div'); bubble.classList.add('bubble');

  // Images & View-once
  if(msg.viewOnce && msg.image && msg.sender!==userUid){
    const v1Box = document.createElement('div'); v1Box.classList.add('view-once-box');
    v1Box.textContent = "📷 View Once";
    v1Box.style.cssText = "padding:20px;text-align:center;border:2px dashed #888;border-radius:10px;cursor:pointer;";
    bubble.appendChild(v1Box);
    v1Box.addEventListener('click', ()=> openImageModal(msg,key,true));
  } else if(msg.viewOnce && msg.sender===userUid){
    if(msg.opened){
      const openedBox = document.createElement('div'); openedBox.classList.add('view-once-opened');
      openedBox.textContent = "📷 Opened";
      openedBox.style.cssText = "padding:15px;text-align:center;border:2px dashed #888;border-radius:10px;color:#888;";
      bubble.appendChild(openedBox);
    } else {
      const sentBox = document.createElement('div'); sentBox.classList.add('view-once-sent');
      sentBox.textContent = "✔ View Once sent";
      sentBox.style.cssText = "padding:15px;text-align:center;border:2px solid #4CAF50;border-radius:10px;";
      bubble.appendChild(sentBox);
    }
  } else if(msg.image){
    const mImg = document.createElement('img'); mImg.src = msg.image; mImg.classList.add('message-image');
    mImg.style.cssText = "width:280px;border-radius:10px;display:block;margin-bottom:"+(msg.text?'8px':'0');
    bubble.appendChild(mImg);
    mImg.style.cursor='pointer';
    mImg.onclick = ()=> openImageModal(msg,key,false); // normal image
  }

  if(msg.text){
    const messageText = document.createElement('div'); messageText.textContent = msg.text; bubble.appendChild(messageText);
  }

  const timestamp = document.createElement('div'); timestamp.classList.add('timestamp');
  const date = new Date(msg.timestamp); timestamp.textContent = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  bubble.appendChild(timestamp);

  if(msg.sender===userUid && msg.seen){
    const seenText = document.createElement('div'); seenText.classList.add('seen-text');
    seenText.textContent='Seen'; seenText.style.cssText="font-size:12px;color:#888;margin-top:4px;text-align:right;";
    bubble.appendChild(seenText);
  }

  div.appendChild(bubble); chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  bubble.classList.add('bubble-pop'); setTimeout(()=>bubble.classList.remove('bubble-pop'),300);
}

/* Image Modal open */
async function openImageModal(msg,msgKey,isViewOnce=false){
  imageModal.style.display='flex';
  modalImage.src = msg.image;
  downloadLink.style.display = isViewOnce ? 'none':'inline-block';

  const chatId = getChatId(auth.currentUser.uid,currentFriend.uid);
  const msgRef = ref(db, `chats/${chatId}/messages/${msgKey}`);

  const closeHandler = async ()=>{
    imageModal.style.display='none';

    if(isViewOnce && msgKey && msg.sender !== auth.currentUser.uid){
      // Mark as opened for sender
      await update(msgRef, { opened: true });
      // Remove image and viewOnce for viewer
      await update(msgRef, { image: null, viewOnce: false, deleteUrl: null });

      // Update sender bubble UI
      const senderDiv = chatMessages.querySelector(`.message[data-key="${msgKey}"]`);
      if(senderDiv && msg.sender === auth.currentUser.uid){
        const bubble = senderDiv.querySelector('.bubble');
        bubble.innerHTML=`<div style="padding:15px;text-align:center;border:2px dashed #888;border-radius:10px;color:#888;">📷 Opened</div>`;
      }

      // Update viewer bubble UI
      const viewerDiv = chatMessages.querySelector(`.message[data-key="${msgKey}"]`);
      if(viewerDiv && msg.sender !== auth.currentUser.uid){
        const bubble = viewerDiv.querySelector('.bubble');
        bubble.innerHTML=`<div style="padding:15px;text-align:center;border:2px dashed #888;border-radius:10px;color:#888;">📷 Viewed</div>`;
      }

      // Delete from ImgBB
      if(msg.deleteUrl) await fetch(msg.deleteUrl).catch(()=>{});
    }

    modalClose.removeEventListener('click', closeHandler);
    imageModal.removeEventListener('click', bgClickHandler);
  };
  const bgClickHandler = e=>{ if(e.target.id==='imageModal') closeHandler(); };
  modalClose.addEventListener('click', closeHandler);
  imageModal.addEventListener('click', bgClickHandler);

  downloadLink.onclick = async e=>{
    e.preventDefault();
    if(isViewOnce) return;
    try{
      const res = await fetch(modalImage.src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download=`chat_image_${Date.now()}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }catch(err){ alert("Couldn't download image."); console.error(err);}
  };
}

/* Mark messages as seen */
async function markMessagesAsSeen(){
  if(!auth.currentUser || !currentFriend) return;
  const chatId = getChatId(auth.currentUser.uid,currentFriend.uid);
  const messagesRef = ref(db, `chats/${chatId}/messages`);
  const snap = await get(messagesRef); if(!snap.exists()) return;
  let maxTs = 0;
  for(const [key,msg] of Object.entries(snap.val())){
    if(msg.sender===currentFriend.uid && !msg.seen) await update(ref(db, `chats/${chatId}/messages/${key}`), { seen:true });
    if(msg.timestamp>maxTs) maxTs=maxTs>msg.timestamp?maxTs:msg.timestamp;
  }
  await set(ref(db, `users/${auth.currentUser.uid}/lastRead/${chatId}`), maxTs);
}

/* Typing status */
function setTypingStatus(isTyping){
  if(!auth.currentUser || !currentFriend) return;
  const chatId = getChatId(auth.currentUser.uid,currentFriend.uid);
  set(ref(db, `chats/${chatId}/typing/${auth.currentUser.uid}`), isTyping);
}

/* Auth listener & real-time updates */
/* Auth listener & real-time updates */
auth.onAuthStateChanged(async user=>{
  if(!user) return;

 
    const chatSnap = await get(ref(db, `users/${user.uid}/currentChat`));
    if(!chatSnap.exists()) return;
    currentFriend = chatSnap.val();
    friendPhoto.src = currentFriend.photoURL || './assets/user.png';
    friendName.textContent = currentFriend.displayName || 'Friend';

    const chatId = getChatId(user.uid,currentFriend.uid);
    const messagesRef = ref(db, `chats/${chatId}/messages`);
    onValue(messagesRef, snap=>{
      const data = snap.val(); if(!data){ chatMessages.innerHTML=''; return; }
      Object.entries(data).forEach(([key,msg])=>{
        let div = chatMessages.querySelector(`.message[data-key="${key}"]`);
        if(!div) renderMessage(msg,user.uid,key);

        // Seen tick for sender
        div = chatMessages.querySelector(`.message[data-key="${key}"]`);
        if(msg.sender===user.uid && msg.seen){
          const bubble = div.querySelector('.bubble');
          if(!bubble.querySelector('.seen-text')){
            const seenText=document.createElement('div'); seenText.classList.add('seen-text');
            seenText.style.cssText="font-size:12px;color:#888;margin-top:4px;text-align:right;"; seenText.textContent='Seen';
            bubble.appendChild(seenText);
          }
        }

        // View-once click
        if(msg.viewOnce && msg.sender!==user.uid){
          const v1Box = div.querySelector('.view-once-box');
          if(v1Box) v1Box.onclick=()=>openImageModal(msg,key,true);
        }
      });
      chatMessages.scrollTop=chatMessages.scrollHeight;
      markMessagesAsSeen();
    });

    // Typing indicator
    const typingRef = ref(db, `chats/${chatId}/typing/${currentFriend.uid}`);
    onValue(typingRef,snap=>{
      const indicator=document.querySelector('.typing-indicator');
      if(indicator) indicator.classList.toggle('active',!!snap.val());
    });
  
});


// Call Render server to send push notifications
async function sendNotification(chatId, senderUid, msgData) {
  try {
    const response = await fetch('http://localhost:3000/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, senderUid, message: msgData })
    });

    // Try parsing JSON safely
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.error('Notification server error:', data || response.statusText);
      return;
    }

    if (data && data.success) {
      console.log('Notification sent:', data.response);
    } else {
      console.warn('Notification not sent:', data);
    }
  } catch (err) {
    console.error('Notification fetch error:', err);
  }
}






/* Send message */
sendBtn.addEventListener('click', async ()=>{
  if(!currentFriend || !auth.currentUser) return;
  const text = messageInput.value.trim(); if(!text && !pendingImageFile) return;
  sendBtn.disabled=true;
  const user = auth.currentUser;
  const messagesRef = ref(db, `chats/${getChatId(user.uid,currentFriend.uid)}/messages`);
  const msgData = { sender:user.uid, timestamp:Date.now() };
  try{
    if(pendingImageFile){
      const {url,deleteUrl} = await uploadToImgbb(pendingImageFile);
      msgData.image=url;
      if(viewOnceCheckbox.checked){ msgData.viewOnce=true; msgData.deleteUrl=deleteUrl; }
      pendingImageFile=null; previewImage.src=''; previewContainer.style.display='none'; fileInput.value=''; viewOnceCheckbox.checked=false;
    }
    if(text) msgData.text=text;
        
await push(messagesRef, msgData);

// ✅ Send notification via your Render server
const chatId = getChatId(user.uid, currentFriend.uid);
sendNotification(chatId, user.uid, msgData);

playBubbleSound(); 
messageInput.value=''; 
setTypingStatus(false);



  }catch(err){ console.error(err); alert('Send error: '+err.message); }
  finally{ sendBtn.disabled=false; }
});

/* Input & file handling */
messageInput.addEventListener('keypress', e=>{ if(e.key==='Enter') sendBtn.click(); });
messageInput.addEventListener('input', ()=>{
  setTypingStatus(true); clearTimeout(typingTimeout); typingTimeout=setTimeout(()=>setTypingStatus(false),2000);
});
fileBtn.addEventListener('click', ()=>fileInput.click());
fileInput.addEventListener('change', ()=>{
  pendingImageFile=fileInput.files[0];
  if(pendingImageFile){ previewImage.src=URL.createObjectURL(pendingImageFile); previewContainer.style.display='flex'; }
});
previewRemoveBtn.addEventListener('click', ()=>{ pendingImageFile=null; previewImage.src=''; previewContainer.style.display='none'; fileInput.value=''; });
chatMessages.addEventListener('scroll', markMessagesAsSeen);
window.addEventListener('load', markMessagesAsSeen);


