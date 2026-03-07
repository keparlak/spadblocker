#!/usr/bin/env node

/**
 * Build script for Spadblocker
 * Combines all modules into a single distributable file
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SRC_DIR = path.join(__dirname, '../src');
const DIST_DIR = path.join(__dirname, '../dist');
const OUTPUT_FILE = path.join(DIST_DIR, 'spadblocker.js');

// Ensure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// Module files in order (now just single file)
const moduleFiles = [
  'spadblocker.js'
];

/**
 * Combine all module files into one
 */
function buildExtension() {
  console.log('🔨 Building Spadblocker extension...');

  try {
    // Start with header comment
    let combinedContent = `/**
 * Spadblocker - Custom Spotify Adblocker Extension
 * Eliminates ads and unlocks premium features for free users
 * 
 * @version 1.0.0
 * @author Spadblocker Team
 * @license MIT
 * @build ${new Date().toISOString()}
 */

`;

    // Read and combine each module
    for (const file of moduleFiles) {
      const filePath = path.join(SRC_DIR, file);

      if (!fs.existsSync(filePath)) {
        throw new Error(`Module file not found: ${file}`);
      }

      console.log(`📦 Adding module: ${file}`);
      const content = fs.readFileSync(filePath, 'utf8');

      // Remove any existing export statements for browser compatibility
      const browserContent = content
        .replace(/if\s*\(\s*typeof\s+module\s*!==\s*['"]undefined['"].*?\}/gs, '')
        .replace(/module\.exports\s*=\s*[^;]+;/g, '')
        .replace(/window\.\w+\s*=\s*\w+;/g, '');

      combinedContent += `${browserContent}\n\n`;
    }

    // Add initialization wrapper
    combinedContent += `
// Auto-initialize when loaded
if (typeof window !== 'undefined') {
    console.log('Spadblocker: Extension loaded');
}
`;

    // Write combined file
    fs.writeFileSync(OUTPUT_FILE, combinedContent);

    // Get file size
    const stats = fs.statSync(OUTPUT_FILE);
    const fileSizeKB = (stats.size / 1024).toFixed(2);

    console.log('✅ Build completed successfully!');
    console.log(`📁 Output: ${OUTPUT_FILE}`);
    console.log(`📊 Size: ${fileSizeKB} KB`);

    return true;

  } catch (error) {
    console.error('❌ Build failed:', error.message);
    return false;
  }
}

/**
 * Create minified version
 */
function createMinifiedVersion() {
  console.log('🗜️  Creating minified version...');

  try {
    const content = fs.readFileSync(OUTPUT_FILE, 'utf8');

    // Simple minification (remove comments, extra whitespace)
    const minified = content
      .replace(/\/\*\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/;\s*}/g, '}') // Remove unnecessary semicolons
      .replace(/\s*([{}();,])\s*/g, '$1') // Remove whitespace around operators
      .trim();

    const minifiedFile = path.join(DIST_DIR, 'spadblocker.min.js');
    fs.writeFileSync(minifiedFile, minified);

    const stats = fs.statSync(minifiedFile);
    const fileSizeKB = (stats.size / 1024).toFixed(2);

    console.log('✅ Minified version created!');
    console.log(`📁 Output: ${minifiedFile}`);
    console.log(`📊 Size: ${fileSizeKB} KB`);

    return true;

  } catch (error) {
    console.error('❌ Minification failed:', error.message);
    return false;
  }
}

/**
 * Create installation package
 */
function createPackage() {
  console.log('📦 Creating installation package...');

  try {
    const packageDir = path.join(DIST_DIR, 'package');

    // Clean up existing package
    if (fs.existsSync(packageDir)) {
      fs.rmSync(packageDir, { recursive: true, force: true });
    }

    fs.mkdirSync(packageDir, { recursive: true });

    // Copy main extension file
    fs.copyFileSync(OUTPUT_FILE, path.join(packageDir, 'spadblocker.js'));

    // Create installation instructions
    const instructions = `# Spadblocker Installation

## Quick Install

1. Copy \`spadblocker.js\` to your Spicetify extensions folder:

**Windows**: \`%appdata%\\spicetify\\Extensions\\\`
**Linux**: \`~/.config/spicetify/Extensions/\`
**macOS**: \`~/.config/spicetify/Extensions/\`

2. Run:
\`\`\`bash
spicetify config extensions spadblocker.js
spicetify apply
\`\`\`

3. Restart Spotify

## Verification

Open browser console (F12) and check for:
\`Spadblocker: Extension loaded\`
\`Spadblocker: Successfully initialized\`

## Troubleshooting

- Ensure Spicetify is properly installed
- Check that the file is in the correct directory
- Run \`spicetify apply\` again
- Restart Spotify completely

For more help, visit: https://github.com/keparlak/spadblocker
`;

    fs.writeFileSync(path.join(packageDir, 'INSTALL.md'), instructions);

    console.log('✅ Installation package created!');
    console.log(`📁 Location: ${packageDir}`);

    return true;

  } catch (error) {
    console.error('❌ Package creation failed:', error.message);
    return false;
  }
}

// Main build process
function main() {
  console.log('🚀 Starting Spadblocker build process...\n');

  const success = buildExtension() &&
                   createMinifiedVersion() &&
                   createPackage();

  if (success) {
    console.log('\n🎉 All build operations completed successfully!');
    console.log('📋 Ready for distribution!');
  } else {
    console.log('\n💥 Build process encountered errors.');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  buildExtension,
  createMinifiedVersion,
  createPackage
};
