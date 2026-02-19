import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { DashboardStats, FactoryStatDetail } from '@/types';

/** Statistik dashboard. Tanpa factoryAccess = semua factory (factory baru otomatis ikut). */
export const getDashboardStats = async (factoryAccess?: string[]): Promise<DashboardStats> => {
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

  return {
    totalActive,
    totalBroken,
    totalRepairsThisMonth: repairsThisMonth,
    factoryStats,
    lineStats,
    lineStatsByFactory,
    factoryDetail,
  };
};
