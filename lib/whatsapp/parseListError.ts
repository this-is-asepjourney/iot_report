/**
 * Parse pesan list error dari WhatsApp menjadi array device (mcid, factory, line, mac_address?).
 *
 * Format yang didukung (satu device per baris):
 * - MCID,Factory,Line
 * - MCID,Factory,Line,MAC
 * - MCID\tFactory\tLine  (tab)
 * - MCID  Factory  Line  (spasi banyak)
 * Baris kosong diabaikan. Minimal 3 kolom (MCID, Factory, Line).
 */

export interface ParsedListErrorRow {
  mcid: string;
  factory: string;
  line: string;
  mac_address?: string;
}

export function parseListError(text: string): ParsedListErrorRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const result: ParsedListErrorRow[] = [];

  for (const line of lines) {
    const parts = line.split(/[\t,]+| {2,}/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 3) continue;

    const [mcid, factory, lineName, mac_address] = parts;
    if (!mcid || !factory || !lineName) continue;

    result.push({
      mcid,
      factory,
      line: lineName,
      ...(mac_address ? { mac_address } : {}),
    });
  }

  return result;
}
