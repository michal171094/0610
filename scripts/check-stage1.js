/**
 * Stage 1 Verification Script
 * Checks that all Stage 1 components are properly installed
 * 
 * Run: node scripts/check-stage1.js
 */

const fs = require('fs')
const path = require('path')

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function checkFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath)
  const exists = fs.existsSync(fullPath)
  
  if (exists) {
    const stats = fs.statSync(fullPath)
    log(`✓ ${filePath} (${stats.size} bytes)`, 'green')
    return true
  } else {
    log(`✗ ${filePath} - NOT FOUND`, 'red')
    return false
  }
}

function checkEnvVar(varName) {
  // Load .env.local
  const envPath = path.join(process.cwd(), '.env.local')
  
  if (!fs.existsSync(envPath)) {
    log(`✗ .env.local not found`, 'red')
    return false
  }

  const envContent = fs.readFileSync(envPath, 'utf8')
  const hasVar = envContent.includes(varName)
  
  if (hasVar) {
    // Check if it has a value (not just placeholder)
    const match = envContent.match(new RegExp(`${varName}=(.+)`))
    const value = match ? match[1].trim() : ''
    
    if (value && !value.includes('your-') && !value.includes('xxx')) {
      log(`✓ ${varName} is set`, 'green')
      return true
    } else {
      log(`⚠ ${varName} exists but needs value`, 'yellow')
      return false
    }
  } else {
    log(`✗ ${varName} - NOT SET`, 'red')
    return false
  }
}

function checkNpmPackage(packageName) {
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  
  if (!fs.existsSync(packageJsonPath)) {
    log(`✗ package.json not found`, 'red')
    return false
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }
  
  if (deps[packageName]) {
    log(`✓ ${packageName} (${deps[packageName]})`, 'green')
    return true
  } else {
    log(`✗ ${packageName} - NOT INSTALLED`, 'red')
    return false
  }
}

async function main() {
  log('\n========================================', 'blue')
  log('  STAGE 1 VERIFICATION', 'blue')
  log('========================================\n', 'blue')

  let allPassed = true

  // Check files
  log('Checking Files:', 'blue')
  const files = [
    'lib/memory/qdrant-memory.ts',
    'lib/memory/hybrid-memory.ts',
    'lib/ai/smart-router.ts',
    'lib/ai/deep-reasoner.ts',
    'app/api/memory/search/route.ts',
    'app/api/memory/save/route.ts',
    'database-stage1.sql',
  ]

  for (const file of files) {
    if (!checkFile(file)) allPassed = false
  }

  // Check NPM packages
  log('\nChecking NPM Packages:', 'blue')
  const packages = [
    '@qdrant/js-client',
    'openai',
  ]

  for (const pkg of packages) {
    if (!checkNpmPackage(pkg)) allPassed = false
  }

  // Check environment variables
  log('\nChecking Environment Variables:', 'blue')
  const envVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'QDRANT_URL',
    'QDRANT_API_KEY',
  ]

  for (const envVar of envVars) {
    if (!checkEnvVar(envVar)) allPassed = false
  }

  // Summary
  log('\n========================================', 'blue')
  if (allPassed) {
    log('✓ ALL CHECKS PASSED', 'green')
    log('Stage 1 is ready!', 'green')
    log('\nNext steps:', 'blue')
    log('1. Set up Qdrant Cloud account', 'reset')
    log('2. Update QDRANT_URL and QDRANT_API_KEY in .env.local', 'reset')
    log('3. Run: npm run dev', 'reset')
    log('4. Test: POST to /api/memory/save', 'reset')
  } else {
    log('✗ SOME CHECKS FAILED', 'red')
    log('Please fix the issues above before continuing', 'yellow')
  }
  log('========================================\n', 'blue')
}

main()