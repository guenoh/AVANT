# ccNC Connection Service Usage Guide

## Overview

The ccNC Connection Service provides a persistent TCP connection to TestAutomation Daemon (ccNC) for device automation. Unlike the Python client which reconnects for each command, this service maintains a single persistent connection for better performance.

## Quick Start

### Basic Connection

```javascript
const { CCNCConnectionService } = require('./src/main/services/ccnc-connection.service');

const service = new CCNCConnectionService();

// Connect to server
await service.connect('localhost', 20000);

// Use the service...
await service.tap(500, 300);

// Disconnect when done
service.disconnect();
```

### Event Handling

```javascript
service.on('connected', (info) => {
  console.log(`Connected to ${info.host}:${info.port}`);
});

service.on('disconnected', () => {
  console.log('Connection closed');
});

service.on('error', (error) => {
  console.error('Error:', error.message);
});
```

## API Reference

### Connection Management

#### `connect(host, port)`
Establish connection to ccNC server.

```javascript
await service.connect('localhost', 20000);
```

**Parameters:**
- `host` (string): Server hostname or IP
- `port` (number): Server port (default: 20000)

**Returns:** Promise<void>

**Throws:** Error if connection fails or banner verification fails

#### `disconnect()`
Close connection to server.

```javascript
service.disconnect();
```

#### `isConnected()`
Check connection status.

```javascript
if (service.isConnected()) {
  // Safe to send commands
}
```

**Returns:** boolean

#### `getState()`
Get current connection state.

```javascript
const state = service.getState();
// 'disconnected' | 'connecting' | 'connected' | 'error'
```

**Returns:** string

### Device Commands

#### `tap(x, y, options)`
Simulate a tap (press + release).

```javascript
// Simple tap
await service.tap(500, 300);

// Tap with options
await service.tap(500, 300, {
  monitor: 0x00,        // Monitor ID (default: FRONT)
  delay: 100,           // Delay between press/release (ms)
  waitResponse: false   // Wait for confirmation
});
```

**Parameters:**
- `x` (number): X coordinate
- `y` (number): Y coordinate
- `options` (object):
  - `monitor` (number): Monitor ID (default: MONITOR.FRONT)
  - `delay` (number): Delay between press and release in ms (default: 100)
  - `waitResponse` (boolean): Wait for server response (default: false)

**Returns:** Promise<void>

#### `touch(x, y, action, options)`
Send raw touch command.

```javascript
// Press
await service.touch(500, 300, 'press');

// Move
await service.touch(550, 350, 'move');

// Release
await service.touch(550, 350, 'release');

// With response wait
await service.touch(500, 300, 'press', { waitResponse: true });
```

**Parameters:**
- `x` (number): X coordinate
- `y` (number): Y coordinate
- `action` (string): 'press' | 'release' | 'move'
- `options` (object):
  - `monitor` (number): Monitor ID
  - `waitResponse` (boolean): Wait for server response

**Returns:** Promise<void>

#### `drag(startX, startY, endX, endY, options)`
Send drag/swipe command.

```javascript
// Simple drag
await service.drag(100, 100, 500, 500);

// Drag with duration
await service.drag(100, 100, 500, 500, {
  duration: 1000,       // Drag duration in ms
  monitor: 0x00,
  waitResponse: false
});
```

**Parameters:**
- `startX` (number): Start X coordinate
- `startY` (number): Start Y coordinate
- `endX` (number): End X coordinate
- `endY` (number): End Y coordinate
- `options` (object):
  - `duration` (number): Drag duration in ms (default: 1000)
  - `monitor` (number): Monitor ID
  - `waitResponse` (boolean): Wait for server response

**Returns:** Promise<void>

#### `fastTouch(x, y, options)`
Send repeated touch command.

```javascript
// 5 rapid taps
await service.fastTouch(500, 300, {
  repeat: 5,
  delay: 100
});
```

**Parameters:**
- `x` (number): X coordinate
- `y` (number): Y coordinate
- `options` (object):
  - `repeat` (number): Repeat count (default: 1)
  - `delay` (number): Delay between repeats in ms (default: 100)
  - `monitor` (number): Monitor ID
  - `waitResponse` (boolean): Wait for server response

**Returns:** Promise<void>

#### `capture(left, top, right, bottom, options)`
Capture screen region.

```javascript
// Full screen capture
const imageData = await service.capture(0, 0, 1920, 1080);
fs.writeFileSync('screen.png', imageData);

// Specific region as JPEG
const regionData = await service.capture(100, 100, 500, 500, {
  format: 'jpeg',
  monitor: 0x00
});
```

**Parameters:**
- `left` (number): Left coordinate
- `top` (number): Top coordinate
- `right` (number): Right coordinate
- `bottom` (number): Bottom coordinate
- `options` (object):
  - `format` (string): 'png' | 'jpeg' | 'bitmap' (default: 'png')
  - `monitor` (number): Monitor ID

**Returns:** Promise<Buffer> - Image data

#### `getVersion()`
Get daemon version.

```javascript
const version = await service.getVersion();
console.log('Version:', version);
```

**Returns:** Promise<string> - Version string

## Monitor IDs

```javascript
const { MONITOR } = require('./src/main/services/ccnc-connection.service');

MONITOR.FRONT        // 0x00 - Front display (default)
MONITOR.REAR_LEFT    // 0x01 - Rear left display
MONITOR.REAR_RIGHT   // 0x02 - Rear right display
MONITOR.CLUSTER      // 0x03 - Instrument cluster
MONITOR.HUD          // 0x04 - Head-up display
```

## Fire-and-Forget vs Request-Response

### Fire-and-Forget (Default)
Commands are sent without waiting for response. Faster but no confirmation.

```javascript
await service.tap(500, 300); // Returns immediately
```

**Pros:**
- Faster execution
- No network round-trip delay
- Good for rapid command sequences

**Cons:**
- No confirmation of success/failure
- Cannot detect errors

### Request-Response
Commands wait for server response. Slower but provides confirmation.

```javascript
await service.tap(500, 300, { waitResponse: true }); // Waits for response
```

**Pros:**
- Confirms command execution
- Can detect errors
- Required for queries (version, capture)

**Cons:**
- Slower due to network round-trip
- May timeout if server is busy

## Error Handling

```javascript
try {
  await service.connect('localhost', 20000);
  await service.tap(500, 300);
} catch (error) {
  if (error.message === 'Not connected') {
    // Connection lost, attempt reconnect
    await service.connect('localhost', 20000);
  } else if (error.message === 'Response timeout') {
    // Command timed out, server might be busy
    console.warn('Command timeout, retrying...');
  } else {
    // Other error
    console.error('Command failed:', error.message);
  }
}
```

## Testing

A test script is provided to verify the connection:

```bash
# Test with default localhost:20000
node test-ccnc.js

# Test with custom host/port
node test-ccnc.js 192.168.1.100 20000
```

The test script will:
1. Connect to server
2. Get version
3. Send tap command
4. Send drag command
5. Capture screen and save as test-capture.png
6. Send fast touch
7. Send touch with response wait
8. Disconnect

## Performance Comparison

### Python Client (Spawn per command)
```bash
# Each command spawns new process
time python3 automation_client.py localhost 20000 --cmd touch-sim --x 500 --y 300
# ~200-500ms per command (process spawn + TCP connect + command)
```

### Node.js Persistent Connection
```javascript
// One-time connection
await service.connect('localhost', 20000); // ~50ms

// Commands use existing connection
await service.tap(500, 300); // ~5-10ms per command
await service.tap(600, 400); // ~5-10ms per command
await service.tap(700, 500); // ~5-10ms per command
```

**Performance gain:** ~20-50x faster for multiple commands

## Integration with Vision Auto

### In ActionService

```javascript
class ActionService {
  constructor() {
    this.ccncService = new CCNCConnectionService();
  }

  async connectCCNC(host, port) {
    await this.ccncService.connect(host, port);
  }

  async executeAction(action) {
    if (action.type === 'tap') {
      await this.ccncService.tap(action.x, action.y);
    } else if (action.type === 'swipe') {
      await this.ccncService.drag(
        action.startX,
        action.startY,
        action.endX,
        action.endY,
        { duration: action.duration }
      );
    }
  }
}
```

### In ScreenService

```javascript
class ScreenService {
  constructor() {
    this.ccncService = new CCNCConnectionService();
  }

  async startStreaming(width, height) {
    // Capture screen periodically
    this.streamInterval = setInterval(async () => {
      try {
        const imageData = await this.ccncService.capture(0, 0, width, height, {
          format: 'jpeg' // JPEG is faster than PNG
        });
        this.emit('frame', imageData);
      } catch (error) {
        console.error('Capture failed:', error.message);
      }
    }, 100); // 10 FPS
  }
}
```

## Troubleshooting

### Connection Refused
- Check if ccNC daemon is running
- Verify host and port are correct
- Check firewall settings

### Response Timeout
- Increase timeout: `service.responseTimeout = 10000`
- Check if server is busy
- Verify command parameters are valid

### CRC Mismatch
- Protocol implementation error
- Network corruption (rare)
- Reconnect to server

### Image Capture Fails
- Check coordinates are within screen bounds
- Verify monitor ID is correct
- Try different image format

## References

- Protocol specification: `CCNC_PROTOCOL.md`
- Python reference: `/Users/groro/Workspace/iSAP/automation_client.py`
- Design document: `DEVICE_CONNECTION_REDESIGN.md`
