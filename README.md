# Spadblocker

Modern Spotify adblocker extension with ES2023+ features that eliminates ads and unlocks premium features for free users.

## Features

- 🎵 **Audio Ad Blocking** - Blocks audio ads between songs
- 🖼️ **UI Ad Removal** - Hides upgrade buttons, banners, and premium prompts
- ⭐ **Premium Features** - Unlocks shuffle, queue, high quality, and more
- 🚀 **Modern Architecture** - Built with ES2023+ features and performance monitoring
- 📦 **Single File** - Clean, maintainable single-file structure

## Installation

### Prerequisites

- [Spicetify](https://spicetify.app/) installed and configured
- Spotify desktop client

### Quick Install

1. **Download the latest release** from the [dist](dist/) folder:
   - `spadblocker.js` - Main extension file

2. **Copy to Spicetify Extensions folder**:
   ```bash
   # Windows
   copy spadblocker.js "%appdata%\spicetify\Extensions\"
   
   # Linux/macOS
   cp spadblocker.js ~/.config/spicetify/Extensions/
   ```

3. **Register with Spicetify**:
   ```bash
   spicetify config extensions spadblocker.js
   spicetify apply
   ```

4. **Restart Spotify** completely

### Build from Source

```bash
# Clone the repository
git clone https://github.com/your-username/spadblocker.git
cd spadblocker

# Install dependencies
npm install

# Build the extension
npm run build

# Install
npm run install
```

## Verification

Open Spotify's developer console (F12) and check for:
```
Spadblocker: Extension loaded
Spadblocker: Successfully initialized
```

You can also check the status:
```javascript
window.Spadblocker?.getStatus()
```

Expected response:
```json
{
  "initialized": true,
  "modules": {
    "audioAdBlocker": true,
    "uiAdRemover": true,
    "premiumFeatures": true
  }
}
```

## Features in Detail

### Audio Ad Blocking
- Disables Spotify's ad managers
- Configures ad slots to prevent ads
- Works with both direct and fallback methods

### UI Ad Removal
- Hides upgrade buttons and premium prompts
- Removes banner advertisements
- Blocks modal upgrade dialogs
- Real-time DOM monitoring with MutationObserver

### Premium Features
- Enables shuffle and repeat functionality
- Unlocks high-quality audio streaming
- Activates queue management
- Simulates premium product state

## Development

### Project Structure

```
spadblocker/
├── src/
│   └── spadblocker.js          # Main extension file (single file architecture)
├── scripts/
│   ├── build.cjs               # Build script
│   ├── analyze-bundle.cjs      # Bundle analyzer
│   └── test.cjs                # Test runner
├── dist/
│   ├── spadblocker.js          # Built extension
│   ├── spadblocker.min.js      # Minified version
│   └── package/                # Installation package
├── eslint.config.js            # ESLint configuration
├── prettierrc                  # Prettier configuration
└── package.json               # Project metadata
```

### Available Scripts

```bash
npm run build          # Build the extension
npm run dev            # Development mode with watching
npm run test           # Run tests
npm run lint           # Lint code
npm run format         # Format code
npm run size           # Analyze bundle size
npm run install        # Install built extension
```

### Architecture

The extension uses a modern single-file architecture with:

- **ES2023+ Features**: Private class fields, WeakRef, PerformanceObserver
- **Modular Design**: Separate classes for different concerns
- **Performance Monitoring**: Built-in timing and metrics
- **Error Handling**: Comprehensive error catching and recovery
- **Memory Management**: WeakRef for automatic cleanup

## Configuration

You can modify the behavior by editing the `CONFIG` object in `src/spadblocker.js`:

```javascript
const CONFIG = {
  blockAudioAds: true,           // Enable audio ad blocking
  blockUIAds: true,              // Enable UI ad removal
  enablePremiumFeatures: true,    // Enable premium features
  hideUpgradeButtons: true,       // Hide upgrade buttons
  debugMode: false,               // Enable debug logging
  // ... other options
};
```

## Troubleshooting

### Common Issues

1. **Extension not loading**
   - Ensure Spicetify is properly installed
   - Check file permissions
   - Run `spicetify apply` again

2. **Ads still appearing**
   - Restart Spotify completely
   - Check console for errors
   - Verify status with `window.Spadblocker?.getStatus()`

3. **Build errors**
   - Ensure Node.js 18+ is installed
   - Run `npm install` to update dependencies
   - Check ESLint configuration

### Debug Mode

Enable debug mode by setting `debugMode: true` in the CONFIG object to see detailed logging.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Based on [spicetify-extensions/adblock](https://github.com/rxri/spicetify-extensions/tree/main/adblock)
- Built with modern JavaScript best practices
- Compatible with latest Spotify client versions

## Changelog

### v1.0.0 (2026-03-07)
- ✨ Initial release with modern ES2023+ architecture
- 🎵 Audio ad blocking functionality
- 🖼️ UI ad removal with real-time monitoring
- ⭐ Premium features unlocking
- 🚀 Single-file architecture for easy maintenance
- 📊 Performance monitoring and metrics
- 🧹 Comprehensive error handling

---

**Enjoy ad-free Spotify!** 🎵
