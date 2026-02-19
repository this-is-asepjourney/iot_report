# IoT Report — Cloud Functions

Webhook Telegram untuk laporan IoT error. Dipanggil oleh Telegram Bot API; menulis device/repair ke Firestore.

## Setup

1. `npm install`
2. Set `TELEGRAM_BOT_TOKEN`:
   - Buat `functions/.env` berisi: `TELEGRAM_BOT_TOKEN=token_dari_botfather`
   - Atau saat deploy pertama kali, CLI akan meminta nilai ini dan menyimpan ke `.env.<projectId>`

## Deploy

Dari **root project**:

```bash
npm run deploy:functions
```

atau:

```bash
firebase deploy --only functions
```

Setelah deploy, set webhook Telegram ke URL function (lihat Firebase Console > Functions, atau output deploy). Format URL:

```
https://asia-southeast2-<PROJECT_ID>.cloudfunctions.net/telegramWebhook
```
