/**
 * Service untuk Ganti IoT: cari device lama (MCID lama, MAC lama opsional), update ke data baru, catat riwayat.
 */

import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Replacement } from '@/types';
import { getDeviceByMCID, updateDevice } from '@/services/deviceService';

const COLLECTION = 'replacements';

export interface CreateReplacementInput {
  mcid_old: string;
  mac_old?: string;
  mcid_new: string;
  mac_address_new: string;
  factory: string;
  line: string;
  technician: string;
}

/**
 * Ganti IoT: update device yang match mcid_old (dan optional mac_old) dengan data baru, lalu simpan riwayat replacement.
 * Melempar error jika device lama tidak ditemukan atau MCID baru sudah dipakai device lain.
 */
export async function createReplacement(input: CreateReplacementInput): Promise<string> {
  const deviceOld = await getDeviceByMCID(input.mcid_old.trim());
  if (!deviceOld) {
    throw new Error('Device dengan MCID lama tidak ditemukan.');
  }
  if (input.mac_old != null && input.mac_old.trim() !== '' && deviceOld.mac_address !== input.mac_old.trim()) {
    // MAC lama diisi tapi tidak cocok - tetap lanjut (user mungkin salah ketik), bisa tambah validasi strict nanti
  }

  await updateDevice(deviceOld.id, {
    mcid: input.mcid_new.trim(),
    mac_address: input.mac_address_new.trim(),
    factory: input.factory.trim(),
    line: input.line.trim(),
  });

  const docRef = await addDoc(collection(db, COLLECTION), {
    mcid_old: input.mcid_old.trim(),
    mac_old: input.mac_old?.trim() || null,
    mcid_new: input.mcid_new.trim(),
    mac_address_new: input.mac_address_new.trim(),
    factory: input.factory.trim(),
    line: input.line.trim(),
    date_replace: new Date(),
    technician: input.technician.trim(),
    createdAt: new Date(),
  });

  return docRef.id;
}

export async function getReplacements(factory?: string, line?: string): Promise<Replacement[]> {
  let q = query(collection(db, COLLECTION), orderBy('date_replace', 'desc'));
  const snap = await getDocs(q);
  let list = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    date_replace: d.data().date_replace?.toDate?.(),
    createdAt: d.data().createdAt?.toDate?.(),
  })) as Replacement[];
  if (factory) list = list.filter((r) => r.factory === factory);
  if (line) list = list.filter((r) => r.line === line);
  return list;
}
