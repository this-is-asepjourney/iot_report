'use client';

import { useState, FormEvent } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QRScanner } from '@/components/QRScanner';
import { createInstallation } from '@/services/installationService';
import { createDevice, checkDuplicateDevice } from '@/services/deviceService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { QrCode } from 'lucide-react';

export default function NewInstallationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    mcid: '',
    mac_address: '',
    factory: '',
    line: '',
  });
  const [loading, setLoading] = useState(false);
  const [showMCIDScanner, setShowMCIDScanner] = useState(false);
  const [showMACScanner, setShowMACScanner] = useState(false);

  const handleScanMCID = (result: string) => {
    setFormData({ ...formData, mcid: result });
    setShowMCIDScanner(false);
  };

  const handleScanMAC = (result: string) => {
    setFormData({ ...formData, mac_address: result });
    setShowMACScanner(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check for duplicates
      const isDuplicate = await checkDuplicateDevice(formData.mcid, formData.mac_address);
      if (isDuplicate) {
        toast({
          title: 'Error',
          description: 'Device dengan MCID atau MAC Address ini sudah terdaftar',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Create device
      const deviceId = await createDevice({
        mcid: formData.mcid,
        mac_address: formData.mac_address,
        factory: formData.factory,
        line: formData.line,
        status: 'active',
        last_update: new Date(),
        created_at: new Date(),
      });

      // Create installation record
      await createInstallation({
        mcid: formData.mcid,
        mac_address: formData.mac_address,
        factory: formData.factory,
        line: formData.line,
        date_install: new Date(),
        technician: user?.name || '',
      });

      toast({
        title: 'Berhasil',
        description: 'Device baru berhasil diinstall',
      });

      // Reset form
      setFormData({
        mcid: '',
        mac_address: '',
        factory: '',
        line: '',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Gagal menyimpan data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8 pb-24 md:pb-8">
          <h1 className="text-3xl font-bold mb-8">New Installation</h1>

          <Card>
            <CardHeader>
              <CardTitle>Form Installasi Baru</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="mcid">MCID</Label>
                  <div className="flex gap-2">
                    <Input
                      id="mcid"
                      value={formData.mcid}
                      onChange={(e) => setFormData({ ...formData, mcid: e.target.value })}
                      placeholder="Scan atau masukkan MCID"
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowMCIDScanner(true)}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="mac_address">MAC Address</Label>
                  <div className="flex gap-2">
                    <Input
                      id="mac_address"
                      value={formData.mac_address}
                      onChange={(e) => setFormData({ ...formData, mac_address: e.target.value })}
                      placeholder="Scan atau masukkan MAC Address"
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowMACScanner(true)}
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
                      onChange={(e) => setFormData({ ...formData, factory: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="line">Line</Label>
                    <Input
                      id="line"
                      value={formData.line}
                      onChange={(e) => setFormData({ ...formData, line: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Menyimpan...' : 'Simpan Installasi'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {showMCIDScanner && (
            <QRScanner
              onScan={handleScanMCID}
              onClose={() => setShowMCIDScanner(false)}
              title="Scan MCID"
            />
          )}

          {showMACScanner && (
            <QRScanner
              onScan={handleScanMAC}
              onClose={() => setShowMACScanner(false)}
              title="Scan MAC Address"
            />
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
