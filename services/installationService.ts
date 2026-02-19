import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Installation } from '@/types';

export const getInstallationById = async (id: string): Promise<Installation | null> => {
  const docRef = doc(db, 'installations', id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return {
      id: docSnap.id,
      ...docSnap.data(),
      date_install: docSnap.data().date_install?.toDate(),
      createdAt: docSnap.data().createdAt?.toDate(),
    } as Installation;
  }
  
  return null;
};

export const getInstallations = async (
  factory?: string,
  line?: string
): Promise<Installation[]> => {
  let q = query(collection(db, 'installations'), orderBy('date_install', 'desc'));

  if (factory) {
    q = query(q, where('factory', '==', factory));
  }

  if (line) {
    q = query(q, where('line', '==', line));
  }

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    date_install: doc.data().date_install?.toDate(),
    createdAt: doc.data().createdAt?.toDate(),
  })) as Installation[];
};

export const createInstallation = async (
  installation: Omit<Installation, 'id' | 'createdAt'>
): Promise<string> => {
  const docRef = await addDoc(collection(db, 'installations'), {
    ...installation,
    createdAt: new Date(),
  });
  return docRef.id;
};

export const checkDuplicateDevice = async (
  mcid: string,
  mac_address: string
): Promise<boolean> => {
  const mcidQuery = query(collection(db, 'devices'), where('mcid', '==', mcid), limit(1));
  const macQuery = query(
    collection(db, 'devices'),
    where('mac_address', '==', mac_address),
    limit(1)
  );

  const [mcidSnapshot, macSnapshot] = await Promise.all([
    getDocs(mcidQuery),
    getDocs(macQuery),
  ]);

  return !mcidSnapshot.empty || !macSnapshot.empty;
};
