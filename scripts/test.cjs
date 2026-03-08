#!/usr/bin/env node

/**
 * Test script for Spadblocker
 * Validates syntax and basic functionality
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SRC_DIR = path.join(__dirname, '../src');
const DIST_DIR = path.join(__dirname, '../dist');

// Test results
let testsPassed = 0;
let testsTotal = 0;

/**
 * Test helper functions
 */
function test(name, testFn) {
  testsTotal++;
  try {
    const result = testFn();
    if (result) {
      console.log(`✅ ${name}`);
      testsPassed++;
    } else {
      console.log(`❌ ${name}`);
    }
  } catch (error) {
    console.log(`❌ ${name} - Error: ${error.message}`);
  }
}

/**
 * Check if file exists
 */
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * Check JavaScript syntax
 */
function validateSyntax(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    new Function(content);
    return true;
  } catch (error) {
    console.error(`Syntax error in ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Check for required functions/classes
 */
function validateStructure(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    const requiredItems = {
      'spadblocker.js': ['class Spadblocker', 'initialize', 'CONFIG', 'AudioAdBlocker', 'UIAdRemover', 'PremiumFeatures']
    };

    const filename = path.basename(filePath);
    const required = requiredItems[filename];

    if (!required) {
      return true; // No specific requirements for this file
    }

    return required.every(item => content.includes(item));
  } catch (error) {
    console.error(`Structure validation error for ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Check build output
 */
function validateBuild() {
  const distFile = path.join(DIST_DIR, 'spadblocker.js');
  const minFile = path.join(DIST_DIR, 'spadblocker.min.js');

  return fileExists(distFile) && fileExists(minFile);
}

/**
 * Run all tests
 */
function runTests() {
  console.log('🧪 Running Spadblocker tests...\n');

  // Test source files exist
  test('Source directory exists', () => fileExists(SRC_DIR));

  const sourceFiles = [
    'spadblocker.js'
  ];

  sourceFiles.forEach(file => {
    const filePath = path.join(SRC_DIR, file);
    test(`${file} exists`, () => fileExists(filePath));
    test(`${file} has valid syntax`, () => validateSyntax(filePath));
    test(`${file} has correct structure`, () => validateStructure(filePath));
  });

  // Test build output
  test('Build directory exists', () => fileExists(DIST_DIR));
  test('Build output exists', () => validateBuild());

  // Test package.json
  const packagePath = path.join(__dirname, '../package.json');
  test('package.json exists', () => fileExists(packagePath));
  test('package.json has valid JSON', () => {
    try {
      const content = fs.readFileSync(packagePath, 'utf8');
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  });

  // Test README
  const readmePath = path.join(__dirname, '../README.md');
  test('README.md exists', () => fileExists(readmePath));
  test('README.md has content', () => {
    try {
      const content = fs.readFileSync(readmePath, 'utf8');
      return content.length > 1000; // Should have substantial content
    } catch {
      return false;
    }
  });

  // Summary
  console.log('\n📊 Test Results:');
  console.log(`Passed: ${testsPassed}/${testsTotal}`);
  console.log(`Success Rate: ${((testsPassed / testsTotal) * 100).toFixed(1)}%`);

  if (testsPassed === testsTotal) {
    console.log('\n🎉 All tests passed!');
    return true;
  } else {
    console.log('\n💥 Some tests failed!');
    return false;
  }
}

/**
 * Lint check
 */
function runLinting() {
  console.log('\n🔍 Running basic linting...');

  const sourceFiles = [
    'spadblocker.js'
  ];

  let lintPassed = 0;
  let lintTotal = 0;

  sourceFiles.forEach(file => {
    const filePath = path.join(SRC_DIR, file);

    if (fileExists(filePath)) {
      lintTotal++;

      try {
        const content = fs.readFileSync(filePath, 'utf8');

        // Basic linting rules
        const issues = [];

        // Check for console.log statements (should be removed in production)
        if (content.includes('console.log(') && !content.includes('console.error(')) {
          issues.push('Contains console.log statements');
        }

        // Check for TODO comments
        if (content.includes('// TODO') || content.includes('/* TODO')) {
          issues.push('Contains TODO comments');
        }

        // Check for proper JSDoc comments
        if (!content.includes('/**')) {
          issues.push('Missing JSDoc comments');
        }

        if (issues.length === 0) {
          console.log(`✅ ${file} - No linting issues`);
          lintPassed++;
        } else {
          console.log(`⚠️  ${file} - Issues: ${issues.join(', ')}`);
        }

      } catch (error) {
        console.log(`❌ ${file} - Linting error: ${error.message}`);
      }
    }
  });

  console.log(`\n📋 Linting: ${lintPassed}/${lintTotal} files passed`);
}

// Main test runner
function main() {
  const testsPassed = runTests();
  runLinting();

  if (testsPassed) {
    console.log('\n🚀 Ready for distribution!');
    process.exit(0);
  } else {
    console.log('\n🔧 Fix issues before distribution.');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runTests,
  runLinting
};
