import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export interface ImportErrorRow {
  no: number;
  baris: number;
  mcid: string;
  mac_address: string;
  factory: string;
  line: string;
  status: 'Berhasil' | 'Gagal' | 'Dilewati';
  keterangan: string;
}

/**
 * Download laporan hasil import (berhasil + gagal) dalam format Excel (.xlsx)
 * Format mengikuti standar report error: No, Baris, MCID, MAC Address, Factory, Line, Status, Keterangan
 */
export function downloadImportErrorReport(
  rows: ImportErrorRow[],
  filename?: string
): void {
  const headers = [
    'No',
    'Baris',
    'MCID',
    'MAC Address',
    'Factory',
    'Line',
    'Status',
    'Keterangan',
  ];

  const data = rows.map((r) => [
    r.no,
    r.baris,
    r.mcid ?? '',
    r.mac_address ?? '',
    r.factory ?? '',
    r.line ?? '',
    r.status,
    r.keterangan ?? '',
  ]);

  const wsData = [headers, ...data];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Lebar kolom agar terbaca rapi
  ws['!cols'] = [
    { wch: 5 },
    { wch: 6 },
    { wch: 12 },
    { wch: 20 },
    { wch: 15 },
    { wch: 10 },
    { wch: 10 },
    { wch: 40 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan Import');

  const name =
    filename ||
    `IoT_Report_Import_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
  XLSX.writeFile(wb, name);
}
