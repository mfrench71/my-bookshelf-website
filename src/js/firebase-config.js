// Firebase Configuration and Initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCUXsgRk9htRXIAyvmC4SDfAche_5YQZZ0",
  authDomain: "book-tracker-b786e.firebaseapp.com",
  projectId: "book-tracker-b786e",
  storageBucket: "book-tracker-b786e.firebasestorage.app",
  messagingSenderId: "168297986996",
  appId: "1:168297986996:web:582183909a294db03fd0e1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
