# Firebase CLI Setup & Usage

## Masalah: `firebase` command tidak dikenali

Setelah install `firebase-tools` secara global, command `firebase` mungkin tidak dikenali di PowerShell karena PATH belum ter-update.

## Solusi

### Opsi 1: Gunakan `npx` (Paling Mudah) ✅

Gunakan `npx` untuk menjalankan firebase commands:

```powershell
# Login ke Firebase
npx firebase-tools login

# Initialize project
npx firebase-tools init

# Deploy
npx firebase-tools deploy

# Lihat semua commands
npx firebase-tools --help
```

### Opsi 2: Gunakan Full Path

```powershell
& "$env:APPDATA\npm\firebase.cmd" login
& "$env:APPDATA\npm\firebase.cmd" init
& "$env:APPDATA\npm\firebase.cmd" deploy
```

### Opsi 3: Gunakan Script Helper

Jalankan script `firebase.ps1` yang sudah dibuat:

```powershell
# Login
.\firebase.ps1 login

# Init
.\firebase.ps1 init

# Deploy
.\firebase.ps1 deploy
```

### Opsi 4: Tambahkan ke PATH Permanen

1. Buka **System Properties** > **Environment Variables**
2. Di **User variables**, edit **Path**
3. Tambahkan: `C:\Users\F\AppData\Roaming\npm`
4. Restart PowerShell

Atau jalankan di PowerShell (Admin):

```powershell
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$env:APPDATA\npm", "User")
```

Kemudian **restart PowerShell**.

## Commands yang Sering Digunakan

### 1. Login ke Firebase
```powershell
npx firebase-tools login
```

### 2. Initialize Firebase Project
```powershell
npx firebase-tools init
```

Pilih:
- ✅ Firestore
- ✅ Storage
- ✅ Hosting (optional)

### 3. Setup Firestore Rules
```powershell
npx firebase-tools deploy --only firestore:rules
```

### 4. Setup Storage Rules
```powershell
npx firebase-tools deploy --only storage
```

### 5. Deploy Semua
```powershell
npx firebase-tools deploy
```

### 6. Lihat Project Info
```powershell
npx firebase-tools projects:list
```

### 7. Set Active Project
```powershell
npx firebase-tools use <project-id>
```

## Troubleshooting

### Error: "Cannot run login in non-interactive mode"
- Pastikan menjalankan di terminal interaktif (bukan script)
- Buka browser untuk login

### Error: "Command not found"
- Gunakan `npx firebase-tools` sebagai gantinya
- Atau restart PowerShell setelah menambah PATH

### Error: "Permission denied"
- Pastikan sudah login: `npx firebase-tools login`
- Cek project ID: `npx firebase-tools projects:list`

## Rekomendasi

**Gunakan `npx firebase-tools`** untuk semua commands - ini adalah cara termudah dan tidak perlu setup PATH.

Contoh:
```powershell
npx firebase-tools login
npx firebase-tools init
npx firebase-tools deploy
```
