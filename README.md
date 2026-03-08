# Spadblocker

Modern Spotify adblocker extension with ES2023+ features that eliminates ads and unlocks premium features for free users.

## Features

- 🎵 **Audio Ad Blocking** - Blocks audio ads between songs
- 🖼️ **UI Ad Removal** - Hides upgrade buttons, banners, and premium prompts
- ⭐ **Premium Features** - Unlocks shuffle, queue, high quality, and more
- 🚀 **Modern Architecture** - Built with ES2023+ features and performance monitoring
- 📦 **Version Management** - Automatic version tracking and deployment system
- 🛡️ **Advanced Protection** - Blocks Google DoubleClick, HPTO, and generic ad patterns

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
git clone https://github.com/keparlak/spadblocker.git
cd spadblocker

# Install dependencies
npm install

# Build the extension
npm run build

# Deploy
npm run version:deploy
spicetify apply
```

### Version Management

```bash
# Check current version
npm run version

# Deploy current version
npm run version:deploy

# Build with version bump
npm run build
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
  },
  "version": "1.0.4",
  "uptime": 12345.67
}
```

## Features in Detail

### Audio Ad Blocking
- Disables Spotify's ad managers
- Blocks Google DoubleClick and GPT scripts
- Intercepts ad URL patterns
- Configures ad slots to prevent ads
- Works with both direct and fallback methods

### UI Ad Removal
- Hides upgrade buttons and premium prompts
- Removes banner advertisements
- Blocks modal upgrade dialogs
- Real-time DOM monitoring with MutationObserver
- Generic pattern matching for new ad types

### Premium Features
- Enables shuffle and repeat functionality
- Unlocks high-quality audio streaming
- Activates queue management
- Simulates premium product state
- Maintains premium overrides

### Advanced Protection
- **Script Blocking**: Prevents ad script loading
- **Fetch Interception**: Blocks ad network requests
- **Content Filtering**: Filters ad script content
- **Pattern Matching**: Generic class and ID patterns
- **Dynamic Monitoring**: Real-time DOM observation

## Development

### Documentation

For detailed development information, see:
- [Extension Development Guide](docs/EXTENSION_DEVELOPMENT.md)
- [API Reference](docs/API_REFERENCE.md)
- [Architecture Overview](docs/ARCHITECTURE.md)

### Project Structure

```
spadblocker/
├── src/
│   └── spadblocker.js          # Main extension file (single file architecture)
├── scripts/
│   ├── build.cjs               # Build script
│   ├── version.cjs             # Version management
│   └── dev.js                  # Development script
├── dist/
│   ├── spadblocker.js          # Built extension
│   ├── spadblocker.min.js      # Minified version
│   ├── package/                # Installation package
│   └── version.json           # Version information
├── docs/                      # Documentation
│   ├── EXTENSION_DEVELOPMENT.md
│   ├── API_REFERENCE.md
│   └── ARCHITECTURE.md
├── eslint.config.js            # ESLint configuration
├── prettierrc                  # Prettier configuration
└── package.json               # Project metadata
```

### Available Scripts

```bash
npm run build          # Build the extension
npm run version         # Show version information
npm run version:deploy  # Deploy current version
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
- **Version System**: Automatic version tracking and deployment

## Configuration

You can modify the behavior by editing the `CONFIG` object in `src/spadblocker.js`:

```javascript
const CONFIG = {
  // Core features
  blockAudioAds: true,           // Enable audio ad blocking
  blockUIAds: true,              // Enable UI ad removal
  enablePremiumFeatures: true,    // Enable premium features
  hideUpgradeButtons: true,       // Hide upgrade buttons
  
  // Development
  debugMode: false,               // Enable debug logging
  
  // Performance
  debounceMs: 300,              // Debounce expensive operations
  maintenanceIntervalMs: 30000,    // Maintenance interval
  premiumOverrideIntervalMs: 60000, // Premium override interval
  
  // Advanced
  useWeakRef: true,              // Use WeakRef for memory management
  enablePerformanceMonitoring: true  // Enable performance monitoring
};
```

## Version History

### v1.0.4 (2026-03-08) - Advanced Audio Ad Blocking
- 🔧 Enhanced audio ad script blocking
- 🛡️ Added script content filtering
- 🚫 Improved fetch request blocking
- 📊 Enhanced performance monitoring

### v1.0.3 (2026-03-08) - Generic Banner Ad Blocking
- 🎯 Added generic class pattern matching
- 📝 Enhanced CSS selectors
- 🔍 Improved pattern detection
- 🚀 Fixed double initialization

### v1.0.2 (2026-03-08) - Double Loading Fix
- 🔧 Fixed double initialization issue
- 🛡️ Added initialization guard
- 📊 Improved error handling
- 🚀 Enhanced startup performance

### v1.0.1 (2026-03-08) - Enhanced Ad Blocking
- 🎯 Added Google DoubleClick/GPT blocking
- 🖼️ Added HPTO ad container blocking
- 🛡️ Enhanced script blocking
- 📦 Improved CSS selectors

### v1.0.0 (2026-03-07) - Initial Release
- ✨ Initial release with modern ES2023+ architecture
- 🎵 Audio ad blocking functionality
- 🖼️ UI ad removal with real-time monitoring
- ⭐ Premium features unlocking
- 🚀 Single-file architecture for easy maintenance
- 📊 Performance monitoring and metrics
- 🧹 Comprehensive error handling
- 📦 Version management system

## Troubleshooting

### Common Issues

1. **Extension not loading**
   - Ensure Spicetify is properly installed
   - Check file permissions
   - Run `spicetify apply` again
   - Check version status with `npm run version`

2. **Ads still appearing**
   - Restart Spotify completely
   - Check console for blocked script logs
   - Verify status with `window.Spadblocker?.getStatus()`
   - Report new ad patterns for inclusion

3. **Performance issues**
   - Enable debug mode to see metrics
   - Check for memory leaks
   - Monitor event listener cleanup
   - Optimize CSS selectors

4. **Version conflicts**
   - Check current deployed version
   - Use `npm run version` to compare
   - Deploy latest version with `npm run version:deploy`

### Debug Mode

Enable debug mode by setting `debugMode: true` in the CONFIG object to see detailed logging.

### Getting Help

- **Console**: Check DevTools console for errors
- **Logs**: Look for `🚫 Spadblocker blocked` messages
- **Status**: Use `window.Spadblocker?.getStatus()` for health check
- **Issues**: Report bugs on GitHub Issues
- **Community**: Join Discord/Reddit communities

## Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly: `npm test`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style

- Use ESLint for code formatting
- Follow existing naming conventions
- Add JSDoc comments for functions
- Write clear, descriptive commit messages
- Test with different Spotify versions

### Testing Requirements

- Test all major functionality
- Verify with different Spotify versions
- Check performance impact
- Ensure backward compatibility
- Report version changes

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Based on [spicetify-extensions/adblock](https://github.com/rxri/spicetify-extensions/tree/main/adblock)
- Built with modern JavaScript best practices
- Compatible with latest Spotify client versions
- Enhanced with advanced ad blocking patterns

---

## Resources

### Official Documentation
- [Spicetify Docs](https://spicetify.app/docs/)
- [API Reference](https://spicetify.app/docs/development/api-wrapper)
- [Extension Guide](https://spicetify.app/docs/development/extensions)
- [Spicetify Creator](https://spicetify.app/docs/development/spicetify-creator)

### Community
- [Spicetify Discord](https://discord.gg/VnyqWzAqAz)
- [r/spicetify](https://reddit.com/r/spicetify)
- [GitHub Discussions](https://github.com/spicetify/spicetify-cli/discussions)

---

**Enjoy ad-free Spotify!** 🎵
