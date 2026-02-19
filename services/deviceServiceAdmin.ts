/**
 * Device service untuk server (API routes) — pakai Firebase Admin SDK.
 * Logika tidak duplikat (createDeviceIfNotExists) sama dengan client, dipakai oleh webhook WhatsApp.
 */

import { getAdminDb } from '@/lib/firebase/admin';
import { DeviceStatus } from '@/types';

const COLLECTION = 'devices';

export interface DeviceInput {
  mcid: string;
  mac_address?: string;
  factory: string;
  line: string;
  status?: DeviceStatus;
}

/** Cek device by MCID (Admin). Returns id and mac_address for repair creation. */
export async function getDeviceByMCIDAdmin(
  mcid: string
): Promise<{ id: string; mac_address: string } | null> {
  const db = getAdminDb();
  const snap = await db.collection(COLLECTION).where('mcid', '==', mcid.trim()).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data();
  return {
    id: doc.id,
    mac_address: (data.mac_address as string) ?? '',
  };
}

/** Tambah device hanya jika MCID belum ada. Return { id, created }. */
export async function createDeviceIfNotExistsAdmin(
  input: DeviceInput
): Promise<{ id: string; created: boolean }> {
  const existing = await getDeviceByMCIDAdmin(input.mcid.trim());
  if (existing) return { id: existing.id, created: false };

  const db = getAdminDb();
  const now = new Date();
  const docRef = await db.collection(COLLECTION).add({
    mcid: input.mcid.trim(),
    mac_address: (input.mac_address ?? '').trim(),
    factory: input.factory.trim(),
    line: input.line.trim(),
    status: input.status ?? 'active',
    last_update: now,
    created_at: now,
  });
  return { id: docRef.id, created: true };
}

/** Update status device (Admin). Dipakai setelah create repair dari Telegram. */
export async function updateDeviceStatusAdmin(
  deviceId: string,
  status: DeviceStatus
): Promise<void> {
  const db = getAdminDb();
  await db.collection(COLLECTION).doc(deviceId).update({
    status,
    last_update: new Date(),
  });
}
