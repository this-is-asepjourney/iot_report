# Setup Instructions

## Langkah-langkah Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Firebase

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Buat project baru atau gunakan project yang sudah ada
3. Enable Authentication:
   - Masuk ke Authentication > Sign-in method
   - Enable Email/Password
4. Buat Firestore Database:
   - Masuk ke Firestore Database
   - Create database (mode: Production atau Test)
   - Pilih region terdekat
5. Enable Storage:
   - Masuk ke Storage
   - Get started
   - Gunakan default security rules untuk development

### 3. Setup Environment Variables

Buat file `.env.local` di root project:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

Untuk mendapatkan nilai-nilai ini:
- Masuk ke Firebase Console > Project Settings > General
- Scroll ke bawah ke "Your apps"
- Klik ikon web (</>) untuk menambahkan web app
- Copy konfigurasi yang diberikan

### 4. Setup Firestore Collections

Buat collections berikut di Firestore:

#### Collection: `users`
Contoh document:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "role": "teknisi",
  "factory_access": ["Factory A", "Factory B"]
}
```

#### Collection: `devices`
Akan dibuat otomatis saat import CSV atau new installation.

#### Collection: `repairs`
Akan dibuat otomatis saat input repair.

#### Collection: `installations`
Akan dibuat otomatis saat new installation.

### 5. Setup Firestore Security Rules

Masuk ke Firestore Database > Rules, dan paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to get user role
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    
    // Helper function to get user factory access
    function getUserFactoryAccess() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.factory_access;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && getUserRole() == 'admin';
    }
    
    // Devices collection
    match /devices/{deviceId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
        (getUserRole() in ['supervisor', 'admin']);
      allow delete: if request.auth != null && getUserRole() == 'admin';
    }
    
    // Repairs collection
    match /repairs/{repairId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
        (getUserRole() in ['supervisor', 'admin']);
    }
    
    // Installations collection
    match /installations/{installationId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }
  }
}
```

### 6. Setup Storage Security Rules

Masuk ke Storage > Rules, dan paste:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

**Note:** Rules di atas untuk development. Untuk production, sesuaikan dengan kebutuhan keamanan Anda.

### 7. Create First User

1. Masuk ke Firebase Console > Authentication
2. Tambahkan user manual dengan email dan password
3. Masuk ke Firestore > Collection `users`
4. Buat document dengan ID = UID dari user yang baru dibuat
5. Isi fields:
   - `name`: Nama user
   - `email`: Email user
   - `role`: "teknisi", "supervisor", atau "admin"
   - `factory_access`: Array of strings, contoh: ["Factory A", "Factory B"]

### 8. Run Development Server

```bash
npm run dev
```

Buka browser di `http://localhost:3000`

### 9. PWA Icons (Optional)

Untuk PWA icons, buat file:
- `public/icon-192.png` (192x192 pixels)
- `public/icon-512.png` (512x512 pixels)

Atau gunakan generator online seperti [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator)

## Troubleshooting

### Error: "Cannot find module 'react'"
- Pastikan sudah menjalankan `npm install`
- Hapus `node_modules` dan `package-lock.json`, lalu `npm install` lagi

### Error: "Firebase: Error (auth/invalid-api-key)"
- Pastikan environment variables sudah diisi dengan benar
- Restart development server setelah mengubah `.env.local`

### Error: "Permission denied" di Firestore
- Pastikan security rules sudah di-setup dengan benar
- Pastikan user sudah login
- Check role user di collection `users`

### QR Scanner tidak bekerja
- Pastikan menggunakan HTTPS atau localhost
- Pastikan browser mengizinkan akses kamera
- Untuk mobile, pastikan menggunakan HTTPS

## Next Steps

1. Import data device dari CSV (jika ada)
2. Setup user accounts untuk tim
3. Test semua fitur
4. Deploy ke production (Vercel, Netlify, atau hosting lain)
