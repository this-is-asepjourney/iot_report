# Firebase Credentials & Project Sync

## ✅ Status Sinkronisasi

Project sudah tersinkronkan dengan Firebase:
- **Project ID**: `iot-reports-2b7dd`
- **Firebase CLI**: Terhubung sebagai `asepjourney551@gmail.com`
- **Firestore**: Location `asia-southeast2`
- **Rules**: Sudah di-deploy
- **Indexes**: Sudah di-deploy

## 🔍 Verifikasi Konfigurasi

### 1. Cek Status Sync
```powershell
npm run sync:firebase
```

### 2. Verifikasi Environment Variables
```powershell
npm run verify:firebase
```

## 📋 Checklist Konfigurasi

### ✅ Sudah Terkonfigurasi:
- [x] Firebase CLI login
- [x] Project ID: `iot-reports-2b7dd`
- [x] `.firebaserc` - Project configuration
- [x] `firebase.json` - Firebase services config
- [x] `firestore.rules` - Security rules (deployed)
- [x] `firestore.indexes.json` - Database indexes (deployed)
- [x] `storage.rules` - Storage security rules (ready)
- [x] `.env.local` - Environment variables

### ⚠️ Perlu Setup Manual:
- [ ] **Firebase Storage** - Aktifkan di Console
- [ ] **Authentication** - Enable Email/Password
- [ ] **User pertama** - Buat di Authentication & Firestore

## 🔑 Mendapatkan Firebase Credentials

### Quick Link:
**Project Settings**: https://console.firebase.google.com/project/iot-reports-2b7dd/settings/general

### Langkah-langkah:

1. **Buka Firebase Console**
   ```
   https://console.firebase.google.com/project/iot-reports-2b7dd
   ```

2. **Masuk ke Project Settings**
   - Klik ikon ⚙️ Settings di sidebar
   - Pilih **Project settings**

3. **Scroll ke "Your apps"**
   - Di bagian bawah halaman
   - Jika belum ada web app, klik ikon `</>` (Web)

4. **Copy Configuration**
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "iot-reports-2b7dd.firebaseapp.com",
     projectId: "iot-reports-2b7dd",
     storageBucket: "iot-reports-2b7dd.appspot.com",
     messagingSenderId: "895992734690",
     appId: "1:895992734690:web:..."
   };
   ```

5. **Update `.env.local`**
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=iot-reports-2b7dd.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=iot-reports-2b7dd
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=iot-reports-2b7dd.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=895992734690
   NEXT_PUBLIC_FIREBASE_APP_ID=1:895992734690:web:...
   ```

## 🔄 Sync Project dengan Firebase

### Deploy Rules & Indexes
```powershell
# Deploy Firestore rules
npx firebase-tools deploy --only firestore:rules

# Deploy Firestore indexes
npx firebase-tools deploy --only firestore:indexes

# Deploy Storage rules (setelah Storage diaktifkan)
npx firebase-tools deploy --only storage

# Deploy semua
npx firebase-tools deploy
```

### Switch Project (jika perlu)
```powershell
# Lihat semua projects
npx firebase-tools projects:list

# Switch ke project lain
npx firebase-tools use <project-id>
```

## 🛠️ Troubleshooting

### Error: "Project not found"
```powershell
# Pastikan project ID benar
npx firebase-tools use iot-reports-2b7dd

# Verifikasi
npx firebase-tools projects:list
```

### Error: "Not logged in"
```powershell
# Login ulang
npx firebase-tools login

# Verifikasi
npx firebase-tools login:list
```

### Error: "Invalid API key"
1. Pastikan `.env.local` sudah diisi dengan benar
2. Restart development server setelah mengubah `.env.local`
3. Verifikasi di Firebase Console > Project Settings > General

### Project ID Mismatch
```powershell
# Cek project ID di .firebaserc
cat .firebaserc

# Cek project ID di .env.local
# Pastikan NEXT_PUBLIC_FIREBASE_PROJECT_ID=iot-reports-2b7dd
```

## 📝 File Konfigurasi

### `.firebaserc`
```json
{
  "projects": {
    "default": "iot-reports-2b7dd"
  }
}
```

### `firebase.json`
- Firestore configuration
- Storage configuration
- Hosting configuration (optional)

### `.env.local`
- Firebase API credentials
- **JANGAN commit** ke Git (sudah di `.gitignore`)

## ✅ Verifikasi Akhir

Setelah semua setup, verifikasi dengan:

1. **Cek sync status**
   ```powershell
   npm run sync:firebase
   ```

2. **Cek environment variables**
   ```powershell
   npm run verify:firebase
   ```

3. **Test koneksi**
   - Start dev server: `npm run dev`
   - Buka: http://localhost:3000
   - Coba login (setelah user dibuat)

## 🔗 Quick Links

- **Firebase Console**: https://console.firebase.google.com/project/iot-reports-2b7dd
- **Project Settings**: https://console.firebase.google.com/project/iot-reports-2b7dd/settings/general
- **Firestore**: https://console.firebase.google.com/project/iot-reports-2b7dd/firestore
- **Storage**: https://console.firebase.google.com/project/iot-reports-2b7dd/storage
- **Authentication**: https://console.firebase.google.com/project/iot-reports-2b7dd/authentication
