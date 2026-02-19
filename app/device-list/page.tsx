'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { searchDevices, getDistinctFactories, getDistinctLines, updateDevice, createDeviceIfNotExists, getDeviceByMCID } from '@/services/deviceService';
import { Device, DeviceStatus } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { debounce } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { Search, Pencil, PlusCircle } from 'lucide-react';

export default function DeviceListPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [factoryFilter, setFactoryFilter] = useState<string>('all');
  const [lineFilter, setLineFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [factoryOptions, setFactoryOptions] = useState<string[]>([]);
  const [lineOptions, setLineOptions] = useState<string[]>([]);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editForm, setEditForm] = useState<{ mcid: string; mac_address: string; factory: string; line: string; status: DeviceStatus }>({
    mcid: '',
    mac_address: '',
    factory: '',
    line: '',
    status: 'active',
  });
  const [savingDeviceId, setSavingDeviceId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ mcid: '', mac_address: '', factory: '', line: '' });
  const [addingDevice, setAddingDevice] = useState(false);

  useEffect(() => {
    getDistinctFactories().then(setFactoryOptions);
  }, []);

  useEffect(() => {
    getDistinctLines(factoryFilter && factoryFilter !== 'all' ? factoryFilter : undefined).then(setLineOptions);
  }, [factoryFilter]);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const result = await searchDevices(
        searchTerm,
        factoryFilter && factoryFilter !== 'all' ? factoryFilter : undefined,
        lineFilter && lineFilter !== 'all' ? lineFilter : undefined,
        statusFilter && statusFilter !== 'all' ? (statusFilter as DeviceStatus) : undefined
      );
      setDevices(result.devices);
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = debounce(loadDevices, 300);

  useEffect(() => {
    loadDevices();
  }, [factoryFilter, lineFilter, statusFilter]);

  useEffect(() => {
    debouncedSearch();
  }, [searchTerm]);

  const getStatusColor = (status: DeviceStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-500';
      case 'repair':
        return 'bg-yellow-500/20 text-yellow-500';
      case 'broken':
        return 'bg-red-500/20 text-red-500';
      default:
        return 'bg-gray-500/20 text-gray-500';
    }
  };

  const openEdit = (device: Device) => {
    setEditingDevice(device);
    setEditForm({
      mcid: device.mcid ?? '',
      mac_address: device.mac_address ?? '',
      factory: device.factory ?? '',
      line: device.line ?? '',
      status: device.status ?? 'active',
    });
  };

  const closeEdit = () => {
    setEditingDevice(null);
    setSavingDeviceId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingDevice) return;
    const { mcid, mac_address, factory, line, status } = editForm;
    if (!mcid.trim() || !factory.trim() || !line.trim()) {
      toast({
        title: 'Validasi gagal',
        description: 'MCID, Factory, dan Line wajib diisi.',
        variant: 'destructive',
      });
      return;
    }
    if (mcid.trim() !== editingDevice.mcid) {
      const existing = await getDeviceByMCID(mcid.trim());
      if (existing && existing.id !== editingDevice.id) {
        toast({
          title: 'MCID duplikat',
          description: 'MCID ini sudah dipakai device lain. Tidak bisa duplikat.',
          variant: 'destructive',
        });
        return;
      }
    }
    setSavingDeviceId(editingDevice.id);
    try {
      await updateDevice(editingDevice.id, { mcid: mcid.trim(), mac_address: mac_address.trim(), factory: factory.trim(), line: line.trim(), status });
      toast({ title: 'Berhasil', description: 'Data device telah diperbarui.' });
      closeEdit();
      await loadDevices();
    } catch (error) {
      console.error('Error updating device:', error);
      toast({
        title: 'Gagal',
        description: error instanceof Error ? error.message : 'Gagal memperbarui device.',
        variant: 'destructive',
      });
    } finally {
      setSavingDeviceId(null);
    }
  };

  const handleAddFromListError = async () => {
    const { mcid, mac_address, factory, line } = addForm;
    if (!mcid.trim() || !factory.trim() || !line.trim()) {
      toast({
        title: 'Validasi gagal',
        description: 'MCID, Factory, dan Line wajib diisi.',
        variant: 'destructive',
      });
      return;
    }
    setAddingDevice(true);
    try {
      const { created } = await createDeviceIfNotExists({
        mcid: mcid.trim(),
        mac_address: mac_address.trim(),
        factory: factory.trim(),
        line: line.trim(),
        status: 'active',
        last_update: new Date(),
        created_at: new Date(),
      });
      if (created) {
        toast({ title: 'Device ditambahkan', description: 'Data dari list error disimpan. MCID tidak duplikat.' });
        setAddForm({ mcid: '', mac_address: '', factory: '', line: '' });
        await loadDevices();
      } else {
        toast({
          title: 'Tidak duplikat',
          description: 'Device dengan MCID ini sudah ada di list. Data tidak disimpan dua kali.',
        });
      }
    } catch (error) {
      console.error('Error adding device:', error);
      toast({
        title: 'Gagal',
        description: error instanceof Error ? error.message : 'Gagal menambah device.',
        variant: 'destructive',
      });
    } finally {
      setAddingDevice(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8 pb-24 md:pb-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Device List
            </h1>
            <p className="text-muted-foreground">
              Data device tidak perlu diisi sekaligus. Anda bisa menyicil: ketika ada data masuk dari list error (misalnya saat import repair), device list akan menyimpan datanya. Satu MCID hanya boleh satu device — tidak bisa duplikat.
            </p>
          </div>

          {/* Tambah device dari list error */}
          <Card className="mb-6 border-2 border-dashed border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <PlusCircle className="h-5 w-5" />
                Tambah device dari list error
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Input MCID, Factory, Line (dan opsional MAC). Jika MCID sudah ada, data tidak akan duplikat.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-mcid">MCID</Label>
                  <Input
                    id="add-mcid"
                    value={addForm.mcid}
                    onChange={(e) => setAddForm((f) => ({ ...f, mcid: e.target.value }))}
                    placeholder="MCID (wajib)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-factory">Factory</Label>
                  <Input
                    id="add-factory"
                    value={addForm.factory}
                    onChange={(e) => setAddForm((f) => ({ ...f, factory: e.target.value }))}
                    placeholder="Factory (wajib)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-line">Line</Label>
                  <Input
                    id="add-line"
                    value={addForm.line}
                    onChange={(e) => setAddForm((f) => ({ ...f, line: e.target.value }))}
                    placeholder="Line (wajib)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-mac">MAC Address</Label>
                  <Input
                    id="add-mac"
                    value={addForm.mac_address}
                    onChange={(e) => setAddForm((f) => ({ ...f, mac_address: e.target.value }))}
                    placeholder="Opsional"
                  />
                </div>
              </div>
              <Button onClick={handleAddFromListError} disabled={addingDevice}>
                {addingDevice ? 'Menambah...' : 'Tambah ke device list (tidak duplikat)'}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4 mb-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari MCID, MAC Address, Factory, atau Line..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="broken">Broken</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : devices.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Tidak ada device ditemukan
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {(() => {
                const byFactory = devices.reduce((acc, d) => {
                  const f = d.factory || 'Unknown';
                  if (!acc[f]) acc[f] = [];
                  acc[f].push(d);
                  return acc;
                }, {} as Record<string, Device[]>);
                const sortedFactories = Object.keys(byFactory).sort();
                return sortedFactories.map((factory) => {
                  const factoryDevices = byFactory[factory];
                  const byLine = factoryDevices.reduce((acc, d) => {
                    const line = d.line || 'Unknown';
                    if (!acc[line]) acc[line] = [];
                    acc[line].push(d);
                    return acc;
                  }, {} as Record<string, Device[]>);
                  const sortedLines = Object.keys(byLine).sort((a, b) =>
                    a.localeCompare(b, undefined, { numeric: true })
                  );
                  return (
                    <div key={factory} className="space-y-6">
                      <h2 className="text-lg font-semibold pb-2 border-b flex items-center gap-2">
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">{factory}</span>
                        <span className="text-sm font-normal text-muted-foreground">
                          ({factoryDevices.length} device)
                        </span>
                      </h2>
                      {sortedLines.map((line) => (
                        <div key={`${factory}-${line}`}>
                          <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                            <span>Line: {line}</span>
                            <span className="text-xs">({byLine[line].length} device)</span>
                          </h3>
                          <div className="flex flex-col gap-3">
                            {byLine[line].map((device) => (
                              <Card key={device.id} className="hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50">
                                <CardContent className="p-6">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <h3 className="font-semibold">{device.mcid}</h3>
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                            device.status
                                          )}`}
                                        >
                                          {device.status}
                                        </span>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-8 w-8 p-0"
                                          onClick={() => openEdit(device)}
                                          title="Edit device"
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      MAC: {device.mac_address || '—'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Last Update: {new Date(device.last_update).toLocaleDateString('id-ID')}
                                    </p>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* Dialog Edit Device */}
          {editingDevice && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <Card className="w-full max-w-md border-2 shadow-lg">
                <CardHeader className="border-b">
                  <CardTitle>Edit Device</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ubah nilai MCID, MAC Address, Factory, Line, atau Status
                  </p>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-mcid">MCID</Label>
                    <Input
                      id="edit-mcid"
                      value={editForm.mcid}
                      onChange={(e) => setEditForm((f) => ({ ...f, mcid: e.target.value }))}
                      placeholder="MCID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-mac">MAC Address</Label>
                    <Input
                      id="edit-mac"
                      value={editForm.mac_address}
                      onChange={(e) => setEditForm((f) => ({ ...f, mac_address: e.target.value }))}
                      placeholder="MAC Address (opsional)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-factory">Factory</Label>
                    <Input
                      id="edit-factory"
                      value={editForm.factory}
                      onChange={(e) => setEditForm((f) => ({ ...f, factory: e.target.value }))}
                      placeholder="Factory"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-line">Line</Label>
                    <Input
                      id="edit-line"
                      value={editForm.line}
                      onChange={(e) => setEditForm((f) => ({ ...f, line: e.target.value }))}
                      placeholder="Line"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={editForm.status}
                      onValueChange={(v: DeviceStatus) => setEditForm((f) => ({ ...f, status: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="repair">Repair</SelectItem>
                        <SelectItem value="broken">Broken</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleSaveEdit}
                      disabled={savingDeviceId !== null}
                      className="flex-1"
                    >
                      {savingDeviceId === editingDevice.id ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={closeEdit}
                      disabled={savingDeviceId !== null}
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
