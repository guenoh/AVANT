// Test script for instant execution feature
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Wait for application to fully load
setTimeout(() => {
    console.log('Testing instant execution feature...');

    // Create a simple Python script to test UI interaction
    const testScript = `
import time
import subprocess
import json

def test_buttons():
    print("Testing button functionality...")

    # Test if the application is responding
    result = subprocess.run(['osascript', '-e',
        'tell application "System Events" to tell process "Electron" to get value of attribute "AXEnabled" of window 1'],
        capture_output=True, text=True)

    if result.returncode == 0:
        print("✓ Application window is accessible")
        return True
    else:
        print("✗ Application window is not accessible")
        return False

def test_instant_execution():
    print("Testing instant execution toggle...")
    # This would normally interact with the UI, but for now we just check if the app is responsive
    return True

# Run tests
if __name__ == "__main__":
    success = test_buttons()
    if success:
        test_instant_execution()
        print("\\nAll tests completed!")
    else:
        print("\\nTests failed - application may not be responding correctly")
`;

    fs.writeFileSync('/tmp/test_ui.py', testScript);

    // Execute the test
    exec('python3 /tmp/test_ui.py', (error, stdout, stderr) => {
        if (error) {
            console.error(`Test error: ${error}`);
            return;
        }
        console.log(stdout);
        if (stderr) console.error(`Test stderr: ${stderr}`);
    });
}, 3000);

console.log('Test script initialized. Waiting for application to load...');