import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  updateProfile 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";





import { loadExploreUsers} from './explore.js';

// ---- Firebase Config ----
const firebaseConfig = {
  apiKey: "AIzaSyDVfhLFmklJCoU6hsBEWRq5WutjNzNCYH4",
  authDomain: "interlyve.firebaseapp.com",
  projectId: "interlyve",
  storageBucket: "interlyve.firebasestorage.app",
  messagingSenderId: "679492513153",
  appId: "1:679492513153:web:46f2e68a7fc4f79aff8c80"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);


// ---- Signup DOM Elements ----
const signupPicInput = document.getElementById("signupProfilePic");
const signupPicPreview = document.getElementById("signupPicPreview");
const uploadPicBtn = document.getElementById("uploadPicBtn");
const fileNameDisplay = document.getElementById("fileNameDisplay");



if (signupPicInput && signupPicPreview && uploadPicBtn) {
  uploadPicBtn.addEventListener("click", () => {
    signupPicInput.value = "";
    signupPicInput.click();
  });

  signupPicInput.addEventListener("change", () => {
    const file = signupPicInput.files[0];
    signupPicPreview.src = file ? URL.createObjectURL(file) : "default-avatar.png";
    if (fileNameDisplay) fileNameDisplay.textContent = file ? file.name : "";
  });
}

// ---- Save user to RTDB ----
async function saveUserToRTDB(user, extraData) {
  await set(ref(db, 'users/' + user.uid), {
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL || null,
    bio: extraData.bio || "",
    country: extraData.country || "",
    gender: extraData.gender || "",
    dateOfBirth: extraData.dateOfBirth || "",
    location: extraData.location || "",
    termsAccepted: extraData.termsAccepted || false,
    isDeveloper: false,
    signupDate: extraData.signupDate || Date.now()
  });
}

// ---- Signup ----
export async function signup() {
  const usernameInput = document.getElementById("signupUsername");
  const emailInput = document.getElementById("signupEmail");
  const passwordInput = document.getElementById("signupPassword");

  if (!usernameInput || !emailInput || !passwordInput) return;

  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const bio = document.getElementById("signupBio")?.value.trim() || "";
  const country = document.getElementById("signupCountry")?.value || "";
  const gender = document.getElementById("signupGender")?.value || "";
  const dateOfBirth = document.getElementById("signupDOB")?.value || "";
  const location = document.getElementById("signupLocation")?.value.trim() || "";
  const termsAccepted = document.getElementById("signupTerms")?.checked || false;
  const file = signupPicInput?.files[0];

  if (!username || !email || !password || !country || !gender || !dateOfBirth || !location) {
    alert("Please fill in all required fields.");
    return;
  }
  if (!termsAccepted) {
    alert("You must agree to the Terms and Conditions.");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    let photoURL = "";
    if (file) {
      const formData = new FormData();
      formData.append("image", file);
      const apiKey = "66bcddc873ba6b0036e823676c0d6e76";
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        body: formData
      });
      const result = await response.json();
      photoURL = result.data.url;
    }

    await updateProfile(user, { displayName: username, photoURL: photoURL || null });
    await saveUserToRTDB(user, { bio, country, gender, dateOfBirth, location, termsAccepted, signupDate: Date.now() });

    alert(`Welcome, ${username}! Account created.`);
    window.location.href = "main page.html"; 
  } catch (error) {
    alert(error.message);
  }
}

// ---- Login ----
export async function login() {
  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");
  if (!emailInput || !passwordInput) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert(`Welcome back!`);
    window.location.href = "main page.html"; 
  } catch (error) {
    alert(error.message);
  }
}

// ---- Tab Switching ----
const tabs = document.querySelectorAll('.tab-content');
const navItems = document.querySelectorAll('.bottom-nav .nav-item');

navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');
    const targetTab = item.getAttribute('data-tab');
    tabs.forEach(tab => tab.style.display = (tab.id === targetTab) ? 'block' : 'none');
  });
});

// ---- Settings ----
const editBtn = document.getElementById('editSettingsBtn');
const saveBtn = document.getElementById('saveSettingsBtn');
const editableFields = [
  document.getElementById('settingsUsername'),
  document.getElementById('settingsEmail'),
  document.getElementById('settingsDOB'),
  document.getElementById('settingsCountry'),
  document.getElementById('settingsGender'),
  document.getElementById('settingsLocation')
].filter(el => el !== null);


if (saveBtn) saveBtn.style.display = 'block';

if (editBtn) {
  editBtn.addEventListener('click', () => {
    const isDisabled = editableFields[0].disabled;
    editableFields.forEach(f => f.disabled = !isDisabled);
    saveBtn.style.display = isDisabled ? 'block' : 'none';
  });
}

async function loadSettings(user) {
  try {
    const snapshot = await get(ref(db, 'users/' + user.uid));
    if (!snapshot.exists()) return;

    const data = snapshot.val();
    editableFields[0].value = data.displayName || '';
    editableFields[1].value = data.email || '';
    editableFields[2].value = data.dateOfBirth || '';
    editableFields[3].value = data.country || '';
    editableFields[4].value = data.gender || '';
    editableFields[5].value = data.location || '';

    const profileImg = document.getElementById("settingsProfilePic");
    if (profileImg && data.photoURL) profileImg.src = data.photoURL;
  } catch (err) {
    console.error(err);
  }
}

if (saveBtn) {
  saveBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return alert('User not logged in.');

    const updatedData = {
      displayName: editableFields[0].value.trim(),
      email: editableFields[1].value.trim(),
      dateOfBirth: editableFields[2].value,
      country: editableFields[3].value.trim(),
      gender: editableFields[4].value,
      location: editableFields[5].value.trim(),
      photoURL: user.photoURL || null,
      termsAccepted: true,
      isDeveloper: false,
      signupDate: Date.now()
    };

    try {
      await updateProfile(user, { displayName: updatedData.displayName });
      if (user.email !== updatedData.email) await user.updateEmail(updatedData.email);
      await set(ref(db, 'users/' + user.uid), updatedData);

      editableFields.forEach(f => f.disabled = true);
      saveBtn.style.display = 'none';
      alert('Settings saved!');
    } catch (err) {
      console.error(err);
      alert('Error saving settings: ' + err.message);
    }
  });
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    loadSettings(user);
    loadExploreUsers(); // Load explore users now that currentUser exists
  }
});

// ---- Modals ----
export function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = "flex";
}
export function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = "none";
}




// ---- Global functions ----
window.login = login;
window.signup = signup;
window.openModal = openModal;
window.closeModal = closeModal;





// At the bottom of app.js
export { auth, db };
