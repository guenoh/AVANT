/**
 * Electron App Helper for Playwright E2E Tests
 */
const { _electron: electron } = require('@playwright/test');
const path = require('path');

/**
 * Launch Electron app for testing
 */
async function launchElectronApp() {
    const electronApp = await electron.launch({
        args: [path.join(__dirname, '../../src/main/main.js')],
        env: {
            ...process.env,
            NODE_ENV: 'test'
        }
    });

    // Wait for the main window
    const window = await electronApp.firstWindow();

    // Wait for app to be ready
    await window.waitForLoadState('domcontentloaded');

    return { electronApp, window };
}

/**
 * Close Electron app
 */
async function closeElectronApp(electronApp) {
    if (electronApp) {
        await electronApp.close();
    }
}

/**
 * Wait for element and click
 */
async function clickElement(window, selector, options = {}) {
    await window.waitForSelector(selector, { timeout: 5000 });
    await window.click(selector, options);
}

/**
 * Wait for element and fill text
 */
async function fillInput(window, selector, text) {
    await window.waitForSelector(selector, { timeout: 5000 });
    await window.fill(selector, text);
}

/**
 * Check if element exists
 */
async function elementExists(window, selector) {
    try {
        await window.waitForSelector(selector, { timeout: 2000 });
        return true;
    } catch {
        return false;
    }
}

/**
 * Get text content of element
 */
async function getElementText(window, selector) {
    await window.waitForSelector(selector, { timeout: 5000 });
    return await window.textContent(selector);
}

/**
 * Take screenshot with timestamp
 */
async function takeScreenshot(window, name) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await window.screenshot({
        path: `e2e/screenshots/${name}-${timestamp}.png`
    });
}

module.exports = {
    launchElectronApp,
    closeElectronApp,
    clickElement,
    fillInput,
    elementExists,
    getElementText,
    takeScreenshot
};
