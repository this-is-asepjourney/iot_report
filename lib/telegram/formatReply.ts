/**
 * Format balasan bot Telegram untuk hasil proses laporan.
 */

export interface ProcessResult {
  created: number;
  errors: string[];
}

export function formatReportReply(result: ProcessResult): string {
  const lines: string[] = [];

  if (result.created > 0) {
    lines.push(`✅ ${result.created} report berhasil disimpan.`);
  }
  if (result.errors.length > 0) {
    lines.push('');
    lines.push('❌ Error:');
    result.errors.slice(0, 5).forEach((e) => lines.push(`• ${e}`));
    if (result.errors.length > 5) {
      lines.push(`• ... dan ${result.errors.length - 5} error lainnya`);
    }
  }

  if (lines.length === 0) {
    return 'Tidak ada data yang diproses. Kirim /help untuk panduan.';
  }

  return lines.join('\n');
}

export function formatHelpMessage(): string {
  return `📋 *Cara laporan IoT Error*

Kirim list error (satu device per baris):
\`MCID,Factory,Line\`
\`MCID,Factory,Line,Deskripsi masalah\`

Contoh:
\`MCID001,PabrikA,Line1\`
\`MCID002,PabrikA,Line2,Sensor error\`

Pemisah: koma, tab, atau spasi.
Kolom ke-4 opsional: deskripsi masalah.`;
}
