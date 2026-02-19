# IoT Report - Monitoring Mesin Jahit

Aplikasi monitoring perangkat IoT mesin jahit dengan fitur repair tracking, new installation, dan device management.

## Fitur Utama

- ✅ Monitoring perangkat IoT mesin jahit
- ✅ Pencatatan IoT rusak
- ✅ Pencatatan instalasi baru
- ✅ Mempermudah teknisi mencari device bermasalah
- ✅ Bisa dipakai di HP & Web Browser (PWA)
- ✅ QR Code Scanner untuk instalasi baru
- ✅ Import/Export CSV
- ✅ Dashboard dengan statistik dan grafik
- ✅ Role-based access control (Teknisi, Supervisor, Admin)
- ✅ Bot Telegram untuk laporan IoT error dari leader factory

## Teknologi Stack

### Frontend
- **Next.js 14** (App Router)
- **Tailwind CSS** - UI cepat dan ringan
- **Shadcn UI / Radix UI** - Komponen profesional
- **PWA Support** - Install ke HP seperti aplikasi native
- **html5-qrcode** - Barcode scanning

### Backend / Database
- **Firebase Authentication** - Login user
- **Firestore** - Database realtime
- **Firebase Storage** - Upload CSV & foto device

## Setup

1. **Clone repository**
   ```bash
   git clone <repository-url>
   cd iot_report
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup Firebase**
   - Buat project baru di [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication (Email/Password)
   - Buat Firestore Database
   - Enable Storage
   - Copy konfigurasi Firebase ke `.env.local`

4. **Setup Environment Variables**
   ```bash
   cp .env.example .env.local
   ```
   Isi dengan konfigurasi Firebase Anda.

5. **Setup Firestore Collections**
   Buat collections berikut di Firestore:
   - `devices`
   - `repairs`
   - `installations`
   - `users`

6. **Setup Firestore Security Rules**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Users: read/write own doc; admin bisa baca & edit semua user (untuk Admin Panel)
       match /users/{userId} {
         allow read, write: if request.auth != null && (
           request.auth.uid == userId ||
           get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
         );
       }
       
       // Devices - role-based access
       match /devices/{deviceId} {
         allow read: if request.auth != null;
         allow create: if request.auth != null;
         allow update: if request.auth != null && 
           (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['supervisor', 'admin']);
       }
       
       // Repairs
       match /repairs/{repairId} {
         allow read: if request.auth != null;
         allow create: if request.auth != null;
         allow update: if request.auth != null && 
           (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['supervisor', 'admin']);
       }
       
       // Installations
       match /installations/{installationId} {
         allow read: if request.auth != null;
         allow create: if request.auth != null;
       }
     }
   }
   ```

7. **Run development server**
   ```bash
   npm run dev
   ```

8. **Build for production**
   ```bash
   npm run build
   npm start
   ```

## Struktur Halaman

- `/login` - Halaman login
- `/dashboard` - Dashboard dengan statistik
- `/repair` - Input repair IoT
- `/new-installation` - Installasi device baru dengan QR scanner
- `/device-list` - Daftar semua device dengan filter dan search
- `/import-csv` - Import device dari CSV (Supervisor/Admin only)
- `/profile` - Profile user
- `/admin` - Admin panel (Admin only)

## Role User

### Teknisi
- Lihat list device
- Input repair
- Scan barcode
- Search device

### Supervisor
- Semua akses teknisi
- Export CSV
- Approve data
- Import CSV

### Admin
- Manage user
- Manage factory & line
- Backup data
- Full access

## Database Schema

### Collection: devices
```typescript
{
  id: string;
  mcid: string;
  mac_address: string;
  factory: string;
  line: string;
  status: 'active' | 'repair' | 'broken';
  last_update: Date;
  created_at: Date;
}
```

### Collection: repairs
```typescript
{
  id: string;
  device_id: string;
  mcid: string;
  mac_address: string;
  factory: string;
  line: string;
  date: Date;
  problem: string;
  action: string;
  technician_name: string;
  photo_url?: string;
  status: 'pending' | 'completed' | 'approved';
}
```

### Collection: installations
```typescript
{
  id: string;
  mcid: string;
  mac_address: string;
  factory: string;
  line: string;
  date_install: Date;
  technician: string;
}
```

### Collection: users
```typescript
{
  id: string;
  name: string;
  email: string;
  role: 'teknisi' | 'supervisor' | 'admin';
  factory_access: string[];
}
```

## Bot Telegram (Laporan IoT Error)

Leader factory bisa melaporkan IoT error lewat Telegram. Bot menerima list error, membuat device jika belum ada, lalu mencatat repair (status pending).

Aplikasi memakai **Firebase Hosting** (Next.js static export) + **Firebase Cloud Functions** (webhook Telegram). Hosting hanya menyajikan file statis; webhook bot berjalan di Cloud Functions agar bisa menulis ke Firestore.

### Setup Bot (production — Firebase)

1. Buat bot di Telegram: buka [@BotFather](https://t.me/BotFather), kirim `/newbot`, ikuti langkah hingga dapat **token**.
2. Deploy Cloud Function (dari root project):
   ```bash
   cd functions
   npm install
   cd ..
   firebase deploy --only functions
   ```
   Saat pertama kali deploy, CLI akan meminta nilai `TELEGRAM_BOT_TOKEN` (atau buat file `functions/.env` berisi `TELEGRAM_BOT_TOKEN=token_anda`).
3. Set webhook ke URL function (ganti `PROJECT_ID` dan `TOKEN_BOT`):
   ```bash
   curl "https://api.telegram.org/botTOKEN_BOT/setWebhook?url=https://asia-southeast2-PROJECT_ID.cloudfunctions.net/telegramWebhook"
   ```
   URL function bisa dilihat di Firebase Console > Functions setelah deploy, atau dari output `firebase deploy --only functions`.
4. Di Firestore pastikan collections `devices` dan `repairs` ada (rules mengizinkan akses; di Functions pakai Admin SDK).

### Deploy aplikasi (Next.js + Hosting)

- Build dan deploy Hosting (web app):
  ```bash
  npm run build
  firebase deploy --only hosting
  ```
- Deploy hanya Functions (webhook):
  ```bash
  firebase deploy --only functions
  ```

### Cara Pakai

- Kirim **list error** (satu device per baris):
  - `MCID,Factory,Line`
  - `MCID,Factory,Line,Deskripsi masalah`
- Contoh:
  ```
  MCID001,PabrikA,Line1
  MCID002,PabrikA,Line2,Sensor error
  ```
- Pemisah: koma, tab, atau spasi. Kolom ke-4 opsional (deskripsi masalah).
- Perintah: `/help` atau `/start` untuk panduan.

Webhook: Telegram memanggil Cloud Function `telegramWebhook`; tidak perlu memanggil manual.

## Fitur Tambahan (Recommended)

- [ ] Notifikasi email/push untuk device broken
- [ ] History device per device
- [ ] QR Label Generator
- [ ] Offline Mode dengan IndexedDB
- [ ] SLA Timer
- [ ] Photo Evidence Before/After Repair
- [ ] Audit Log
- [ ] Heatmap Factory

## License

MIT
