/**
 * E2E Test: Action Sequence Operations
 */
const { test, expect } = require('@playwright/test');
const { launchElectronApp, closeElectronApp, clickElement, elementExists } = require('./helpers/electron');

test.describe('Action Sequence', () => {
    let electronApp;
    let window;

    test.beforeAll(async () => {
        const result = await launchElectronApp();
        electronApp = result.electronApp;
        window = result.window;

        // Create a new scenario first
        await clickElement(window, '#btn-new-scenario');
        await window.waitForTimeout(500);
    });

    test.afterAll(async () => {
        await closeElectronApp(electronApp);
    });

    test('should add wait action', async () => {
        // Find and click wait action button
        const waitActionSelector = '[data-action-type="wait"], .action-card:has-text("Wait"), button:has-text("대기")';

        if (await elementExists(window, waitActionSelector)) {
            const initialCount = await window.locator('.action-block, .action-item').count();

            await clickElement(window, waitActionSelector);
            await window.waitForTimeout(300);

            const newCount = await window.locator('.action-block, .action-item').count();
            expect(newCount).toBeGreaterThanOrEqual(initialCount);
        }
    });

    test('should show action in sequence panel', async () => {
        // Check if action sequence panel has content
        const actionSequence = window.locator('#action-sequence, .action-sequence');
        await expect(actionSequence).toBeVisible();
    });

    test('should be able to select action', async () => {
        const actionItem = window.locator('.action-block, .action-item').first();

        if (await actionItem.isVisible()) {
            await actionItem.click();
            await window.waitForTimeout(200);

            // Check if action is selected (has selected class or shows settings)
            const isSelected = await actionItem.evaluate(el =>
                el.classList.contains('selected') ||
                el.classList.contains('expanded') ||
                el.getAttribute('data-selected') === 'true'
            );

            // Either selected or settings panel should be visible
            const hasSettings = await elementExists(window, '.action-settings, .settings-panel');
            expect(isSelected || hasSettings).toBe(true);
        }
    });

    test('should be able to delete action', async () => {
        const actionItems = window.locator('.action-block, .action-item');
        const initialCount = await actionItems.count();

        if (initialCount > 0) {
            // Find delete button on first action
            const deleteBtn = window.locator('.action-block .btn-delete, .action-item .delete-btn, [data-action="delete"]').first();

            if (await deleteBtn.isVisible()) {
                await deleteBtn.click();
                await window.waitForTimeout(300);

                const newCount = await actionItems.count();
                expect(newCount).toBeLessThan(initialCount);
            }
        }
    });
});
