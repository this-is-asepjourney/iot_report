'use client';

import { useState, FormEvent, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createOrUpdateRepairByMCID } from '@/services/repairService';
import {
  getDeviceByMCID,
  updateDeviceStatus,
  createDeviceIfNotExists,
} from '@/services/deviceService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { uploadToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';
import { Search, List, ImagePlus, X } from 'lucide-react';

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
    const [mediaUrls, setMediaUrls] = useState<string[]>([]);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files?.length || !isCloudinaryConfigured()) {
            if (files?.length && !isCloudinaryConfigured()) {
                toast({
                    title: 'Upload media belum aktif',
                    description: 'Atur NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME dan NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET di .env.local',
                    variant: 'destructive',
                });
            }
            e.target.value = '';
            return;
        }
        setUploadingMedia(true);
        const urls: string[] = [];
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!file.type.startsWith('image/')) continue;
                const url = await uploadToCloudinary(file);
                urls.push(url);
            }
            setMediaUrls((prev) => [...prev, ...urls]);
            if (urls.length > 0) {
                toast({ title: 'Foto terunggah', description: `${urls.length} foto ditambahkan.` });
            }
        } catch (err: unknown) {
            toast({
                title: 'Upload gagal',
                description: err instanceof Error ? err.message : 'Gagal mengunggah foto',
                variant: 'destructive',
            });
        } finally {
            setUploadingMedia(false);
            e.target.value = '';
        }
    };

    const removeMedia = (index: number) => {
        setMediaUrls((prev) => prev.filter((_, i) => i !== index));
    };

    /** Opsional: isi otomatis factory/line/mac jika MCID sudah terdaftar. */
    const handleMCIDSearch = async () => {
        if (!formData.mcid.trim()) return;
        try {
            const device = await getDeviceByMCID(formData.mcid.trim());
            if (device) {
                setFormData((prev) => ({
                    ...prev,
                    mac_address: device.mac_address || prev.mac_address,
                    factory: device.factory || prev.factory,
                    line: device.line || prev.line,
                }));
                toast({
                    title: 'Device ditemukan',
                    description: 'Data device dimuat. Bisa diedit bila perlu.',
                });
            } else {
                toast({
                    title: 'MCID belum terdaftar',
                    description: 'Langsung isi form dan simpan—device akan otomatis ditambahkan ke Device List.',
                });
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
            const mcid = formData.mcid.trim();
            const factory = formData.factory.trim();
            const line = formData.line.trim();
            if (!mcid || !factory || !line) {
                toast({
                    title: 'Data wajib kurang',
                    description: 'MCID, Factory, dan Line harus diisi.',
                    variant: 'destructive',
                });
                setLoading(false);
                return;
            }

            // Device jadi sumber dari repair: kalau belum ada, buat dulu dari data form
            const now = new Date();
            const { id: deviceId } = await createDeviceIfNotExists({
                mcid,
                mac_address: formData.mac_address?.trim() || '',
                factory,
                line,
                status: 'active',
                last_update: now,
                created_at: now,
            });

            const { updated } = await createOrUpdateRepairByMCID({
                device_id: deviceId,
                mcid,
                mac_address: formData.mac_address?.trim() || '',
                factory,
                line,
                date: new Date(formData.date),
                problem: formData.problem || '',
                action: formData.action || '',
                technician_name: user?.name || user?.email || '',
                status: 'pending',
                ...(mediaUrls.length > 0 ? { media: mediaUrls } : {}),
            });

            await updateDeviceStatus(deviceId, 'repair');

            toast({
                title: 'Berhasil',
                description: updated
                    ? 'Laporan untuk MCID ini diperbarui (overwrite). Tidak ada duplikat di List Error.'
                    : 'Repair ditambahkan. Device otomatis tercatat di Device List bila baru.',
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
            setMediaUrls([]);

            router.push('/repair-list');
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
                            MCID = identitas mesin jahit (1 MCID = 1 mesin). Isi MCID, Factory, Line, opsional MAC (identitas IoT). Jika MCID belum ada, device otomatis ditambahkan lalu repair dicatat.
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
                                        <Label htmlFor="mcid">MCID (identitas mesin, unik)</Label>
                                        <Input
                                            id="mcid"
                                            value={formData.mcid}
                                            onChange={(e) => setFormData({ ...formData, mcid: e.target.value })}
                                            placeholder="Masukkan MCID"
                                            required
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <Button type="button" onClick={handleMCIDSearch} variant="outline" title="Isi otomatis jika MCID sudah terdaftar">
                                            <Search className="h-4 w-4 mr-2" />
                                            Cari
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="mac_address">MAC Address (identitas IoT, opsional)</Label>
                                        <Input
                                            id="mac_address"
                                            value={formData.mac_address}
                                            onChange={(e) => setFormData({ ...formData, mac_address: e.target.value })}
                                            placeholder="Kosongkan jika tidak ada"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="factory">Factory</Label>
                                        <Input
                                            id="factory"
                                            value={formData.factory}
                                            onChange={(e) => setFormData({ ...formData, factory: e.target.value })}
                                            required
                                            placeholder="Nama pabrik/lokasi"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="line">Line</Label>
                                        <Input
                                            id="line"
                                            value={formData.line}
                                            onChange={(e) => setFormData({ ...formData, line: e.target.value })}
                                            required
                                            placeholder="Line produksi"
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

                                {isCloudinaryConfigured() && (
                                    <div>
                                        <Label>Foto / Media (opsional)</Label>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={handleMediaSelect}
                                            disabled={uploadingMedia}
                                        />
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={uploadingMedia}
                                            >
                                                <ImagePlus className="h-4 w-4 mr-2" />
                                                {uploadingMedia ? 'Mengunggah...' : 'Tambah foto'}
                                            </Button>
                                            {mediaUrls.length > 0 && (
                                                <span className="text-sm text-muted-foreground self-center">
                                                    {mediaUrls.length} foto
                                                </span>
                                            )}
                                        </div>
                                        {mediaUrls.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {mediaUrls.map((url, i) => (
                                                    <div key={i} className="relative group rounded-lg overflow-hidden border bg-muted w-20 h-20">
                                                        <Image
                                                            src={url}
                                                            alt={`Foto ${i + 1}`}
                                                            fill
                                                            className="object-cover"
                                                            sizes="80px"
                                                            unoptimized
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => removeMedia(i)}
                                                            className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition"
                                                            aria-label="Hapus foto"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

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
