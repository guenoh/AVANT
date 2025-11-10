/**
 * Protocol Extensibility Test
 * Demonstrates how easily new protocols can be added and used
 */

const ProtocolManager = require('./src/main/services/ProtocolManager');
const AdbProtocol = require('./src/main/services/protocols/AdbProtocol');
const IsapProtocol = require('./src/main/services/protocols/IsapProtocol');

console.log('='.repeat(60));
console.log('Protocol Extensibility Test');
console.log('='.repeat(60));

// Create protocol manager
const manager = new ProtocolManager();

// Register protocols (this is how easy it is to add new protocols!)
manager.registerProtocol('adb', AdbProtocol, {
    adbPath: 'adb'
});

manager.registerProtocol('isap', IsapProtocol, {
    serverUrl: 'http://localhost:8100'
});

// Set protocol priority (ISAP preferred over ADB for performance)
manager.setProtocolPriority(['isap', 'adb']);

console.log('\n1. Registered Protocols:');
console.log('-'.repeat(60));
const protocols = manager.listProtocols();
protocols.forEach(p => {
    console.log(`  - ${p.name}: ${p.connected ? 'Connected' : 'Not connected'}`);
});

console.log('\n2. Protocol Capabilities Comparison:');
console.log('-'.repeat(60));

const adbProtocol = manager.getProtocol('adb');
const isapProtocol = manager.getProtocol('isap');

const adbCaps = adbProtocol.getCapabilities();
const isapCaps = isapProtocol.getCapabilities();

// Compare key capabilities
const keyCapabilities = [
    'canTap',
    'canMultiTouch',
    'canFastTouch',
    'canCaptureScreen',
    'canStreamScreen',
    'canInstallApp',
    'canExecuteShellCommand'
];

console.log('\nCapability         | ADB    | ISAP');
console.log('-'.repeat(40));
keyCapabilities.forEach(cap => {
    const adb = adbCaps[cap] ? '✓' : '✗';
    const isap = isapCaps[cap] ? '✓' : '✗';
    console.log(`${cap.padEnd(18)} | ${adb.padEnd(6)} | ${isap}`);
});

console.log('\n3. Capability-Based Protocol Selection:');
console.log('-'.repeat(60));

// Test auto-selection based on capabilities
const testCases = [
    ['canTap'],
    ['canMultiTouch'],
    ['canFastTouch'],
    ['canExecuteShellCommand'],
    ['canTap', 'canStreamScreen'],
    ['canTap', 'canMultiTouch', 'canStreamScreen']
];

testCases.forEach(capabilities => {
    const selected = manager.findProtocolForCapabilities(capabilities);
    console.log(`\nRequired: [${capabilities.join(', ')}]`);
    console.log(`Selected: ${selected || 'None (no protocol supports all)'}`);
});

console.log('\n4. Adding New Protocol Example:');
console.log('-'.repeat(60));
console.log(`
To add a new protocol (e.g., WebDriver), simply:

1. Create WebDriverProtocol.js extending BaseProtocol:

   class WebDriverProtocol extends BaseProtocol {
       constructor(config) {
           super(config);
           this.capabilities = {
               canTap: true,
               canSwipe: true,
               // ... set capabilities
           };
       }

       getName() { return 'webdriver'; }

       async tap(x, y) {
           // Implement using WebDriver API
       }

       // ... implement other methods
   }

2. Register in ProtocolManager:

   manager.registerProtocol('webdriver', WebDriverProtocol, {
       serverUrl: 'http://localhost:4723'
   });

3. Done! The protocol is now available and can be auto-selected
   based on capabilities.
`);

console.log('\n5. Protocol Manager Benefits:');
console.log('-'.repeat(60));
console.log(`
✓ Single Interface: All protocols use the same API
✓ Capability-Based Selection: Auto-select best protocol
✓ Easy Extension: Add new protocols without modifying existing code
✓ Protocol Fallback: Try protocols in priority order
✓ Runtime Switching: Change protocols without app restart
✓ Type Safety: BaseProtocol enforces interface compliance
`);

console.log('\n6. Example Usage in Action Service:');
console.log('-'.repeat(60));
console.log(`
// Before (hardcoded protocol checks):
if (this.ccncService && this.ccncService.isConnected()) {
    await this.ccncService.tap(x, y);
} else {
    await this.adbService.tap(x, y);
}

// After (protocol abstraction):
await this.protocolManager.tap(x, y);

// Or with capability check:
await this.protocolManager.executeWithCapability('canFastTouch',
    protocol => protocol.fastTouch(x, y)
);
`);

console.log('\n7. Real-World Scenarios:');
console.log('-'.repeat(60));
console.log(`
Scenario 1: iOS Support
- Add IsapProtocol
- Set priority: ['isap', 'adb']
- App automatically uses ISAP for iOS, ADB for Android

Scenario 2: Performance Optimization
- Add ccNC protocol (high-performance)
- Set priority: ['ccnc', 'adb']
- App uses ccNC when available, falls back to ADB

Scenario 3: Cloud Testing
- Add WebDriver protocol
- Connect to Appium/Selenium server
- Same code works locally and in cloud

Scenario 4: Multiple Devices
- Register multiple protocol instances
- Switch between devices seamlessly
- Each device uses optimal protocol
`);

console.log('\n' + '='.repeat(60));
console.log('Test Complete!');
console.log('='.repeat(60));
console.log(`
Summary:
- Created Protocol Abstraction Layer with BaseProtocol
- Implemented 2 protocol adapters (ADB, ISAP)
- Demonstrated capability-based selection
- Showed how to add new protocols in ~200 lines
- Unified interface eliminates conditional logic

Next Steps:
1. Integrate ProtocolManager into main app
2. Refactor ActionService to use ProtocolManager
3. Refactor ScreenService to use ProtocolManager
4. Add more protocols as needed (ccNC, WebDriver, etc.)
`);
