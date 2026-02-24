'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getDashboardStats } from '@/services/dashboardService';
import { DashboardStats, FactoryStatDetail } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Activity, AlertTriangle, Wrench, Building2, Filter, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CHART_COLORS = ['hsl(var(--primary))', '#22d3ee', '#38bdf8', '#0ea5e9', '#06b6d4'];

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [factoryFilter, setFactoryFilter] = useState<string>('all');

  const goToDeviceList = (params: { factory?: string; line?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params.factory) sp.set('factory', params.factory);
    if (params.line) sp.set('line', params.line);
    if (params.status) sp.set('status', params.status);
    router.push(`/device-list${sp.toString() ? `?${sp.toString()}` : ''}`);
  };

  const goToRepairList = (params?: { factory?: string; line?: string }) => {
    if (!params?.factory && !params?.line) {
      router.push('/repair-list');
      return;
    }
    const sp = new URLSearchParams();
    if (params.factory) sp.set('factory', params.factory);
    if (params.line) sp.set('line', params.line);
    router.push(`/repair-list?${sp.toString()}`);
  };

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getDashboardStats();
        setStats(data);
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadStats();
    }
  }, [user]);

  const filteredFactoryDetail: FactoryStatDetail[] = factoryFilter === 'all'
    ? (stats?.factoryDetail ?? [])
    : (stats?.factoryDetail ?? []).filter((f) => f.factory === factoryFilter);

  const filteredFactoryStats = factoryFilter === 'all'
    ? (stats?.factoryStats ?? [])
    : (stats?.factoryStats ?? []).filter((f) => f.factory === factoryFilter);

  const filteredLineStatsByFactory =
    factoryFilter === 'all'
      ? (stats?.lineStatsByFactory ?? [])
      : (stats?.lineStatsByFactory ?? []).filter((f) => f.factory === factoryFilter);
  const totalActive = factoryFilter === 'all' ? (stats?.totalActive ?? 0) : filteredFactoryDetail[0]?.active ?? 0;
  const totalBroken = factoryFilter === 'all' ? (stats?.totalBroken ?? 0) : filteredFactoryDetail[0]?.broken ?? 0;
  const totalRepairsMonth = factoryFilter === 'all' ? (stats?.totalRepairsThisMonth ?? 0) : filteredFactoryDetail[0]?.repairsThisMonth ?? 0;

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center bg-muted/30">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent" />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-24 md:pb-8 max-w-7xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Dashboard
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                Overview monitoring perangkat IoT mesin jahit
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={factoryFilter} onValueChange={setFactoryFilter}>
                <SelectTrigger className="w-full sm:w-[200px] bg-background border-2">
                  <SelectValue placeholder="Semua Factory" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Factory</SelectItem>
                  {(stats?.factoryStats ?? []).map((f) => (
                    <SelectItem key={f.factory} value={f.factory}>
                      {f.factory}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <Link href="/device-list?status=active" className="focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
              <Card className="border shadow-sm bg-card overflow-hidden h-full transition-all hover:shadow-md hover:border-primary/30 cursor-pointer">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total IoT Aktif
                  </CardTitle>
                  <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Activity className="h-4 w-4 text-emerald-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums">{totalActive}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    Perangkat aktif <ChevronRight className="h-3 w-3" />
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/device-list?status=repair" className="focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
              <Card className="border shadow-sm bg-card overflow-hidden h-full transition-all hover:shadow-md hover:border-primary/30 cursor-pointer">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Rusak / Repair
                  </CardTitle>
                  <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums text-amber-600">{totalBroken}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    Sedang diperbaiki <ChevronRight className="h-3 w-3" />
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/repair-list" className="focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
              <Card className="border shadow-sm bg-card overflow-hidden h-full transition-all hover:shadow-md hover:border-primary/30 cursor-pointer">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Repair Bulan Ini
                  </CardTitle>
                  <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <Wrench className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums">{totalRepairsMonth}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    Lihat List Error <ChevronRight className="h-3 w-3" />
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="border-b bg-muted/30 py-3 sm:py-4">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 shrink-0" />
                  Statistik per Factory
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">Klik bar → Device List (filter factory)</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6">
                <div className="w-full min-h-[240px] sm:min-h-[280px]">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={filteredFactoryStats} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                      <XAxis dataKey="factory" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(value: number) => [value, 'Device']}
                        cursor={{ fill: 'hsl(var(--muted))' }}
                      />
                      <Bar
                        dataKey="count"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={48}
                        onClick={(data: { factory?: string }) => data?.factory && goToDeviceList({ factory: data.factory })}
                        style={{ cursor: 'pointer' }}
                      >
                        {(filteredFactoryStats ?? []).map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm overflow-hidden lg:col-span-2 lg:col-start-1">
              <CardHeader className="border-b bg-muted/30 py-3 sm:py-4">
                <CardTitle className="text-sm sm:text-base">Statistik per Line (per Factory)</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Klik bar → Device List (filter factory + line)</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {filteredLineStatsByFactory.length === 0 ? (
                    <p className="col-span-2 text-sm text-muted-foreground text-center py-8">Tidak ada data</p>
                  ) : (
                    filteredLineStatsByFactory.map(({ factory, lines }) => (
                      <div key={factory} className="border rounded-lg p-3 sm:p-4 bg-muted/20">
                        <h4 className="text-sm font-semibold mb-2 sm:mb-3 text-foreground">{factory}</h4>
                        <div className="min-h-[200px] sm:min-h-[220px]">
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={lines} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                              <XAxis dataKey="line" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={28} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
                                  fontSize: '11px',
                                }}
                                formatter={(value: number) => [value, 'Device']}
                                cursor={{ fill: 'hsl(var(--muted))' }}
                              />
                              <Bar
                                dataKey="count"
                                fill="hsl(var(--primary))"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={36}
                                onClick={(data: { line?: string }) => data?.line && goToDeviceList({ factory, line: data.line })}
                                style={{ cursor: 'pointer' }}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border shadow-sm overflow-hidden">
            <CardHeader className="border-b bg-muted/30 py-3 sm:py-4">
              <CardTitle className="text-sm sm:text-base">Detail per Factory</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Klik baris → Device List (filter factory)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto -mx-px">
                <table className="w-full text-sm min-w-[320px]">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left font-medium p-3 sm:p-4">Factory</th>
                      <th className="text-right font-medium p-3 sm:p-4">Total</th>
                      <th className="text-right font-medium p-3 sm:p-4">Aktif</th>
                      <th className="text-right font-medium p-3 sm:p-4">Rusak</th>
                      <th className="text-right font-medium p-3 sm:p-4">Repair</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFactoryDetail.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          Tidak ada data
                        </td>
                      </tr>
                    ) : (
                      filteredFactoryDetail.map((row) => (
                        <tr
                          key={row.factory}
                          onClick={() => goToDeviceList({ factory: row.factory })}
                          className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                        >
                          <td className="p-3 sm:p-4 font-medium">{row.factory}</td>
                          <td className="p-3 sm:p-4 text-right tabular-nums">{row.totalDevices}</td>
                          <td className="p-3 sm:p-4 text-right tabular-nums text-emerald-600">{row.active}</td>
                          <td className="p-3 sm:p-4 text-right tabular-nums text-amber-600">{row.broken}</td>
                          <td className="p-3 sm:p-4 text-right tabular-nums">{row.repairsThisMonth}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
}
