'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createRepair } from '@/services/repairService';
import { getDeviceByMCID, updateDeviceStatus } from '@/services/deviceService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { Search, List } from 'lucide-react';

export default function RepairPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [formData, setFormData] = useState({
        mcid: '',
        mac_address: '',
        factory: '',
        line: '',
        date: new Date().toISOString().split('T')[0],
        problem: '',
        action: '',
    });
    const [loading, setLoading] = useState(false);
    const [deviceFound, setDeviceFound] = useState(false);

    const handleMCIDSearch = async () => {
        if (!formData.mcid) return;

        try {
            const device = await getDeviceByMCID(formData.mcid);
            if (device) {
                setFormData((prev: typeof formData) => ({
                    ...prev,
                    mac_address: device.mac_address,
                    factory: device.factory,
                    line: device.line,
                }));
                setDeviceFound(true);
                toast({
                    title: 'Device ditemukan',
                    description: 'Data device berhasil dimuat',
                });
            } else {
                toast({
                    title: 'Device tidak ditemukan',
                    description: 'MCID tidak terdaftar',
                    variant: 'destructive',
                });
                setDeviceFound(false);
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Gagal mencari device',
                variant: 'destructive',
            });
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const device = await getDeviceByMCID(formData.mcid);
            if (device) {
                await createRepair({
                    device_id: device.id,
                    mcid: formData.mcid,
                    mac_address: formData.mac_address,
                    factory: formData.factory,
                    line: formData.line,
                    date: new Date(formData.date),
                    problem: formData.problem || '',
                    action: formData.action || '',
                    technician_name: user?.name || user?.email || '',
                    status: 'pending',
                });

                await updateDeviceStatus(device.id, 'repair');

                toast({
                    title: 'Berhasil',
                    description: 'Repair ditambahkan ke List IoT Error. Dialihkan ke list.',
                });

                setFormData({
                    mcid: '',
                    mac_address: '',
                    factory: '',
                    line: '',
                    date: new Date().toISOString().split('T')[0],
                    problem: '',
                    action: '',
                });
                setDeviceFound(false);

                router.push('/repair-list');
            } else {
                toast({
                    title: 'Error',
                    description: 'Device tidak ditemukan',
                    variant: 'destructive',
                });
            }
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
                    <div className="mb-8">
                        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                            Input Repair
                        </h1>
                        <p className="text-muted-foreground">
                            Tambah entry ke List IoT Error. Setelah simpan, data muncul di List Error dan bisa ditindak lanjuti (Done) di sana.
                        </p>
                    </div>

                    <Card className="border-2 shadow-lg">
                        <CardHeader className="border-b">
                            <CardTitle className="text-xl">Form Repair (satu kesatuan dengan List Error)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <Label htmlFor="mcid">MCID</Label>
                                        <Input
                                            id="mcid"
                                            value={formData.mcid}
                                            onChange={(e) => setFormData({ ...formData, mcid: e.target.value })}
                                            placeholder="Masukkan MCID"
                                            required
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <Button type="button" onClick={handleMCIDSearch} variant="outline">
                                            <Search className="h-4 w-4 mr-2" />
                                            Cari
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="mac_address">MAC Address</Label>
                                        <Input
                                            id="mac_address"
                                            value={formData.mac_address}
                                            onChange={(e) => setFormData({ ...formData, mac_address: e.target.value })}
                                            required
                                            disabled={deviceFound}
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="factory">Factory</Label>
                                        <Input
                                            id="factory"
                                            value={formData.factory}
                                            onChange={(e) => setFormData({ ...formData, factory: e.target.value })}
                                            required
                                            disabled={deviceFound}
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="line">Line</Label>
                                        <Input
                                            id="line"
                                            value={formData.line}
                                            onChange={(e) => setFormData({ ...formData, line: e.target.value })}
                                            required
                                            disabled={deviceFound}
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="date">Tanggal</Label>
                                        <Input
                                            id="date"
                                            type="date"
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="problem">Problem</Label>
                                    <Input
                                        id="problem"
                                        value={formData.problem}
                                        onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
                                        placeholder="Deskripsi masalah (opsional, bisa diisi nanti di List Error)"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="action">Action</Label>
                                    <Input
                                        id="action"
                                        value={formData.action}
                                        onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                                        placeholder="Tindakan yang dilakukan (opsional, bisa diisi nanti di List Error)"
                                    />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button type="submit" className="flex-1" disabled={loading}>
                                        {loading ? 'Menyimpan...' : 'Simpan & Lihat di List Error'}
                                    </Button>
                                    <Button type="button" variant="outline" asChild>
                                        <Link href="/repair-list">
                                            <List className="h-4 w-4 mr-2" />
                                            List Error
                                        </Link>
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </main>
            </div>
        </ProtectedRoute>
    );
}
