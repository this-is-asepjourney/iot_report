'use client';

import { useState, FormEvent } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QRScanner } from '@/components/QRScanner';
import { createReplacement } from '@/services/replacementService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { QrCode, RefreshCw } from 'lucide-react';

export default function GantiIoTPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    mcid_old: '',
    mac_old: '',
    mcid: '',
    mac_address: '',
    factory: '',
    line: '',
  });
  const [loading, setLoading] = useState(false);
  const [showMCIDOldScanner, setShowMCIDOldScanner] = useState(false);
  const [showMACOldScanner, setShowMACOldScanner] = useState(false);
  const [showMCIDScanner, setShowMCIDScanner] = useState(false);
  const [showMACScanner, setShowMACScanner] = useState(false);

  const handleScanMCIDOld = (result: string) => {
    setFormData((prev) => ({ ...prev, mcid_old: result }));
    setShowMCIDOldScanner(false);
  };
  const handleScanMACOld = (result: string) => {
    setFormData((prev) => ({ ...prev, mac_old: result }));
    setShowMACOldScanner(false);
  };
  const handleScanMCID = (result: string) => {
    setFormData((prev) => ({ ...prev, mcid: result }));
    setShowMCIDScanner(false);
  };
  const handleScanMAC = (result: string) => {
    setFormData((prev) => ({ ...prev, mac_address: result }));
    setShowMACScanner(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await createReplacement({
        mcid_old: formData.mcid_old.trim(),
        mac_old: formData.mac_old.trim() || undefined,
        mcid_new: formData.mcid.trim(),
        mac_address_new: formData.mac_address.trim(),
        factory: formData.factory.trim(),
        line: formData.line.trim(),
        technician: user?.name || '',
      });

      toast({
        title: 'Berhasil',
        description: 'Ganti IoT berhasil dicatat. Data device telah diperbarui.',
      });

      setFormData({
        mcid_old: '',
        mac_old: '',
        mcid: '',
        mac_address: '',
        factory: '',
        line: '',
      });
    } catch (err) {
      toast({
        title: 'Gagal',
        description: err instanceof Error ? err.message : 'Gagal menyimpan ganti IoT',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8 pb-24 md:pb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Ganti IoT
          </h1>
          <p className="text-muted-foreground mb-8">
            Catat penggantian perangkat IoT. Isi MCID lama (wajib) dan MAC lama (opsional), lalu data baru.
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Form Ganti IoT
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4 rounded-lg border border-dashed p-4 bg-muted/30">
                  <h3 className="font-medium text-sm text-muted-foreground">Data device lama (yang diganti)</h3>
                  <div>
                    <Label htmlFor="mcid_old">MCID lama (wajib)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="mcid_old"
                        value={formData.mcid_old}
                        onChange={(e) => setFormData((prev) => ({ ...prev, mcid_old: e.target.value }))}
                        placeholder="Scan atau masukkan MCID lama"
                        required
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowMCIDOldScanner(true)}
                        title="Scan MCID lama"
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="mac_old">MAC lama (opsional)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="mac_old"
                        value={formData.mac_old}
                        onChange={(e) => setFormData((prev) => ({ ...prev, mac_old: e.target.value }))}
                        placeholder="Scan atau masukkan MAC lama (opsional)"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowMACOldScanner(true)}
                        title="Scan MAC lama"
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border border-dashed p-4 bg-muted/30">
                  <h3 className="font-medium text-sm text-muted-foreground">Data baru (setelah ganti)</h3>
                  <div>
                    <Label htmlFor="mcid">MCID baru (identitas mesin, unik)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="mcid"
                        value={formData.mcid}
                        onChange={(e) => setFormData((prev) => ({ ...prev, mcid: e.target.value }))}
                        placeholder="Scan atau masukkan MCID baru"
                        required
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowMCIDScanner(true)}
                        title="Scan MCID baru"
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="mac_address">MAC Address baru (identitas IoT)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="mac_address"
                        value={formData.mac_address}
                        onChange={(e) => setFormData((prev) => ({ ...prev, mac_address: e.target.value }))}
                        placeholder="Scan atau masukkan MAC Address baru"
                        required
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowMACScanner(true)}
                        title="Scan MAC baru"
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="factory">Factory</Label>
                      <Input
                        id="factory"
                        value={formData.factory}
                        onChange={(e) => setFormData((prev) => ({ ...prev, factory: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="line">Line</Label>
                      <Input
                        id="line"
                        value={formData.line}
                        onChange={(e) => setFormData((prev) => ({ ...prev, line: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Menyimpan...' : 'Simpan Ganti IoT'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {showMCIDOldScanner && (
            <QRScanner onScan={handleScanMCIDOld} onClose={() => setShowMCIDOldScanner(false)} title="Scan MCID lama" />
          )}
          {showMACOldScanner && (
            <QRScanner onScan={handleScanMACOld} onClose={() => setShowMACOldScanner(false)} title="Scan MAC lama" />
          )}
          {showMCIDScanner && (
            <QRScanner onScan={handleScanMCID} onClose={() => setShowMCIDScanner(false)} title="Scan MCID baru" />
          )}
          {showMACScanner && (
            <QRScanner onScan={handleScanMAC} onClose={() => setShowMACScanner(false)} title="Scan MAC baru" />
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
