// Script to sync Firebase project configuration
// Run: node scripts/sync-firebase.js

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔄 Syncing Firebase Project Configuration...\n');

try {
  // Check if logged in
  console.log('1️⃣ Checking Firebase login status...');
  const loginStatus = execSync('npx firebase-tools login:list', { encoding: 'utf-8' });
  console.log('✅', loginStatus.trim());

  // Get current project
  console.log('\n2️⃣ Getting current Firebase project...');
  const currentProject = execSync('npx firebase-tools use', { encoding: 'utf-8' }).trim();
  console.log('✅ Current project:', currentProject);

  // Get project info
  console.log('\n3️⃣ Fetching project information...');
  const projectsList = execSync('npx firebase-tools projects:list', { encoding: 'utf-8' });
  console.log(projectsList);

  // Check .firebaserc
  const firebasercPath = path.join(process.cwd(), '.firebaserc');
  if (fs.existsSync(firebasercPath)) {
    const firebaserc = JSON.parse(fs.readFileSync(firebasercPath, 'utf-8'));
    console.log('\n4️⃣ Checking .firebaserc configuration...');
    console.log('✅ Project ID:', firebaserc.projects?.default);
  }

  // Check firebase.json
  const firebaseJsonPath = path.join(process.cwd(), 'firebase.json');
  if (fs.existsSync(firebaseJsonPath)) {
    const firebaseJson = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf-8'));
    console.log('\n5️⃣ Checking firebase.json configuration...');
    console.log('✅ Firestore location:', firebaseJson.firestore?.location);
    console.log('✅ Firestore rules:', firebaseJson.firestore?.rules);
    console.log('✅ Storage rules:', firebaseJson.storage?.rules || 'Not configured');
  }

  // Check .env.local
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    console.log('\n6️⃣ Checking .env.local...');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const hasProjectId = envContent.includes('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
    
    if (hasProjectId) {
      const projectIdMatch = envContent.match(/NEXT_PUBLIC_FIREBASE_PROJECT_ID=(.+)/);
      if (projectIdMatch) {
        const envProjectId = projectIdMatch[1].trim();
        console.log('✅ Project ID in .env.local:', envProjectId);
        
        if (envProjectId === currentProject) {
          console.log('✅ Project ID matches!');
        } else {
          console.log('⚠️  Project ID mismatch!');
          console.log('   Current project:', currentProject);
          console.log('   .env.local project:', envProjectId);
        }
      }
    } else {
      console.log('⚠️  NEXT_PUBLIC_FIREBASE_PROJECT_ID not found in .env.local');
    }
  } else {
    console.log('\n⚠️  .env.local not found!');
    console.log('   Please create .env.local with Firebase configuration.');
    console.log('   See: scripts/get-firebase-config.md');
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Firebase project sync check completed!');
  console.log('='.repeat(50));
  console.log('\n📝 Next steps:');
  console.log('   1. Verify .env.local has correct Firebase config');
  console.log('   2. Run: npm run verify:firebase');
  console.log('   3. Deploy rules: npx firebase-tools deploy');

} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.log('\n💡 Make sure you are logged in:');
  console.log('   npx firebase-tools login');
  process.exit(1);
}
