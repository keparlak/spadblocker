#!/usr/bin/env node

/**
 * Version management script for Spadblocker
 * Shows current version and deployment history
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '../dist');
const VERSION_FILE = path.join(DIST_DIR, 'version.json');
const OUTPUT_FILE = path.join(DIST_DIR, 'spadblocker.js');

function showVersionInfo() {
  console.log('🏷️  Spadblocker Version Information\n');

  try {
    if (!fs.existsSync(VERSION_FILE)) {
      console.log('❌ No version information found. Run npm run build first.');
      return;
    }

    const versionInfo = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
    
    console.log(`📋 Version: ${versionInfo.version}`);
    console.log(`📅 Build Date: ${versionInfo.buildDate}`);
    console.log(`🕐 Build Time: ${versionInfo.buildTime}`);
    console.log(`🔗 Build Hash: ${versionInfo.buildHash}`);
    console.log(`📁 Main File: ${versionInfo.files.main}`);
    console.log(`📦 Package: ${versionInfo.files.package}`);
    
    if (fs.existsSync(OUTPUT_FILE)) {
      const stats = fs.statSync(OUTPUT_FILE);
      const fileSizeKB = (stats.size / 1024).toFixed(2);
      console.log(`📊 File Size: ${fileSizeKB} KB`);
    }

    console.log('\n📜 Changelog:');
    versionInfo.changelog.forEach((entry, index) => {
      console.log(`  ${index + 1}. ${entry}`);
    });

    // Check if deployed
    const deployedVersion = getCurrentDeployedVersion();
    if (deployedVersion) {
      console.log(`\n🚀 Currently Deployed: ${deployedVersion.version}`);
      console.log(`🔗 Deployed Hash: ${deployedVersion.hash}`);
      
      if (deployedVersion.version === versionInfo.version && deployedVersion.hash === versionInfo.buildHash) {
        console.log('✅ Latest version is deployed!');
      } else {
        console.log('⚠️  Newer version available for deployment.');
      }
    } else {
      console.log('\n❌ No deployed version found.');
    }

  } catch (error) {
    console.error('❌ Error reading version information:', error.message);
  }
}

function getCurrentDeployedVersion() {
  try {
    // Check common deployment locations
    const deployPaths = [
      path.join(__dirname, '../temp/extensions/spadblocker.js'),
      path.join(process.env.APPDATA || '', 'spicetify/Extensions/spadblocker.js'),
      path.join(process.env.HOME || '', '.config/spicetify/Extensions/spadblocker.js')
    ];

    for (const deployPath of deployPaths) {
      if (fs.existsSync(deployPath)) {
        const content = fs.readFileSync(deployPath, 'utf8');
        const versionMatch = content.match(/@version\s+([0-9.]+)/);
        if (versionMatch) {
          const hash = require('crypto')
            .createHash('sha256')
            .update(content)
            .digest('hex')
            .substring(0, 16);
          
          return {
            version: versionMatch[1],
            path: deployPath,
            hash: hash
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

function deployVersion() {
  console.log('🚀 Deploying Spadblocker...\n');

  try {
    if (!fs.existsSync(VERSION_FILE)) {
      console.log('❌ No version information found. Run npm run build first.');
      return;
    }

    const versionInfo = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
    const packageFile = path.join(DIST_DIR, 'package/spadblocker.js');
    
    if (!fs.existsSync(packageFile)) {
      console.log('❌ Package file not found. Run npm run build first.');
      return;
    }

    // Create temp deployment directory if it doesn't exist
    const tempDir = path.join(__dirname, '../temp/extensions');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Copy to temp directory
    fs.copyFileSync(packageFile, path.join(tempDir, 'spadblocker.js'));
    
    console.log(`✅ Version ${versionInfo.version} deployed to temp/extensions/`);
    console.log(`🔗 Hash: ${versionInfo.buildHash}`);
    console.log('📋 Ready for testing!');

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
  }
}

// CLI interface
const command = process.argv[2];

switch (command) {
  case 'show':
  case 'info':
    showVersionInfo();
    break;
  case 'deploy':
    deployVersion();
    break;
  default:
    console.log('🏷️  Spadblocker Version Manager\n');
    console.log('Usage:');
    console.log('  node version.js show    - Show current version info');
    console.log('  node version.js deploy  - Deploy current version');
    console.log('\nAvailable commands: show, deploy');
}
