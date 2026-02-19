/**
 * WhatsApp Webhook — menerima pesan dari WhatsApp Business API / provider.
 *
 * GET: verifikasi webhook (WhatsApp mengirim hub.mode, hub.verify_token, hub.challenge).
 * POST: menerima incoming messages; body format tergantung provider (Meta Cloud API / Twilio / dll).
 *
 * Env: WHATSAPP_VERIFY_TOKEN (untuk GET verification). API token untuk reply akan menyusul.
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseListError } from '@/lib/whatsapp/parseListError';
import { createDeviceIfNotExistsAdmin } from '@/services/deviceServiceAdmin';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

/** Ekstrak teks pesan dari payload — sesuaikan dengan provider (Meta / Twilio / dll). */
function extractIncomingText(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;

  const o = body as Record<string, unknown>;

  // Format WhatsApp Cloud API (Meta)
  const entry = (o.entry as unknown[])?.[0] as Record<string, unknown> | undefined;
  const changes = entry?.changes as unknown[] | undefined;
  const value = (changes?.[0] as Record<string, unknown>)?.value as Record<string, unknown> | undefined;
  const messages = value?.messages as unknown[] | undefined;
  const msg = messages?.[0] as Record<string, unknown> | undefined;
  const text = msg?.text as Record<string, unknown> | undefined;
  if (typeof text?.body === 'string') return text.body;

  // Format sederhana untuk testing: { "message": "..." } atau { "text": "..." }
  if (typeof o.message === 'string') return o.message;
  if (typeof o.text === 'string') return o.text;

  return null;
}

/** GET — verifikasi webhook (WhatsApp / Meta memanggil dengan hub.mode, hub.verify_token, hub.challenge). */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/** POST — terima pesan masuk; parse list error dan simpan ke Firestore (tidak duplikat). */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const text = extractIncomingText(body);
  if (!text || !text.trim()) {
    return NextResponse.json({ ok: true, message: 'No text to process' }, { status: 200 });
  }

  const rows = parseListError(text);
  if (rows.length === 0) {
    return NextResponse.json(
      { ok: true, message: 'No valid list-error rows (format: MCID,Factory,Line per line)' },
      { status: 200 }
    );
  }

  let created = 0;
  let skipped = 0;
  try {
    for (const row of rows) {
      const result = await createDeviceIfNotExistsAdmin({
        mcid: row.mcid,
        factory: row.factory,
        line: row.line,
        mac_address: row.mac_address,
        status: 'active',
      });
      if (result.created) created++;
      else skipped++;
    }
  } catch (err) {
    console.error('Webhook list-error save error:', err);
    return NextResponse.json(
      { error: 'Failed to save devices', details: String(err) },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: `Processed ${rows.length} row(s): ${created} created, ${skipped} already existed (no duplicate)`,
    created,
    skipped,
  });
}
