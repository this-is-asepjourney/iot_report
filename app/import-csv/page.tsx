'use client';

import { useState, FormEvent } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createDeviceIfNotExists } from '@/services/deviceService';
import { useToast } from '@/components/ui/use-toast';
import Papa from 'papaparse';
import { Upload, Download, FileSpreadsheet } from 'lucide-react';
import { downloadCSVTemplate } from '@/utils/csvTemplate';
import {
  downloadImportErrorReport,
  type ImportErrorRow,
} from '@/utils/csvImportErrorReport';

/** Kolom wajib saat import — tidak boleh kosong. Kolom lain (termasuk mac_address) opsional. */
const KOLOM_WAJIB = ['mcid', 'factory', 'line'] as const;

interface CSVRow {
  mcid?: string;
  mac_address?: string;
  factory?: string;
  line?: string;
  [key: string]: string | undefined; // kolom lain opsional
}

export default function ImportCSVPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CSVRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<ImportErrorRow[] | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const data = results.data as CSVRow[];
        setPreview(data.slice(0, 10)); // Preview first 10 rows
      },
      error: (error) => {
        toast({
          title: 'Error',
          description: 'Gagal membaca file CSV',
          variant: 'destructive',
        });
      },
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    try {
      // Parse and import data (tanpa upload ke storage)
      Papa.parse(file, {
        header: true,
        complete: async (results) => {
          const data = results.data as CSVRow[];
          const report: ImportErrorRow[] = [];
          let no = 1;

          for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const baris = i + 2; // baris di file (1-based + header)
            const mcid = (row.mcid ?? '').trim();
            const mac_address = (row.mac_address ?? '').trim();
            const factory = (row.factory ?? '').trim();
            const line = (row.line ?? '').trim();

            const semuaWajibTerisi = mcid && factory && line;
            if (!semuaWajibTerisi) {
              const kolomKosong = KOLOM_WAJIB.filter((k) => !(row[k] ?? '').trim());
              report.push({
                no: no++,
                baris,
                mcid,
                mac_address,
                factory,
                line,
                status: 'Gagal',
                keterangan: `Kolom wajib tidak boleh kosong: ${kolomKosong.join(', ')}`,
              });
              continue;
            }

            try {
              const { created } = await createDeviceIfNotExists({
                mcid,
                mac_address,
                factory,
                line,
                status: 'active',
                last_update: new Date(),
                created_at: new Date(),
              });
              report.push({
                no: no++,
                baris,
                mcid,
                mac_address,
                factory,
                line,
                status: created ? 'Berhasil' : 'Dilewati',
                keterangan: created ? '' : 'MCID sudah terdaftar (1 MCID = 1 mesin)',
              });
            } catch (error: unknown) {
              const msg =
                error instanceof Error ? error.message : 'Gagal menyimpan device';
              report.push({
                no: no++,
                baris,
                mcid,
                mac_address,
                factory,
                line,
                status: 'Gagal',
                keterangan: msg,
              });
            }
          }

          const successCount = report.filter((r) => r.status === 'Berhasil').length;
          const errorCount = report.filter((r) => r.status === 'Gagal').length;

          toast({
            title: 'Import selesai',
            description: `Berhasil: ${successCount}, Gagal: ${errorCount}. ${
              report.length > 0 ? 'Download laporan di bawah.' : ''
            }`,
          });

          setReportRows(report);
          setFile(null);
          setPreview([]);
        },
        error: (error) => {
          toast({
            title: 'Error',
            description: 'Gagal memproses CSV',
            variant: 'destructive',
          });
        },
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Gagal mengupload file',
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
          <h1 className="text-3xl font-bold mb-8">Import CSV</h1>

          <Card>
            <CardHeader>
              <CardTitle>Import Device dari CSV</CardTitle>
              <CardDescription>
                <strong>MCID</strong> = identitas mesin jahit (wajib, unik — 1 MCID = 1 mesin). <strong>factory</strong>, <strong>line</strong> wajib. <strong>mac_address</strong> (identitas IoT) opsional. Baris dengan MCID yang sudah terdaftar akan dilewati.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={downloadCSVTemplate}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template CSV
                </Button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="csv-file">Pilih File CSV</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    required
                  />
                </div>

                {preview.length > 0 && (
                  <div>
                    <Label>Preview Data (10 baris pertama)</Label>
                    <div className="mt-2 border rounded-md overflow-auto max-h-64">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-left">MCID</th>
                            <th className="p-2 text-left">MAC Address</th>
                            <th className="p-2 text-left">Factory</th>
                            <th className="p-2 text-left">Line</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.map((row, index) => (
                            <tr key={index} className="border-t">
                              <td className="p-2">{row.mcid}</td>
                              <td className="p-2">{row.mac_address}</td>
                              <td className="p-2">{row.factory}</td>
                              <td className="p-2">{row.line}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading || !file}>
                  <Upload className="h-4 w-4 mr-2" />
                  {loading ? 'Mengimport...' : 'Import CSV'}
                </Button>

                {reportRows && reportRows.length > 0 && (
                  <div className="mt-4 p-4 border rounded-lg bg-muted/50 space-y-2">
                    <Label>Laporan Hasil Import</Label>
                    <p className="text-sm text-muted-foreground">
                      Berhasil: {reportRows.filter((r) => r.status === 'Berhasil').length},{' '}
                      Gagal: {reportRows.filter((r) => r.status === 'Gagal').length}.
                      Download file Excel untuk detail per baris.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        downloadImportErrorReport(reportRows);
                        toast({
                          title: 'Laporan berhasil diunduh',
                          description: 'File Excel berisi detail per baris (Status & Keterangan).',
                        });
                      }}
                      className="w-full"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Download Laporan Import (Excel)
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
}
