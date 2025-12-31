// Firebase Configuration and Initialization
import { initializeApp, FirebaseApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, Auth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  initializeFirestore,
  persistentLocalCache,
  Firestore,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage, FirebaseStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const firebaseConfig: FirebaseConfig = {
  apiKey: 'AIzaSyCUXsgRk9htRXIAyvmC4SDfAche_5YQZZ0',
  authDomain: 'book-tracker-b786e.firebaseapp.com',
  projectId: 'book-tracker-b786e',
  storageBucket: 'book-tracker-b786e.firebasestorage.app',
  messagingSenderId: '168297986996',
  appId: '1:168297986996:web:582183909a294db03fd0e1',
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);
const auth: Auth = getAuth(app);

// Initialize Firestore with offline persistence (caches data in IndexedDB)
// This reduces Firebase reads by serving from cache when possible
const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});

// Initialize Firebase Storage for image uploads
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, storage };
