/**
 * Test script for ccNC connection service
 *
 * Usage:
 *   node test-ccnc.js [host] [port]
 *
 * Default: localhost:20000
 */

const { CCNCConnectionService } = require('./src/main/services/ccnc-connection.service');
const fs = require('fs');
const path = require('path');

async function test() {
  const host = process.argv[2] || 'localhost';
  const port = parseInt(process.argv[3]) || 20000;

  console.log('=== ccNC Connection Test ===\n');
  console.log(`Target: ${host}:${port}\n`);

  const service = new CCNCConnectionService();

  // Set up event listeners
  service.on('connected', (info) => {
    console.log(`[EVENT] Connected to ${info.host}:${info.port}`);
  });

  service.on('disconnected', () => {
    console.log('[EVENT] Disconnected');
  });

  service.on('error', (error) => {
    console.error('[EVENT] Error:', error.message);
  });

  try {
    // Test 1: Connect
    console.log('Test 1: Connecting...');
    await service.connect(host, port);
    console.log('✓ Connected successfully\n');

    // Test 2: Get Version
    console.log('Test 2: Getting version...');
    const version = await service.getVersion();
    console.log(`✓ Version: ${version}\n`);

    // Test 3: Simple tap
    console.log('Test 3: Sending tap at (500, 300)...');
    await service.tap(500, 300);
    console.log('✓ Tap sent\n');

    // Test 4: Drag
    console.log('Test 4: Sending drag (100,100) -> (500,500) in 1s...');
    await service.drag(100, 100, 500, 500, { duration: 1000 });
    console.log('✓ Drag sent\n');

    // Test 5: Screen capture
    console.log('Test 5: Capturing screen (1920x1080)...');
    const imageData = await service.capture(0, 0, 1920, 1080, { format: 'png' });
    console.log(`✓ Captured ${imageData.length} bytes\n`);

    // Save captured image
    const outputPath = path.join(__dirname, 'test-capture.png');
    fs.writeFileSync(outputPath, imageData);
    console.log(`✓ Saved to ${outputPath}\n`);

    // Test 6: Fast touch
    console.log('Test 6: Sending fast touch (5 taps)...');
    await service.fastTouch(500, 300, { repeat: 5, delay: 100 });
    console.log('✓ Fast touch sent\n');

    // Test 7: Multiple rapid taps
    console.log('Test 7: Sending multiple rapid taps...');
    await service.tap(400, 300);
    await service.tap(500, 300);
    await service.tap(600, 300);
    console.log('✓ Multiple taps sent\n');

    console.log('=== All tests passed! ===\n');

  } catch (error) {
    console.error('✗ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    console.log('Disconnecting...');
    service.disconnect();
  }
}

// Run tests
test().catch(console.error);
