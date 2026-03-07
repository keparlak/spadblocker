#!/usr/bin/env node

/**
 * Bundle Analyzer for Spadblocker
 * Analyzes bundle size, complexity, and performance metrics
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DIST_DIR = path.join(__dirname, '../dist');
const SRC_DIR = path.join(__dirname, '../src');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Colorize console output
 */
function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Analyze bundle file
 */
function analyzeBundle(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(colorize(`❌ Bundle file not found: ${filePath}`, 'red'));
    return null;
  }

  const stats = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  
  return {
    path: filePath,
    size: stats.size,
    sizeKB: (stats.size / 1024).toFixed(2),
    lines: content.split('\n').length,
    characters: content.length,
    // Basic complexity metrics
    functions: (content.match(/function\s+\w+|=>\s*{|\w+\s*:\s*function/g) || []).length,
    classes: (content.match(/class\s+\w+/g) || []).length,
    // Modern JS features
    arrowFunctions: (content.match(/=>/g) || []).length,
    asyncFunctions: (content.match(/async\s+function|async\s+\w+/g) || []).length,
    awaitCalls: (content.match(/await\s+/g) || []).length,
    destructuring: (content.match(/const\s*{[^}]+}|const\s*\[[^\]]+\]/g) || []).length,
    optionalChaining: (content.match(/\?\.|\\?\\./g) || []).length,
    nullishCoalescing: (content.match(/\\?\\?/g) || []).length,
    // Performance indicators
    domQueries: (content.match(/querySelector|querySelectorAll|getElementById|getElementsBy/g) || []).length,
    eventListeners: (content.match(/addEventListener|removeEventListener/g) || []).length,
    timers: (content.match(/setTimeout|setInterval/g) || []).length
  };
}

/**
 * Analyze source files
 */
function analyzeSourceFiles() {
  const sourceFiles = fs.readdirSync(SRC_DIR).filter(file => file.endsWith('.js'));
  const analysis = {
    totalFiles: sourceFiles.length,
    totalLines: 0,
    totalSize: 0,
    features: {
      es6Classes: 0,
      arrowFunctions: 0,
      asyncFunctions: 0,
      destructuring: 0,
      optionalChaining: 0,
      nullishCoalescing: 0
    }
  };

  for (const file of sourceFiles) {
    const filePath = path.join(SRC_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);

    analysis.totalLines += content.split('\n').length;
    analysis.totalSize += stats.size;
    analysis.features.es6Classes += (content.match(/class\s+\w+/g) || []).length;
    analysis.features.arrowFunctions += (content.match(/=>/g) || []).length;
    analysis.features.asyncFunctions += (content.match(/async\s+function|async\s+\w+/g) || []).length;
    analysis.features.destructuring += (content.match(/const\s*{[^}]+}|const\s*\[[^\]]+\]/g) || []).length;
    analysis.features.optionalChaining += (content.match(/\?\.|\\?\\./g) || []).length;
    analysis.features.nullishCoalescing += (content.match(/\\?\\?/g) || []).length;
  }

  return analysis;
}

/**
 * Generate performance report
 */
function generatePerformanceReport(bundleAnalysis, sourceAnalysis) {
  console.log(colorize('\n📊 Bundle Analysis Report', 'bright'));
  console.log('='.repeat(50));

  // Bundle size analysis
  console.log(colorize('\n📦 Bundle Size:', 'cyan'));
  console.log(`  Main Bundle: ${colorize(bundleAnalysis.sizeKB + ' KB', 'yellow')}`);
  console.log(`  Lines: ${colorize(bundleAnalysis.lines.toLocaleString(), 'blue')}`);
  console.log(`  Characters: ${colorize(bundleAnalysis.characters.toLocaleString(), 'blue')}`);

  // Complexity metrics
  console.log(colorize('\n🧠 Code Complexity:', 'magenta'));
  console.log(`  Functions: ${colorize(bundleAnalysis.functions.toString(), 'blue')}`);
  console.log(`  Classes: ${colorize(bundleAnalysis.classes.toString(), 'blue')}`);
  console.log(`  Functions per KB: ${colorize((bundleAnalysis.functions / bundleAnalysis.sizeKB).toFixed(2), 'yellow')}`);

  // Modern JavaScript features
  console.log(colorize('\n✨ Modern JS Features:', 'green'));
  console.log(`  Arrow Functions: ${colorize(bundleAnalysis.arrowFunctions.toString(), 'blue')}`);
  console.log(`  Async Functions: ${colorize(bundleAnalysis.asyncFunctions.toString(), 'blue')}`);
  console.log(`  Await Calls: ${colorize(bundleAnalysis.awaitCalls.toString(), 'blue')}`);
  console.log(`  Destructuring: ${colorize(bundleAnalysis.destructuring.toString(), 'blue')}`);
  console.log(`  Optional Chaining: ${colorize(bundleAnalysis.optionalChaining.toString(), 'blue')}`);
  console.log(`  Nullish Coalescing: ${colorize(bundleAnalysis.nullishCoalescing.toString(), 'blue')}`);

  // Performance indicators
  console.log(colorize('\n⚡ Performance Indicators:', 'yellow'));
  console.log(`  DOM Queries: ${colorize(bundleAnalysis.domQueries.toString(), 'blue')}`);
  console.log(`  Event Listeners: ${colorize(bundleAnalysis.eventListeners.toString(), 'blue')}`);
  console.log(`  Timers: ${colorize(bundleAnalysis.timers.toString(), 'blue')}`);

  // Source analysis
  console.log(colorize('\n📁 Source Code Analysis:', 'cyan'));
  console.log(`  Total Files: ${colorize(sourceAnalysis.totalFiles.toString(), 'blue')}`);
  console.log(`  Total Lines: ${colorize(sourceAnalysis.totalLines.toLocaleString(), 'blue')}`);
  console.log(`  Source Size: ${colorize((sourceAnalysis.totalSize / 1024).toFixed(2) + ' KB', 'yellow')}`);
  console.log(`  Compression Ratio: ${colorize(((bundleAnalysis.sizeKB / (sourceAnalysis.totalSize / 1024)) * 100).toFixed(1) + '%', 'yellow')}`);

  // Recommendations
  console.log(colorize('\n💡 Optimization Recommendations:', 'bright'));
  const recommendations = [];

  if (bundleAnalysis.sizeKB > 50) {
    recommendations.push('Consider code splitting to reduce initial bundle size');
  }

  if (bundleAnalysis.domQueries > 20) {
    recommendations.push('Cache DOM queries to improve performance');
  }

  if (bundleAnalysis.timers > 10) {
    recommendations.push('Review timer usage and consider debouncing');
  }

  if (bundleAnalysis.functions / bundleAnalysis.sizeKB < 2) {
    recommendations.push('Consider breaking down large functions');
  }

  if (bundleAnalysis.optionalChaining === 0) {
    recommendations.push('Use optional chaining for safer property access');
  }

  if (recommendations.length === 0) {
    console.log(colorize('  ✅ No major optimization needed!', 'green'));
  } else {
    recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
  }

  // Performance score
  const score = calculatePerformanceScore(bundleAnalysis, sourceAnalysis);
  console.log(colorize(`\n🏆 Performance Score: ${score}/100`, score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red'));
}

/**
 * Calculate performance score
 */
function calculatePerformanceScore(bundle, _source) {
  let score = 100;

  // Size penalty
  if (bundle.sizeKB > 30) score -= 10;
  if (bundle.sizeKB > 50) score -= 20;

  // Complexity penalty
  if (bundle.functions / bundle.sizeKB < 1) score -= 10;

  // Modern JS bonus
  if (bundle.arrowFunctions > bundle.functions * 0.5) score += 5;
  if (bundle.asyncFunctions > 0) score += 5;
  if (bundle.optionalChaining > 0) score += 5;

  // Performance bonus
  if (bundle.domQueries < 15) score += 5;
  if (bundle.timers < 5) score += 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * Main analysis function
 */
function main() {
  console.log(colorize('🔍 Analyzing Spadblocker Bundle...', 'bright'));

  const bundlePath = path.join(DIST_DIR, 'spadblocker.js');
  const bundleAnalysis = analyzeBundle(bundlePath);
  const sourceAnalysis = analyzeSourceFiles();

  if (bundleAnalysis) {
    generatePerformanceReport(bundleAnalysis, sourceAnalysis);
  } else {
    console.log(colorize('❌ Run build first: npm run build', 'red'));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  analyzeBundle,
  analyzeSourceFiles,
  generatePerformanceReport
};
