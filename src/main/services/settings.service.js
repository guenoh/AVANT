/**
 * Settings Service - 애플리케이션 설정 관리
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

// 기본 설정
const DEFAULT_SETTINGS = {
  // 일반 설정
  general: {
    language: 'ko',
    theme: 'light',
    autoStart: false,
    minimizeToTray: true,
    checkUpdates: true
  },

  // 디바이스 설정
  device: {
    autoConnect: true,
    lastDevice: null,
    wirelessEnabled: false,
    adbPath: 'adb'
  },

  // 화면 설정
  screen: {
    streamQuality: 'high',
    maxFps: 30,
    recordQuality: 'high',
    screenshotFormat: 'png',
    saveLocation: path.join(app.getPath('pictures'), 'VisionAuto')
  },

  // 액션 설정
  action: {
    defaultTapDuration: 100,
    defaultSwipeDuration: 300,
    defaultLongPressDuration: 1000,
    actionDelay: 100,
    enableHapticFeedback: false
  },

  // 매크로 설정
  macro: {
    autoSave: true,
    autoSaveInterval: 300000, // 5분
    maxHistorySize: 50,
    defaultStopOnError: true,
    enableShortcuts: true,
    backupEnabled: true,
    backupInterval: 86400000 // 24시간
  },

  // UI 설정
  ui: {
    showDeviceFrame: true,
    showCoordinates: true,
    showActionOverlay: true,
    highlightDuration: 500,
    gridEnabled: false,
    gridSize: 50
  },

  // 고급 설정
  advanced: {
    debugMode: false,
    logLevel: 'info',
    maxLogFiles: 10,
    enableAnalytics: false,
    experimentalFeatures: false
  },

  // 단축키 설정
  shortcuts: {
    startRecording: 'Ctrl+Shift+R',
    stopRecording: 'Ctrl+Shift+S',
    runMacro: 'Ctrl+Shift+Space',
    pauseMacro: 'Ctrl+Shift+P',
    takeScreenshot: 'Ctrl+Shift+C',
    toggleStream: 'Ctrl+Shift+V'
  }
};

class SettingsService extends EventEmitter {
  constructor() {
    super();
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
    this.settings = null;
    this._initialized = false;
  }

  /**
   * 서비스 초기화
   */
  async initialize() {
    if (this._initialized) return;

    try {
      await this.loadSettings();
      this._initialized = true;
      console.log('Settings service initialized');
    } catch (error) {
      console.error('Failed to initialize settings service:', error);
      throw error;
    }
  }

  /**
   * 서비스 정리
   */
  async cleanup() {
    if (this.settings) {
      await this.saveSettings();
    }
    this._initialized = false;
  }

  /**
   * 설정 로드
   */
  async loadSettings() {
    try {
      const data = await fs.readFile(this.settingsPath, 'utf8');
      const loadedSettings = JSON.parse(data);

      // 기본 설정과 병합 (새로운 설정 항목 추가 시 대비)
      this.settings = this._mergeSettings(DEFAULT_SETTINGS, loadedSettings);
    } catch (error) {
      // 설정 파일이 없으면 기본 설정 사용
      console.log('No settings file found, using defaults');
      this.settings = { ...DEFAULT_SETTINGS };
      await this.saveSettings();
    }
  }

  /**
   * 설정 저장
   */
  async saveSettings() {
    try {
      await fs.writeFile(
        this.settingsPath,
        JSON.stringify(this.settings, null, 2)
      );

      this.emit('settings-saved', this.settings);
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * 설정 병합 (재귀적)
   */
  _mergeSettings(defaults, loaded) {
    const merged = { ...defaults };

    for (const key in loaded) {
      if (loaded.hasOwnProperty(key)) {
        if (typeof loaded[key] === 'object' && !Array.isArray(loaded[key]) && loaded[key] !== null) {
          // 객체인 경우 재귀적으로 병합
          merged[key] = this._mergeSettings(defaults[key] || {}, loaded[key]);
        } else {
          // 값이면 덮어쓰기
          merged[key] = loaded[key];
        }
      }
    }

    return merged;
  }

  /**
   * 모든 설정 가져오기
   */
  async getAll() {
    if (!this.settings) {
      await this.loadSettings();
    }
    return { ...this.settings };
  }

  /**
   * 카테고리별 설정 가져오기
   */
  async getCategory(category) {
    if (!this.settings) {
      await this.loadSettings();
    }
    return this.settings[category] ? { ...this.settings[category] } : null;
  }

  /**
   * 특정 설정 값 가져오기
   */
  async get(path) {
    if (!this.settings) {
      await this.loadSettings();
    }

    const keys = path.split('.');
    let value = this.settings;

    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * 설정 업데이트
   */
  async update(updates) {
    if (!this.settings) {
      await this.loadSettings();
    }

    // 재귀적으로 업데이트 적용
    this.settings = this._mergeSettings(this.settings, updates);

    await this.saveSettings();

    // 변경 사항 알림
    for (const category in updates) {
      this.emit('settings-changed', {
        category,
        settings: updates[category]
      });
    }

    return this.settings;
  }

  /**
   * 특정 설정 값 설정
   */
  async set(path, value) {
    if (!this.settings) {
      await this.loadSettings();
    }

    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = this.settings;

    for (const key of keys) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }

    const oldValue = target[lastKey];
    target[lastKey] = value;

    await this.saveSettings();

    // 변경 사항 알림
    this.emit('setting-changed', {
      path,
      oldValue,
      newValue: value
    });

    return value;
  }

  /**
   * 설정 초기화
   */
  async reset(category = null) {
    if (!this.settings) {
      await this.loadSettings();
    }

    if (category) {
      // 특정 카테고리만 초기화
      if (DEFAULT_SETTINGS[category]) {
        this.settings[category] = { ...DEFAULT_SETTINGS[category] };
      }
    } else {
      // 전체 초기화
      this.settings = { ...DEFAULT_SETTINGS };
    }

    await this.saveSettings();

    this.emit('settings-reset', category);

    return this.settings;
  }

  /**
   * 설정 내보내기
   */
  async exportSettings(exportPath) {
    if (!this.settings) {
      await this.loadSettings();
    }

    const exportData = {
      version: '2.0.0',
      exported: new Date().toISOString(),
      settings: this.settings
    };

    await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));

    return exportPath;
  }

  /**
   * 설정 가져오기
   */
  async importSettings(importPath) {
    try {
      const data = await fs.readFile(importPath, 'utf8');
      const importData = JSON.parse(data);

      if (!importData.version || !importData.settings) {
        throw new Error('Invalid settings file format');
      }

      // 가져온 설정을 기본 설정과 병합
      this.settings = this._mergeSettings(DEFAULT_SETTINGS, importData.settings);

      await this.saveSettings();

      this.emit('settings-imported');

      return this.settings;
    } catch (error) {
      console.error('Failed to import settings:', error);
      throw error;
    }
  }

  /**
   * 설정 검증
   */
  validateSettings(settings) {
    const errors = [];

    // 언어 검증
    if (settings.general?.language) {
      const validLanguages = ['ko', 'en', 'ja', 'zh'];
      if (!validLanguages.includes(settings.general.language)) {
        errors.push('Invalid language setting');
      }
    }

    // 테마 검증
    if (settings.general?.theme) {
      const validThemes = ['light', 'dark', 'auto'];
      if (!validThemes.includes(settings.general.theme)) {
        errors.push('Invalid theme setting');
      }
    }

    // 품질 설정 검증
    if (settings.screen?.streamQuality) {
      const validQualities = ['low', 'medium', 'high'];
      if (!validQualities.includes(settings.screen.streamQuality)) {
        errors.push('Invalid stream quality setting');
      }
    }

    // FPS 검증
    if (settings.screen?.maxFps) {
      if (settings.screen.maxFps < 1 || settings.screen.maxFps > 60) {
        errors.push('FPS must be between 1 and 60');
      }
    }

    // 지속 시간 검증
    if (settings.action?.defaultTapDuration) {
      if (settings.action.defaultTapDuration < 0) {
        errors.push('Tap duration must be positive');
      }
    }

    return errors.length === 0 ? null : errors;
  }

  /**
   * 설정 마이그레이션
   */
  async migrateSettings(oldVersion, newVersion) {
    // 버전별 마이그레이션 로직
    if (oldVersion === '1.0.0' && newVersion === '2.0.0') {
      // 1.0.0에서 2.0.0으로 마이그레이션
      if (this.settings.device) {
        // 새로운 필드 추가
        this.settings.device.adbPath = this.settings.device.adbPath || 'adb';
      }

      await this.saveSettings();
    }
  }

  /**
   * 디버깅용 상태 반환
   */
  getState() {
    return {
      initialized: this._initialized,
      settingsPath: this.settingsPath,
      hasSettings: !!this.settings,
      categories: this.settings ? Object.keys(this.settings) : []
    };
  }
}

// 싱글톤 인스턴스 내보내기
module.exports = new SettingsService();