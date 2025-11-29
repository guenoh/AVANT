/**
 * E2E Test: App Launch and Basic UI
 */
const { test, expect } = require('@playwright/test');
const { launchElectronApp, closeElectronApp, elementExists } = require('./helpers/electron');

test.describe('App Launch', () => {
    let electronApp;
    let window;

    test.beforeAll(async () => {
        const result = await launchElectronApp();
        electronApp = result.electronApp;
        window = result.window;
    });

    test.afterAll(async () => {
        await closeElectronApp(electronApp);
    });

    test('should launch without errors', async () => {
        // Check window title
        const title = await window.title();
        expect(title).toContain('AVANT');
    });

    test('should display main UI panels', async () => {
        // Left panel - Scenario list
        const hasScenarioHeader = await elementExists(window, '#scenario-list-header, #scenario-edit-header');
        expect(hasScenarioHeader).toBe(true);

        // Center panel - Screen preview
        const hasScreenPanel = await elementExists(window, '#screen-preview');
        expect(hasScreenPanel).toBe(true);

        // Right panel - Action list
        const hasActionPanel = await elementExists(window, '#action-list, .action-panel');
        expect(hasActionPanel).toBe(true);
    });

    test('should have new scenario button', async () => {
        const hasNewScenarioBtn = await elementExists(window, '#btn-new-scenario');
        expect(hasNewScenarioBtn).toBe(true);
    });

    test('should show device status area', async () => {
        const hasDeviceStatus = await elementExists(window, '#device-status, .device-status');
        expect(hasDeviceStatus).toBe(true);
    });
});
