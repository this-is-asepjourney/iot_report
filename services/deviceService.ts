import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Device, DeviceStatus } from '@/types';
import { getRepairIdsByDeviceId } from '@/services/repairService';
import { updateRepair } from '@/services/repairService';
import { get as cacheGet, set as cacheSet, invalidateAll as cacheInvalidateAll } from '@/utils/clientCache';

const CACHE_TTL_LIST_MS = 1 * 60 * 1000;   // 1 menit untuk list
const CACHE_TTL_DISTINCT_MS = 5 * 60 * 1000; // 5 menit untuk factory/line

export const getDeviceById = async (id: string): Promise<Device | null> => {
  const docRef = doc(db, 'devices', id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return {
      id: docSnap.id,
      ...docSnap.data(),
      last_update: docSnap.data().last_update?.toDate(),
      created_at: docSnap.data().created_at?.toDate(),
    } as Device;
  }
  
  return null;
};

/** MCID = identitas mesin jahit (1 MCID = 1 mesin). Query dengan trim agar konsisten. */
export const getDeviceByMCID = async (mcid: string): Promise<Device | null> => {
  const key = (mcid || '').trim();
  if (!key) return null;
  const q = query(collection(db, 'devices'), where('mcid', '==', key), limit(1));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
      last_update: doc.data().last_update?.toDate(),
      created_at: doc.data().created_at?.toDate(),
    } as Device;
  }
  
  return null;
};

export const checkDuplicateDevice = async (mcid: string, mac_address: string): Promise<boolean> => {
  const byMcid = await getDeviceByMCID((mcid || '').trim());
  if (byMcid) return true;
  if (!mac_address?.trim()) return false;
  const q = query(collection(db, 'devices'), where('mac_address', '==', mac_address.trim()), limit(1));
  const snap = await getDocs(q);
  return !snap.empty;
};

export const searchDevices = async (
  searchTerm: string,
  factory?: string,
  line?: string,
  status?: DeviceStatus,
  pageSize: number = 1000,
  lastDoc?: QueryDocumentSnapshot<DocumentData>
): Promise<{ devices: Device[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> => {
  // Cache hanya halaman pertama (tanpa lastDoc) untuk kurangi read
  if (!lastDoc) {
    const cacheKey = `searchDevices:${searchTerm}|${factory ?? ''}|${line ?? ''}|${status ?? ''}|${pageSize}`;
    const cached = cacheGet<{ devices: Device[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }>(cacheKey);
    if (cached) return cached;
  }

  let q = query(collection(db, 'devices'), orderBy('created_at', 'desc'));

  if (factory) {
    q = query(q, where('factory', '==', factory));
  }

  if (line) {
    q = query(q, where('line', '==', line));
  }

  if (status) {
    q = query(q, where('status', '==', status));
  }

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  // Tingkatkan limit menjadi 1000 agar semua device terambil (Firestore max limit per query)
  q = query(q, limit(pageSize));

  const querySnapshot = await getDocs(q);
  const devices = querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    last_update: doc.data().last_update?.toDate(),
    created_at: doc.data().created_at?.toDate(),
  })) as Device[];

  // Filter by search term if provided
  let filteredDevices = devices;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredDevices = devices.filter(
      (device) =>
        device.mcid.toLowerCase().includes(term) ||
        device.mac_address.toLowerCase().includes(term) ||
        device.factory.toLowerCase().includes(term) ||
        device.line.toLowerCase().includes(term)
    );
  }

  const result = {
    devices: filteredDevices,
    lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1] || null,
  };
  if (!lastDoc) {
    const cacheKey = `searchDevices:${searchTerm}|${factory ?? ''}|${line ?? ''}|${status ?? ''}|${pageSize}`;
    cacheSet(cacheKey, result, CACHE_TTL_LIST_MS);
  }
  return result;
};

/** Buat device. MCID harus unik (1 MCID = 1 mesin jahit). Melempar error jika MCID sudah terdaftar. */
export const createDevice = async (device: Omit<Device, 'id'>): Promise<string> => {
  const mcid = (device.mcid || '').trim();
  if (!mcid) throw new Error('MCID wajib diisi (identitas mesin jahit).');
  const existing = await getDeviceByMCID(mcid);
  if (existing) {
    throw new Error('MCID sudah terdaftar. Satu MCID = satu mesin jahit (identitas harus unik).');
  }
  const docRef = await addDoc(collection(db, 'devices'), {
    ...device,
    mcid,
    created_at: new Date(),
    last_update: new Date(),
  });
  cacheInvalidateAll();
  return docRef.id;
};

/** Tambah device hanya jika MCID belum ada. Satu MCID = satu mesin (identitas unik). Dipakai saat import / list error / input repair. */
export const createDeviceIfNotExists = async (
  device: Omit<Device, 'id'>
): Promise<{ id: string; created: boolean }> => {
  const mcid = (device.mcid || '').trim();
  if (!mcid) throw new Error('MCID wajib diisi (identitas mesin jahit).');
  const existing = await getDeviceByMCID(mcid);
  if (existing) {
    return { id: existing.id, created: false };
  }
  const id = await createDevice({ ...device, mcid });
  return { id, created: true };
};

/** Update device. Jika mengubah MCID, MCID baru harus belum dipakai device lain (1 MCID = 1 mesin). */
export const updateDevice = async (id: string, updates: Partial<Device>): Promise<void> => {
  if (updates.mcid != null) {
    const newMcid = (updates.mcid as string).trim();
    if (!newMcid) throw new Error('MCID wajib diisi (identitas mesin jahit).');
    const existing = await getDeviceByMCID(newMcid);
    if (existing && existing.id !== id) {
      throw new Error('MCID sudah dipakai device lain. Satu MCID = satu mesin jahit.');
    }
    updates = { ...updates, mcid: newMcid };
  }
  const docRef = doc(db, 'devices', id);
  await updateDoc(docRef, {
    ...updates,
    last_update: new Date(),
  });
  cacheInvalidateAll();
};

export const updateDeviceStatus = async (id: string, status: DeviceStatus): Promise<void> => {
  await updateDevice(id, { status });
};

/** Daftar factory unik dari devices. Cache 5 menit. */
export const getDistinctFactories = async (factoryAccess?: string[]): Promise<string[]> => {
  const cacheKey = `distinctFactories:${factoryAccess?.slice().sort().join(',') ?? 'all'}`;
  const cached = cacheGet<string[]>(cacheKey);
  if (cached) return cached;

  let q = query(collection(db, 'devices'), limit(1000));
  if (factoryAccess?.length) {
    q = query(q, where('factory', 'in', factoryAccess));
  }
  const snap = await getDocs(q);
  const set = new Set<string>();
  snap.docs.forEach((d) => {
    const f = d.data().factory;
    if (f) set.add(f);
  });
  const list = Array.from(set).sort();
  cacheSet(cacheKey, list, CACHE_TTL_DISTINCT_MS);
  return list;
};

/** Daftar line unik dari devices. Cache 5 menit. */
export const getDistinctLines = async (factory?: string): Promise<string[]> => {
  const cacheKey = `distinctLines:${factory ?? 'all'}`;
  const cached = cacheGet<string[]>(cacheKey);
  if (cached) return cached;

  let q = query(collection(db, 'devices'), limit(1000));
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
  cacheSet(cacheKey, list, CACHE_TTL_DISTINCT_MS);
  return list;
};

const DEVICES_PAGE_SIZE = 1000;

/** Ambil semua device dengan paginasi (untuk tool hapus duplikat). */
export const getAllDevices = async (): Promise<Device[]> => {
  const all: Device[] = [];
  let last: QueryDocumentSnapshot<DocumentData> | null = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = query(
      collection(db, 'devices'),
      orderBy('created_at', 'asc'),
      limit(DEVICES_PAGE_SIZE)
    );
    if (last) q = query(q, startAfter(last));
    const snap = await getDocs(q);
    const batch = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      last_update: d.data().last_update?.toDate(),
      created_at: d.data().created_at?.toDate(),
    })) as Device[];
    all.push(...batch);
    if (batch.length < DEVICES_PAGE_SIZE) break;
    last = snap.docs[snap.docs.length - 1];
  }
  return all;
};

export type DedupeProgress = {
  phase: 'loading' | 'analyzing' | 'removing';
  message: string;
  current?: number;
  total?: number;
  removedSoFar?: number;
  repairsReassignedSoFar?: number;
};

/** Hapus device duplikat (satu MCID = satu device). Yang dipertahankan: dokumen dengan created_at paling lama. Yang dihapus: repair yang mengacu ke device yang dihapus akan dialihkan ke device yang dipertahankan. Hanya boleh dipanggil admin. */
export const removeDuplicateDevices = async (
  onProgress?: (p: DedupeProgress) => void
): Promise<{
  duplicateCount: number;
  removedCount: number;
  repairsReassigned: number;
}> => {
  onProgress?.({ phase: 'loading', message: 'Memuat daftar device...' });
  const devices = await getAllDevices();
  onProgress?.({ phase: 'analyzing', message: `Menganalisis ${devices.length} device...` });

  const byMcid = new Map<string, Device[]>();
  for (const d of devices) {
    const key = (d.mcid || '').trim().toLowerCase();
    if (!key) continue;
    if (!byMcid.has(key)) byMcid.set(key, []);
    byMcid.get(key)!.push(d);
  }

  const duplicateGroups = Array.from(byMcid.entries()).filter(([, list]) => list.length > 1);
  const totalGroups = duplicateGroups.length;

  let removedCount = 0;
  let repairsReassigned = 0;

  for (let i = 0; i < duplicateGroups.length; i++) {
    const [mcidKey, list] = duplicateGroups[i];
    onProgress?.({
      phase: 'removing',
      message: `Memproses MCID duplikat: ${mcidKey}`,
      current: i + 1,
      total: totalGroups,
      removedSoFar: removedCount,
      repairsReassignedSoFar: repairsReassigned,
    });

    list.sort(
      (a, b) =>
        (a.created_at?.getTime() ?? 0) - (b.created_at?.getTime() ?? 0)
    );
    const [keep, ...duplicates] = list;
    const keepId = keep.id;

    for (const dup of duplicates) {
      const repairIds = await getRepairIdsByDeviceId(dup.id);
      for (const repairId of repairIds) {
        await updateRepair(repairId, { device_id: keepId });
        repairsReassigned++;
      }
      await deleteDoc(doc(db, 'devices', dup.id));
      removedCount++;
    }
  }

  const duplicateCount = totalGroups;
  cacheInvalidateAll();
  return { duplicateCount, removedCount, repairsReassigned };
};
