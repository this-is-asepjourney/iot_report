'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { getRepairs } from '@/services/repairService';
import { Repair } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { debounce } from '@/lib/utils';
import Link from 'next/link';
import { Search, CheckCircle2, Clock, AlertCircle, Download, Upload, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { exportRepairsToCSV } from '@/utils/csvExport';
import { downloadRepairCSVTemplate } from '@/utils/csvRepairTemplate';
import { useToast } from '@/components/ui/use-toast';
import Papa from 'papaparse';
import { createRepair, updateRepair } from '@/services/repairService';
import { getDeviceByMCID, createDevice, updateDeviceStatus, getDistinctFactories, getDistinctLines } from '@/services/deviceService';

/** Kolom wajib saat import repair. problem & action opsional (bisa diisi nanti di web app). */
const REPAIR_KOLOM_WAJIB = ['mcid', 'factory', 'line'] as const;

interface RepairCSVRow {
  mcid?: string;
  mac_address?: string;
  factory?: string;
  line?: string;
  date?: string;
  problem?: string;
  action?: string;
  technician_name?: string;
  [key: string]: string | undefined;
}

/** Normalisasi baris CSV: terima header typo (mis. mac_addre) dan abaikan baris kosong. */
function normalizeRepairRow(raw: Record<string, unknown>): RepairCSVRow {
  const get = (key: string, alt?: string) => {
    const v = raw[key] ?? (alt ? raw[alt] : undefined);
    return typeof v === 'string' ? v : '';
  };
  return {
    mcid: get('mcid'),
    mac_address: get('mac_address', 'mac_addre'),
    factory: get('factory'),
    line: get('line'),
    date: get('date'),
    problem: get('problem'),
    action: get('action'),
    technician_name: get('technician_name'),
  };
}

function isRowEmpty(row: RepairCSVRow): boolean {
  return !(row.mcid?.trim() || row.factory?.trim() || row.line?.trim());
}

export default function RepairListPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [factoryFilter, setFactoryFilter] = useState<string>('all');
  const [lineFilter, setLineFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [completionFilter, setCompletionFilter] = useState<string>('belum'); // default: tampilkan yang belum saja (list error)
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [updatingRepairId, setUpdatingRepairId] = useState<string | null>(null);
  const [factoryOptions, setFactoryOptions] = useState<string[]>([]);
  const [lineOptions, setLineOptions] = useState<string[]>([]);

  useEffect(() => {
    getDistinctFactories().then(setFactoryOptions);
  }, []);

  useEffect(() => {
    getDistinctLines(factoryFilter && factoryFilter !== 'all' ? factoryFilter : undefined).then(setLineOptions);
  }, [factoryFilter]);

  const loadRepairs = async () => {
    setLoading(true);
    try {
      const result = await getRepairs(
        factoryFilter && factoryFilter !== 'all' ? factoryFilter : undefined,
        lineFilter && lineFilter !== 'all' ? lineFilter : undefined
      );
      
      let filtered = result.repairs;
      
      // Filter by completion status
      if (completionFilter === 'done') {
        filtered = filtered.filter(r => r.status === 'completed' || r.status === 'approved');
      } else if (completionFilter === 'belum') {
        filtered = filtered.filter(r => r.status === 'pending');
      }
      
      // Filter by repair status
      if (statusFilter && statusFilter !== 'all') {
        filtered = filtered.filter(r => r.status === statusFilter);
      }
      
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (repair) =>
            repair.mcid.toLowerCase().includes(term) ||
            repair.mac_address.toLowerCase().includes(term) ||
            repair.factory.toLowerCase().includes(term) ||
            repair.line.toLowerCase().includes(term) ||
            repair.problem.toLowerCase().includes(term) ||
            repair.technician_name.toLowerCase().includes(term)
        );
      }
      
      // Urutkan ascending by line
      filtered.sort((a, b) => (a.line || '').localeCompare(b.line || '', undefined, { numeric: true }));
      
      setRepairs(filtered);
    } catch (error) {
      console.error('Error loading repairs:', error);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = debounce(loadRepairs, 300);

  useEffect(() => {
    loadRepairs();
  }, [factoryFilter, lineFilter, statusFilter, completionFilter]);

  useEffect(() => {
    debouncedSearch();
  }, [searchTerm]);

  const getStatusBadge = (status: Repair['status']) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/50">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Done
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50">
            <Clock className="h-3 w-3 mr-1" />
            Belum
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-500/20 text-gray-500 border-gray-500/50">
            <AlertCircle className="h-3 w-3 mr-1" />
            {status}
          </Badge>
        );
    }
  };

  const doneCount = repairs.filter(r => r.status === 'completed' || r.status === 'approved').length;
  const belumCount = repairs.filter(r => r.status === 'pending').length;

  const handleToggleDoneBelum = async (repair: Repair) => {
    const isDone = repair.status === 'completed' || repair.status === 'approved';
    const newStatus = isDone ? 'pending' as const : 'completed' as const;
    const newDeviceStatus = isDone ? 'repair' : 'active';
    const technicianName = user?.name || user?.email || 'Teknisi';
    setUpdatingRepairId(repair.id);
    try {
      await updateRepair(repair.id, {
        status: newStatus,
        ...(newStatus === 'completed' ? { technician_name: technicianName } : {}),
      });
      await updateDeviceStatus(repair.device_id, newDeviceStatus);
      toast({
        title: isDone ? 'Diubah ke Belum' : 'Ditandai Done',
        description: isDone
          ? 'Repair kembali ditampilkan di list error. Device status: repair.'
          : `Device ditandai selesai diperbaiki oleh ${technicianName}. Data tetap tersimpan di Device List.`,
      });
      loadRepairs();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Gagal mengubah status',
        variant: 'destructive',
      });
    } finally {
      setUpdatingRepairId(null);
    }
  };

  const handleExport = () => {
    if (repairs.length === 0) {
      toast({
        title: 'Tidak ada data',
        description: 'Tidak ada data untuk diekspor',
        variant: 'destructive',
      });
      return;
    }
    exportRepairsToCSV(repairs);
    toast({
      title: 'Export berhasil',
      description: `Data ${repairs.length} repair berhasil diekspor`,
    });
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setImportLoading(true);
    try {
      Papa.parse(importFile, {
        header: true,
        complete: async (results) => {
          const rawData = (results.data || []) as Record<string, unknown>[];
          const data = rawData.map(normalizeRepairRow);
          let successCount = 0;
          let deviceCreatedCount = 0;
          let skipEmpty = 0;
          let skipInvalid = 0;
          let skipError = 0;

          for (const row of data) {
            if (isRowEmpty(row)) {
              skipEmpty++;
              continue;
            }

            const mcid = (row.mcid ?? '').trim();
            const factory = (row.factory ?? '').trim();
            const line = (row.line ?? '').trim();
            const problem = (row.problem ?? '').trim();
            const action = (row.action ?? '').trim();
            const semuaWajibTerisi = mcid && factory && line;

            if (!semuaWajibTerisi) {
              skipInvalid++;
              continue;
            }

            try {
              let deviceId: string;
              let mac_address = (row.mac_address ?? '').trim();

              const device = await getDeviceByMCID(mcid);
              if (device) {
                deviceId = device.id;
                mac_address = mac_address || device.mac_address || '';
              } else {
                deviceId = await createDevice({
                  mcid,
                  mac_address: mac_address || '',
                  factory,
                  line,
                  status: 'active',
                  last_update: new Date(),
                  created_at: new Date(),
                });
                deviceCreatedCount++;
              }

              await createRepair({
                device_id: deviceId,
                mcid,
                mac_address,
                factory,
                line,
                date: row.date ? new Date(row.date) : new Date(),
                problem: problem || '',
                action: action || '',
                technician_name: row.technician_name?.trim() || user?.name || '',
                status: 'pending',
              });

              await updateDeviceStatus(deviceId, 'repair');
              successCount++;
            } catch (error) {
              console.error('Error importing repair:', error);
              skipError++;
            }
          }

          const totalFail = skipEmpty + skipInvalid + skipError;
          let desc = `Berhasil: ${successCount} repair di-import`;
          if (deviceCreatedCount > 0) {
            desc += ` (${deviceCreatedCount} device baru dibuat dari data repair)`;
          }
          desc += '.';
          if (totalFail > 0) {
            desc += ` Dilewati: ${totalFail}`;
            if (skipInvalid > 0) desc += ` (${skipInvalid} data tidak lengkap)`;
            if (skipEmpty > 0) desc += ` (${skipEmpty} baris kosong)`;
            if (skipError > 0) desc += ` (${skipError} error)`;
            desc += '.';
          }
          toast({
            title: 'Import selesai',
            description: desc,
          });

          setImportFile(null);
          setShowImportDialog(false);
          loadRepairs(); // Reload repairs
        },
        error: (error) => {
          toast({
            title: 'Error',
            description: 'Gagal membaca file CSV',
            variant: 'destructive',
          });
        },
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Gagal mengimport data',
        variant: 'destructive',
      });
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-8 max-w-6xl">
          <div className="flex flex-col gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 sm:mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                List IoT Error
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">Daftar perbaikan perangkat IoT</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <Card className="px-3 py-1.5 sm:px-4 sm:py-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 shrink-0" />
                  <span className="text-xs sm:text-sm font-medium">Done: {doneCount}</span>
                </div>
              </Card>
              <Card className="px-3 py-1.5 sm:px-4 sm:py-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-500 shrink-0" />
                  <span className="text-xs sm:text-sm font-medium">Belum: {belumCount}</span>
                </div>
              </Card>
              <div className="flex gap-2 flex-wrap w-full sm:w-auto">
                <Button variant="default" size="sm" className="sm:size-default shrink-0" asChild>
                  <Link href="/repair">
                    <PlusCircle className="h-4 w-4 mr-1.5 sm:mr-2" />
                    <span className="hidden sm:inline">Input Repair</span>
                    <span className="sm:hidden">Input</span>
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="sm:size-default"
                  onClick={handleExport}
                  disabled={repairs.length === 0}
                >
                  <Download className="h-4 w-4 mr-1.5 sm:mr-2" />
                  Export
                </Button>
                {(user?.role === 'supervisor' || user?.role === 'admin') && (
                  <Button variant="outline" size="sm" className="sm:size-default" onClick={() => setShowImportDialog(true)}>
                    <Upload className="h-4 w-4 mr-1.5 sm:mr-2" />
                    Import
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
            <div className="w-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Cari MCID, Factory, Line, Problem..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 sm:pl-10 text-base"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              <Select value={completionFilter} onValueChange={setCompletionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status Selesai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="belum">Belum</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status Repair" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>

              <Select value={factoryFilter} onValueChange={(v) => { setFactoryFilter(v); setLineFilter('all'); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter Factory" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Factory</SelectItem>
                  {factoryOptions.map((factory) => (
                    <SelectItem key={factory} value={factory}>
                      {factory}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={lineFilter} onValueChange={setLineFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter Line" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Line</SelectItem>
                  {lineOptions.map((line) => (
                    <SelectItem key={line} value={line}>
                      {line}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : repairs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Tidak ada data repair ditemukan
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {repairs.map((repair) => (
                <Card key={repair.id} className="hover:shadow-md transition-shadow overflow-hidden">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3 sm:mb-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5 sm:mb-2">
                          <h3 className="font-semibold text-base sm:text-lg break-all">{repair.mcid}</h3>
                          {getStatusBadge(repair.status)}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                          <div className="truncate" title={repair.mac_address}><span className="font-medium">MAC:</span> <span className="truncate block">{repair.mac_address || '—'}</span></div>
                          <div><span className="font-medium">Factory:</span> {repair.factory}</div>
                          <div><span className="font-medium">Line:</span> {repair.line}</div>
                          <div><span className="font-medium">Tanggal:</span> {format(repair.date, 'dd MMM yyyy')}</div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                      <div>
                        <span className="text-xs sm:text-sm font-medium text-muted-foreground">Problem:</span>
                        <p className="text-xs sm:text-sm mt-0.5 break-words">{repair.problem || '—'}</p>
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-medium text-muted-foreground">Action:</span>
                        <p className="text-xs sm:text-sm mt-0.5 break-words">{repair.action || '—'}</p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                        <span className="text-xs text-muted-foreground">Teknisi: {repair.technician_name || '—'}</span>
                        <span className="text-xs text-muted-foreground">{format(repair.createdAt || repair.date, 'dd/MM/yy HH:mm')}</span>
                        <Button
                          size="sm"
                          variant={repair.status === 'completed' || repair.status === 'approved' ? 'outline' : 'default'}
                          onClick={() => handleToggleDoneBelum(repair)}
                          disabled={updatingRepairId === repair.id}
                          className="w-full sm:w-auto min-w-[80px]"
                        >
                          {updatingRepairId === repair.id ? (
                            <span className="animate-pulse">...</span>
                          ) : repair.status === 'completed' || repair.status === 'approved' ? (
                            'Belum'
                          ) : (
                            'Done'
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Import Dialog */}
          {showImportDialog && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <Card className="w-full max-w-lg border-2 shadow-lg">
                <CardHeader className="border-b">
                  <CardTitle>Import Repair dari CSV</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Import data repair perangkat IoT dari file CSV
                  </p>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="bg-muted/50 p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-semibold">Download Template CSV</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={downloadRepairCSVTemplate}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Template
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Kolom wajib: mcid, factory, line. Kolom opsional: mac_address, date, problem, action, technician_name (problem & action bisa diisi nanti di web app).
                    </p>
                    <div className="text-xs font-mono bg-background p-2 rounded border">
                      mcid, mac_address, factory, line, date, problem, action, technician_name
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Baris yang valid (mcid, factory, line terisi) akan di-import. Jika MCID belum ada di Device List, device akan dibuat otomatis dari data repair — tidak perlu import device dulu; bisa dicicil sambil repair.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="import-csv">Pilih File CSV untuk Import</Label>
                    <Input
                      id="import-csv"
                      type="file"
                      accept=".csv"
                      onChange={handleImportFileChange}
                      className="mt-2"
                    />
                    {importFile && (
                      <p className="text-xs text-green-500 mt-2 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        File dipilih: {importFile.name}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleImport}
                      disabled={!importFile || importLoading}
                      className="flex-1"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {importLoading ? 'Mengimport...' : 'Import Data'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowImportDialog(false);
                        setImportFile(null);
                      }}
                      disabled={importLoading}
                    >
                      Batal
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
