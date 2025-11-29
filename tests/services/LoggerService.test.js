/**
 * LoggerService Unit Tests
 */

const LoggerService = require('../../src/renderer/services/LoggerService');

describe('LoggerService', () => {
  let logger;

  beforeEach(() => {
    logger = new LoggerService();
  });

  describe('Initialization', () => {
    test('should initialize with default options', () => {
      expect(logger.logs).toEqual([]);
      expect(logger.maxLogs).toBe(1000);
      expect(logger.listeners.size).toBe(0);
    });

    test('should accept custom options', () => {
      const customLogger = new LoggerService({
        maxLogs: 500,
        levels: ['info', 'error'],
        minLevel: 'info'
      });

      expect(customLogger.maxLogs).toBe(500);
      expect(customLogger.filters.levels).toEqual(['info', 'error']);
      expect(customLogger.filters.minLevel).toBe('info');
    });
  });

  describe('Logging Methods', () => {
    test('should log info message', () => {
      const entry = logger.info('Test info message');

      expect(entry.level).toBe('info');
      expect(entry.message).toBe('Test info message');
      expect(logger.logs).toHaveLength(1);
    });

    test('should log success message', () => {
      const entry = logger.success('Test success message');

      expect(entry.level).toBe('success');
      expect(entry.message).toBe('Test success message');
    });

    test('should log warning message', () => {
      const entry = logger.warning('Test warning message');

      expect(entry.level).toBe('warning');
      expect(entry.message).toBe('Test warning message');
    });

    test('should log error message', () => {
      const entry = logger.error('Test error message');

      expect(entry.level).toBe('error');
      expect(entry.message).toBe('Test error message');
    });

    test('should log debug message', () => {
      const entry = logger.debug('Test debug message');

      expect(entry.level).toBe('debug');
      expect(entry.message).toBe('Test debug message');
    });

    test('should log with data', () => {
      const data = { key: 'value', count: 42 };
      const entry = logger.info('Message with data', data);

      expect(entry.data).toEqual(data);
    });

    test('should generate unique IDs for each log', () => {
      const entry1 = logger.info('First message');
      const entry2 = logger.info('Second message');

      expect(entry1.id).toBeDefined();
      expect(entry2.id).toBeDefined();
      expect(entry1.id).not.toBe(entry2.id);
    });

    test('should include timestamp in log entries', () => {
      const entry = logger.info('Test message');

      expect(entry.timestamp).toBeDefined();
      expect(entry.time).toBeDefined();
    });
  });

  describe('Log Management', () => {
    test('should clear all logs', () => {
      logger.info('Message 1');
      logger.info('Message 2');
      logger.clear();

      expect(logger.logs).toHaveLength(0);
    });

    test('should trim logs when maxLogs is exceeded', () => {
      const smallLogger = new LoggerService({ maxLogs: 5 });

      for (let i = 0; i < 10; i++) {
        smallLogger.info(`Message ${i}`);
      }

      expect(smallLogger.logs).toHaveLength(5);
      expect(smallLogger.logs[0].message).toBe('Message 5');
    });
  });

  describe('Log Filtering', () => {
    beforeEach(() => {
      logger.info('Info message', { type: 'info' });
      logger.success('Success message', { type: 'success' });
      logger.warning('Warning message', { type: 'warning' });
      logger.error('Error message', { type: 'error' });
    });

    test('should get all logs without filter', () => {
      const logs = logger.getLogs();
      expect(logs).toHaveLength(4);
    });

    test('should filter logs by level', () => {
      const logs = logger.getLogs({ level: 'error' });
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
    });

    test('should filter logs by search text in message', () => {
      const logs = logger.getLogs({ search: 'warning' });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toContain('Warning');
    });

    test('should filter logs by search text in data', () => {
      const logs = logger.getLogs({ search: 'success' });
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });

    test('should limit log results', () => {
      const logs = logger.getLogs({ limit: 2 });
      expect(logs).toHaveLength(2);
    });

    test('should get logs by level', () => {
      const logs = logger.getLogsByLevel('info');
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
    });

    test('should get recent logs', () => {
      const logs = logger.getRecentLogs(2);
      expect(logs).toHaveLength(2);
    });
  });

  describe('Level Filtering', () => {
    test('should filter by allowed levels', () => {
      logger.setFilterLevels(['error']);

      const infoEntry = logger.info('Should not log');
      const errorEntry = logger.error('Should log');

      expect(logger.logs).toHaveLength(1);
      expect(logger.logs[0].level).toBe('error');
    });

    test('should filter by minimum level', () => {
      logger.setMinLevel('warning');

      logger.debug('Should not log');
      logger.info('Should not log');
      logger.warning('Should log');
      logger.error('Should log');

      expect(logger.logs).toHaveLength(2);
    });
  });

  describe('Statistics', () => {
    test('should return log statistics', () => {
      logger.info('Info 1');
      logger.info('Info 2');
      logger.error('Error 1');
      logger.success('Success 1');

      const stats = logger.getStatistics();

      expect(stats.total).toBe(4);
      expect(stats.byLevel.info).toBe(2);
      expect(stats.byLevel.error).toBe(1);
      expect(stats.byLevel.success).toBe(1);
      expect(stats.byLevel.warning).toBe(0);
    });
  });

  describe('Subscription', () => {
    test('should subscribe to log events', () => {
      const listener = jest.fn();
      logger.subscribe(listener);

      logger.info('Test message');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: 'Test message'
        })
      );
    });

    test('should return unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe = logger.subscribe(listener);

      logger.info('First message');
      unsubscribe();
      logger.info('Second message');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('should unsubscribe listener', () => {
      const listener = jest.fn();
      logger.subscribe(listener);
      logger.unsubscribe(listener);

      logger.info('Test message');

      expect(listener).not.toHaveBeenCalled();
    });

    test('should notify on clear', () => {
      const listener = jest.fn();
      logger.subscribe(listener);
      logger.clear();

      expect(listener).toHaveBeenCalledWith({ type: 'cleared' });
    });

    test('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = jest.fn();

      console.error = jest.fn();

      logger.subscribe(errorListener);
      logger.subscribe(normalListener);

      logger.info('Test message');

      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('Export', () => {
    beforeEach(() => {
      logger.info('Info message', { key: 'value' });
      logger.error('Error message');
    });

    test('should export logs as JSON', () => {
      const json = logger.exportJSON();
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
    });

    test('should export logs as CSV', () => {
      const csv = logger.exportCSV();
      const lines = csv.split('\n');

      expect(lines[0]).toBe('Timestamp,Level,Message,Data');
      expect(lines.length).toBe(3);
    });

    test('should export logs as text', () => {
      const text = logger.exportText();
      const lines = text.split('\n');

      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('[INFO]');
      expect(lines[1]).toContain('[ERROR]');
    });
  });

  describe('Scoped Logger', () => {
    test('should create scoped logger with prefix', () => {
      const scopedLogger = logger.createScope('TestModule');

      scopedLogger.info('Scoped message');

      expect(logger.logs[0].message).toBe('[TestModule] Scoped message');
    });

    test('should support all log levels in scoped logger', () => {
      const scopedLogger = logger.createScope('Module');

      scopedLogger.info('Info');
      scopedLogger.success('Success');
      scopedLogger.warning('Warning');
      scopedLogger.error('Error');
      scopedLogger.debug('Debug');

      expect(logger.logs).toHaveLength(5);
      expect(logger.logs.every(log => log.message.startsWith('[Module]'))).toBe(true);
    });
  });

  describe('Time Range Filtering', () => {
    test('should filter logs by start time', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 10000);

      logger.info('Old message');
      logger.info('Recent message');

      const logs = logger.getLogs({
        startTime: past.toISOString()
      });

      expect(logs.length).toBeGreaterThanOrEqual(1);
    });

    test('should filter logs by end time', () => {
      const future = new Date(Date.now() + 10000);

      logger.info('Message 1');
      logger.info('Message 2');

      const logs = logger.getLogs({
        endTime: future.toISOString()
      });

      expect(logs).toHaveLength(2);
    });
  });
});
