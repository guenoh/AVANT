/**
 * LoggerService
 * Centralized logging with filtering and subscription support
 */

class LoggerService {
    constructor(options = {}) {
        this.logs = [];
        this.maxLogs = options.maxLogs || 1000;
        this.listeners = new Set();
        this.filters = {
            levels: options.levels || ['info', 'success', 'warning', 'error', 'debug'],
            minLevel: options.minLevel || 'debug'
        };

        this.levelPriority = {
            debug: 0,
            info: 1,
            success: 2,
            warning: 3,
            error: 4
        };
    }

    /**
     * Log a message
     */
    log(level, message, data = null) {
        const entry = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            time: new Date().toLocaleTimeString('ko-KR'),
            level,
            message,
            data
        };

        // Check if level should be logged
        if (!this._shouldLog(level)) {
            return entry;
        }

        this.logs.push(entry);

        // Trim logs if exceeded
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // Notify listeners
        this._notify(entry);

        // Console output in development
        if (typeof window !== 'undefined' && window.location.search.includes('debug')) {
            this._consoleOutput(entry);
        }

        return entry;
    }

    /**
     * Log info message
     */
    info(message, data) {
        return this.log('info', message, data);
    }

    /**
     * Log success message
     */
    success(message, data) {
        return this.log('success', message, data);
    }

    /**
     * Log warning message
     */
    warning(message, data) {
        return this.log('warning', message, data);
    }

    /**
     * Log error message
     */
    error(message, data) {
        return this.log('error', message, data);
    }

    /**
     * Log debug message
     */
    debug(message, data) {
        return this.log('debug', message, data);
    }

    /**
     * Clear all logs
     */
    clear() {
        this.logs = [];
        this._notify({ type: 'cleared' });
    }

    /**
     * Get all logs with optional filter
     */
    getLogs(filter = null) {
        if (!filter) {
            return this.logs;
        }

        let filtered = this.logs;

        // Filter by level
        if (filter.level) {
            filtered = filtered.filter(log => log.level === filter.level);
        }

        // Filter by search text
        if (filter.search) {
            const search = filter.search.toLowerCase();
            filtered = filtered.filter(log =>
                log.message.toLowerCase().includes(search) ||
                (log.data && JSON.stringify(log.data).toLowerCase().includes(search))
            );
        }

        // Filter by time range
        if (filter.startTime) {
            filtered = filtered.filter(log =>
                new Date(log.timestamp) >= new Date(filter.startTime)
            );
        }

        if (filter.endTime) {
            filtered = filtered.filter(log =>
                new Date(log.timestamp) <= new Date(filter.endTime)
            );
        }

        // Limit results
        if (filter.limit) {
            filtered = filtered.slice(-filter.limit);
        }

        return filtered;
    }

    /**
     * Get logs by level
     */
    getLogsByLevel(level) {
        return this.logs.filter(log => log.level === level);
    }

    /**
     * Get recent logs
     */
    getRecentLogs(count = 50) {
        return this.logs.slice(-count);
    }

    /**
     * Get log statistics
     */
    getStatistics() {
        const stats = {
            total: this.logs.length,
            byLevel: {}
        };

        ['info', 'success', 'warning', 'error', 'debug'].forEach(level => {
            stats.byLevel[level] = this.logs.filter(log => log.level === level).length;
        });

        return stats;
    }

    /**
     * Subscribe to log events
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Unsubscribe from log events
     */
    unsubscribe(listener) {
        this.listeners.delete(listener);
    }

    /**
     * Export logs as JSON
     */
    exportJSON() {
        return JSON.stringify(this.logs, null, 2);
    }

    /**
     * Export logs as CSV
     */
    exportCSV() {
        const headers = ['Timestamp', 'Level', 'Message', 'Data'];
        const rows = this.logs.map(log => [
            log.timestamp,
            log.level,
            log.message,
            log.data ? JSON.stringify(log.data) : ''
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        return csv;
    }

    /**
     * Export logs as text
     */
    exportText() {
        return this.logs.map(log => {
            const dataStr = log.data ? ` | ${JSON.stringify(log.data)}` : '';
            return `[${log.time}] [${log.level.toUpperCase()}] ${log.message}${dataStr}`;
        }).join('\n');
    }

    /**
     * Set filter levels
     */
    setFilterLevels(levels) {
        this.filters.levels = levels;
    }

    /**
     * Set minimum log level
     */
    setMinLevel(level) {
        this.filters.minLevel = level;
    }

    /**
     * Check if level should be logged
     */
    _shouldLog(level) {
        // Check if level is in allowed levels
        if (!this.filters.levels.includes(level)) {
            return false;
        }

        // Check if level meets minimum priority
        const minPriority = this.levelPriority[this.filters.minLevel] || 0;
        const currentPriority = this.levelPriority[level] || 0;

        return currentPriority >= minPriority;
    }

    /**
     * Notify all listeners
     */
    _notify(entry) {
        this.listeners.forEach(listener => {
            try {
                listener(entry);
            } catch (error) {
                console.error('Error in log listener:', error);
            }
        });
    }

    /**
     * Output to console (development)
     */
    _consoleOutput(entry) {
        const style = this._getConsoleStyle(entry.level);
        const prefix = `[${entry.time}] [${entry.level.toUpperCase()}]`;

        console.log(`%c${prefix}%c ${entry.message}`, style, 'color: inherit', entry.data);
    }

    /**
     * Get console style for level
     */
    _getConsoleStyle(level) {
        const styles = {
            info: 'color: #3b82f6; font-weight: bold',
            success: 'color: #22c55e; font-weight: bold',
            warning: 'color: #f59e0b; font-weight: bold',
            error: 'color: #ef4444; font-weight: bold',
            debug: 'color: #8b5cf6; font-weight: bold'
        };

        return styles[level] || 'color: #666';
    }

    /**
     * Create a scoped logger (with prefix)
     */
    createScope(prefix) {
        return {
            info: (msg, data) => this.info(`[${prefix}] ${msg}`, data),
            success: (msg, data) => this.success(`[${prefix}] ${msg}`, data),
            warning: (msg, data) => this.warning(`[${prefix}] ${msg}`, data),
            error: (msg, data) => this.error(`[${prefix}] ${msg}`, data),
            debug: (msg, data) => this.debug(`[${prefix}] ${msg}`, data)
        };
    }
}

// Export for use in renderer process
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoggerService;
}

if (typeof window !== 'undefined') {
    window.LoggerService = LoggerService;
}
