import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { DashboardStats, FactoryStatDetail } from '@/types';
import { get as cacheGet, set as cacheSet } from '@/utils/clientCache';
import { getAggregationsForDashboard } from '@/services/aggregationService';

const CACHE_TTL_DASHBOARD_MS = 2 * 60 * 1000; // 2 menit

/** Repairs bulan ini (satu query repairs). */
async function getRepairsThisMonth(factoryAccess?: string[]) {
  let repairsQuery = query(collection(db, 'repairs'), orderBy('date', 'desc'));
  if (factoryAccess?.length) {
    repairsQuery = query(repairsQuery, where('factory', 'in', factoryAccess));
  }
  const snap = await getDocs(repairsQuery);
  const repairs = snap.docs.map((d) => d.data());
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  let total = 0;
  const byFactory = new Map<string, number>();
  repairs.forEach((repair) => {
    const repairDate = repair.date?.toDate?.();
    if (!repairDate || repairDate < startOfMonth) return;
    total += 1;
    const f = (repair.factory as string) || 'Unknown';
    byFactory.set(f, (byFactory.get(f) || 0) + 1);
  });
  return { total, byFactory };
}

/** Statistik dashboard. Pakai aggregation (counter doc) jika ada agar tidak query semua device. */
export const getDashboardStats = async (factoryAccess?: string[]): Promise<DashboardStats> => {
  const cacheKey = `dashboard:${factoryAccess?.slice().sort().join(',') ?? 'all'}`;
  const cached = cacheGet<DashboardStats>(cacheKey);
  if (cached) return cached;

  const [aggs, repairsData] = await Promise.all([
    getAggregationsForDashboard(),
    getRepairsThisMonth(factoryAccess),
  ]);

  const { device: deviceAgg, factories: factoryAggs, lineStats: aggLineStats, lineStatsByFactory: aggLineStatsByFactory } = aggs;

  // Jalan cepat: pakai counter doc (tanpa baca semua device)
  if (deviceAgg && deviceAgg.total >= 0) {
    let factoryStats = factoryAggs.map((f) => ({ factory: f.factory, count: f.total }));
    let factoryDetail: FactoryStatDetail[] = factoryAggs.map((f) => ({
      factory: f.factory,
      active: f.active,
      broken: f.repair + f.broken,
      totalDevices: f.total,
      repairsThisMonth: repairsData.byFactory.get(f.factory) || 0,
    })).sort((a, b) => a.factory.localeCompare(b.factory));
    let lineStats = aggLineStats;
    let lineStatsByFactory = aggLineStatsByFactory;
    if (factoryAccess?.length) {
      const set = new Set(factoryAccess);
      factoryStats = factoryStats.filter((f) => set.has(f.factory));
      factoryDetail = factoryDetail.filter((f) => set.has(f.factory));
      lineStatsByFactory = lineStatsByFactory.filter((f) => set.has(f.factory));
      const lineMap = new Map<string, number>();
      lineStatsByFactory.forEach((f) =>
        f.lines.forEach((l) => lineMap.set(l.line, (lineMap.get(l.line) ?? 0) + l.count))
      );
      lineStats = Array.from(lineMap.entries()).map(([line, count]) => ({ line, count })).sort((a, b) => a.line.localeCompare(b.line, undefined, { numeric: true }));
    }
    const result: DashboardStats = {
      totalActive: deviceAgg.active,
      totalBroken: deviceAgg.repair + deviceAgg.broken,
      totalRepairsThisMonth: repairsData.total,
      factoryStats,
      lineStats,
      lineStatsByFactory,
      factoryDetail,
    };
    cacheSet(cacheKey, result, CACHE_TTL_DASHBOARD_MS);
    return result;
  }

  // Fallback: aggregation doc belum ada — query devices seperti dulu
  let devicesQuery = query(collection(db, 'devices'));
  let repairsQuery = query(collection(db, 'repairs'));
  if (factoryAccess && factoryAccess.length > 0) {
    devicesQuery = query(devicesQuery, where('factory', 'in', factoryAccess));
    repairsQuery = query(repairsQuery, where('factory', 'in', factoryAccess));
  }

  const [devicesSnapshot, repairsSnapshot] = await Promise.all([
    getDocs(devicesQuery),
    getDocs(repairsQuery),
  ]);

  const devices = devicesSnapshot.docs.map((doc) => doc.data());
  const repairs = repairsSnapshot.docs.map((doc) => doc.data());

  // Calculate stats: active = aktif, rusak = repair (sedang diperbaiki) + broken
  const totalActive = devices.filter((d) => d.status === 'active').length;
  const totalBroken = devices.filter(
    (d) => d.status === 'repair' || d.status === 'broken'
  ).length;

  // Repairs this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const repairsThisMonth = repairs.filter((repair) => {
    const repairDate = repair.date?.toDate();
    return repairDate && repairDate >= startOfMonth;
  }).length;

  // Factory stats
  const factoryMap = new Map<string, number>();
  devices.forEach((device) => {
    const factory = device.factory || 'Unknown';
    factoryMap.set(factory, (factoryMap.get(factory) || 0) + 1);
  });
  const factoryStats = Array.from(factoryMap.entries()).map(([factory, count]) => ({
    factory,
    count,
  }));

  // Per-factory detail (active, broken, repairs this month)
  const factoryDetailMap = new Map<string, { active: number; broken: number; total: number }>();
  devices.forEach((d) => {
    const f = d.factory || 'Unknown';
    if (!factoryDetailMap.has(f)) {
      factoryDetailMap.set(f, { active: 0, broken: 0, total: 0 });
    }
    const row = factoryDetailMap.get(f)!;
    row.total += 1;
    if (d.status === 'active') row.active += 1;
    else if (d.status === 'repair' || d.status === 'broken') row.broken += 1;
  });
  const repairsByFactory = new Map<string, number>();
  repairs.forEach((repair) => {
    const repairDate = repair.date?.toDate();
    const thisMonth = repairDate && repairDate >= startOfMonth;
    if (!thisMonth) return;
    const f = repair.factory || 'Unknown';
    repairsByFactory.set(f, (repairsByFactory.get(f) || 0) + 1);
  });
  const factoryDetail: FactoryStatDetail[] = Array.from(factoryDetailMap.entries()).map(
    ([factory, row]) => ({
      factory,
      active: row.active,
      broken: row.broken,
      totalDevices: row.total,
      repairsThisMonth: repairsByFactory.get(factory) || 0,
    })
  ).sort((a, b) => a.factory.localeCompare(b.factory));

  // Line stats (global)
  const lineMap = new Map<string, number>();
  devices.forEach((device) => {
    const line = device.line || 'Unknown';
    lineMap.set(line, (lineMap.get(line) || 0) + 1);
  });
  const lineStats = Array.from(lineMap.entries()).map(([line, count]) => ({
    line,
    count,
  }));

  // Line stats per factory (setiap factory terpisah)
  const lineByFactoryMap = new Map<string, Map<string, number>>();
  devices.forEach((device) => {
    const f = device.factory || 'Unknown';
    const line = device.line || 'Unknown';
    if (!lineByFactoryMap.has(f)) {
      lineByFactoryMap.set(f, new Map());
    }
    const lineMapForF = lineByFactoryMap.get(f)!;
    lineMapForF.set(line, (lineMapForF.get(line) || 0) + 1);
  });
  const lineStatsByFactory = Array.from(lineByFactoryMap.entries()).map(([factory, lineMapForF]) => ({
    factory,
    lines: Array.from(lineMapForF.entries())
      .map(([line, count]) => ({ line, count }))
      .sort((a, b) => a.line.localeCompare(b.line, undefined, { numeric: true })),
  })).sort((a, b) => a.factory.localeCompare(b.factory));

  const result: DashboardStats = {
    totalActive,
    totalBroken,
    totalRepairsThisMonth: repairsThisMonth,
    factoryStats,
    lineStats,
    lineStatsByFactory,
    factoryDetail,
  };
  cacheSet(cacheKey, result, CACHE_TTL_DASHBOARD_MS);
  return result;
};
