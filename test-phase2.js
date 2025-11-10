const { chromium } = require('playwright');
const path = require('path');

(async () => {
    console.log('Starting Phase 2 Services Tests...\n');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    const testFile = 'file://' + path.resolve(__dirname, 'test-phase2-services.html');

    console.log(`Loading test page: ${testFile}\n`);
    await page.goto(testFile);

    // Wait for tests to complete
    await page.waitForTimeout(3000);

    // Extract test results
    const results = await page.evaluate(() => {
        const sections = [
            'logger-results',
            'marker-results',
            'interaction-results',
            'config-results'
        ];

        const allResults = {};

        sections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            const resultDivs = section.querySelectorAll('.test-result');

            const sectionResults = [];
            resultDivs.forEach(div => {
                sectionResults.push({
                    message: div.textContent,
                    success: div.classList.contains('success')
                });
            });

            allResults[sectionId] = sectionResults;
        });

        return allResults;
    });

    // Print results
    console.log('=== TEST RESULTS ===\n');

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    Object.entries(results).forEach(([section, tests]) => {
        const sectionName = section
            .replace('-results', '')
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        console.log(`\n${sectionName}:`);
        console.log('-'.repeat(50));

        tests.forEach(test => {
            totalTests++;
            if (test.success) {
                passedTests++;
                console.log(`  ${test.message}`);
            } else {
                failedTests++;
                console.log(`  ${test.message}`);
            }
        });
    });

    console.log('\n' + '='.repeat(50));
    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${failedTests}`);

    if (failedTests === 0) {
        console.log('\n✅ All Phase 2 tests passed!\n');
    } else {
        console.log('\n❌ Some tests failed\n');
    }

    // Take screenshot
    await page.screenshot({ path: 'test-phase2-results.png', fullPage: true });
    console.log('Screenshot saved to test-phase2-results.png\n');

    await browser.close();

    process.exit(failedTests > 0 ? 1 : 0);
})();
