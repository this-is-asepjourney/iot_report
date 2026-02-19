/**
 * Firebase Admin SDK — dipakai di API routes (server) untuk menulis ke Firestore.
 * Jangan dipakai di client; gunakan lib/firebase/config.ts (client SDK) untuk web app.
 *
 * Env (akan diisi nanti):
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_CLIENT_EMAIL
 * - FIREBASE_PRIVATE_KEY  (private key dari service account, newline sebagai \n)
 * Atau: GOOGLE_APPLICATION_CREDENTIALS = path ke file JSON service account
 */

import { getApps, initializeApp, cert, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0] as App;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({ credential: applicationDefault() });
  }
  throw new Error(
    'Firebase Admin: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY atau GOOGLE_APPLICATION_CREDENTIALS'
  );
}

let _adminDb: ReturnType<typeof getFirestore> | null = null;

/** Lazy: Firestore Admin hanya di-init saat pertama dipakai (supaya build tidak gagal jika env belum ada). */
export function getAdminDb(): ReturnType<typeof getFirestore> {
  if (!_adminDb) _adminDb = getFirestore(getAdminApp());
  return _adminDb;
}
