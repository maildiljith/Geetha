// auth.js - Firebase Authentication & Access Control

const firebaseConfig = {
  projectId: "connecting-272c0",
  appId: "1:182177576718:web:e345b5dc0050623716495f",
  storageBucket: "connecting-272c0.firebasestorage.app",
  apiKey: "AIzaSyA9Yeb9kF6aqHKia-zueOf7pO-DBdeIvlY",
  authDomain: "connecting-272c0.firebaseapp.com",
  messagingSenderId: "182177576718"
};

// Initialize Firebase (using CDN loads in HTML)
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

// WHITELIST: Only these emails can access the dashboard
// ADD YOUR AUTHORIZED EMAILS HERE
const AUTHORIZED_EMAILS = [
  'maildiljith@gmail.com', // Initial authorized user
];

const GUEST_SESSION_KEY = 'fc_guest_access_dev';

function checkAuthState(onAuthenticated) {
  // Check for Guest Bypass (Development Only)
  if (localStorage.getItem(GUEST_SESSION_KEY) === 'true') {
    if (window.location.pathname.includes('login.html')) {
      window.location.href = 'index.html';
    } else if (onAuthenticated) {
      onAuthenticated({ email: 'guest@development.local', displayName: 'Guest User' });
    }
    return;
  }

  auth.onAuthStateChanged((user) => {
    if (user) {
      if (AUTHORIZED_EMAILS.includes(user.email)) {
        if (window.location.pathname.includes('login.html')) {
          window.location.href = 'index.html';
        } else if (onAuthenticated) {
          onAuthenticated(user);
        }
      } else {
        // Logged in but not authorized
        auth.signOut().then(() => {
          alert(`Access Denied: ${user.email} is not authorized.`);
          window.location.href = 'login.html?error=unauthorized';
        });
      }
    } else {
      // Not logged in
      if (!window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
      }
    }
  });
}

function loginWithGoogle() {
  auth.signInWithPopup(provider).catch((error) => {
    console.error("Login failed:", error);
    alert("Login failed: " + error.message);
  });
}

function loginAsGuest() {
  localStorage.setItem(GUEST_SESSION_KEY, 'true');
  window.location.href = 'index.html';
}

function logout() {
  localStorage.removeItem(GUEST_SESSION_KEY);
  auth.signOut().then(() => {
    window.location.href = 'login.html';
  });
}
