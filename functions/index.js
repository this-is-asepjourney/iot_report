/**
 * Firebase Cloud Functions — Telegram Webhook untuk IoT Report.
 * Dipanggil oleh Telegram Bot API saat ada pesan; parse laporan, buat device/repair di Firestore, balas ke chat.
 *
 * Env: TELEGRAM_BOT_TOKEN (via defineString / .env)
 */

import { onRequest } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';

const REGION = 'asia-southeast2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const TELEGRAM_BOT_TOKEN = defineString('TELEGRAM_BOT_TOKEN');
const TELEGRAM_API = 'https://api.telegram.org';

// Firebase Admin (default credentials di Cloud Functions)
initializeApp();
const db = getFirestore();

// --- Helpers (sesuai lib/telegram & services di Next.js) ---

function getMessage(update) {
  const message =
    update.message ??
    update.edited_message ??
    update.channel_post ??
    update.edited_channel_post;
  if (!message?.chat || typeof message.text !== 'string') return null;
  const fromUsername = message.from?.username
    ? `Telegram: @${message.from.username}`
    : message.from?.first_name
      ? `Telegram: ${message.from.first_name}`
      : 'Telegram';
  return {
    chatId: message.chat.id,
    text: message.text.trim(),
    fromUsername,
  };
}

function parseReportMessage(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const result = [];
  const DEFAULT_PROBLEM = 'Laporan dari Telegram';

  for (const line of lines) {
    const parts = line
      .split(/[\t,]+| {2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
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

function formatReportReply(result) {
  const lines = [];
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

function formatHelpMessage() {
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

async function sendTelegramMessage(chatId, text, parseMode = null) {
  const token = TELEGRAM_BOT_TOKEN.value();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');
  const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(parseMode ? { parse_mode: parseMode } : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram sendMessage failed: ${res.status} ${err}`);
  }
}

const DEVICES = 'devices';
const REPAIRS = 'repairs';

async function getDeviceByMCID(mcid) {
  const snap = await db
    .collection(DEVICES)
    .where('mcid', '==', mcid.trim())
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data();
  return {
    id: doc.id,
    mac_address: data.mac_address ?? '',
  };
}

async function createDeviceIfNotExists(input) {
  const existing = await getDeviceByMCID(input.mcid.trim());
  if (existing) return { id: existing.id, created: false };

  const now = new Date();
  const docRef = await db.collection(DEVICES).add({
    mcid: input.mcid.trim(),
    mac_address: (input.mac_address ?? '').trim(),
    factory: input.factory.trim(),
    line: input.line.trim(),
    status: input.status ?? 'active',
    last_update: now,
    created_at: now,
  });
  return { id: docRef.id, created: true };
}

async function updateDeviceStatus(deviceId, status) {
  await db.collection(DEVICES).doc(deviceId).update({
    status,
    last_update: new Date(),
  });
}

async function createRepair(input) {
  const docRef = await db.collection(REPAIRS).add({
    ...input,
    createdAt: new Date(),
  });
  return docRef.id;
}

// --- HTTP handler ---

export const telegramWebhook = onRequest(
  { region: REGION },
  async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  const msg = getMessage(body);
  if (!msg) {
    res.status(200).json({ ok: true, message: 'No text message' });
    return;
  }

  const { chatId, text, fromUsername } = msg;

  if (!TELEGRAM_BOT_TOKEN.value()) {
    console.error('TELEGRAM_BOT_TOKEN not set');
    res.status(500).json({ error: 'Bot not configured' });
    return;
  }

  if (text === '/help' || text === '/start') {
    try {
      await sendTelegramMessage(chatId, formatHelpMessage(), 'Markdown');
    } catch (err) {
      console.error('Telegram send help error:', err);
      res.status(500).json({ error: 'Failed to send reply' });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  const rows = parseReportMessage(text);
  if (rows.length === 0) {
    try {
      await sendTelegramMessage(
        chatId,
        'Format tidak valid. Minimal: MCID,Factory,Line per baris. Kirim /help untuk panduan.'
      );
    } catch (err) {
      console.error('Telegram send error:', err);
    }
    res.status(200).json({ ok: true });
    return;
  }

  const result = { created: 0, errors: [] };

  for (const row of rows) {
    try {
      let device = await getDeviceByMCID(row.mcid);
      if (!device) {
        await createDeviceIfNotExists({
          mcid: row.mcid,
          factory: row.factory,
          line: row.line,
          mac_address: row.mac_address ?? '',
          status: 'active',
        });
        device = await getDeviceByMCID(row.mcid);
        if (!device) {
          result.errors.push(`${row.mcid}: Gagal membuat device`);
          continue;
        }
      }

      await updateDeviceStatus(device.id, 'repair');

      await createRepair({
        device_id: device.id,
        mcid: row.mcid,
        mac_address: device.mac_address,
        factory: row.factory,
        line: row.line,
        date: new Date(),
        problem: row.problem ?? 'Laporan dari Telegram',
        action: '',
        technician_name: fromUsername ?? 'Telegram',
        status: 'pending',
      });

      result.created++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`${row.mcid}: ${message}`);
    }
  }

  try {
    await sendTelegramMessage(chatId, formatReportReply(result));
  } catch (err) {
    console.error('Telegram send reply error:', err);
    res.status(500).json({ error: 'Failed to send reply' });
    return;
  }

  res.status(200).json({
    ok: true,
    created: result.created,
    errors: result.errors.length,
  }
);
