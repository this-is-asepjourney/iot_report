/**
 * Baca counter agregasi device (total, active, repair, broken) dari Firestore.
 * Counter di-update oleh Cloud Functions trigger pada collection devices.
 * Mengurangi read: dashboard hanya baca 1 doc (+ doc per factory) instead of semua device.
 */

import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { get as cacheGet, set as cacheSet, invalidateByPrefix } from '@/utils/clientCache';

const AGGREGATIONS = 'aggregations';
const DEVICES_AGG_DOC = 'devices';
const FACTORY_PREFIX = 'factory_';
const LINE_PREFIX = 'line_';
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 menit

export interface DeviceAggregation {
  total: number;
  active: number;
  repair: number;
  broken: number;
  lastUpdated?: Date;
}

export interface FactoryAggregation {
  factory: string;
  total: number;
  active: number;
  repair: number;
  broken: number;
}

export interface AggregationsForDashboard {
  device: DeviceAggregation | null;
  factories: FactoryAggregation[];
  lineStats: { line: string; count: number }[];
  lineStatsByFactory: { factory: string; lines: { line: string; count: number }[] }[];
}

/** Baca counter global device (1 read). Return null jika doc belum ada (sebelum trigger/init). */
export async function getDeviceAggregation(): Promise<DeviceAggregation | null> {
  const cacheKey = 'aggregation:devices';
  const cached = cacheGet<DeviceAggregation | null>(cacheKey);
  if (cached !== undefined) return cached;

  const ref = doc(db, AGGREGATIONS, DEVICES_AGG_DOC);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    cacheSet(cacheKey, null, CACHE_TTL_MS);
    return null;
  }

  const d = snap.data();
  const result: DeviceAggregation = {
    total: Number(d?.total ?? 0),
    active: Number(d?.active ?? 0),
    repair: Number(d?.repair ?? 0),
    broken: Number(d?.broken ?? 0),
    lastUpdated: d?.lastUpdated?.toDate?.(),
  };
  cacheSet(cacheKey, result, CACHE_TTL_MS);
  return result;
}

/** Baca counter per factory. Doc id format: factory_{safeId}. Returns list (N reads = jumlah factory). */
export async function getFactoryAggregations(): Promise<FactoryAggregation[]> {
  const cacheKey = 'aggregation:factories';
  const cached = cacheGet<FactoryAggregation[]>(cacheKey);
  if (cached) return cached;

  const collRef = collection(db, AGGREGATIONS);
  const snap = await getDocs(collRef);
  const list: FactoryAggregation[] = [];

  snap.docs.forEach((docSnap) => {
    if (!docSnap.id.startsWith(FACTORY_PREFIX)) return;
    const d = docSnap.data();
    list.push({
      factory: typeof d?.name === 'string' ? d.name : docSnap.id.replace(FACTORY_PREFIX, '').replace(/_/g, '/'),
      total: Number(d?.total ?? 0),
      active: Number(d?.active ?? 0),
      repair: Number(d?.repair ?? 0),
      broken: Number(d?.broken ?? 0),
    });
  });

  list.sort((a, b) => a.factory.localeCompare(b.factory));
  cacheSet(cacheKey, list, CACHE_TTL_MS);
  return list;
}

/** Satu getDocs(aggregations) untuk dashboard: device + factories + line stats (termasuk line_*). */
export async function getAggregationsForDashboard(): Promise<AggregationsForDashboard> {
  const cacheKey = 'aggregation:dashboard';
  const cached = cacheGet<AggregationsForDashboard>(cacheKey);
  if (cached) return cached;

  const snap = await getDocs(collection(db, AGGREGATIONS));
  let device: DeviceAggregation | null = null;
  const factories: FactoryAggregation[] = [];
  const lineDocs: { factoryName: string; lineName: string; total: number }[] = [];

  snap.docs.forEach((docSnap) => {
    const d = docSnap.data();
    if (docSnap.id === DEVICES_AGG_DOC) {
      device = {
        total: Number(d?.total ?? 0),
        active: Number(d?.active ?? 0),
        repair: Number(d?.repair ?? 0),
        broken: Number(d?.broken ?? 0),
        lastUpdated: d?.lastUpdated?.toDate?.(),
      };
      return;
    }
    if (docSnap.id.startsWith(FACTORY_PREFIX)) {
      factories.push({
        factory: typeof d?.name === 'string' ? d.name : docSnap.id.replace(FACTORY_PREFIX, '').replace(/_/g, '/'),
        total: Number(d?.total ?? 0),
        active: Number(d?.active ?? 0),
        repair: Number(d?.repair ?? 0),
        broken: Number(d?.broken ?? 0),
      });
      return;
    }
    if (docSnap.id.startsWith(LINE_PREFIX)) {
      lineDocs.push({
        factoryName: typeof d?.factoryName === 'string' ? d.factoryName : 'Unknown',
        lineName: typeof d?.lineName === 'string' ? d.lineName : 'Unknown',
        total: Number(d?.total ?? 0),
      });
    }
  });

  factories.sort((a, b) => a.factory.localeCompare(b.factory));

  const lineStatsMap = new Map<string, number>();
  lineDocs.forEach(({ lineName, total }) => {
    lineStatsMap.set(lineName, (lineStatsMap.get(lineName) ?? 0) + total);
  });
  const lineStats = Array.from(lineStatsMap.entries())
    .map(([line, count]) => ({ line, count }))
    .sort((a, b) => a.line.localeCompare(b.line, undefined, { numeric: true }));

  const byFactoryMap = new Map<string, Map<string, number>>();
  lineDocs.forEach(({ factoryName, lineName, total }) => {
    if (!byFactoryMap.has(factoryName)) byFactoryMap.set(factoryName, new Map());
    const lineMap = byFactoryMap.get(factoryName)!;
    lineMap.set(lineName, (lineMap.get(lineName) ?? 0) + total);
  });
  const lineStatsByFactory = Array.from(byFactoryMap.entries())
    .map(([factory, lineMap]) => ({
      factory,
      lines: Array.from(lineMap.entries())
        .map(([line, count]) => ({ line, count }))
        .sort((a, b) => a.line.localeCompare(b.line, undefined, { numeric: true })),
    }))
    .sort((a, b) => a.factory.localeCompare(b.factory));

  const result: AggregationsForDashboard = {
    device,
    factories,
    lineStats,
    lineStatsByFactory,
  };
  cacheSet(cacheKey, result, CACHE_TTL_MS);
  return result;
}

/** Invalidasi cache aggregation (dipanggil setelah write device jika perlu). */
export function invalidateAggregationCache(): void {
  invalidateByPrefix('aggregation:');
}
