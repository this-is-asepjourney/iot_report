// Script to verify Firebase configuration
// Run: node scripts/verify-firebase-config.js

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Firebase Configuration...\n');

// Check .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
    console.log('❌ .env.local file not found!');
    console.log('📝 Please create .env.local file with Firebase configuration.\n');
    process.exit(1);
}

// Read .env.local
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
            envVars[key.trim()] = valueParts.join('=').trim();
        }
    }
});

// Required Firebase env vars
const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
];

console.log('📋 Checking required environment variables:\n');

let allPresent = true;
requiredVars.forEach(varName => {
    const value = envVars[varName];
    if (value && value !== `your_${varName.toLowerCase().replace('next_public_', '')}_here`) {
        console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
    } else {
        console.log(`❌ ${varName}: Missing or not configured`);
        allPresent = false;
    }
});

// Check .firebaserc
const firebasercPath = path.join(process.cwd(), '.firebaserc');
if (fs.existsSync(firebasercPath)) {
    const firebaserc = JSON.parse(fs.readFileSync(firebasercPath, 'utf-8'));
    console.log(`\n📦 Firebase Project: ${firebaserc.projects?.default || 'Not set'}`);

    // Verify project ID matches
    if (envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
        if (firebaserc.projects?.default === envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
            console.log('✅ Project ID matches between .env.local and .firebaserc');
        } else {
            console.log('⚠️  Project ID mismatch between .env.local and .firebaserc');
        }
    }
}

console.log('\n' + '='.repeat(50));
if (allPresent) {
    console.log('✅ All Firebase configuration variables are present!');
    console.log('💡 Next: Make sure values are correct from Firebase Console');
} else {
    console.log('❌ Some configuration variables are missing!');
    console.log('📝 Please update .env.local with correct Firebase values');
}
console.log('='.repeat(50));
