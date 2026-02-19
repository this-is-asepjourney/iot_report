/**
 * Repair service untuk server (API routes) — pakai Firebase Admin SDK.
 * Dipakai oleh webhook Telegram untuk membuat repair dari laporan leader.
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

export async function createRepairAdmin(input: CreateRepairAdminInput): Promise<string> {
  const db = getAdminDb();
  const docRef = await db.collection(COLLECTION).add({
    ...input,
    createdAt: new Date(),
  });
  return docRef.id;
}
