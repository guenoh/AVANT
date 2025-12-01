/**
 * Action Service - 자동화 액션 실행
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const EventEmitter = require('events');

const execAsync = promisify(exec);

// Android 키 코드 상수
const KEY_CODES = {
  BACK: 4,
  HOME: 3,
  MENU: 82,
  POWER: 26,
  VOLUME_UP: 24,
  VOLUME_DOWN: 25,
  CAMERA: 27,
  SEARCH: 84,
  ENTER: 66,
  DEL: 67,
  TAB: 61,
  SPACE: 62,
  SHIFT: 59,
  CAPS_LOCK: 115,
  ESCAPE: 111,
  PAGE_UP: 92,
  PAGE_DOWN: 93,
  MOVE_HOME: 122,
  MOVE_END: 123,
  INSERT: 124
};

class ActionService extends EventEmitter {
  constructor() {
    super();
    this.deviceService = null;
    this.ccncService = null;
    this._initialized = false;
    this.executionHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * 서비스 초기화
   */
  async initialize(deviceService, ccncService = null) {
    if (this._initialized) return;

    this.deviceService = deviceService;
    this.ccncService = ccncService;
    this._initialized = true;
    console.log('Action service initialized');
  }

  /**
   * 서비스 정리
   */
  async cleanup() {
    this.executionHistory = [];
    this._initialized = false;
  }

  /**
   * ADB 명령 실행
   */
  async _execAdb(command) {
    if (!this.deviceService || !this.deviceService.currentDevice) {
      throw new Error('No device connected');
    }

    const adbPath = this.deviceService.adbPath;
    const deviceId = this.deviceService.currentDevice;
    const fullCommand = `${adbPath} -s ${deviceId} ${command}`;

    try {
      const { stdout, stderr } = await execAsync(fullCommand);

      if (stderr && !stderr.includes('Warning')) {
        console.warn(`ADB stderr: ${stderr}`);
      }

      return stdout.trim();
    } catch (error) {
      throw new Error(`Action failed: ${error.message}`);
    }
  }

  /**
   * 실행 기록 추가
   */
  _addToHistory(action) {
    this.executionHistory.push({
      ...action,
      timestamp: Date.now()
    });

    // 기록 크기 제한
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.shift();
    }
  }

  /**
   * 탭 액션 실행
   */
  async tap(x, y, duration = 100) {
    try {
      // 좌표 검증
      if (typeof x !== 'number' || typeof y !== 'number') {
        throw new Error('Invalid coordinates');
      }

      if (x < 0 || y < 0) {
        throw new Error('Coordinates must be positive');
      }

      // 탭 실행
      if (duration > 100) {
        // 롱 프레스
        await this._execAdb(`shell input swipe ${x} ${y} ${x} ${y} ${duration}`);
      } else {
        // 일반 탭
        await this._execAdb(`shell input tap ${x} ${y}`);
      }

      const action = {
        type: 'tap',
        x,
        y,
        duration
      };

      this._addToHistory(action);
      this.emit('action-executed', action);

      return { success: true };
    } catch (error) {
      console.error('Tap action failed:', error);
      throw error;
    }
  }

  /**
   * 스와이프 액션 실행
   */
  async swipe(x1, y1, x2, y2, duration = 300) {
    try {
      // 좌표 검증
      if (typeof x1 !== 'number' || typeof y1 !== 'number' ||
          typeof x2 !== 'number' || typeof y2 !== 'number') {
        throw new Error('Invalid coordinates');
      }

      if (x1 < 0 || y1 < 0 || x2 < 0 || y2 < 0) {
        throw new Error('Coordinates must be positive');
      }

      // 스와이프 실행
      await this._execAdb(`shell input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`);

      const action = {
        type: 'swipe',
        x1,
        y1,
        x2,
        y2,
        duration
      };

      this._addToHistory(action);
      this.emit('action-executed', action);

      return { success: true };
    } catch (error) {
      console.error('Swipe action failed:', error);
      throw error;
    }
  }

  /**
   * 롱 프레스 액션 실행
   */
  async longPress(x, y, duration = 1000) {
    try {
      // 좌표 검증
      if (typeof x !== 'number' || typeof y !== 'number') {
        throw new Error('Invalid coordinates');
      }

      if (x < 0 || y < 0) {
        throw new Error('Coordinates must be positive');
      }

      // 롱 프레스 실행 (스와이프를 같은 위치에서 실행)
      await this._execAdb(`shell input swipe ${x} ${y} ${x} ${y} ${duration}`);

      const action = {
        type: 'longPress',
        x,
        y,
        duration
      };

      this._addToHistory(action);
      this.emit('action-executed', action);

      return { success: true };
    } catch (error) {
      console.error('Long press action failed:', error);
      throw error;
    }
  }

  /**
   * 드래그 액션 실행
   */
  async drag(x1, y1, x2, y2, duration = 1000) {
    // 드래그는 긴 스와이프와 동일
    return this.swipe(x1, y1, x2, y2, duration);
  }

  /**
   * 핀치 줌 인/아웃 액션
   */
  async pinch(centerX, centerY, scale = 2, duration = 300) {
    try {
      const offset = 100; // 핀치 시작점 오프셋

      if (scale > 1) {
        // 줌 인 (핀치 아웃)
        const x1Start = centerX - offset;
        const y1Start = centerY - offset;
        const x1End = centerX - offset * scale;
        const y1End = centerY - offset * scale;

        const x2Start = centerX + offset;
        const y2Start = centerY + offset;
        const x2End = centerX + offset * scale;
        const y2End = centerY + offset * scale;

        // 두 손가락 동시 스와이프 시뮬레이션
        await Promise.all([
          this._execAdb(`shell input swipe ${x1Start} ${y1Start} ${x1End} ${y1End} ${duration}`),
          this._execAdb(`shell input swipe ${x2Start} ${y2Start} ${x2End} ${y2End} ${duration}`)
        ]);
      } else {
        // 줌 아웃 (핀치 인)
        const x1Start = centerX - offset * (1 / scale);
        const y1Start = centerY - offset * (1 / scale);
        const x1End = centerX - offset;
        const y1End = centerY - offset;

        const x2Start = centerX + offset * (1 / scale);
        const y2Start = centerY + offset * (1 / scale);
        const x2End = centerX + offset;
        const y2End = centerY + offset;

        await Promise.all([
          this._execAdb(`shell input swipe ${x1Start} ${y1Start} ${x1End} ${y1End} ${duration}`),
          this._execAdb(`shell input swipe ${x2Start} ${y2Start} ${x2End} ${y2End} ${duration}`)
        ]);
      }

      const action = {
        type: 'pinch',
        centerX,
        centerY,
        scale,
        duration
      };

      this._addToHistory(action);
      this.emit('action-executed', action);

      return { success: true };
    } catch (error) {
      console.error('Pinch action failed:', error);
      throw error;
    }
  }

  /**
   * 텍스트 입력 액션
   */
  async inputText(text) {
    try {
      // 텍스트 검증
      if (typeof text !== 'string') {
        throw new Error('Text must be a string');
      }

      // 특수 문자 이스케이프
      const escapedText = text
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'")
        .replace(/\$/g, '\\$')
        .replace(/`/g, '\\`')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/&/g, '\\&')
        .replace(/;/g, '\\;')
        .replace(/</g, '\\<')
        .replace(/>/g, '\\>')
        .replace(/\|/g, '\\|')
        .replace(/ /g, '%s'); // 공백을 %s로 변경

      // 텍스트 입력
      await this._execAdb(`shell input text "${escapedText}"`);

      const action = {
        type: 'inputText',
        text
      };

      this._addToHistory(action);
      this.emit('action-executed', action);

      return { success: true };
    } catch (error) {
      console.error('Text input failed:', error);
      throw error;
    }
  }

  /**
   * 텍스트 클리어
   */
  async clearText() {
    try {
      // 전체 선택
      await this.sendKey(KEY_CODES.MOVE_HOME);
      await this.sendKey(KEY_CODES.SHIFT, KEY_CODES.MOVE_END);

      // 삭제
      await this.sendKey(KEY_CODES.DEL);

      const action = {
        type: 'clearText'
      };

      this._addToHistory(action);
      this.emit('action-executed', action);

      return { success: true };
    } catch (error) {
      console.error('Clear text failed:', error);
      throw error;
    }
  }

  /**
   * 키 이벤트 전송
   */
  async sendKey(keyCode, metaState = 0) {
    try {
      // 키 코드 검증
      if (typeof keyCode === 'string') {
        keyCode = KEY_CODES[keyCode.toUpperCase()] || parseInt(keyCode);
      }

      if (typeof keyCode !== 'number') {
        throw new Error('Invalid key code');
      }

      // 키 이벤트 전송
      if (metaState) {
        await this._execAdb(`shell input keyevent --longpress ${keyCode}`);
      } else {
        await this._execAdb(`shell input keyevent ${keyCode}`);
      }

      const action = {
        type: 'sendKey',
        keyCode,
        metaState
      };

      this._addToHistory(action);
      this.emit('action-executed', action);

      return { success: true };
    } catch (error) {
      console.error('Send key failed:', error);
      throw error;
    }
  }

  /**
   * 홈 버튼
   */
  async pressHome() {
    return this.sendKey(KEY_CODES.HOME);
  }

  /**
   * 뒤로 버튼
   */
  async pressBack() {
    return this.sendKey(KEY_CODES.BACK);
  }

  /**
   * 메뉴 버튼
   */
  async pressMenu() {
    return this.sendKey(KEY_CODES.MENU);
  }

  /**
   * 엔터 키
   */
  async pressEnter() {
    return this.sendKey(KEY_CODES.ENTER);
  }

  /**
   * 스크롤 액션
   */
  async scroll(direction = 'down', amount = 300) {
    try {
      // Use ccNC if available and connected
      if (this.ccncService && this.ccncService.isConnected()) {
        await this.ccncService.scroll(direction, {
          distance: amount * 2, // ccNC uses larger distance
          duration: 300
        });
      } else {
        // Use ADB swipe for scroll
        // 화면 정보 가져오기 (screen service 필요)
        const centerX = 540; // 기본값 (1080 기준)
        const centerY = 960; // 기본값 (1920 기준)

        let x1 = centerX;
        let y1 = centerY;
        let x2 = centerX;
        let y2 = centerY;

        switch (direction) {
          case 'up':
            y1 = centerY + amount;
            y2 = centerY - amount;
            break;
          case 'down':
            y1 = centerY - amount;
            y2 = centerY + amount;
            break;
          case 'left':
            x1 = centerX + amount;
            x2 = centerX - amount;
            break;
          case 'right':
            x1 = centerX - amount;
            x2 = centerX + amount;
            break;
          default:
            throw new Error('Invalid scroll direction');
        }

        await this.swipe(x1, y1, x2, y2, 300);
      }

      const action = {
        type: 'scroll',
        direction,
        amount
      };

      this._addToHistory(action);

      return { success: true };
    } catch (error) {
      console.error('Scroll failed:', error);
      throw error;
    }
  }

  /**
   * 멀티 터치 액션
   */
  async multiTouch(touches) {
    try {
      // 여러 터치 포인트 동시 실행
      const promises = touches.map(touch => {
        if (touch.type === 'tap') {
          return this._execAdb(`shell input tap ${touch.x} ${touch.y}`);
        } else if (touch.type === 'swipe') {
          return this._execAdb(
            `shell input swipe ${touch.x1} ${touch.y1} ${touch.x2} ${touch.y2} ${touch.duration || 300}`
          );
        }
      });

      await Promise.all(promises);

      const action = {
        type: 'multiTouch',
        touches
      };

      this._addToHistory(action);
      this.emit('action-executed', action);

      return { success: true };
    } catch (error) {
      console.error('Multi-touch failed:', error);
      throw error;
    }
  }

  /**
   * 제스처 실행
   */
  async executeGesture(gesturePath) {
    try {
      // 제스처 경로를 따라 스와이프
      if (!Array.isArray(gesturePath) || gesturePath.length < 2) {
        throw new Error('Invalid gesture path');
      }

      let command = 'shell input swipe';

      for (const point of gesturePath) {
        command += ` ${point.x} ${point.y}`;
      }

      command += ' 500'; // 기본 지속 시간

      await this._execAdb(command);

      const action = {
        type: 'gesture',
        path: gesturePath
      };

      this._addToHistory(action);
      this.emit('action-executed', action);

      return { success: true };
    } catch (error) {
      console.error('Gesture execution failed:', error);
      throw error;
    }
  }

  /**
   * 실행 기록 가져오기
   */
  getHistory(limit = 10) {
    return this.executionHistory.slice(-limit);
  }

  /**
   * 실행 기록 클리어
   */
  clearHistory() {
    this.executionHistory = [];
    return true;
  }

  /**
   * 마지막 액션 반복
   */
  async repeatLastAction() {
    if (this.executionHistory.length === 0) {
      throw new Error('No action to repeat');
    }

    const lastAction = this.executionHistory[this.executionHistory.length - 1];

    switch (lastAction.type) {
      case 'tap':
        return this.tap(lastAction.x, lastAction.y, lastAction.duration);
      case 'swipe':
        return this.swipe(lastAction.x1, lastAction.y1, lastAction.x2, lastAction.y2, lastAction.duration);
      case 'inputText':
        return this.inputText(lastAction.text);
      case 'sendKey':
        return this.sendKey(lastAction.keyCode, lastAction.metaState);
      default:
        throw new Error(`Cannot repeat action type: ${lastAction.type}`);
    }
  }

  /**
   * Get device volume level using logcat
   * Returns volume as raw value (0-45 typically)
   */
  async getVolume(action) {
    try {
      // Clear logcat buffer to ignore old logs
      await this._execAdb('logcat -c');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger volume info by toggling mute (doesn't change volume level)
      await this._execAdb('shell input keyevent KEYCODE_VOLUME_MUTE');
      await new Promise(resolve => setTimeout(resolve, 200));
      await this._execAdb('shell input keyevent KEYCODE_VOLUME_MUTE');
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get only recent logs (after clearing buffer)
      const logcatOutput = await this._execAdb('shell "logcat -d | grep currentVolume"');

      // Get currentVolume from OsdVolumeView
      const osdVolumeMatches = logcatOutput.match(/currentVolume= (\d+)/g);

      if (!osdVolumeMatches || osdVolumeMatches.length === 0) {
        throw new Error('Could not parse volume from logcat');
      }

      // Get the last volume value (most recent)
      const lastVolumeMatch = osdVolumeMatches[osdVolumeMatches.length - 1].match(/currentVolume= (\d+)/);
      const currentVolume = parseInt(lastVolumeMatch[1], 10);

      this._addToHistory({
        type: 'get-volume',
        volume: currentVolume
      });

      this.emit('action-executed', {
        type: 'get-volume',
        volume: currentVolume
      });

      return {
        success: true,
        volume: currentVolume,
        raw: currentVolume
      };
    } catch (error) {
      console.error('Get volume failed:', error);
      throw error;
    }
  }

  /**
   * Single action execution (for IPC handler)
   */
  async execute(action) {
    if (!this._initialized) {
      throw new Error('Action service not initialized');
    }

    switch (action.type) {
      case 'tap':
        return await this.tap(action.x, action.y, action.duration);
      case 'swipe':
        return await this.swipe(action.x1, action.y1, action.x2, action.y2, action.duration);
      case 'scroll':
        return await this.scroll(action.direction, action.amount);
      case 'input':
        return await this.inputText(action.text);
      case 'key':
        return await this.sendKey(action.keycode || action.keyCode);
      case 'wait':
        await new Promise(resolve => setTimeout(resolve, action.delay || 1000));
        return { success: true };
      case 'sound-check':
        // Sound check is handled by the renderer process via IPC
        // This is just a placeholder that returns success
        // The actual sound check will be performed by the AudioService in main process
        return { success: true, message: 'Sound check action triggered' };
      case 'get-volume':
        return await this.getVolume(action);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Batch action execution (for IPC handler)
   */
  async executeBatch(actions) {
    const results = [];
    for (const action of actions) {
      const result = await this.execute(action);
      results.push(result);
    }
    return results;
  }

  /**
   * 디버깅용 상태 반환
   */
  getState() {
    return {
      initialized: this._initialized,
      historySize: this.executionHistory.length,
      lastAction: this.executionHistory[this.executionHistory.length - 1] || null
    };
  }
}

// 싱글톤 인스턴스 내보내기
module.exports = new ActionService();