/**
 * POST /api/admin/init-device-aggregation
 * Inisialisasi counter agregasi device (setelah deploy trigger atau data migrasi).
 * Opsi auth: (1) Authorization: Bearer <Firebase ID token> + user role admin, atau (2) x-init-secret / Bearer = INIT_AGGREGATION_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';

const AGGREGATIONS = 'aggregations';
const DEVICES_AGG_DOC = 'devices';
const FACTORY_PREFIX = 'factory_';
const LINE_PREFIX = 'line_';
const PAGE_SIZE = 1000;

function safeFactoryId(factory: string): string {
  if (!factory || typeof factory !== 'string') return 'Unknown';
  return factory.trim().replace(/\//g, '_');
}

function safeLineId(line: string): string {
  if (!line || typeof line !== 'string') return 'Unknown';
  return line.trim().replace(/\//g, '_');
}

function lineDocId(factory: string, line: string): string {
  return LINE_PREFIX + safeFactoryId(factory) + '_' + safeLineId(line);
}

function getStatus(status: string): 'active' | 'repair' | 'broken' {
  if (status === 'repair' || status === 'broken') return status;
  return 'active';
}

async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  const initSecret = process.env.INIT_AGGREGATION_SECRET;
  if (initSecret && token === initSecret) return true;
  if (!token) return false;
  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    const db = getAdminDb();
    const userSnap = await db.collection('users').doc(decoded.uid).get();
    const role = userSnap.data()?.role;
    return role === 'admin';
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const ok = await isAdminRequest(request);
    if (!ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const db = getAdminDb();
    const globalCounts = { total: 0, active: 0, repair: 0, broken: 0 };
    const factoryCounts = new Map<string, { total: number; active: number; repair: number; broken: number; name: string }>();
    const lineCounts = new Map<string, { total: number; active: number; repair: number; broken: number; factoryName: string; lineName: string }>();

    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let q: FirebaseFirestore.Query = db.collection('devices').orderBy('created_at', 'asc').limit(PAGE_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;

      snap.docs.forEach((doc) => {
        const d = doc.data();
        const status = getStatus((d.status as string) ?? 'active');
        const factory = (d.factory as string) ?? 'Unknown';
        const line = (d.line as string) ?? 'Unknown';
        const fid = safeFactoryId(factory);
        const factoryName = factory.trim() || 'Unknown';
        const lineName = line.trim() || 'Unknown';
        const lid = lineDocId(factory, line);

        globalCounts.total += 1;
        globalCounts[status] += 1;

        if (!factoryCounts.has(fid)) {
          factoryCounts.set(fid, { total: 0, active: 0, repair: 0, broken: 0, name: factoryName });
        }
        const fRow = factoryCounts.get(fid)!;
        fRow.total += 1;
        fRow[status] += 1;

        if (!lineCounts.has(lid)) {
          lineCounts.set(lid, { total: 0, active: 0, repair: 0, broken: 0, factoryName, lineName });
        }
        const lRow = lineCounts.get(lid)!;
        lRow.total += 1;
        lRow[status] += 1;
      });

      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < PAGE_SIZE) break;
    }

    const now = new Date();
    const BATCH_LIMIT = 500;
    let batch = db.batch();
    let opCount = 0;

    const flushBatch = async () => {
      if (opCount > 0) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    };

    batch.set(db.collection(AGGREGATIONS).doc(DEVICES_AGG_DOC), { ...globalCounts, lastUpdated: now });
    opCount += 1;

    for (const [fid, row] of factoryCounts) {
      if (opCount >= BATCH_LIMIT) await flushBatch();
      batch.set(db.collection(AGGREGATIONS).doc(FACTORY_PREFIX + fid), {
        total: row.total,
        active: row.active,
        repair: row.repair,
        broken: row.broken,
        name: row.name,
        lastUpdated: now,
      });
      opCount += 1;
    }

    for (const [lid, row] of lineCounts) {
      if (opCount >= BATCH_LIMIT) await flushBatch();
      batch.set(db.collection(AGGREGATIONS).doc(lid), {
        total: row.total,
        active: row.active,
        repair: row.repair,
        broken: row.broken,
        factoryName: row.factoryName,
        lineName: row.lineName,
        lastUpdated: now,
      });
      opCount += 1;
    }

    await flushBatch();

    return NextResponse.json({
      ok: true,
      total: globalCounts.total,
      active: globalCounts.active,
      repair: globalCounts.repair,
      broken: globalCounts.broken,
      factories: factoryCounts.size,
      lines: lineCounts.size,
    });
  } catch (e) {
    console.error('Init device aggregation error:', e);
    const message = e instanceof Error ? e.message : 'Init failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
