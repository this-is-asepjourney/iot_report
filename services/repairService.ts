import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Repair } from '@/types';

export const getRepairById = async (id: string): Promise<Repair | null> => {
  const docRef = doc(db, 'repairs', id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return {
      id: docSnap.id,
      ...docSnap.data(),
      date: docSnap.data().date?.toDate(),
      createdAt: docSnap.data().createdAt?.toDate(),
    } as Repair;
  }
  
  return null;
};

export const getRepairs = async (
  factory?: string,
  line?: string,
  startDate?: Date,
  endDate?: Date,
  pageSize: number = 20,
  lastDoc?: QueryDocumentSnapshot<DocumentData>
): Promise<{ repairs: Repair[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> => {
  let q = query(collection(db, 'repairs'), orderBy('date', 'desc'));

  if (factory) {
    q = query(q, where('factory', '==', factory));
  }

  if (line) {
    q = query(q, where('line', '==', line));
  }

  if (startDate && endDate) {
    q = query(
      q,
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate))
    );
  }

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  q = query(q, limit(pageSize));

  const querySnapshot = await getDocs(q);
  const repairs = querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    date: doc.data().date?.toDate(),
    createdAt: doc.data().createdAt?.toDate(),
  })) as Repair[];

  return {
    repairs,
    lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1] || null,
  };
};

export const createRepair = async (repair: Omit<Repair, 'id' | 'createdAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'repairs'), {
    ...repair,
    createdAt: new Date(),
  });
  return docRef.id;
};

export const updateRepair = async (id: string, updates: Partial<Repair>): Promise<void> => {
  const docRef = doc(db, 'repairs', id);
  await updateDoc(docRef, updates);
};

export const approveRepair = async (id: string): Promise<void> => {
  await updateRepair(id, { status: 'approved' });
};
