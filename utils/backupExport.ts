/**
 * Export semua data devices, repairs, installations sebagai JSON backup.
 */

import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

const MAX_BACKUP = 5000;

function toPlain(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'object' && 'toDate' in obj && typeof (obj as { toDate: () => Date }).toDate === 'function') {
    return (obj as { toDate: () => Date }).toDate().toISOString();
  }
  if (Array.isArray(obj)) return obj.map(toPlain);
  if (Object.prototype.toString.call(obj) === '[object Object]') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = toPlain(v);
    return out;
  }
  return obj;
}

export async function exportBackupJson(): Promise<Blob> {
  const [devicesSnap, repairsSnap, installationsSnap] = await Promise.all([
    getDocs(query(collection(db, 'devices'), orderBy('created_at', 'desc'), limit(MAX_BACKUP))),
    getDocs(query(collection(db, 'repairs'), orderBy('date', 'desc'), limit(MAX_BACKUP))),
    getDocs(query(collection(db, 'installations'), orderBy('date_install', 'desc'), limit(MAX_BACKUP))),
  ]);

  const devices = devicesSnap.docs.map((d) => toPlain({ id: d.id, ...d.data() }));
  const repairs = repairsSnap.docs.map((d) => toPlain({ id: d.id, ...d.data() }));
  const installations = installationsSnap.docs.map((d) => toPlain({ id: d.id, ...d.data() }));

  const backup = {
    exportedAt: new Date().toISOString(),
    devices,
    repairs,
    installations,
  };

  return new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
