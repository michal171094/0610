#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking project setup...\n');

let hasErrors = false;

// Check Node version
console.log('📦 Node.js Version:');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion < 18) {
  console.error('   ❌ Node.js 18+ required. Current:', nodeVersion);
  hasErrors = true;
} else {
  console.log('   ✅', nodeVersion);
}

// Check required files
console.log('\n📄 Required Files:');
const requiredFiles = [
  '.env.local',
  'package.json',
  'tsconfig.json',
  'tailwind.config.ts',
  'next.config.js'
];

for (const file of requiredFiles) {
  const exists = fs.existsSync(path.join(process.cwd(), file));
  console.log(exists ? '   ✅' : '   ❌', file);
  if (!exists && file === '.env.local') {
    console.log('      💡 Run "npm run setup:env" to create it');
  }
  if (!exists) hasErrors = true;
}

// Check environment variables
console.log('\n🔐 Environment Variables:');
if (fs.existsSync(path.join(process.cwd(), '.env.local'))) {
  require('dotenv').config({ path: '.env.local' });
  
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY'
  ];
  
  for (const envVar of requiredEnvVars) {
    const isSet = !!process.env[envVar] && !process.env[envVar].includes('YOUR_');
    const status = isSet ? '✅' : '❌';
    const value = isSet ? '***' : 'NOT SET';
    console.log(`   ${status} ${envVar}: ${value}`);
    if (!isSet) hasErrors = true;
  }
  
  // Optional variables
  console.log('\n   Optional:');
  const optionalVars = ['GOOGLE_CLIENT_ID', 'LANGFUSE_PUBLIC_KEY'];
  for (const envVar of optionalVars) {
    const isSet = !!process.env[envVar];
    console.log(`   ${isSet ? '✅' : 'ℹ️ '} ${envVar}: ${isSet ? 'Set' : 'Not set'}`);
  }
} else {
  console.log('   ❌ .env.local not found');
  console.log('      💡 Run "npm run setup:env" to create it');
  hasErrors = true;
}

// Check database connection (basic)
console.log('\n🗄️  Database Setup:');
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.log('   ✅ Supabase credentials configured');
  console.log('   💡 Run SQL scripts in Supabase SQL Editor:');
  console.log('      1. database/00-enable-extensions.sql');
  console.log('      2. database/01-create-tables-only.sql');
  console.log('      3. database/02-create-indexes-triggers.sql');
  console.log('      4. database/04-FINAL-COMPLETION.sql');
} else {
  console.log('   ❌ Supabase not configured');
  hasErrors = true;
}

// Check dependencies
console.log('\n📚 Dependencies:');
if (fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
  console.log('   ✅ node_modules exists');
  
  // Check critical packages
  const criticalPackages = [
    'next',
    'react',
    '@supabase/supabase-js',
    '@langchain/langgraph',
    'zod'
  ];
  
  let allInstalled = true;
  for (const pkg of criticalPackages) {
    const installed = fs.existsSync(path.join(process.cwd(), 'node_modules', pkg));
    if (!installed) {
      console.log(`   ❌ ${pkg} not installed`);
      allInstalled = false;
    }
  }
  
  if (allInstalled) {
    console.log('   ✅ All critical packages installed');
  } else {
    console.log('   💡 Run "npm install" to install dependencies');
    hasErrors = true;
  }
} else {
  console.log('   ❌ node_modules not found');
  console.log('   💡 Run "npm install"');
  hasErrors = true;
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ Setup incomplete. Please fix the issues above.');
  process.exit(1);
} else {
  console.log('✅ Setup complete! You can now run: npm run dev');
  console.log('\n💡 Next steps:');
  console.log('   1. Make sure you ran all SQL scripts in Supabase');
  console.log('   2. Start dev server: npm run dev');
  console.log('   3. Open http://localhost:3000');
}
