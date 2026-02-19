/**
 * Parse pesan dari Telegram menjadi array report (mcid, factory, line, problem?).
 *
 * Format yang didukung (satu device per baris):
 * - MCID,Factory,Line
 * - MCID,Factory,Line,Problem
 * - MCID\tFactory\tLine  (tab)
 * - MCID  Factory  Line  Problem  (spasi banyak)
 * Baris kosong diabaikan. Minimal 3 kolom (MCID, Factory, Line).
 */

export interface ParsedReportRow {
  mcid: string;
  factory: string;
  line: string;
  mac_address?: string;
  problem?: string;
}

const DEFAULT_PROBLEM = 'Laporan dari Telegram';

export function parseReportMessage(text: string): ParsedReportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const result: ParsedReportRow[] = [];

  for (const line of lines) {
    const parts = line.split(/[\t,]+| {2,}/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 3) continue;

    const [mcid, factory, lineName, fourth] = parts;
    if (!mcid || !factory || !lineName) continue;

    const looksLikeMac =
      fourth && fourth.length <= 17 && /^[0-9A-Fa-f:.-]+$/.test(fourth);
    const mac_address = looksLikeMac ? fourth : undefined;
    const problem = fourth
      ? looksLikeMac
        ? DEFAULT_PROBLEM
        : fourth
      : DEFAULT_PROBLEM;

    result.push({
      mcid,
      factory,
      line: lineName,
      ...(mac_address ? { mac_address } : {}),
      problem,
    });
  }

  return result;
}
