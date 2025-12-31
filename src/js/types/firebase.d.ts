/**
 * Firebase CDN Module Type Declarations
 * Declares types for Firebase modules imported via CDN URLs
 */

// Re-export everything from the npm package types
declare module 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js' {
  export * from 'firebase/app';
}

declare module 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js' {
  export * from 'firebase/auth';
}

declare module 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js' {
  export * from 'firebase/firestore';
}

declare module 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js' {
  export * from 'firebase/storage';
}

// Declare the firebase-config module
declare module '/js/firebase-config.js' {
  import { Auth } from 'firebase/auth';
  import { Firestore } from 'firebase/firestore';
  import { FirebaseStorage } from 'firebase/storage';

  export const auth: Auth;
  export const db: Firestore;
  export const storage: FirebaseStorage;
}
