# Vision Auto

Android Device Automation with Image Matching

---

## Table of Contents

1. [Introduction](#introduction)
2. [Features](#features)
3. [System Requirements](#system-requirements)
4. [Installation](#installation)
5. [Getting Started](#getting-started)
6. [User Guide](#user-guide)
7. [Architecture](#architecture)
8. [API Reference](#api-reference)
9. [Troubleshooting](#troubleshooting)
10. [Development](#development)
11. [License](#license)

---

## Introduction

Vision Auto is a desktop application for automating Android devices. Built on Electron and ADB (Android Debug Bridge), it provides a visual interface for creating, managing, and executing automation scenarios.

The application uses image matching technology to identify UI elements on the device screen, enabling automation that adapts to dynamic content without requiring access to the app's internal structure.

### Use Cases

- **Quality Assurance Testing**: Automate repetitive test scenarios across multiple devices
- **Device Configuration**: Set up multiple devices with consistent configurations
- **App Demonstration**: Create reproducible demo sequences for presentations
- **Data Collection**: Automate data extraction from apps with visual interfaces
- **Accessibility Testing**: Verify app behavior under various input conditions

### Design Philosophy

Vision Auto follows several core principles:

1. **Visual-First Approach**: Automation is based on what users see, not internal app structures
2. **No Root Required**: Works with standard USB debugging, no device modifications needed
3. **Offline Operation**: All processing happens locally, no cloud dependencies
4. **Extensible Architecture**: Clean separation of concerns enables customization

---

## Features

### Device Connectivity

| Feature | Description |
|---------|-------------|
| USB Connection | Direct connection via USB cable with automatic detection |
| Wireless ADB | Connect over WiFi after initial USB pairing |
| Multi-Device Support | Switch between multiple connected devices |
| Connection Status | Real-time connection monitoring with automatic reconnection |

### Screen Interaction

| Feature | Description |
|---------|-------------|
| Real-time Streaming | Live device screen display in the application |
| Screen Capture | Save current screen as image file |
| Touch Actions | Tap, long-press, swipe, and drag operations |
| Text Input | Enter text directly without on-screen keyboard |
| Hardware Keys | Simulate Home, Back, Recent Apps, Volume, Power buttons |

### Image Matching

| Feature | Description |
|---------|-------------|
| Region Selection | Visual drag-to-select for defining match templates |
| Template Storage | Automatic saving of captured regions |
| Similarity Threshold | Configurable matching sensitivity (0-100%) |
| Match Visualization | Display of match results with confidence scores |
| Multi-Region Matching | Support for multiple match conditions |

### Scenario Management

| Feature | Description |
|---------|-------------|
| Action Palette | Drag-and-drop action building interface |
| Conditional Logic | IF/ELSE IF/ELSE branching based on match results |
| Loop Constructs | WHILE loops with image-based conditions |
| Scenario Files | JSON-based scenario storage and sharing |
| Execution History | Logging of all executed actions with timestamps |

### AI-Powered Analysis

| Feature | Description |
|---------|-------------|
| Failure Analysis | LLM-based root cause analysis for failed scenarios |
| Recommendations | Actionable suggestions for fixing issues |
| Logcat Integration | Device log collection during execution |
| Result Reports | Comprehensive execution reports with screenshots |

---

## System Requirements

### Operating System

| OS | Version | Status |
|----|---------|--------|
| macOS | 12.0 (Monterey) or later | Fully Supported |
| Windows | 10 or later | Supported |
| Linux | Ubuntu 20.04 or later | Community Tested |

### Software Dependencies

| Software | Version | Required |
|----------|---------|----------|
| Node.js | 18.0 or later | Yes |
| ADB | Any recent version | Yes |
| npm | 9.0 or later | Yes |

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 4 GB | 8 GB or more |
| Storage | 500 MB | 1 GB or more |
| USB | USB 2.0 | USB 3.0 |

### Android Device Requirements

| Requirement | Details |
|-------------|---------|
| Android Version | 7.0 (API 24) or later |
| USB Debugging | Enabled in Developer Options |
| USB Connection | MTP or PTP mode |
| Screen Lock | Disabled or unlocked during automation |

---

## Installation

### Step 1: Install ADB

**macOS (using Homebrew)**
```bash
brew install android-platform-tools
```

**Windows**
1. Download [Android SDK Platform Tools](https://developer.android.com/studio/releases/platform-tools)
2. Extract to a folder (e.g., `C:\platform-tools`)
3. Add the folder to your system PATH

**Linux (Debian/Ubuntu)**
```bash
sudo apt-get update
sudo apt-get install android-tools-adb
```

Verify installation:
```bash
adb version
```

### Step 2: Clone and Install

```bash
git clone https://github.com/your-username/vision-auto.git
cd vision-auto
npm install
```

### Step 3: Configure Android Device

1. **Enable Developer Options**
   - Go to Settings > About Phone
   - Tap "Build Number" 7 times
   - Developer Options will appear in Settings

2. **Enable USB Debugging**
   - Go to Settings > Developer Options
   - Enable "USB debugging"
   - (Optional) Enable "Stay awake" to prevent screen timeout

3. **Connect Device**
   - Connect device via USB cable
   - Accept the "Allow USB debugging" prompt on the device
   - Check "Always allow from this computer" for convenience

Verify connection:
```bash
adb devices
```

Expected output:
```
List of devices attached
XXXXXXXXXX    device
```

### Step 4: Run Application

```bash
# Development mode (with DevTools)
npm run dev

# Production mode
npm start
```

---

## Getting Started

### First Connection

1. Launch Vision Auto
2. Connect your Android device via USB
3. Click the "Refresh" button in the device panel
4. Select your device from the dropdown
5. The device screen will appear in the main panel

### Creating Your First Scenario

**Step 1: Capture a Target Image**
1. Enable "Crop Mode" by clicking the crop icon
2. Drag to select a region on the screen (e.g., a button)
3. The captured region will be saved automatically

**Step 2: Add an Action**
1. Open the Action Palette
2. Drag "Image Match" to the scenario
3. Configure the match threshold (default: 85%)
4. Set the action to perform on match (tap, long-press, etc.)

**Step 3: Add Supporting Actions**
1. Add a "Wait" action before the match for stability
2. Add additional actions as needed

**Step 4: Execute and Verify**
1. Click the "Play" button to run the scenario
2. Observe the execution in the live preview
3. Check the log panel for results

**Step 5: Save Your Scenario**
1. Click "Save Scenario"
2. Enter a descriptive name
3. The scenario is saved as a JSON file

---

## User Guide

### Understanding the Interface

```
+------------------------------------------------------------------+
|  Toolbar                                                          |
+------------------------------------------------------------------+
|          |                              |                         |
|  Device  |        Screen Preview        |     Scenario Panel      |
|  Panel   |                              |                         |
|          |                              |     - Action List       |
|          |                              |     - Settings          |
|          |                              |     - Controls          |
+----------+------------------------------+-------------------------+
|                        Log Panel                                  |
+------------------------------------------------------------------+
```

### Action Types

#### Basic Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| Tap | Single touch at coordinates | X, Y position |
| Long Press | Extended touch | X, Y position, Duration |
| Swipe | Slide from one point to another | Start X/Y, End X/Y, Duration |
| Drag | Touch-hold and move | Start X/Y, End X/Y, Duration |
| Text Input | Type text | Text string, IME option |
| Wait | Pause execution | Duration in milliseconds |

#### Hardware Keys

| Action | Description |
|--------|-------------|
| Home | Navigate to home screen |
| Back | Go back / close dialog |
| Recent Apps | Open recent apps view |
| Volume Up/Down | Adjust device volume |
| Power | Toggle screen on/off |

#### Smart Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| Image Match | Find image on screen | Template, Threshold, Timeout |
| Tap Matched | Tap the last matched location | None |

#### Control Flow

| Action | Description |
|--------|-------------|
| IF | Execute block if condition is true |
| ELSE IF | Alternative condition check |
| ELSE | Execute when all conditions are false |
| WHILE | Repeat while condition is true |
| LOOP | Repeat a fixed number of times |

#### Result Actions

| Action | Description |
|--------|-------------|
| Success | Mark scenario as passed |
| Fail | Mark scenario as failed |
| Skip | Skip remaining actions |

### Image Matching Best Practices

**Selecting Good Match Regions**

DO:
- Select unique visual elements
- Include some surrounding context
- Use regions with distinct colors or patterns
- Choose static elements that don't animate

DO NOT:
- Select regions smaller than 20x20 pixels
- Include animated or changing content
- Use regions that appear multiple times on screen
- Select pure white or solid color regions

**Threshold Guidelines**

| Threshold | Use Case |
|-----------|----------|
| 95-100% | Pixel-perfect matches, static content |
| 85-95% | Standard UI elements with minor variations |
| 75-85% | Dynamic content with consistent layout |
| 60-75% | Significant variation expected (use with caution) |

### Conditional Logic Examples

**Example 1: Login Flow with Error Handling**
```
IF [Login Button visible]
    Tap matched location
    Wait 3000ms
    IF [Home Screen visible]
        Success
    ELSE IF [Error Message visible]
        Tap [Retry Button]
    ELSE
        Fail
ENDIF
```

**Example 2: Scroll Until Found**
```
WHILE [Target Item NOT visible]
    Swipe up
    Wait 500ms
ENDWHILE
Tap matched location
```

### Working with Multiple Devices

1. Connect all devices via USB
2. Use `adb devices` to verify all are connected
3. In Vision Auto, select the target device from the dropdown
4. Execute scenarios on the selected device
5. Switch devices using the dropdown without reconnecting

---

## Architecture

### Project Structure

```
vision-auto/
+-- src/
|   +-- main/                      # Electron Main Process
|   |   +-- main.js                # Application entry point
|   |   +-- preload.js             # IPC bridge to renderer
|   |   +-- services/              # Business logic services
|   |       +-- device.service.js      # Device management
|   |       +-- screen.service.js      # Screen capture and streaming
|   |       +-- action.service.js      # Action execution
|   |       +-- macro.service.js       # Scenario management
|   |       +-- result-report.service.js   # Execution reports
|   |       +-- ai-analysis.service.js     # LLM integration
|   |       +-- adb-logcat.service.js      # Device log collection
|   |       +-- protocols/             # Protocol implementations
|   |           +-- AdbProtocol.js     # ADB commands
|   |           +-- BaseProtocol.js    # Protocol interface
|   +-- renderer/                  # Electron Renderer Process
|   |   +-- index.html             # Main UI
|   |   +-- macro-builder-app.js   # Application controller
|   |   +-- components/            # UI components
|   |   +-- services/              # Frontend services
|   |   +-- styles/                # CSS stylesheets
|   +-- shared/                    # Shared code
|       +-- constants.js           # IPC channels, enums
+-- docs/                          # Documentation
+-- tests/                         # Test files
+-- package.json                   # Project configuration
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Desktop Framework | Electron 28 | Cross-platform desktop app |
| Runtime | Node.js 18+ | JavaScript runtime |
| Device Control | ADB | Android device communication |
| Image Processing | Jimp | Pure JavaScript image manipulation |
| UI Rendering | Vanilla JS, CSS3 | No framework dependencies |
| Testing | Jest, Playwright | Unit and E2E testing |

### IPC Communication

The application uses Electron's IPC (Inter-Process Communication) for communication between the main process and renderer process.

**Channel Naming Convention**
```
{domain}:{action}:{sub-action}

Examples:
- device:list
- screen:capture
- action:execute
- scenario:save
```

**Request/Response Pattern**
```javascript
// Renderer Process
const result = await window.api.device.list();

// Main Process
ipcMain.handle('device:list', async () => {
    return await deviceService.getDevices();
});
```

### Service Layer

All business logic is encapsulated in services:

| Service | Responsibility |
|---------|----------------|
| DeviceService | Device detection, connection management |
| ScreenService | Screen capture, streaming, image processing |
| ActionService | Action execution, coordinate transformation |
| MacroService | Scenario file operations |
| ResultReportService | Execution logging, report generation |
| AIAnalysisService | LLM API integration for failure analysis |
| ADBLogcatService | Device log collection and filtering |

---

## API Reference

### Device API

```javascript
// List connected devices
await window.api.device.list();
// Returns: Array<{id: string, model: string, status: string}>

// Select a device
await window.api.device.select(deviceId);
// Returns: {success: boolean}

// Get current device info
await window.api.device.getInfo();
// Returns: {id, model, manufacturer, androidVersion, resolution}

// Connect via wireless ADB
await window.api.device.connectWireless(ipAddress);
// Returns: {success: boolean}
```

### Screen API

```javascript
// Capture current screen
await window.api.screen.capture();
// Returns: {success: boolean, imagePath: string, dataUrl: string}

// Start screen streaming
await window.api.screen.startStream({fps: 10, quality: 80});
// Returns: {success: boolean}

// Stop screen streaming
await window.api.screen.stopStream();
// Returns: {success: boolean}
```

### Action API

```javascript
// Execute single action
await window.api.action.execute({
    type: 'tap',
    x: 500,
    y: 1000
});
// Returns: {success: boolean, duration: number}

// Execute batch of actions
await window.api.action.executeBatch([
    {type: 'tap', x: 500, y: 1000},
    {type: 'wait', duration: 1000},
    {type: 'swipe', x1: 500, y1: 1500, x2: 500, y2: 500, duration: 300}
]);
// Returns: {success: boolean, results: Array}
```

### Scenario API

```javascript
// List all scenarios
await window.api.scenario.list();
// Returns: Array<{filename: string, name: string, modified: Date}>

// Save scenario
await window.api.scenario.save({
    name: 'Login Test',
    actions: [...],
    metadata: {...}
});
// Returns: {success: boolean, filename: string}

// Load scenario
await window.api.scenario.load(filename);
// Returns: {success: boolean, scenario: Object}

// Delete scenario
await window.api.scenario.delete(filename);
// Returns: {success: boolean}
```

---

## Troubleshooting

### Device Not Detected

**Symptoms**: Device does not appear in the device dropdown

**Solutions**:
1. Verify USB cable is data-capable (not charge-only)
2. Check USB debugging is enabled on device
3. Accept the "Allow USB debugging" prompt on device
4. Restart ADB server:
   ```bash
   adb kill-server
   adb start-server
   adb devices
   ```
5. Try a different USB port

### Device Shows "Unauthorized"

**Symptoms**: Device appears but cannot be controlled

**Solutions**:
1. Disconnect and reconnect USB cable
2. Look for authorization prompt on device screen
3. Check "Always allow from this computer"
4. If prompt doesn't appear:
   ```bash
   adb kill-server
   rm ~/.android/adbkey*    # macOS/Linux
   adb start-server
   ```
5. Reconnect device and accept prompt

### Screen Capture Returns Black Image

**Symptoms**: Preview shows black or blank screen

**Solutions**:
1. Ensure device screen is unlocked
2. Check if app has secure flag (banking apps often do)
3. Disable any screen overlay apps
4. Try capturing from a different app (e.g., home screen)
5. Restart the Vision Auto application

### Image Matching Always Fails

**Symptoms**: Match never succeeds even with visible target

**Solutions**:
1. Lower the threshold (try 75-80%)
2. Recapture the template from current screen
3. Ensure device resolution hasn't changed
4. Avoid capturing animated elements
5. Select a larger, more distinctive region

### Slow Screen Streaming

**Symptoms**: Preview updates slowly or lags

**Causes and Solutions**:
| Cause | Solution |
|-------|----------|
| USB 2.0 | Use USB 3.0 port |
| High resolution | Lower device resolution in settings |
| CPU load | Close other applications |
| Wireless connection | Use USB for better performance |

### Application Crashes on Startup

**Solutions**:
1. Delete `node_modules` and reinstall:
   ```bash
   rm -rf node_modules
   npm install
   ```
2. Check Node.js version (18+ required)
3. Run in debug mode:
   ```bash
   npm run dev
   ```
4. Check console for error messages

---

## Development

### Development Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Code Style Guidelines

- No emojis in code, comments, or commit messages
- Use meaningful variable and function names
- Keep functions small and focused
- Write comments explaining "why", not "what"
- Follow existing patterns in the codebase

### Adding New Action Types

1. **Define action in ActionConfigProvider.js**
   - Add action metadata
   - Configure color scheme
   - Add to appropriate category

2. **Create settings builder in ActionSettingsBuilder.js**
   - Build the settings panel HTML
   - Handle parameter validation

3. **Implement execution in main.js**
   - Add case in action:execute handler
   - Implement the actual device action

4. **Update preload.js if new IPC needed**
   - Expose new API methods
   - Handle response formatting

### Running Tests

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

### Building for Production

```bash
# Build for current platform
npm run build

# Build for specific platform
npm run build:mac
npm run build:win
npm run build:linux
```

---

## License

MIT License

Copyright (c) 2024

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## References

- [Electron Documentation](https://www.electronjs.org/docs/latest)
- [ADB Command Reference](https://developer.android.com/studio/command-line/adb)
- [Jimp Image Processing](https://github.com/jimp-dev/jimp)
- [Android Developer Options](https://developer.android.com/studio/debug/dev-options)
