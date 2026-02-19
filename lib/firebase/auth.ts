import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './config';
import { User } from '@/types';

export const login = async (email: string, password: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
  
  if (!userDoc.exists()) {
    throw new Error('User data not found');
  }

  return {
    ...userDoc.data(),
    id: userDoc.id,
  } as User;
};

export const logout = async () => {
  await signOut(auth);
};

export const getCurrentUser = (): Promise<User | null> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      unsubscribe();
      
      if (!firebaseUser) {
        resolve(null);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          resolve({
            ...userDoc.data(),
            id: userDoc.id,
          } as User);
        } else {
          resolve(null);
        }
      } catch (error) {
        console.error('Error getting user data:', error);
        resolve(null);
      }
    });
  });
};
