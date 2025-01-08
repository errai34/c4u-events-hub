// src/context/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, signOut } from 'firebase/auth';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Subscribe to changes in Firebase Auth user
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        console.log("User is signed in:", firebaseUser);
      } else {
        console.log("No user is signed in.");
      }
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  // Optional: Force the account selection every time
  // googleProvider.setCustomParameters({ prompt: 'select_account' });

  const signIn = async () => {
    try {
      // Attempt to sign in with Google
      const result = await signInWithPopup(auth, googleProvider);
      console.log("Sign-in successful. User:", result.user);
    } catch (error) {
      // Provide helpful console logs to diagnose
      if (error.code === 'auth/popup-closed-by-user') {
        console.error("Sign-in popup was closed prematurely by the user.");
      } else if (error.code === 'auth/unauthorized-domain') {
        console.error(`
          Unauthorized domain error. 
          1) Check "Authorized domains" in Firebase Console 
             (Authentication > Sign-in method > Authorized domains).
          2) Make sure "localhost" (and your dev port if needed) 
             or any custom domain are added.
        `);
      } else {
        console.error("Error signing in:", error);
      }
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
      console.log("User signed out successfully.");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, signIn, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
};
