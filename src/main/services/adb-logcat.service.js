/**
 * ADB Logcat Service
 * Collects and filters Android device logs during scenario execution
 *
 * Features:
 * - Real-time log collection via adb logcat
 * - Log filtering by level (Error, Warning)
 * - Log parsing and structuring
 * - Session-based log management
 */

const { spawn } = require('child_process');
const { exec } = require('child_process');
const { promisify } = require('util');
const EventEmitter = require('events');
const fs = require('fs');

const execAsync = promisify(exec);

class ADBLogcatService extends EventEmitter {
    constructor() {
        super();
        this._logcatProcess = null;
        this._isCollecting = false;
        this._currentSession = null;
        this._logs = [];
        this._adbPath = this._findAdbPath();
        this._deviceId = null;
    }

    /**
     * Find ADB path (same logic as device.service.js)
     * @private
     */
    _findAdbPath() {
        if (process.platform === 'win32') {
            return 'adb.exe';
        } else if (process.platform === 'darwin') {
            const homebrewPath = '/opt/homebrew/bin/adb';
            const usrLocalPath = '/usr/local/bin/adb';

            if (fs.existsSync(homebrewPath)) {
                return homebrewPath;
            } else if (fs.existsSync(usrLocalPath)) {
                return usrLocalPath;
            }
        }
        return 'adb';
    }

    /**
     * Check if service is currently collecting logs
     * @returns {boolean}
     */
    isCollecting() {
        return this._isCollecting;
    }

    /**
     * Start collecting logs for a session
     * @param {string} sessionId - Session ID for tracking
     * @param {string} deviceId - ADB device ID
     * @param {Object} options - Collection options
     * @returns {Promise<boolean>}
     */
    async startCollection(sessionId, deviceId, options = {}) {
        if (this._isCollecting) {
            console.warn('[ADBLogcat] Already collecting logs, stopping previous session');
            await this.stopCollection();
        }

        this._currentSession = sessionId;
        this._deviceId = deviceId;
        this._logs = [];

        const {
            levels = ['E', 'W'],  // Error and Warning by default
            maxLogs = 1000,       // Maximum logs to keep
            tags = []             // Specific tags to filter (empty = all)
        } = options;

        try {
            // Clear existing logcat buffer before starting
            await this._clearLogcatBuffer(deviceId);

            // Build logcat command arguments
            const args = this._buildLogcatArgs(deviceId, levels, tags);

            // Spawn logcat process
            this._logcatProcess = spawn(this._adbPath, args);

            this._isCollecting = true;

            // Handle stdout data
            let buffer = '';
            this._logcatProcess.stdout.on('data', (data) => {
                buffer += data.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.trim()) {
                        const parsedLog = this._parseLogLine(line);
                        if (parsedLog) {
                            this._logs.push(parsedLog);

                            // Limit log count
                            if (this._logs.length > maxLogs) {
                                this._logs.shift();
                            }

                            this.emit('log', parsedLog);
                        }
                    }
                }
            });

            // Handle stderr
            this._logcatProcess.stderr.on('data', (data) => {
                const msg = data.toString();
                if (!msg.includes('waiting for device')) {
                    console.warn('[ADBLogcat] stderr:', msg);
                }
            });

            // Handle process exit
            this._logcatProcess.on('close', (code) => {
                console.log(`[ADBLogcat] Process exited with code ${code}`);
                this._isCollecting = false;
                this._logcatProcess = null;
            });

            // Handle process error
            this._logcatProcess.on('error', (error) => {
                console.error('[ADBLogcat] Process error:', error.message);
                this._isCollecting = false;
                this._logcatProcess = null;
            });

            console.log(`[ADBLogcat] Started collecting logs for session: ${sessionId}`);
            return true;
        } catch (error) {
            console.error('[ADBLogcat] Failed to start collection:', error.message);
            this._isCollecting = false;
            return false;
        }
    }

    /**
     * Stop collecting logs and return collected data
     * @returns {Promise<Object>} Collected log data
     */
    async stopCollection() {
        if (!this._isCollecting && !this._logcatProcess) {
            return this._getEmptyResult();
        }

        // Kill logcat process
        if (this._logcatProcess) {
            this._logcatProcess.kill('SIGTERM');
            this._logcatProcess = null;
        }

        this._isCollecting = false;

        const result = {
            sessionId: this._currentSession,
            deviceId: this._deviceId,
            startTimestamp: this._logs.length > 0 ? this._logs[0].timestamp : null,
            endTimestamp: this._logs.length > 0 ? this._logs[this._logs.length - 1].timestamp : null,
            totalLogs: this._logs.length,
            logs: [...this._logs],
            filteredLogs: this._filterImportantLogs(this._logs)
        };

        console.log(`[ADBLogcat] Stopped collecting. Total logs: ${result.totalLogs}, Filtered: ${result.filteredLogs.length}`);

        // Clear state
        this._currentSession = null;
        this._deviceId = null;
        this._logs = [];

        return result;
    }

    /**
     * Get current collected logs without stopping
     * @returns {Object} Current log data
     */
    getCurrentLogs() {
        return {
            sessionId: this._currentSession,
            isCollecting: this._isCollecting,
            totalLogs: this._logs.length,
            logs: [...this._logs],
            filteredLogs: this._filterImportantLogs(this._logs)
        };
    }

    /**
     * Clear logcat buffer before starting collection
     * @private
     */
    async _clearLogcatBuffer(deviceId) {
        try {
            const cmd = deviceId
                ? `${this._adbPath} -s ${deviceId} logcat -c`
                : `${this._adbPath} logcat -c`;
            await execAsync(cmd);
        } catch (error) {
            console.warn('[ADBLogcat] Failed to clear buffer:', error.message);
        }
    }

    /**
     * Build logcat command arguments
     * @private
     */
    _buildLogcatArgs(deviceId, levels, tags) {
        const args = [];

        // Add device specifier if provided
        if (deviceId) {
            args.push('-s', deviceId);
        }

        args.push('logcat');

        // Use threadtime format for better parsing
        args.push('-v', 'threadtime');

        // Add tag filters if specified
        if (tags.length > 0) {
            for (const tag of tags) {
                args.push(`${tag}:V`);
            }
            args.push('*:S'); // Silence other tags
        } else if (levels.length > 0) {
            // Filter by level using *:LEVEL format
            const highestLevel = this._getHighestLevel(levels);
            args.push(`*:${highestLevel}`);
        }

        return args;
    }

    /**
     * Get highest (most verbose) level from array
     * @private
     */
    _getHighestLevel(levels) {
        const priority = ['V', 'D', 'I', 'W', 'E', 'F', 'S'];
        let highest = 'S';

        for (const level of levels) {
            if (priority.indexOf(level) < priority.indexOf(highest)) {
                highest = level;
            }
        }

        return highest;
    }

    /**
     * Parse a logcat line into structured format
     * @private
     */
    _parseLogLine(line) {
        // Format: MM-DD HH:MM:SS.mmm  PID  TID LEVEL TAG: Message
        // Example: 12-04 14:23:45.123  1234  5678 E ActivityManager: Process crashed
        const regex = /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEFS])\s+([^:]+):\s*(.*)$/;
        const match = line.match(regex);

        if (!match) {
            // Try alternative format without PID/TID
            const simpleRegex = /^([VDIWEFS])\/([^(]+)\(\s*(\d+)\):\s*(.*)$/;
            const simpleMatch = line.match(simpleRegex);

            if (simpleMatch) {
                return {
                    timestamp: new Date().toISOString(),
                    level: simpleMatch[1],
                    tag: simpleMatch[2].trim(),
                    pid: parseInt(simpleMatch[3]),
                    tid: null,
                    message: simpleMatch[4]
                };
            }

            return null;
        }

        const [, timestamp, pid, tid, level, tag, message] = match;

        // Convert timestamp to full ISO format
        const now = new Date();
        const [datePart, timePart] = timestamp.split(' ').filter(Boolean);
        const [month, day] = datePart.split('-');
        const fullTimestamp = new Date(
            now.getFullYear(),
            parseInt(month) - 1,
            parseInt(day),
            ...timePart.split(':').map((v, i) => i === 2 ? parseFloat(v) : parseInt(v))
        ).toISOString();

        return {
            timestamp: fullTimestamp,
            level,
            tag: tag.trim(),
            pid: parseInt(pid),
            tid: parseInt(tid),
            message: message.trim()
        };
    }

    /**
     * Filter logs to keep only important ones for AI analysis
     * @private
     */
    _filterImportantLogs(logs) {
        // Keywords that indicate important logs
        const importantKeywords = [
            'crash', 'exception', 'error', 'fail', 'fatal',
            'anr', 'freeze', 'timeout', 'oom', 'killed',
            'ActivityManager', 'WindowManager', 'InputDispatcher',
            'Process', 'System.err', 'AndroidRuntime'
        ];

        return logs.filter(log => {
            // Always include Error and Fatal levels
            if (log.level === 'E' || log.level === 'F') {
                return true;
            }

            // Check for important keywords
            const content = `${log.tag} ${log.message}`.toLowerCase();
            return importantKeywords.some(keyword =>
                content.includes(keyword.toLowerCase())
            );
        });
    }

    /**
     * Get empty result structure
     * @private
     */
    _getEmptyResult() {
        return {
            sessionId: null,
            deviceId: null,
            startTimestamp: null,
            endTimestamp: null,
            totalLogs: 0,
            logs: [],
            filteredLogs: []
        };
    }

    /**
     * Get a snapshot of recent logs (useful for debugging)
     * @param {number} count - Number of recent logs to get
     * @returns {Array}
     */
    getRecentLogs(count = 50) {
        return this._logs.slice(-count);
    }

    /**
     * Cleanup service
     */
    async cleanup() {
        await this.stopCollection();
    }
}

// Export singleton instance
module.exports = new ADBLogcatService();
