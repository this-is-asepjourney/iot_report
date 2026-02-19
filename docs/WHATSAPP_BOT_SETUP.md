# WhatsApp → Bot → Firestore → Web App (List Error)

Alur: **WhatsApp Chat** → **Webhook API** → **Firestore** → **Web App (Device List)**. Data list error yang dikirim lewat WhatsApp disimpan ke Firestore (tanpa duplikat MCID) dan muncul di halaman Device List.

---

## Struktur yang sudah ada

| Path | Fungsi |
|------|--------|
| `lib/firebase/admin.ts` | Inisialisasi Firebase Admin SDK (lazy). Dipakai API routes untuk tulis ke Firestore. |
| `lib/whatsapp/parseListError.ts` | Parse teks list error → array `{ mcid, factory, line, mac_address? }`. |
| `services/deviceServiceAdmin.ts` | `createDeviceIfNotExistsAdmin()` — simpan device ke Firestore tanpa duplikat (by MCID). |
| `app/api/whatsapp/webhook/route.ts` | **GET**: verifikasi webhook. **POST**: terima pesan, parse list error, simpan ke Firestore. |
| `.env.example` | Contoh env (Firebase, Firebase Admin, WhatsApp). Isi nilai asli di `.env.local` (jangan commit). |

---

## Environment (akan diisi nanti)

Salin `.env.example` ke `.env.local` dan isi:

1. **Firebase (client)** — sudah dipakai web app.
2. **Firebase Admin** — salah satu:
   - **Opsi A**: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (dari Service Account key JSON; untuk `PRIVATE_KEY` bisa paste isi field `private_key`, newline tetap `\n`).
   - **Opsi B**: `GOOGLE_APPLICATION_CREDENTIALS` = path ke file JSON service account.
3. **WhatsApp**:
   - `WHATSAPP_VERIFY_TOKEN`: string rahasia untuk verifikasi webhook (GET). Nanti di dashboard provider WhatsApp Anda set Verify Token = nilai ini.
   - (Menyusul) Token untuk kirim balasan: `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` atau sesuai provider.

---

## Format pesan list error

Satu device per baris. Pemisah: koma, tab, atau spasi banyak.

Contoh:

```
MCID001,FactoryA,Line1
MCID002,FactoryA,Line1,AA:BB:CC:DD:EE:FF
MCID003  FactoryB  Line2
```

- Kolom 1: MCID (wajib)
- Kolom 2: Factory (wajib)
- Kolom 3: Line (wajib)
- Kolom 4: MAC Address (opsional)

Baris yang tidak memenuhi minimal 3 kolom diabaikan.

---

## Webhook URL

Setelah deploy (atau pakai ngrok untuk development):

- **URL**: `https://<domain-anda>/api/whatsapp/webhook`
- **GET**: Dipanggil provider WhatsApp untuk verifikasi. Query: `hub.mode=subscribe`, `hub.verify_token=<WHATSAPP_VERIFY_TOKEN>`, `hub.challenge=<challenge>`. Response: body = `hub.challenge`, status 200.
- **POST**: Dipanggil saat ada pesan masuk. Body tergantung provider (Meta Cloud API / Twilio / dll). API ini sudah support format Meta; jika pakai provider lain, sesuaikan `extractIncomingText()` di `app/api/whatsapp/webhook/route.ts`.

---

## Tidak duplikat

- Setiap baris list error diproses dengan `createDeviceIfNotExistsAdmin()`.
- Jika MCID sudah ada di Firestore, device tidak dibuat lagi (hanya di-skip).
- Web App (Device List) membaca dari Firestore yang sama; data dari WhatsApp akan tampil di list (refresh atau real-time sesuai implementasi front-end).

---

## Langkah berikut (API & env)

1. Daftar WhatsApp Business API / provider (Meta, Twilio, 360dialog, dll).
2. Set webhook URL ke `https://<domain>/api/whatsapp/webhook`, Verify Token = `WHATSAPP_VERIFY_TOKEN`.
3. Isi env Firebase Admin dan WhatsApp di `.env.local`.
4. (Opsional) Tambah kirim balasan dari bot (reply ke user): butuh token/API provider; handler reply bisa ditambah di route yang sama atau modul terpisah.
