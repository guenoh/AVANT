/**
 * E2E Test: Scenario Management
 */
const { test, expect } = require('@playwright/test');
const { launchElectronApp, closeElectronApp, clickElement, fillInput, elementExists, getElementText } = require('./helpers/electron');

test.describe('Scenario Management', () => {
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

    test('should create new scenario', async () => {
        // Click new scenario button
        await clickElement(window, '#btn-new-scenario');

        // Wait for dialog or input field
        await window.waitForTimeout(500);

        // Check if scenario name input is visible
        const hasNameInput = await elementExists(window, '#macro-name-input, #scenario-name-input');
        expect(hasNameInput).toBe(true);
    });

    test('should be able to name scenario', async () => {
        const testName = 'E2E Test Scenario';

        // Try to fill scenario name
        const inputSelector = '#macro-name-input';
        if (await elementExists(window, inputSelector)) {
            await fillInput(window, inputSelector, testName);

            // Verify input value
            const inputValue = await window.inputValue(inputSelector);
            expect(inputValue).toBe(testName);
        }
    });

    test('should show action panel when scenario is active', async () => {
        // Action panel should be visible for adding actions
        const hasActionList = await elementExists(window, '#action-list, .action-categories');
        expect(hasActionList).toBe(true);
    });

    test('should have action categories', async () => {
        // Check for action category buttons/sections
        const hasCategories = await elementExists(window, '.action-category, [data-category]');
        // At minimum, we should have some action buttons
        const hasAnyActionButton = await elementExists(window, '.action-card, .action-button, [data-action-type]');
        expect(hasCategories || hasAnyActionButton).toBe(true);
    });
});
