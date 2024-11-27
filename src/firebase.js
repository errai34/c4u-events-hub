import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB2SDQyc9-3Ih99F5R3-yedY29IfsktxQc",
  authDomain: "c4u-events-hub.firebaseapp.com",
  projectId: "c4u-events-hub",
  storageBucket: "c4u-events-hub.firebasestorage.app",
  messagingSenderId: "1051696323890",
  appId: "1:1051696323890:web:429d8268a1e1845284cb2b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();