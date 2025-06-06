import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCakQC_7zu9YZoZ8rEKEnywuX9KzyfkkR4",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "moviemanagement-362f6.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID ||"moviemanagement-362f6",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "moviemanagement-362f6.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID ||"3504408042",
  appId: process.env.FIREBASE_APP_ID || "1:3504408042:web:94ecba5183902d6ad29e93",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID ||"G-0V3TM07EDZ",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

export { storage };

