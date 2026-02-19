# Cara Mendapatkan Firebase Configuration

## Langkah-langkah:

### 1. Buka Firebase Console
https://console.firebase.google.com/project/iot-reports-2b7dd

### 2. Masuk ke Project Settings
- Klik ikon **⚙️ Settings** (gear icon) di sidebar kiri
- Pilih **Project settings**

### 3. Scroll ke bagian "Your apps"
- Di bagian bawah halaman, ada section **"Your apps"**
- Jika belum ada web app, klik ikon **`</>`** (Web) untuk menambahkan

### 4. Copy Configuration
Setelah web app dibuat, akan muncul konfigurasi seperti ini:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "iot-reports-2b7dd.firebaseapp.com",
  projectId: "iot-reports-2b7dd",
  storageBucket: "iot-reports-2b7dd.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

### 5. Update .env.local
Copy nilai-nilai tersebut ke file `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=iot-reports-2b7dd.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=iot-reports-2b7dd
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=iot-reports-2b7dd.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

### 6. Verifikasi
Jalankan script verifikasi:
```powershell
node scripts/verify-firebase-config.js
```

## Quick Link:
- **Project Settings**: https://console.firebase.google.com/project/iot-reports-2b7dd/settings/general
- **Add Web App**: https://console.firebase.google.com/project/iot-reports-2b7dd/settings/general/web
