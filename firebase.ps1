# Firebase CLI Helper Script
# Gunakan script ini untuk menjalankan firebase commands di PowerShell

param(
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Arguments
)

# Cek apakah firebase-tools terinstall
$firebasePath = "$env:APPDATA\npm\firebase.cmd"

if (Test-Path $firebasePath) {
    & $firebasePath $Arguments
} else {
    Write-Host "Firebase tools tidak ditemukan. Menggunakan npx..." -ForegroundColor Yellow
    npx firebase-tools $Arguments
}
