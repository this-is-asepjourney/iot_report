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
  getCountFromServer,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Repair } from '@/types';
import { get as cacheGet, set as cacheSet, invalidateAll as cacheInvalidateAll } from '@/utils/clientCache';

const CACHE_TTL_COUNT_MS = 2 * 60 * 1000;  // 2 menit
const CACHE_TTL_LIST_MS = 1 * 60 * 1000;   // 1 menit

/** Total count Belum (pending) dan Done (completed+approved). Cache 2 menit. */
export const getRepairsCount = async (
  factory?: string,
  line?: string
): Promise<{ pending: number; done: number }> => {
  const cacheKey = `repairsCount:${factory ?? ''}|${line ?? ''}`;
  const cached = cacheGet<{ pending: number; done: number }>(cacheKey);
  if (cached) return cached;

  let qP = query(collection(db, 'repairs'), where('status', '==', 'pending'));
  let qD = query(collection(db, 'repairs'), where('status', 'in', ['completed', 'approved']));
  if (factory) {
    qP = query(qP, where('factory', '==', factory));
    qD = query(qD, where('factory', '==', factory));
  }
  if (line) {
    qP = query(qP, where('line', '==', line));
    qD = query(qD, where('line', '==', line));
  }

  const [snapPending, snapDone] = await Promise.all([
    getCountFromServer(qP),
    getCountFromServer(qD),
  ]);

  const result = {
    pending: snapPending.data().count,
    done: snapDone.data().count,
  };
  cacheSet(cacheKey, result, CACHE_TTL_COUNT_MS);
  return result;
};

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

/** Status filter: satu nilai atau array untuk 'in' query (max 10). */
export type RepairStatusFilter = Repair['status'] | Repair['status'][];

export const getRepairs = async (
  factory?: string,
  line?: string,
  startDate?: Date,
  endDate?: Date,
  pageSize: number = 30,
  lastDoc?: QueryDocumentSnapshot<DocumentData>,
  statusFilter?: RepairStatusFilter
): Promise<{ repairs: Repair[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> => {
  // Cache hanya halaman pertama
  if (!lastDoc && !startDate && !endDate) {
    const statusKey = statusFilter == null ? '' : Array.isArray(statusFilter) ? statusFilter.join(',') : statusFilter;
    const cacheKey = `repairs:${factory ?? ''}|${line ?? ''}|${statusKey}|${pageSize}`;
    const cached = cacheGet<{ repairs: Repair[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }>(cacheKey);
    if (cached) return cached;
  }

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

  if (statusFilter != null) {
    const arr = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
    if (arr.length === 1) {
      q = query(q, where('status', '==', arr[0]));
    } else if (arr.length > 1 && arr.length <= 10) {
      q = query(q, where('status', 'in', arr));
    }
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

  const result = {
    repairs,
    lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1] || null,
  };
  if (!lastDoc && !startDate && !endDate) {
    const statusKey = statusFilter == null ? '' : Array.isArray(statusFilter) ? statusFilter.join(',') : statusFilter;
    const cacheKey = `repairs:${factory ?? ''}|${line ?? ''}|${statusKey}|${pageSize}`;
    cacheSet(cacheKey, result, CACHE_TTL_LIST_MS);
  }
  return result;
};

export const createRepair = async (repair: Omit<Repair, 'id' | 'createdAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'repairs'), {
    ...repair,
    createdAt: new Date(),
  });
  cacheInvalidateAll();
  return docRef.id;
};

export const updateRepair = async (id: string, updates: Partial<Repair>): Promise<void> => {
  const docRef = doc(db, 'repairs', id);
  await updateDoc(docRef, updates);
  cacheInvalidateAll();
};

/** Daftar repair yang mengacu ke device_id tertentu (untuk migrasi saat hapus duplikat device). */
export const getRepairIdsByDeviceId = async (deviceId: string): Promise<string[]> => {
  const q = query(
    collection(db, 'repairs'),
    where('device_id', '==', deviceId),
    limit(500)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.id);
};

export const approveRepair = async (id: string): Promise<void> => {
  await updateRepair(id, { status: 'approved' });
};

/** Daftar factory unik dari repairs (untuk filter List IoT Error). Hanya factory yang punya repair dengan status yang diberikan. */
export const getDistinctFactoriesFromRepairs = async (
  statusFilter: 'pending' | 'completed' | 'approved' = 'pending'
): Promise<string[]> => {
  const cacheKey = `repairs:distinctFactories:${statusFilter}`;
  const cached = cacheGet<string[]>(cacheKey);
  if (cached) return cached;

  const q = query(
    collection(db, 'repairs'),
    where('status', '==', statusFilter),
    limit(1000)
  );
  const snap = await getDocs(q);
  const set = new Set<string>();
  snap.docs.forEach((d) => {
    const f = d.data().factory;
    if (f) set.add(f);
  });
  const list = Array.from(set).sort();
  cacheSet(cacheKey, list, CACHE_TTL_COUNT_MS);
  return list;
};

/** Daftar line unik dari repairs (untuk filter List IoT Error). Opsional filter by factory. */
export const getDistinctLinesFromRepairs = async (
  factory?: string,
  statusFilter: 'pending' | 'completed' | 'approved' = 'pending'
): Promise<string[]> => {
  const cacheKey = `repairs:distinctLines:${factory ?? 'all'}:${statusFilter}`;
  const cached = cacheGet<string[]>(cacheKey);
  if (cached) return cached;

  let q = query(
    collection(db, 'repairs'),
    where('status', '==', statusFilter),
    limit(1000)
  );
  if (factory) {
    q = query(q, where('factory', '==', factory));
  }
  const snap = await getDocs(q);
  const set = new Set<string>();
  snap.docs.forEach((d) => {
    const line = d.data().line;
    if (line) set.add(line);
  });
  const list = Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  cacheSet(cacheKey, list, CACHE_TTL_COUNT_MS);
  return list;
};
