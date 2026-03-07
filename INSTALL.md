# Spadblocker Installation Guide

## 🚀 Quick Start

### Prerequisites
- [Spicetify](https://spicetify.app/) installed and configured
- Spotify desktop client (latest version)

### Installation Steps

1. **Download the Extension**
   - Get `spadblocker.js` from the [dist](dist/) folder
   - Or download the latest release from GitHub

2. **Copy to Extensions Folder**
   
   **Windows:**
   ```
   Copy to: %appdata%\spicetify\Extensions\
   ```
   
   **Linux:**
   ```
   Copy to: ~/.config/spicetify/Extensions/
   ```
   
   **macOS:**
   ```
   Copy to: ~/.config/spicetify/Extensions/
   ```

3. **Register Extension**
   ```bash
   spicetify config extensions spadblocker.js
   spicetify apply
   ```

4. **Restart Spotify**
   - Close Spotify completely
   - Restart the application

## ✅ Verification

Open the browser console (F12) and look for:
```
Spadblocker: Extension loaded
Spadblocker: Successfully initialized
```

You can also check the status:
```javascript
// In browser console
window.Spadblocker.getStatus()
```

## 🔧 Configuration

The extension can be configured by editing the `CONFIG` object in `spadblocker.js`:

```javascript
const CONFIG = {
    blockAudioAds: true,        // Block audio advertisements
    blockUIAds: true,           // Hide upgrade prompts and banners
    enablePremiumFeatures: true, // Unlock shuffle, queue, etc.
    hideUpgradeButtons: true,   // Hide premium upgrade buttons
    debugMode: false            // Enable debug logging
};
```

## 🎯 Features

After installation, you'll have:

- ✅ **No Audio Ads**: Block all advertisements between songs
- ✅ **No UI Ads**: Remove upgrade prompts, sponsored content
- ✅ **Premium Features**: Shuffle control, queue manipulation
- ✅ **No Upgrade Buttons**: Clean interface without premium prompts
- ✅ **Auto-Updates**: Resistant to Spotify client updates

## 🛠️ Troubleshooting

### Extension Not Loading
1. Verify Spicetify is properly installed
2. Check the file is in the correct extensions folder
3. Run `spicetify apply` again
4. Restart Spotify completely

### Ads Still Showing
1. Check browser console for errors
2. Ensure you're using the latest Spadblocker version
3. Try reinstalling the extension
4. Clear Spotify cache

### Premium Features Not Working
1. Verify the extension is loaded in Spicetify
2. Check console for initialization messages
3. Restart Spotify after installation

### Spotify Updates Broke Extension
1. Check for Spadblocker updates
2. Reinstall the latest version
3. Report issues on GitHub

## 📱 Platform-Specific Notes

### Windows
- Use PowerShell or Command Prompt for commands
- Ensure Spotify is closed before running `spicetify apply`

### Linux
- Use terminal for all commands
- May need to install Spicetify via package manager

### macOS
- Use Terminal for commands
- Ensure Spotify permissions allow modifications

## 🔍 Advanced Usage

### Development Mode
For development or testing:
```bash
git clone https://github.com/keparlak/spadblocker.git
cd spadblocker
npm install
npm run dev
```

### Custom Build
Build your own version:
```bash
npm run build
npm test
```

### Manual Loading
Load extension manually in browser console:
```javascript
// Load custom configuration
const customConfig = {
    blockAudioAds: true,
    debugMode: true
};

// Initialize with custom config
window.Spadblocker = {
    config: customConfig
};
```

## 📋 Support

- 🐛 **Report Issues**: [GitHub Issues](https://github.com/keparlak/spadblocker/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/keparlak/spadblocker/discussions)
- 📖 **Documentation**: [Wiki](https://github.com/keparlak/spadblocker/wiki)
- 📧 **Email**: support@spadblocker.dev

## ⚖️ Legal Notice

This extension is for educational purposes only. Consider supporting artists by subscribing to Spotify Premium. Use at your own risk.

## 🔄 Updates

To update Spadblocker:
1. Download the latest version
2. Replace the old `spadblocker.js` file
3. Run `spicetify apply`
4. Restart Spotify

---

**Enjoy ad-free Spotify!** 🎵

*If you find Spadblocker useful, consider giving it a ⭐ on GitHub!*
