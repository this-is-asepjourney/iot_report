
import { NextRequest, NextResponse } from 'next/server';
import type { TelegramUpdate } from '@/lib/telegram/types';
import { parseReportMessage } from '@/lib/telegram/parseMessage';
import { formatReportReply, formatHelpMessage } from '@/lib/telegram/formatReply';
import {
  getDeviceByMCIDAdmin,
  createDeviceIfNotExistsAdmin,
  updateDeviceStatusAdmin,
} from '@/services/deviceServiceAdmin';
import { createRepairAdmin } from '@/services/repairServiceAdmin';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = 'https://api.telegram.org';

function getMessage(update: TelegramUpdate): { chatId: number; text: string; fromUsername?: string } | null {
  const message = update.message ?? update.edited_message ?? update.channel_post ?? update.edited_channel_post;
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

async function sendTelegramMessage(
  chatId: number,
  text: string,
  options?: { parseMode?: 'Markdown' }
): Promise<void> {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not set');
  const url = `${TELEGRAM_API}/bot${BOT_TOKEN}/sendMessage`;
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (options?.parseMode) body.parse_mode = options.parseMode;
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

export async function POST(request: NextRequest) {
  let body: TelegramUpdate;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const msg = getMessage(body);
  if (!msg) {
    return NextResponse.json({ ok: true, message: 'No text message' }, { status: 200 });
  }

  const { chatId, text, fromUsername } = msg;

  if (!BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not set');
    return NextResponse.json({ error: 'Bot not configured' }, { status: 500 });
  }

  if (text === '/help' || text === '/start') {
    try {
      await sendTelegramMessage(chatId, formatHelpMessage(), { parseMode: 'Markdown' });
    } catch (err) {
      console.error('Telegram send help error:', err);
      return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
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
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const result = { created: 0, errors: [] as string[] };

  for (const row of rows) {
    try {
      let device = await getDeviceByMCIDAdmin(row.mcid);
      if (!device) {
        const created = await createDeviceIfNotExistsAdmin({
          mcid: row.mcid,
          factory: row.factory,
          line: row.line,
          mac_address: row.mac_address ?? '',
          status: 'active',
        });
        device = await getDeviceByMCIDAdmin(row.mcid);
        if (!device) {
          result.errors.push(`${row.mcid}: Gagal membuat device`);
          continue;
        }
      }

      await updateDeviceStatusAdmin(device.id, 'repair');

      await createRepairAdmin({
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
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    created: result.created,
    errors: result.errors.length,
  });
}
