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
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Device, DeviceStatus } from '@/types';

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

export const getDeviceByMCID = async (mcid: string): Promise<Device | null> => {
  const q = query(collection(db, 'devices'), where('mcid', '==', mcid), limit(1));
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
  const byMcid = await getDeviceByMCID(mcid);
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
  pageSize: number = 20,
  lastDoc?: QueryDocumentSnapshot<DocumentData>
): Promise<{ devices: Device[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> => {
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

  return {
    devices: filteredDevices,
    lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1] || null,
  };
};

export const createDevice = async (device: Omit<Device, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'devices'), {
    ...device,
    created_at: new Date(),
    last_update: new Date(),
  });
  return docRef.id;
};

/** Tambah device hanya jika MCID belum ada (tidak duplikat). Dipakai saat data masuk dari list error / import repair. */
export const createDeviceIfNotExists = async (
  device: Omit<Device, 'id'>
): Promise<{ id: string; created: boolean }> => {
  const existing = await getDeviceByMCID(device.mcid.trim());
  if (existing) {
    return { id: existing.id, created: false };
  }
  const id = await createDevice(device);
  return { id, created: true };
};

export const updateDevice = async (id: string, updates: Partial<Device>): Promise<void> => {
  const docRef = doc(db, 'devices', id);
  await updateDoc(docRef, {
    ...updates,
    last_update: new Date(),
  });
};

export const updateDeviceStatus = async (id: string, status: DeviceStatus): Promise<void> => {
  await updateDevice(id, { status });
};

/** Daftar factory unik dari devices. Tanpa factoryAccess = semua factory dari data (factory baru otomatis muncul). */
export const getDistinctFactories = async (factoryAccess?: string[]): Promise<string[]> => {
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
  return Array.from(set).sort();
};

/** Daftar line unik dari devices (untuk filter dropdown). Opsional filter by factory. */
export const getDistinctLines = async (factory?: string): Promise<string[]> => {
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
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
};
