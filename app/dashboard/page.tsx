'use client';

import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getDashboardStats } from '@/services/dashboardService';
import { DashboardStats, FactoryStatDetail } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Activity, AlertTriangle, Wrench, Building2, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CHART_COLORS = ['hsl(var(--primary))', '#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b'];

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [factoryFilter, setFactoryFilter] = useState<string>('all');

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
        <main className="container mx-auto px-4 py-8 pb-24 md:pb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Overview monitoring perangkat IoT mesin jahit
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={factoryFilter} onValueChange={setFactoryFilter}>
                <SelectTrigger className="w-[200px] bg-background border-2">
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card className="border shadow-sm bg-card overflow-hidden">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total IoT Aktif
                </CardTitle>
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-emerald-600" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{totalActive}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Perangkat aktif</p>
              </CardContent>
            </Card>

            <Card className="border shadow-sm bg-card overflow-hidden">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Rusak / Repair
                </CardTitle>
                <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums text-amber-600">{totalBroken}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Sedang diperbaiki</p>
              </CardContent>
            </Card>

            <Card className="border shadow-sm bg-card overflow-hidden">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Repair Bulan Ini
                </CardTitle>
                <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Wrench className="h-4 w-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{totalRepairsMonth}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Perbaikan dilakukan</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className="border shadow-sm">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Statistik per Factory
                </CardTitle>
                <CardDescription>Jumlah device per factory</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={filteredFactoryStats} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                    <XAxis dataKey="factory" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(value: number) => [value, 'Device']}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {(filteredFactoryStats ?? []).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border shadow-sm lg:col-span-2">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-base">Statistik per Line (per Factory)</CardTitle>
                <CardDescription>Distribusi perangkat per line — dipisah per factory</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredLineStatsByFactory.length === 0 ? (
                    <p className="col-span-2 text-sm text-muted-foreground text-center py-8">Tidak ada data</p>
                  ) : (
                    filteredLineStatsByFactory.map(({ factory, lines }) => (
                      <div key={factory} className="border rounded-lg p-4 bg-muted/20">
                        <h4 className="text-sm font-semibold mb-3 text-foreground">{factory}</h4>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={lines} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                            <XAxis dataKey="line" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                                fontSize: '11px',
                              }}
                              formatter={(value: number) => [value, 'Device']}
                            />
                            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border shadow-sm">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="text-base">Detail per Factory</CardTitle>
              <CardDescription>
                Ringkasan aktif, rusak, dan repair per factory — filter di atas berlaku
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left font-medium p-4">Factory</th>
                      <th className="text-right font-medium p-4">Total Device</th>
                      <th className="text-right font-medium p-4">Aktif</th>
                      <th className="text-right font-medium p-4">Rusak / Repair</th>
                      <th className="text-right font-medium p-4">Repair Bulan Ini</th>
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
                        <tr key={row.factory} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-4 font-medium">{row.factory}</td>
                          <td className="p-4 text-right tabular-nums">{row.totalDevices}</td>
                          <td className="p-4 text-right tabular-nums text-emerald-600">{row.active}</td>
                          <td className="p-4 text-right tabular-nums text-amber-600">{row.broken}</td>
                          <td className="p-4 text-right tabular-nums">{row.repairsThisMonth}</td>
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
