/**
 * Firebase Cloud Functions — Telegram Webhook untuk IoT Report.
 * Dipanggil oleh Telegram Bot API saat ada pesan; parse laporan, buat device/repair di Firestore, balas ke chat.
 * Juga: trigger Firestore untuk device aggregation (counter doc) agar dashboard tidak perlu baca semua device.
 *
 * Env: TELEGRAM_BOT_TOKEN (via defineString / .env)
 */

import { onRequest } from 'firebase-functions/v2/https';
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
} from 'firebase-functions/v2/firestore';
import { defineString } from 'firebase-functions/params';

const REGION = 'asia-southeast2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const TELEGRAM_BOT_TOKEN = defineString('TELEGRAM_BOT_TOKEN');
const TELEGRAM_API = 'https://api.telegram.org';

// Firebase Admin (default credentials di Cloud Functions)
initializeApp();
const db = getFirestore();

// --- Device aggregation (counter doc): kurangi read di dashboard ---
const AGGREGATIONS = 'aggregations';
const DEVICES_AGG_DOC = 'devices';
const FACTORY_PREFIX = 'factory_';
const LINE_PREFIX = 'line_';

/** Doc ID aman untuk factory/line (Firestore doc id tidak boleh ada /). */
function safeFactoryId(factory) {
  if (typeof factory !== 'string' || !factory.trim()) return 'Unknown';
  return factory.trim().replace(/\//g, '_');
}

function safeLineId(line) {
  if (typeof line !== 'string' || !line.trim()) return 'Unknown';
  return line.trim().replace(/\//g, '_');
}

function getStatusField(status) {
  const s = status === 'repair' || status === 'broken' ? status : 'active';
  return s;
}

function factoryDocId(factory) {
  return FACTORY_PREFIX + safeFactoryId(factory);
}

function lineDocId(factory, line) {
  return LINE_PREFIX + safeFactoryId(factory) + '_' + safeLineId(line);
}

/** Increment global + by_factory saat device dibuat. */
export const onDeviceCreated = onDocumentCreated(
  { document: 'devices/{deviceId}', region: REGION },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const status = getStatusField(data?.status);
    const fid = factoryDocId(data?.factory);

    const batch = db.batch();
    const globalRef = db.collection(AGGREGATIONS).doc(DEVICES_AGG_DOC);
    batch.set(
      globalRef,
      {
        total: FieldValue.increment(1),
        [status]: FieldValue.increment(1),
        lastUpdated: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const factoryRef = db.collection(AGGREGATIONS).doc(fid);
    const factoryName = (data?.factory && typeof data.factory === 'string') ? data.factory.trim() : 'Unknown';
    const lineName = (data?.line && typeof data.line === 'string') ? data.line.trim() : 'Unknown';
    batch.set(
      factoryRef,
      {
        total: FieldValue.increment(1),
        [status]: FieldValue.increment(1),
        name: factoryName,
        lastUpdated: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const lid = lineDocId(data?.factory, data?.line);
    const lineRef = db.collection(AGGREGATIONS).doc(lid);
    batch.set(
      lineRef,
      {
        total: FieldValue.increment(1),
        [status]: FieldValue.increment(1),
        factoryName,
        lineName,
        lastUpdated: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await batch.commit();
  }
);

/** Update counter saat status/factory/line berubah. */
export const onDeviceUpdated = onDocumentUpdated(
  { document: 'devices/{deviceId}', region: REGION },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const oldStatus = getStatusField(before.status);
    const newStatus = getStatusField(after.status);
    const oldFactoryId = factoryDocId(before.factory);
    const newFactoryId = factoryDocId(after.factory);
    const oldLineId = lineDocId(before.factory, before.line);
    const newLineId = lineDocId(after.factory, after.line);
    const statusChanged = oldStatus !== newStatus;
    const factoryChanged = oldFactoryId !== newFactoryId;
    const lineChanged = oldLineId !== newLineId;

    if (!statusChanged && !factoryChanged && !lineChanged) return;

    const batch = db.batch();
    const globalRef = db.collection(AGGREGATIONS).doc(DEVICES_AGG_DOC);

    if (statusChanged) {
      batch.set(
        globalRef,
        {
          [oldStatus]: FieldValue.increment(-1),
          [newStatus]: FieldValue.increment(1),
          lastUpdated: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    if (factoryChanged) {
      const oldFactoryRef = db.collection(AGGREGATIONS).doc(oldFactoryId);
      const newFactoryRef = db.collection(AGGREGATIONS).doc(newFactoryId);
      batch.set(
        oldFactoryRef,
        {
          total: FieldValue.increment(-1),
          [oldStatus]: FieldValue.increment(-1),
          lastUpdated: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      const newFactoryName = (after.factory && typeof after.factory === 'string') ? after.factory.trim() : 'Unknown';
      batch.set(
        newFactoryRef,
        {
          total: FieldValue.increment(1),
          [newStatus]: FieldValue.increment(1),
          name: newFactoryName,
          lastUpdated: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else if (statusChanged) {
      const factoryRef = db.collection(AGGREGATIONS).doc(newFactoryId);
      batch.set(
        factoryRef,
        {
          [oldStatus]: FieldValue.increment(-1),
          [newStatus]: FieldValue.increment(1),
          lastUpdated: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    if (lineChanged || factoryChanged) {
      const oldLineRef = db.collection(AGGREGATIONS).doc(oldLineId);
      const newLineRef = db.collection(AGGREGATIONS).doc(newLineId);
      batch.set(
        oldLineRef,
        {
          total: FieldValue.increment(-1),
          [oldStatus]: FieldValue.increment(-1),
          lastUpdated: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      const newFactoryName = (after.factory && typeof after.factory === 'string') ? after.factory.trim() : 'Unknown';
      const newLineName = (after.line && typeof after.line === 'string') ? after.line.trim() : 'Unknown';
      batch.set(
        newLineRef,
        {
          total: FieldValue.increment(1),
          [newStatus]: FieldValue.increment(1),
          factoryName: newFactoryName,
          lineName: newLineName,
          lastUpdated: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else if (statusChanged) {
      const newLineRef = db.collection(AGGREGATIONS).doc(newLineId);
      batch.set(
        newLineRef,
        {
          [oldStatus]: FieldValue.increment(-1),
          [newStatus]: FieldValue.increment(1),
          lastUpdated: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();
  }
);

/** Decrement saat device dihapus. */
export const onDeviceDeleted = onDocumentDeleted(
  { document: 'devices/{deviceId}', region: REGION },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const status = getStatusField(data?.status);
    const fid = factoryDocId(data?.factory);
    const lid = lineDocId(data?.factory, data?.line);

    const batch = db.batch();
    const globalRef = db.collection(AGGREGATIONS).doc(DEVICES_AGG_DOC);
    batch.set(
      globalRef,
      {
        total: FieldValue.increment(-1),
        [status]: FieldValue.increment(-1),
        lastUpdated: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const factoryRef = db.collection(AGGREGATIONS).doc(fid);
    batch.set(
      factoryRef,
      {
        total: FieldValue.increment(-1),
        [status]: FieldValue.increment(-1),
        lastUpdated: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const lineRef = db.collection(AGGREGATIONS).doc(lid);
    batch.set(
      lineRef,
      {
        total: FieldValue.increment(-1),
        [status]: FieldValue.increment(-1),
        lastUpdated: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await batch.commit();
  }
);

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

/** Ambil repair pending terbaru untuk MCID (overwrite duplicate). */
async function getPendingRepairByMCID(mcid) {
  const snap = await db
    .collection(REPAIRS)
    .where('mcid', '==', (mcid || '').trim())
    .where('status', '==', 'pending')
    .orderBy('date', 'desc')
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id };
}

async function createRepair(input) {
  const docRef = await db.collection(REPAIRS).add({
    ...input,
    createdAt: new Date(),
  });
  return docRef.id;
}

/** Buat repair baru atau update repair pending untuk MCID yang sama. */
async function createOrUpdateRepair(input) {
  const existing = await getPendingRepairByMCID(input.mcid);
  if (existing) {
    await db.collection(REPAIRS).doc(existing.id).update({
      device_id: input.device_id,
      mcid: input.mcid,
      mac_address: input.mac_address,
      factory: input.factory,
      line: input.line,
      date: input.date,
      problem: input.problem,
      action: input.action,
      technician_name: input.technician_name,
      status: input.status,
    });
    return existing.id;
  }
  return createRepair(input);
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

      await createOrUpdateRepair({
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
);})
