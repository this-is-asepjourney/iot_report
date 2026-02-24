'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Users, Building2, Database, Download, Pencil, X, Check, Trash2, RefreshCw } from 'lucide-react';
import { auth } from '@/lib/firebase/config';
import { getAllUsers, updateUser } from '@/services/userService';
import { getDistinctFactories, getDistinctLines, removeDuplicateDevices, type DedupeProgress } from '@/services/deviceService';
import { exportBackupJson, downloadBlob } from '@/utils/backupExport';
import { User, UserRole } from '@/types';

export default function AdminPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ role: UserRole; factory_access: string }>({ role: 'teknisi', factory_access: '' });
  const [savingUser, setSavingUser] = useState(false);

  const [factories, setFactories] = useState<string[]>([]);
  const [linesByFactory, setLinesByFactory] = useState<Record<string, string[]>>({});
  const [factoryLineLoading, setFactoryLineLoading] = useState(true);

  const [backupLoading, setBackupLoading] = useState(false);
  const [dedupeLoading, setDedupeLoading] = useState(false);
  const [dedupeResult, setDedupeResult] = useState<{
    duplicateCount: number;
    removedCount: number;
    repairsReassigned: number;
  } | null>(null);
  const [dedupeProgress, setDedupeProgress] = useState<DedupeProgress | null>(null);
  const [initAggLoading, setInitAggLoading] = useState(false);
  const [initAggResult, setInitAggResult] = useState<{ total: number; factories: number; lines?: number } | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    loadFactoryLine();
  }, []);

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const list = await getAllUsers();
      setUsers(list);
    } catch (e) {
      toast({ title: 'Error', description: 'Gagal memuat daftar user', variant: 'destructive' });
    } finally {
      setUsersLoading(false);
    }
  };

  const loadFactoryLine = async () => {
    setFactoryLineLoading(true);
    try {
      const facs = await getDistinctFactories();
      setFactories(facs);
      const byFactory: Record<string, string[]> = {};
      for (const f of facs) {
        byFactory[f] = await getDistinctLines(f);
      }
      setLinesByFactory(byFactory);
    } catch (e) {
      toast({ title: 'Error', description: 'Gagal memuat factory & line', variant: 'destructive' });
    } finally {
      setFactoryLineLoading(false);
    }
  };

  const openEditUser = (user: User) => {
    setEditingUserId(user.id);
    setEditForm({
      role: user.role,
      factory_access: Array.isArray(user.factory_access) ? user.factory_access.join(', ') : '',
    });
  };

  const handleSaveUser = async () => {
    if (!editingUserId) return;
    setSavingUser(true);
    try {
      const factory_access = editForm.factory_access
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await updateUser(editingUserId, { role: editForm.role, factory_access });
      toast({ title: 'Berhasil', description: 'Data user telah diperbarui.' });
      setEditingUserId(null);
      loadUsers();
    } catch (e: unknown) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Gagal menyimpan user',
        variant: 'destructive',
      });
    } finally {
      setSavingUser(false);
    }
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const blob = await exportBackupJson();
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `iot-report-backup-${date}.json`);
      toast({ title: 'Backup berhasil', description: 'File JSON telah diunduh.' });
    } catch (e) {
      toast({ title: 'Error', description: 'Gagal membuat backup', variant: 'destructive' });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRemoveDuplicates = async () => {
    setDedupeLoading(true);
    setDedupeResult(null);
    setDedupeProgress(null);
    try {
      const result = await removeDuplicateDevices((p) => setDedupeProgress(p));
      setDedupeResult(result);
      setDedupeProgress(null);
      if (result.removedCount > 0) {
        toast({
          title: 'Duplikat dihapus',
          description: `${result.removedCount} device duplikat dihapus. ${result.repairsReassigned} repair dialihkan ke device yang dipertahankan.`,
        });
      } else {
        toast({
          title: 'Tidak ada duplikat',
          description: 'Tidak ditemukan device dengan MCID ganda.',
        });
      }
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Gagal menghapus duplikat device',
        variant: 'destructive',
      });
    } finally {
      setDedupeLoading(false);
      setDedupeProgress(null);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8 pb-24 md:pb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Admin Panel
          </h1>
          <p className="text-muted-foreground mb-8">Kelola user, factory/line, dan backup data</p>

          {/* Manage Users */}
          <Card className="mb-8 border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Manage Users
              </CardTitle>
              <CardDescription>Ubah role dan factory access per user. Firestore rules harus mengizinkan admin menulis ke dokumen user lain.</CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : users.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Belum ada user terdaftar.</p>
              ) : (
                <div className="space-y-4">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border bg-muted/30"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{user.name || '—'}</p>
                        <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge variant="outline">{user.role}</Badge>
                          {Array.isArray(user.factory_access) && user.factory_access.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Factory: {user.factory_access.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      {editingUserId === user.id ? (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end border-t pt-4 sm:border-0 sm:pt-0">
                          <div>
                            <Label className="text-xs">Role</Label>
                            <Select
                              value={editForm.role}
                              onValueChange={(v: UserRole) => setEditForm((f) => ({ ...f, role: v }))}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="teknisi">Teknisi</SelectItem>
                                <SelectItem value="supervisor">Supervisor</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1 min-w-0">
                            <Label className="text-xs">Factory access (pisah koma)</Label>
                            <Input
                              value={editForm.factory_access}
                              onChange={(e) => setEditForm((f) => ({ ...f, factory_access: e.target.value }))}
                              placeholder="PabrikA, PabrikB"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveUser} disabled={savingUser}>
                              <Check className="h-4 w-4 mr-1" />
                              Simpan
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingUserId(null)} disabled={savingUser}>
                              <X className="h-4 w-4 mr-1" />
                              Batal
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => openEditUser(user)}>
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manage Factory & Line */}
          <Card className="mb-8 border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Factory & Line
              </CardTitle>
              <CardDescription>Daftar factory dan line yang muncul dari data device (read-only). Data baru muncul saat ada device/repair dengan factory/line tersebut.</CardDescription>
            </CardHeader>
            <CardContent>
              {factoryLineLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : factories.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Belum ada data factory/line.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {factories.map((factory) => (
                    <Card key={factory}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{factory}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {(linesByFactory[factory] || []).map((line) => (
                            <li key={line}>• {line}</li>
                          ))}
                          {(linesByFactory[factory] || []).length === 0 && (
                            <li className="italic">Tidak ada line</li>
                          )}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hapus Duplikat Device — hanya admin */}
          <Card className="mb-8 border-2 border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-primary" />
                Hapus Duplikat Device
              </CardTitle>
              <CardDescription>
                Jika total IoT membludak karena MCID sama terdaftar lebih dari satu kali, jalankan ini. Satu MCID = satu device. Yang dipertahankan: device dengan tanggal dibuat paling lama. Device duplikat akan dihapus; repair yang mengacu ke device yang dihapus akan dialihkan ke device yang dipertahankan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="destructive"
                onClick={handleRemoveDuplicates}
                disabled={dedupeLoading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {dedupeLoading ? 'Memproses...' : 'Hapus Duplikat Device'}
              </Button>
              {dedupeProgress && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <p className="text-sm font-medium">{dedupeProgress.message}</p>
                  {dedupeProgress.total != null && dedupeProgress.total > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          MCID duplikat: {dedupeProgress.current ?? 0} / {dedupeProgress.total}
                        </span>
                        {(dedupeProgress.removedSoFar != null || dedupeProgress.repairsReassignedSoFar != null) && (
                          <span>
                            Device dihapus: {dedupeProgress.removedSoFar ?? 0}
                            {dedupeProgress.repairsReassignedSoFar != null &&
                              ` · Repair dialihkan: ${dedupeProgress.repairsReassignedSoFar}`}
                          </span>
                        )}
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{
                            width: `${((dedupeProgress.current ?? 0) / dedupeProgress.total) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              {dedupeResult && (
                <div className="text-sm rounded-lg border bg-muted/50 p-4 space-y-1">
                  <p className="font-medium">Hasil:</p>
                  <p>MCID dengan duplikat: {dedupeResult.duplicateCount}</p>
                  <p>Device yang dihapus: {dedupeResult.removedCount}</p>
                  <p>Repair yang dialihkan: {dedupeResult.repairsReassigned}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inisialisasi counter device (aggregation) */}
          <Card className="mb-8 border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Inisialisasi Counter Device
              </CardTitle>
              <CardDescription>
                Isi ulang dokumen agregasi (total device, active, repair, broken) dari data device saat ini. Jalankan sekali setelah deploy Cloud Functions trigger atau setelah migrasi data. Dashboard akan memakai counter ini agar tidak membaca semua device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                onClick={async () => {
                  setInitAggLoading(true);
                  setInitAggResult(null);
                  try {
                    const token = await auth.currentUser?.getIdToken();
                    const res = await fetch('/api/admin/init-device-aggregation', {
                      method: 'POST',
                      headers: token ? { Authorization: `Bearer ${token}` } : {},
                    });
                    const text = await res.text();
                    let data: { error?: string; total?: number; factories?: number; lines?: number } = {};
                    try {
                      data = text ? JSON.parse(text) : {};
                    } catch {
                      toast({
                        title: 'Gagal',
                        description: 'Server mengembalikan respons bukan JSON. Periksa env Firebase Admin (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) di server dan log konsol.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    if (!res.ok) throw new Error(data.error || 'Gagal');
                    setInitAggResult({ total: data.total ?? 0, factories: data.factories ?? 0, lines: data.lines });
                    const linesStr = data.lines != null ? `, ${data.lines} line` : '';
                    toast({ title: 'Berhasil', description: `Counter diisi: ${data.total} device, ${data.factories} factory${linesStr}.` });
                  } catch (e) {
                    toast({
                      title: 'Gagal',
                      description: e instanceof Error ? e.message : 'Inisialisasi gagal',
                      variant: 'destructive',
                    });
                  } finally {
                    setInitAggLoading(false);
                  }
                }}
                disabled={initAggLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${initAggLoading ? 'animate-spin' : ''}`} />
                {initAggLoading ? 'Memproses...' : 'Jalankan inisialisasi'}
              </Button>
              {initAggResult && (
                <p className="text-sm text-muted-foreground">
                  Terakhir: {initAggResult.total} device, {initAggResult.factories} factory
                  {initAggResult.lines != null ? `, ${initAggResult.lines} line` : ''}.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Backup Data */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Backup Data
              </CardTitle>
              <CardDescription>Unduh semua data devices, repairs, dan installations dalam satu file JSON. Maksimal 5000 dokumen per koleksi.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleBackup} disabled={backupLoading}>
                <Download className="h-4 w-4 mr-2" />
                {backupLoading ? 'Membuat backup...' : 'Unduh Backup JSON'}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
}
