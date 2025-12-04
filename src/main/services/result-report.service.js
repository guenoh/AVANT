/**
 * Result Report Service
 * Manages execution sessions and generates HTML reports for scenario runs
 *
 * Features:
 * - Session-based result tracking
 * - HTML report generation
 * - Screenshot organization
 * - Traceability and audit logging
 */

const fs = require('fs');
const path = require('path');
const { generateId } = require('../../shared/utils');

class ResultReportService {
    constructor() {
        this._sessions = new Map();
        this._baseResultsDir = './results';
    }

    /**
     * Start a new execution session
     * @param {Object} options Session options
     * @returns {Object} Session info with sessionId
     */
    startSession(options = {}) {
        const sessionId = generateId('session');
        const startTime = new Date();

        const session = {
            sessionId,
            scenarioName: options.scenarioName || 'Unknown',
            scenarioFile: options.scenarioFile || '',
            startTime: startTime.toISOString(),
            startTimestamp: startTime.getTime(),
            device: options.device || {},
            actions: [],
            variables: {
                initial: options.initialVariables || {},
                final: {}
            },
            result: 'RUNNING',
            failureInfo: null,
            saveSettings: options.saveSettings || {
                saveScreenshots: true,
                saveLogs: true,
                saveVariables: true
            },
            // Extended data for AI analysis
            environment: {
                connectionType: options.connectionType || 'unknown',
                deviceName: options.device?.model || '',
                osVersion: options.osVersion || '',
                appVersion: options.appVersion || ''
            },
            logcat: null,
            aiAnalysis: null
        };

        this._sessions.set(sessionId, session);

        console.log(`[ResultReport] Session started: ${sessionId} for scenario: ${session.scenarioName}`);

        return { sessionId, startTime: session.startTime };
    }

    /**
     * Record an action result
     * @param {string} sessionId Session ID
     * @param {Object} actionResult Action result data
     */
    recordAction(sessionId, actionResult) {
        const session = this._sessions.get(sessionId);
        if (!session) {
            console.error(`[ResultReport] Session not found: ${sessionId}`);
            return { success: false, error: 'Session not found' };
        }

        const actionRecord = {
            index: session.actions.length + 1,
            name: actionResult.name || `Action ${session.actions.length + 1}`,
            type: actionResult.type || 'unknown',
            result: actionResult.success ? 'PASS' : 'FAIL',
            startTime: actionResult.startTime || new Date().toISOString(),
            endTime: actionResult.endTime || new Date().toISOString(),
            duration: actionResult.duration || 0,
            screenshot: actionResult.screenshot || null,
            matchImage: actionResult.matchImage || null,
            details: actionResult.details || {},
            error: actionResult.error || null,
            // Extended data for AI analysis
            matchScore: actionResult.matchScore || null,
            matchThreshold: actionResult.matchThreshold || null,
            matchRegion: actionResult.matchRegion || null,
            screenState: actionResult.screenState || null
        };

        session.actions.push(actionRecord);

        // Update session result if action failed
        if (!actionResult.success && session.result === 'RUNNING') {
            session.result = 'FAIL';
            session.failureInfo = {
                actionIndex: actionRecord.index,
                actionName: actionRecord.name,
                actionType: actionRecord.type,
                reason: actionResult.error || 'Action failed',
                timestamp: actionRecord.endTime
            };
        }

        console.log(`[ResultReport] Action recorded: ${actionRecord.index}. ${actionRecord.name} - ${actionRecord.result}`);

        return { success: true, actionIndex: actionRecord.index };
    }

    /**
     * Finalize the session and generate report
     * @param {string} sessionId Session ID
     * @param {Object} options Finalize options
     * @returns {Object} Result with report path
     */
    async finalizeSession(sessionId, options = {}) {
        const session = this._sessions.get(sessionId);
        if (!session) {
            console.error(`[ResultReport] Session not found: ${sessionId}`);
            return { success: false, error: 'Session not found' };
        }

        const endTime = new Date();
        session.endTime = endTime.toISOString();
        session.endTimestamp = endTime.getTime();
        session.duration = session.endTimestamp - session.startTimestamp;
        session.variables.final = options.finalVariables || {};

        // Set final result
        if (session.result === 'RUNNING') {
            session.result = options.cancelled ? 'CANCELLED' : 'PASS';
        }

        // Create result folder
        const folderName = this._generateFolderName(session);
        const resultDir = path.join(this._baseResultsDir, folderName);

        try {
            // Create directories
            fs.mkdirSync(resultDir, { recursive: true });
            fs.mkdirSync(path.join(resultDir, 'screenshots'), { recursive: true });

            // Copy screenshots
            await this._copyScreenshots(session, resultDir);

            // Generate and save summary.json
            const summaryPath = path.join(resultDir, 'summary.json');
            fs.writeFileSync(summaryPath, JSON.stringify(session, null, 2), 'utf8');

            // Generate and save HTML report
            const reportHtml = this._generateHtmlReport(session);
            const reportPath = path.join(resultDir, 'report.html');
            fs.writeFileSync(reportPath, reportHtml, 'utf8');

            console.log(`[ResultReport] Report generated: ${reportPath}`);

            // Clean up session
            this._sessions.delete(sessionId);

            return {
                success: true,
                result: session.result,
                reportPath: reportPath,
                resultDir: resultDir,
                duration: session.duration,
                totalActions: session.actions.length,
                passedActions: session.actions.filter(a => a.result === 'PASS').length,
                failedActions: session.actions.filter(a => a.result === 'FAIL').length
            };
        } catch (error) {
            console.error(`[ResultReport] Failed to finalize session: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate folder name with timestamp and result
     */
    _generateFolderName(session) {
        const date = new Date(session.startTime);
        const timestamp = date.toISOString()
            .replace(/[-:]/g, '')
            .replace('T', '_')
            .substring(0, 15);

        // Sanitize scenario name for folder
        const safeName = (session.scenarioName || 'Unknown')
            .replace(/[<>:"/\\|?*]/g, '_')
            .substring(0, 50);

        return `${timestamp}_${session.result}_${safeName}`;
    }

    /**
     * Copy screenshots to result folder
     */
    async _copyScreenshots(session, resultDir) {
        const screenshotsDir = path.join(resultDir, 'screenshots');

        for (const action of session.actions) {
            if (action.screenshot && fs.existsSync(action.screenshot)) {
                const ext = path.extname(action.screenshot);
                const safeName = action.name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 30);
                const resultSuffix = action.result === 'FAIL' ? '_FAIL' : '';
                const newName = `${String(action.index).padStart(3, '0')}_${action.type}_${safeName}${resultSuffix}${ext}`;
                const destPath = path.join(screenshotsDir, newName);

                try {
                    fs.copyFileSync(action.screenshot, destPath);
                    action.screenshotRelative = `screenshots/${newName}`;
                } catch (err) {
                    console.error(`[ResultReport] Failed to copy screenshot: ${err.message}`);
                }
            }

            if (action.matchImage && fs.existsSync(action.matchImage)) {
                const ext = path.extname(action.matchImage);
                const safeName = action.name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 30);
                const newName = `${String(action.index).padStart(3, '0')}_${action.type}_${safeName}_match${ext}`;
                const destPath = path.join(screenshotsDir, newName);

                try {
                    fs.copyFileSync(action.matchImage, destPath);
                    action.matchImageRelative = `screenshots/${newName}`;
                } catch (err) {
                    console.error(`[ResultReport] Failed to copy match image: ${err.message}`);
                }
            }
        }
    }

    /**
     * Generate HTML report
     */
    _generateHtmlReport(session) {
        const resultColor = session.result === 'PASS' ? '#16a34a' :
                           session.result === 'FAIL' ? '#dc2626' : '#ca8a04';

        const formatDuration = (ms) => {
            if (ms < 1000) return `${ms}ms`;
            if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
            const mins = Math.floor(ms / 60000);
            const secs = Math.floor((ms % 60000) / 1000);
            return `${mins}m ${secs}s`;
        };

        const formatTime = (isoString) => {
            const date = new Date(isoString);
            return date.toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        };

        const actionsHtml = session.actions.map(action => {
            const actionResultColor = action.result === 'PASS' ? '#16a34a' : '#dc2626';
            const screenshotHtml = action.screenshotRelative
                ? `<a href="${action.screenshotRelative}" target="_blank" class="screenshot-link">View</a>`
                : '-';

            return `
                <tr class="${action.result === 'FAIL' ? 'fail-row' : ''}">
                    <td>${action.index}</td>
                    <td>${action.name}</td>
                    <td><span class="action-type">${action.type}</span></td>
                    <td><span class="result-badge" style="background-color: ${actionResultColor}">${action.result}</span></td>
                    <td>${formatDuration(action.duration)}</td>
                    <td>${screenshotHtml}</td>
                    <td class="error-cell">${action.error || '-'}</td>
                </tr>
            `;
        }).join('');

        const variablesHtml = Object.keys(session.variables.final).length > 0
            ? `
                <section class="variables-section">
                    <h2>Variables</h2>
                    <div class="variables-grid">
                        <div class="variable-box">
                            <h3>Initial</h3>
                            <pre>${JSON.stringify(session.variables.initial, null, 2)}</pre>
                        </div>
                        <div class="variable-box">
                            <h3>Final</h3>
                            <pre>${JSON.stringify(session.variables.final, null, 2)}</pre>
                        </div>
                    </div>
                </section>
            ` : '';

        const failureHtml = session.failureInfo
            ? `
                <section class="failure-section">
                    <h2>Failure Details</h2>
                    <div class="failure-info">
                        <p><strong>Failed at:</strong> Action #${session.failureInfo.actionIndex} - ${session.failureInfo.actionName}</p>
                        <p><strong>Action Type:</strong> ${session.failureInfo.actionType}</p>
                        <p><strong>Reason:</strong> ${session.failureInfo.reason}</p>
                        <p><strong>Time:</strong> ${formatTime(session.failureInfo.timestamp)}</p>
                    </div>
                </section>
            ` : '';

        return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Execution Report - ${session.scenarioName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        header {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 24px;
        }

        header h1 {
            font-size: 24px;
            margin-bottom: 8px;
        }

        .result-banner {
            display: inline-block;
            padding: 8px 24px;
            border-radius: 20px;
            font-size: 18px;
            font-weight: bold;
            color: white;
            margin-top: 12px;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }

        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .summary-card h3 {
            font-size: 12px;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 8px;
        }

        .summary-card .value {
            font-size: 24px;
            font-weight: 600;
            color: #1e293b;
        }

        .summary-card .sub {
            font-size: 12px;
            color: #64748b;
        }

        section {
            background: white;
            border-radius: 8px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        section h2 {
            font-size: 18px;
            margin-bottom: 16px;
            color: #1e293b;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 8px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }

        th {
            background-color: #f8fafc;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            color: #64748b;
        }

        .fail-row {
            background-color: #fef2f2;
        }

        .result-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            color: white;
        }

        .action-type {
            display: inline-block;
            padding: 2px 8px;
            background-color: #e2e8f0;
            border-radius: 4px;
            font-size: 12px;
            color: #475569;
        }

        .screenshot-link {
            color: #2563eb;
            text-decoration: none;
        }

        .screenshot-link:hover {
            text-decoration: underline;
        }

        .error-cell {
            color: #dc2626;
            font-size: 12px;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .failure-section {
            background-color: #fef2f2;
            border-left: 4px solid #dc2626;
        }

        .failure-info p {
            margin-bottom: 8px;
        }

        .variables-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }

        .variable-box {
            background-color: #f8fafc;
            padding: 16px;
            border-radius: 8px;
        }

        .variable-box h3 {
            font-size: 14px;
            margin-bottom: 8px;
            color: #64748b;
        }

        .variable-box pre {
            font-size: 12px;
            overflow-x: auto;
        }

        .device-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
        }

        .device-info-item {
            padding: 8px;
            background-color: #f8fafc;
            border-radius: 4px;
        }

        .device-info-item label {
            font-size: 11px;
            text-transform: uppercase;
            color: #64748b;
            display: block;
        }

        .device-info-item span {
            font-weight: 500;
            color: #1e293b;
        }

        footer {
            text-align: center;
            padding: 20px;
            color: #64748b;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>${session.scenarioName}</h1>
            <p style="opacity: 0.8; font-size: 14px;">${session.scenarioFile}</p>
            <div class="result-banner" style="background-color: ${resultColor}">
                ${session.result}
            </div>
        </header>

        <div class="summary-grid">
            <div class="summary-card">
                <h3>Start Time</h3>
                <div class="value">${formatTime(session.startTime)}</div>
            </div>
            <div class="summary-card">
                <h3>Duration</h3>
                <div class="value">${formatDuration(session.duration)}</div>
            </div>
            <div class="summary-card">
                <h3>Total Actions</h3>
                <div class="value">${session.actions.length}</div>
                <div class="sub">${session.actions.filter(a => a.result === 'PASS').length} passed, ${session.actions.filter(a => a.result === 'FAIL').length} failed</div>
            </div>
            <div class="summary-card">
                <h3>Success Rate</h3>
                <div class="value">${session.actions.length > 0 ? Math.round(session.actions.filter(a => a.result === 'PASS').length / session.actions.length * 100) : 0}%</div>
            </div>
        </div>

        ${failureHtml}

        <section>
            <h2>Device Information</h2>
            <div class="device-info">
                <div class="device-info-item">
                    <label>Serial</label>
                    <span>${session.device.serial || '-'}</span>
                </div>
                <div class="device-info-item">
                    <label>Model</label>
                    <span>${session.device.model || '-'}</span>
                </div>
                <div class="device-info-item">
                    <label>Resolution</label>
                    <span>${session.device.width && session.device.height ? `${session.device.width} x ${session.device.height}` : '-'}</span>
                </div>
            </div>
        </section>

        <section>
            <h2>Action Results</h2>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Result</th>
                        <th>Duration</th>
                        <th>Screenshot</th>
                        <th>Error</th>
                    </tr>
                </thead>
                <tbody>
                    ${actionsHtml}
                </tbody>
            </table>
        </section>

        ${variablesHtml}

        <footer>
            <p>Generated by Vision Auto - ${formatTime(new Date().toISOString())}</p>
            <p>Session ID: ${session.sessionId}</p>
        </footer>
    </div>
</body>
</html>`;
    }

    /**
     * Get current session status
     */
    getSessionStatus(sessionId) {
        const session = this._sessions.get(sessionId);
        if (!session) {
            return { exists: false };
        }
        return {
            exists: true,
            sessionId: session.sessionId,
            scenarioName: session.scenarioName,
            result: session.result,
            actionsCount: session.actions.length,
            startTime: session.startTime
        };
    }

    /**
     * Cancel a session without generating report
     */
    cancelSession(sessionId) {
        if (this._sessions.has(sessionId)) {
            this._sessions.delete(sessionId);
            console.log(`[ResultReport] Session cancelled: ${sessionId}`);
            return { success: true };
        }
        return { success: false, error: 'Session not found' };
    }

    /**
     * Add logcat data to session (for ADB connections)
     * @param {string} sessionId Session ID
     * @param {Object} logcatData Logcat data
     */
    addLogcat(sessionId, logcatData) {
        const session = this._sessions.get(sessionId);
        if (!session) {
            console.error(`[ResultReport] Session not found: ${sessionId}`);
            return { success: false, error: 'Session not found' };
        }

        session.logcat = {
            startTimestamp: logcatData.startTimestamp || Date.now(),
            endTimestamp: logcatData.endTimestamp || Date.now(),
            logs: logcatData.logs || [],
            filteredLogs: logcatData.filteredLogs || []
        };

        console.log(`[ResultReport] Logcat added to session: ${sessionId}, ${session.logcat.logs.length} entries`);
        return { success: true };
    }

    /**
     * Store AI analysis result for a session
     * @param {string} sessionId Session ID
     * @param {Object} analysisResult AI analysis result
     */
    storeAIAnalysis(sessionId, analysisResult) {
        const session = this._sessions.get(sessionId);
        if (!session) {
            console.error(`[ResultReport] Session not found: ${sessionId}`);
            return { success: false, error: 'Session not found' };
        }

        session.aiAnalysis = {
            timestamp: new Date().toISOString(),
            summary: analysisResult.summary,
            rootCause: analysisResult.rootCause,
            failurePoint: analysisResult.failurePoint,
            recommendations: analysisResult.recommendations,
            additionalInsights: analysisResult.additionalInsights
        };

        console.log(`[ResultReport] AI analysis stored for session: ${sessionId}`);
        return { success: true };
    }

    /**
     * Get full session data for AI analysis
     * @param {string} sessionId Session ID
     * @returns {Object} Full session data
     */
    getSessionData(sessionId) {
        const session = this._sessions.get(sessionId);
        if (!session) {
            return { success: false, error: 'Session not found' };
        }

        return {
            success: true,
            session: { ...session }
        };
    }

    /**
     * Get session data from finalized report folder
     * @param {string} reportPath Path to report folder or summary.json
     * @returns {Object} Session data from saved report
     */
    getSessionFromReport(reportPath) {
        try {
            let summaryPath = reportPath;
            if (!reportPath.endsWith('summary.json')) {
                summaryPath = path.join(reportPath, 'summary.json');
            }

            if (!fs.existsSync(summaryPath)) {
                return { success: false, error: 'Summary file not found' };
            }

            const sessionData = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
            return { success: true, session: sessionData };
        } catch (error) {
            console.error(`[ResultReport] Failed to load session from report: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

module.exports = ResultReportService;
