/**
 * Logger Service - 로깅 및 디버그 관리
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const { LOG_LEVEL } = require('../../shared/constants');

// 로그 레벨 우선순위
const LOG_PRIORITY = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4
};

class LoggerService extends EventEmitter {
  constructor() {
    super();
    this.logsDir = path.join(app.getPath('userData'), 'logs');
    this.currentLogFile = null;
    this.logBuffer = [];
    this.maxBufferSize = 100;
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    this.maxLogFiles = 10;
    this.logLevel = LOG_LEVEL.INFO;
    this._initialized = false;
  }

  /**
   * 서비스 초기화
   */
  async initialize(settings = {}) {
    if (this._initialized) return;

    try {
      // 로그 디렉토리 생성
      await fs.mkdir(this.logsDir, { recursive: true });

      // 설정 적용
      this.logLevel = settings.logLevel || LOG_LEVEL.INFO;
      this.maxLogFiles = settings.maxLogFiles || 10;

      // 로그 파일 초기화
      await this._initLogFile();

      // 이전 로그 파일 정리
      await this._cleanOldLogs();

      this._initialized = true;
      this.log(LOG_LEVEL.INFO, 'Logger service initialized');
    } catch (error) {
      console.error('Failed to initialize logger service:', error);
      throw error;
    }
  }

  /**
   * 서비스 정리
   */
  async cleanup() {
    // 버퍼된 로그 플러시
    await this._flushBuffer();
    this._initialized = false;
  }

  /**
   * 로그 파일 초기화
   */
  async _initLogFile() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.currentLogFile = path.join(this.logsDir, `app_${timestamp}.log`);

    // 파일 헤더 작성
    const header = [
      '========================================',
      `Vision Auto v2 Log File`,
      `Created: ${new Date().toISOString()}`,
      `Platform: ${process.platform}`,
      `Version: ${app.getVersion()}`,
      '========================================',
      ''
    ].join('\n');

    await fs.writeFile(this.currentLogFile, header);
  }

  /**
   * 오래된 로그 파일 정리
   */
  async _cleanOldLogs() {
    try {
      const files = await fs.readdir(this.logsDir);
      const logFiles = files.filter(f => f.endsWith('.log'));

      if (logFiles.length > this.maxLogFiles) {
        // 파일을 날짜순으로 정렬
        const fileStats = await Promise.all(
          logFiles.map(async file => {
            const filePath = path.join(this.logsDir, file);
            const stats = await fs.stat(filePath);
            return { file, mtime: stats.mtime };
          })
        );

        fileStats.sort((a, b) => a.mtime - b.mtime);

        // 오래된 파일 삭제
        const toDelete = fileStats.slice(0, fileStats.length - this.maxLogFiles);

        for (const { file } of toDelete) {
          await fs.unlink(path.join(this.logsDir, file));
        }
      }
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }

  /**
   * 로그 작성
   */
  log(level, message, data = {}) {
    // 로그 레벨 확인
    if (!this._shouldLog(level)) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      data: Object.keys(data).length > 0 ? data : undefined,
      pid: process.pid
    };

    // 콘솔 출력
    this._consoleLog(logEntry);

    // 버퍼에 추가
    this.logBuffer.push(logEntry);

    // 이벤트 발생
    this.emit('log', logEntry);

    // 버퍼가 가득 차면 플러시
    if (this.logBuffer.length >= this.maxBufferSize) {
      this._flushBuffer();
    }
  }

  /**
   * 디버그 로그
   */
  debug(message, data) {
    this.log(LOG_LEVEL.DEBUG, message, data);
  }

  /**
   * 정보 로그
   */
  info(message, data) {
    this.log(LOG_LEVEL.INFO, message, data);
  }

  /**
   * 경고 로그
   */
  warn(message, data) {
    this.log(LOG_LEVEL.WARN, message, data);
  }

  /**
   * 에러 로그
   */
  error(message, data) {
    // 에러 객체 처리
    if (data instanceof Error) {
      data = {
        message: data.message,
        stack: data.stack,
        code: data.code
      };
    }

    this.log(LOG_LEVEL.ERROR, message, data);
  }

  /**
   * 치명적 에러 로그
   */
  fatal(message, data) {
    this.log(LOG_LEVEL.FATAL, message, data);

    // 즉시 플러시
    this._flushBuffer();
  }

  /**
   * 로그 레벨 확인
   */
  _shouldLog(level) {
    const currentPriority = LOG_PRIORITY[this.logLevel] || 1;
    const logPriority = LOG_PRIORITY[level] || 1;
    return logPriority >= currentPriority;
  }

  /**
   * 콘솔 출력
   */
  _consoleLog(logEntry) {
    const { level, message, data, timestamp } = logEntry;
    const time = new Date(timestamp).toLocaleTimeString();

    let output = `[${time}] [${level}] ${message}`;

    if (data) {
      output += ` ${JSON.stringify(data)}`;
    }

    switch (level) {
      case 'ERROR':
      case 'FATAL':
        console.error(output);
        break;
      case 'WARN':
        console.warn(output);
        break;
      case 'DEBUG':
        console.debug(output);
        break;
      default:
        console.log(output);
    }
  }

  /**
   * 버퍼 플러시
   */
  async _flushBuffer() {
    if (this.logBuffer.length === 0 || !this.currentLogFile) {
      return;
    }

    try {
      // 로그 항목을 텍스트로 변환
      const logText = this.logBuffer
        .map(entry => this._formatLogEntry(entry))
        .join('\n') + '\n';

      // 파일에 추가
      await fs.appendFile(this.currentLogFile, logText);

      // 파일 크기 확인
      const stats = await fs.stat(this.currentLogFile);

      if (stats.size > this.maxFileSize) {
        // 새 로그 파일 생성
        await this._initLogFile();
        await this._cleanOldLogs();
      }

      // 버퍼 비우기
      this.logBuffer = [];
    } catch (error) {
      console.error('Failed to flush log buffer:', error);
    }
  }

  /**
   * 로그 항목 포맷
   */
  _formatLogEntry(entry) {
    const { timestamp, level, message, data, pid } = entry;

    let formatted = `${timestamp} [${level}] [PID:${pid}] ${message}`;

    if (data) {
      formatted += '\n  Data: ' + JSON.stringify(data, null, 2).replace(/\n/g, '\n  ');
    }

    return formatted;
  }

  /**
   * 로그 가져오기
   */
  async getLogs(options = {}) {
    const {
      level = null,
      limit = 100,
      startDate = null,
      endDate = null,
      search = null
    } = options;

    try {
      // 현재 버퍼 플러시
      await this._flushBuffer();

      // 모든 로그 파일 읽기
      const files = await fs.readdir(this.logsDir);
      const logFiles = files.filter(f => f.endsWith('.log')).sort().reverse();

      const logs = [];

      for (const file of logFiles) {
        if (logs.length >= limit) break;

        const filePath = path.join(this.logsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');

        for (const line of lines) {
          if (logs.length >= limit) break;
          if (!line.trim()) continue;

          // 로그 항목 파싱
          const parsed = this._parseLogLine(line);

          if (!parsed) continue;

          // 필터링
          if (level && parsed.level !== level.toUpperCase()) continue;

          if (startDate && new Date(parsed.timestamp) < new Date(startDate)) continue;

          if (endDate && new Date(parsed.timestamp) > new Date(endDate)) continue;

          if (search && !parsed.message.includes(search) &&
              (!parsed.data || !JSON.stringify(parsed.data).includes(search))) continue;

          logs.push(parsed);
        }
      }

      return logs;
    } catch (error) {
      console.error('Failed to get logs:', error);
      return [];
    }
  }

  /**
   * 로그 라인 파싱
   */
  _parseLogLine(line) {
    // ISO 날짜 패턴으로 시작하는지 확인
    const match = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+\[(\w+)\]\s+\[PID:(\d+)\]\s+(.+)/);

    if (!match) {
      return null;
    }

    const [, timestamp, level, pid, rest] = match;

    // Data 부분 추출 (있는 경우)
    let message = rest;
    let data = null;

    const dataIndex = rest.indexOf('\n  Data: ');
    if (dataIndex !== -1) {
      message = rest.substring(0, dataIndex);
      try {
        const dataStr = rest.substring(dataIndex + 9).replace(/\n  /g, '\n');
        data = JSON.parse(dataStr);
      } catch {
        // 파싱 실패 시 무시
      }
    }

    return {
      timestamp,
      level,
      pid: parseInt(pid),
      message,
      data
    };
  }

  /**
   * 로그 클리어
   */
  async clearLogs() {
    try {
      // 버퍼 비우기
      this.logBuffer = [];

      // 모든 로그 파일 삭제
      const files = await fs.readdir(this.logsDir);

      for (const file of files) {
        if (file.endsWith('.log')) {
          await fs.unlink(path.join(this.logsDir, file));
        }
      }

      // 새 로그 파일 생성
      await this._initLogFile();

      this.log(LOG_LEVEL.INFO, 'Logs cleared');

      return true;
    } catch (error) {
      console.error('Failed to clear logs:', error);
      return false;
    }
  }

  /**
   * 로그 내보내기
   */
  async exportLogs(exportPath, options = {}) {
    try {
      const logs = await this.getLogs(options);

      const exportData = {
        exported: new Date().toISOString(),
        version: app.getVersion(),
        platform: process.platform,
        logs
      };

      await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));

      this.log(LOG_LEVEL.INFO, 'Logs exported', { path: exportPath, count: logs.length });

      return exportPath;
    } catch (error) {
      console.error('Failed to export logs:', error);
      throw error;
    }
  }

  /**
   * 로그 레벨 설정
   */
  setLogLevel(level) {
    if (!Object.values(LOG_LEVEL).includes(level)) {
      throw new Error(`Invalid log level: ${level}`);
    }

    this.logLevel = level;
    this.log(LOG_LEVEL.INFO, `Log level changed to ${level}`);
  }

  /**
   * 성능 측정 시작
   */
  startPerformance(label) {
    const startTime = Date.now();

    this.debug(`Performance measurement started: ${label}`);

    return () => {
      const duration = Date.now() - startTime;
      this.debug(`Performance measurement completed: ${label}`, { duration: `${duration}ms` });
      return duration;
    };
  }

  /**
   * 메모리 사용량 로그
   */
  logMemoryUsage() {
    const usage = process.memoryUsage();

    this.info('Memory usage', {
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`
    });
  }

  /**
   * 디버깅용 상태 반환
   */
  getState() {
    return {
      initialized: this._initialized,
      logsDir: this.logsDir,
      currentLogFile: this.currentLogFile,
      bufferSize: this.logBuffer.length,
      logLevel: this.logLevel
    };
  }
}

// 싱글톤 인스턴스 내보내기
module.exports = new LoggerService();