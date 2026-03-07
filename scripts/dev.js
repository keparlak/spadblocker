#!/usr/bin/env node

/**
 * Development script for Spadblocker
 * Watches for file changes and rebuilds automatically
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SRC_DIR = path.join(__dirname, '../src');
const _DIST_DIR = path.join(__dirname, '../dist');

// Import build functions
const { buildExtension } = require('./build');

/**
 * Watch for file changes
 */
function watchFiles() {
  console.log('👀 Watching for file changes...');
  console.log('📁 Source directory:', SRC_DIR);
  console.log('🔄 Press Ctrl+C to stop watching\n');

  // Watch all .js files in src directory
  fs.watch(SRC_DIR, { recursive: true }, (eventType, filename) => {
    if (filename && filename.endsWith('.js')) {
      console.log(`📝 File changed: ${filename} (${eventType})`);

      // Debounce rapid changes
      setTimeout(() => {
        console.log('🔨 Rebuilding...');
        const success = buildExtension();

        if (success) {
          console.log('✅ Rebuild completed!\n');
        } else {
          console.log('❌ Rebuild failed!\n');
        }
      }, 500);
    }
  });
}

/**
 * Initial build
 */
function initialBuild() {
  console.log('🚀 Starting development mode...\n');

  const success = buildExtension();

  if (success) {
    console.log('✅ Initial build completed!');
    watchFiles();
  } else {
    console.error('❌ Initial build failed!');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initialBuild();
}

module.exports = {
  watchFiles
};
