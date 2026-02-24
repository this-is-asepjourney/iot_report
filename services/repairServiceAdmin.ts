/**
 * Repair service untuk server (API routes) — pakai Firebase Admin SDK.
 * Dipakai oleh webhook Telegram untuk membuat repair dari laporan leader.
 * Opsi A: jika ada repair pending dengan MCID sama, overwrite (update) bukan buat baru.
 */

import { getAdminDb } from '@/lib/firebase/admin';

const COLLECTION = 'repairs';

export interface CreateRepairAdminInput {
  device_id: string;
  mcid: string;
  mac_address: string;
  factory: string;
  line: string;
  date: Date;
  problem: string;
  action: string;
  technician_name: string;
  status: 'pending' | 'completed' | 'approved';
}

/** Ambil repair pending terbaru untuk MCID (untuk overwrite). */
export async function getPendingRepairByMCIDAdmin(mcid: string): Promise<{ id: string } | null> {
  const db = getAdminDb();
  const snap = await db
    .collection(COLLECTION)
    .where('mcid', '==', (mcid || '').trim())
    .where('status', '==', 'pending')
    .orderBy('date', 'desc')
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id };
}

/** Buat repair baru atau update repair pending untuk MCID yang sama. */
export async function createOrUpdateRepairAdmin(
  input: CreateRepairAdminInput
): Promise<{ id: string; updated: boolean }> {
  const existing = await getPendingRepairByMCIDAdmin(input.mcid);
  const db = getAdminDb();
  if (existing) {
    await db.collection(COLLECTION).doc(existing.id).update({
      device_id: input.device_id,
      mcid: input.mcid,
      mac_address: input.mac_address,
      factory: input.factory,
      line: input.line,
      date: input.date,
      problem: input.problem,
      action: input.action,
      technician_name: input.technician_name,
      status: input.status,
    });
    return { id: existing.id, updated: true };
  }
  const docRef = await db.collection(COLLECTION).add({
    ...input,
    createdAt: new Date(),
  });
  return { id: docRef.id, updated: false };
}

export async function createRepairAdmin(input: CreateRepairAdminInput): Promise<string> {
  const db = getAdminDb();
  const docRef = await db.collection(COLLECTION).add({
    ...input,
    createdAt: new Date(),
  });
  return docRef.id;
}
