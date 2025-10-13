#!/usr/bin/env node

/**
 * ADSO Setup Verification Script
 * Checks if all required configuration is in place
 */

const fs = require('fs');
const path = require('path');

const checks = {
  passed: [],
  failed: [],
  warnings: []
};

console.log('🔍 ADSO Setup Verification\n');
console.log('=' .repeat(50) + '\n');

// Check 1: Node version
console.log('Checking Node.js version...');
const nodeVersion = process.version.match(/^v(\d+\.\d+)/)[1];
const nodeMajor = parseInt(process.version.match(/^v(\d+)/)[1]);
if (nodeMajor >= 18) {
  checks.passed.push(`✅ Node.js ${nodeVersion} (>= 18 required)`);
} else {
  checks.failed.push(`❌ Node.js ${nodeVersion} is too old. Need v18 or higher.`);
}

// Check 2: Package.json exists
console.log('Checking package.json...');
if (fs.existsSync('package.json')) {
  checks.passed.push('✅ package.json found');
} else {
  checks.failed.push('❌ package.json not found');
}

// Check 3: .env file exists
console.log('Checking .env file...');
if (fs.existsSync('.env')) {
  checks.passed.push('✅ .env file exists');

  // Check .env contents
  const envContent = fs.readFileSync('.env', 'utf8');
  const requiredVars = [
    'DATABASE_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'JWT_SECRET',
    'NEXT_PUBLIC_APP_URL'
  ];

  requiredVars.forEach(varName => {
    if (envContent.includes(varName) && !envContent.includes(`${varName}=""`)) {
      checks.passed.push(`  ✅ ${varName} is set`);
    } else {
      checks.failed.push(`  ❌ ${varName} is missing or empty`);
    }
  });

  // Check if using default JWT secret
  if (envContent.includes('adso_dev_secret_key_change_in_production')) {
    checks.warnings.push('  ⚠️  Using default JWT_SECRET (change for production)');
  }

  // Check if database URL needs updating
  if (envContent.includes('postgresql://user:password@localhost')) {
    checks.warnings.push('  ⚠️  DATABASE_URL needs to be updated with real credentials');
  }
} else {
  checks.failed.push('❌ .env file not found');
  checks.warnings.push('  ℹ️  Run: cp .env.example .env');
}

// Check 4: Prisma schema
console.log('Checking Prisma schema...');
if (fs.existsSync('prisma/schema.prisma')) {
  checks.passed.push('✅ Prisma schema found');
} else {
  checks.failed.push('❌ Prisma schema not found');
}

// Check 5: Node modules
console.log('Checking dependencies...');
if (fs.existsSync('node_modules')) {
  checks.passed.push('✅ node_modules directory exists');
} else {
  checks.failed.push('❌ Dependencies not installed');
  checks.warnings.push('  ℹ️  Run: npm install');
}

// Check 6: Source files
console.log('Checking source files...');
const requiredFiles = [
  'src/app/page.tsx',
  'src/app/dashboard/page.tsx',
  'src/app/api/auth/login/route.ts',
  'src/app/api/auth/callback/route.ts',
  'src/app/api/accounts/route.ts',
  'src/app/api/campaigns/route.ts',
  'src/lib/auth.ts',
  'src/lib/google-ads.ts',
  'src/lib/prisma.ts'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    checks.failed.push(`❌ Missing: ${file}`);
    allFilesExist = false;
  }
});

if (allFilesExist) {
  checks.passed.push(`✅ All ${requiredFiles.length} required source files exist`);
}

// Check 7: Prisma Client
console.log('Checking Prisma Client...');
if (fs.existsSync('node_modules/.prisma/client')) {
  checks.passed.push('✅ Prisma Client generated');
} else {
  checks.warnings.push('⚠️  Prisma Client not generated');
  checks.warnings.push('  ℹ️  Run: npm run db:generate');
}

// Print Results
console.log('\n' + '='.repeat(50));
console.log('\n📊 VERIFICATION RESULTS\n');

if (checks.passed.length > 0) {
  console.log('✅ PASSED CHECKS:\n');
  checks.passed.forEach(check => console.log(check));
  console.log();
}

if (checks.warnings.length > 0) {
  console.log('⚠️  WARNINGS:\n');
  checks.warnings.forEach(warning => console.log(warning));
  console.log();
}

if (checks.failed.length > 0) {
  console.log('❌ FAILED CHECKS:\n');
  checks.failed.forEach(fail => console.log(fail));
  console.log();
}

// Summary
console.log('='.repeat(50));
console.log('\n📝 SUMMARY\n');
console.log(`Passed: ${checks.passed.length}`);
console.log(`Warnings: ${checks.warnings.length}`);
console.log(`Failed: ${checks.failed.length}`);

// Next steps
console.log('\n' + '='.repeat(50));
console.log('\n📋 NEXT STEPS\n');

if (checks.failed.length > 0) {
  console.log('❌ Fix the failed checks above before proceeding.\n');
} else if (checks.warnings.length > 0) {
  console.log('⚠️  Address warnings before running the app:\n');
  console.log('1. Update DATABASE_URL in .env with real database credentials');
  console.log('2. Run: npm install');
  console.log('3. Run: npm run db:generate');
  console.log('4. Run: npm run db:push');
  console.log('5. Run: npm run dev\n');
} else {
  console.log('✅ All checks passed! Ready to run:\n');
  console.log('1. Update DATABASE_URL in .env (if not done)');
  console.log('2. Add redirect URI to Google Cloud Console');
  console.log('3. Run: npm run db:push');
  console.log('4. Run: npm run dev');
  console.log('5. Open: http://localhost:3000\n');
}

console.log('📚 See QUICKSTART.md for detailed instructions.');
console.log('='.repeat(50) + '\n');

process.exit(checks.failed.length > 0 ? 1 : 0);
