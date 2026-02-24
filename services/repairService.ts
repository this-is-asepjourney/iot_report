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
import { get as cacheGet, set as cacheSet, invalidateAll as cacheInvalidateAll, invalidateByPrefix } from '@/utils/clientCache';

const CACHE_TTL_COUNT_MS = 1 * 60 * 1000;  // 1 menit (sinkron dengan list agar count tidak ketinggalan)
const CACHE_TTL_LIST_MS = 1 * 60 * 1000;   // 1 menit
const CACHE_TTL_PENDING_REPAIR_MS = 30 * 1000; // 30 detik untuk getPendingRepairByMCID

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

/** Mengambil repair pending terbaru untuk MCID (untuk overwrite duplicate). Cache 30 detik bila ketemu. */
export const getPendingRepairByMCID = async (mcid: string): Promise<Repair | null> => {
  const key = (mcid || '').trim();
  if (!key) return null;
  const cacheKey = `pendingRepair:${key}`;
  const cached = cacheGet<Repair>(cacheKey);
  if (cached) return cached;

  const q = query(
    collection(db, 'repairs'),
    where('mcid', '==', key),
    where('status', '==', 'pending'),
    orderBy('date', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  const repair = {
    id: d.id,
    ...data,
    date: data.date?.toDate(),
    createdAt: data.createdAt?.toDate(),
  } as Repair;
  cacheSet(cacheKey, repair, CACHE_TTL_PENDING_REPAIR_MS);
  return repair;
};

/** Buat repair baru atau update repair pending yang sudah ada untuk MCID yang sama (Opsi A: overwrite). */
export const createOrUpdateRepairByMCID = async (
  repair: Omit<Repair, 'id' | 'createdAt'>
): Promise<{ id: string; updated: boolean }> => {
  const existing = await getPendingRepairByMCID(repair.mcid);
  if (existing) {
    const updates: Partial<Repair> = {
      device_id: repair.device_id,
      mcid: repair.mcid,
      mac_address: repair.mac_address,
      factory: repair.factory,
      line: repair.line,
      date: repair.date,
      problem: repair.problem,
      action: repair.action,
      technician_name: repair.technician_name,
      status: repair.status,
    };
    if (repair.media !== undefined) updates.media = repair.media;
    await updateRepair(existing.id, updates);
    return { id: existing.id, updated: true };
  }
  const id = await createRepair(repair);
  return { id, updated: false };
};

export const createRepair = async (repair: Omit<Repair, 'id' | 'createdAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'repairs'), {
    ...repair,
    createdAt: new Date(),
  });
  invalidateByPrefix('repairs');
  invalidateByPrefix('pendingRepair:');
  invalidateByPrefix('dashboard');
  return docRef.id;
};

export const updateRepair = async (id: string, updates: Partial<Repair>): Promise<void> => {
  const docRef = doc(db, 'repairs', id);
  await updateDoc(docRef, updates);
  invalidateByPrefix('repairs');
  invalidateByPrefix('pendingRepair:');
  invalidateByPrefix('dashboard');
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
