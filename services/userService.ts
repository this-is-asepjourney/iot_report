/**
 * User service — baca/update data user di Firestore (collection users).
 * Untuk Admin: list semua user, update role & factory_access.
 * Firestore rules harus mengizinkan admin baca/tulis dokumen user lain.
 */

import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { User, UserRole } from '@/types';

const COLLECTION = 'users';

export async function getAllUsers(): Promise<User[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.(),
  })) as User[];
}

export async function updateUser(
  uid: string,
  updates: { role?: UserRole; factory_access?: string[]; name?: string }
): Promise<void> {
  const ref = doc(db, COLLECTION, uid);
  const data: Record<string, unknown> = {};
  if (updates.role !== undefined) data.role = updates.role;
  if (updates.factory_access !== undefined) data.factory_access = updates.factory_access;
  if (updates.name !== undefined) data.name = updates.name;
  if (Object.keys(data).length === 0) return;
  await updateDoc(ref, data);
}
