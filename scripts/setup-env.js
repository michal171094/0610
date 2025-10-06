#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🔧 Setting up environment files...\n');

// Check if .env.local exists
const envPath = path.join(process.cwd(), '.env.local');
const templatePath = path.join(process.cwd(), '.env.local.template');

if (fs.existsSync(envPath)) {
  console.log('⚠️  .env.local already exists');
  console.log('   If you want to regenerate, delete it first.\n');
  process.exit(0);
}

if (!fs.existsSync(templatePath)) {
  console.error('❌ .env.local.template not found!');
  process.exit(1);
}

// Copy template to .env.local
const template = fs.readFileSync(templatePath, 'utf8');
fs.writeFileSync(envPath, template);

console.log('✅ Created .env.local from template');
console.log('📝 Please update .env.local with your actual API keys:\n');
console.log('   1. NEXT_PUBLIC_SUPABASE_URL');
console.log('   2. NEXT_PUBLIC_SUPABASE_ANON_KEY');
console.log('   3. SUPABASE_SERVICE_ROLE_KEY');
console.log('   4. OPENAI_API_KEY\n');
console.log('💡 Run "npm run check:setup" to verify your configuration');
