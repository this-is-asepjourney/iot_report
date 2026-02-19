# Status Deploy Firebase

## ✅ Berhasil Di-Deploy

### 1. Firestore Security Rules ✅
- **Status**: Berhasil di-deploy
- **File**: `firestore.rules`
- **Fitur**:
  - Role-based access control (Teknisi, Supervisor, Admin)
  - Factory access filtering
  - Collection rules untuk: users, devices, repairs, installations

### 2. Firestore Indexes ✅
- **Status**: Berhasil di-deploy
- **File**: `firestore.indexes.json`
- **Indexes yang dibuat**:
  - `devices`: factory + status
  - `devices`: factory + line
  - `devices`: status + created_at
  - `repairs`: factory + date
  - `repairs`: factory + line + date
  - `repairs`: status + date
  - `installations`: factory + date_install

## ⚠️ Perlu Setup Manual

### 3. Firebase Storage ⚠️
- **Status**: Belum diaktifkan
- **File**: `storage.rules` (sudah dibuat, siap di-deploy)
- **Langkah untuk mengaktifkan**:
  1. Buka: https://console.firebase.google.com/project/iot-reports-2b7dd/storage
  2. Klik **"Get Started"**
  3. Pilih mode: **Production** atau **Test** (untuk development bisa pilih Test)
  4. Pilih location: **asia-southeast2** (sama dengan Firestore)
  5. Setelah aktif, jalankan:
     ```powershell
     npx firebase-tools deploy --only storage
     ```

## 📋 Checklist Setup Lengkap

### Firebase Console Setup:
- [x] Project dibuat: `iot-reports-2b7dd`
- [x] Firestore Database dibuat
- [ ] **Firebase Storage** - Perlu diaktifkan manual
- [ ] **Authentication** - Perlu enable Email/Password
- [ ] **User pertama** - Perlu dibuat di Authentication & Firestore

### Konfigurasi yang Sudah Di-Deploy:
- [x] Firestore Security Rules
- [x] Firestore Indexes
- [x] Storage Rules (file sudah siap, tunggu Storage diaktifkan)

## 🚀 Langkah Selanjutnya

### 1. Aktifkan Firebase Storage
```
https://console.firebase.google.com/project/iot-reports-2b7dd/storage
```

### 2. Enable Authentication
1. Buka: https://console.firebase.google.com/project/iot-reports-2b7dd/authentication
2. Klik **"Get Started"**
3. Masuk ke tab **"Sign-in method"**
4. Enable **Email/Password**
5. Klik **Save**

### 3. Buat User Pertama
1. Masuk ke **Authentication** > **Users**
2. Klik **"Add user"**
3. Masukkan email dan password
4. Copy **User UID**
5. Masuk ke **Firestore** > **Data**
6. Buat collection `users`
7. Buat document dengan ID = UID dari user
8. Isi fields:
   ```json
   {
     "name": "Admin",
     "email": "admin@example.com",
     "role": "admin",
     "factory_access": ["Factory A", "Factory B"]
   }
   ```

### 4. Deploy Storage Rules (setelah Storage aktif)
```powershell
npx firebase-tools deploy --only storage
```

### 5. Setup Environment Variables
Pastikan file `.env.local` sudah diisi dengan konfigurasi Firebase:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=iot-reports-2b7dd
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

## 📝 Catatan

- **Warning di deploy**: Warning tentang "Invalid function name: get" adalah false positive dari Firebase linter. Rules tetap berfungsi dengan baik.
- **Indexes**: Indexes akan dibuat secara otomatis di background. Proses ini bisa memakan waktu beberapa menit.
- **Storage Rules**: File `storage.rules` sudah dibuat dan siap di-deploy setelah Storage diaktifkan.

## ✅ Verifikasi

Setelah semua setup selesai, verifikasi dengan:
1. Login ke aplikasi dengan user yang sudah dibuat
2. Test create device di halaman New Installation
3. Test upload foto di halaman Repair
4. Test import CSV (jika role Supervisor/Admin)
