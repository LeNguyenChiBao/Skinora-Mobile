import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCakQC_7zu9YZoZ8rEKEnywuX9KzyfkkR4",
  authDomain: "moviemanagement-362f6.firebaseapp.com",
  projectId: "moviemanagement-362f6",
  storageBucket: "moviemanagement-362f6.appspot.com",
  messagingSenderId: "3504408042",
  appId: "1:3504408042:web:94ecba5183902d6ad29e93",
  measurementId: "G-0V3TM07EDZ",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

export { storage };

