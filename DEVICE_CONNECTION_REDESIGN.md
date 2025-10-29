# Device Connection System Redesign

## 현재 상황
- ADB 연결만 지원
- DeviceService가 ADB에 종속적
- 모든 액션이 ADB 명령어 기반

## 목표
두 가지 연결 방식 지원:
1. **ADB**: Android 디바이스 (기존)
2. **ccNC**: Python automation_client.py 기반 (새로 추가)

## 주요 차이점

### ADB
```bash
# 화면 캡처
adb shell screencap -p /sdcard/screen.png
adb pull /sdcard/screen.png

# 터치
adb shell input tap x y

# 스와이프
adb shell input swipe x1 y1 x2 y2 duration

# 텍스트 입력
adb shell input text "hello"

# 키 입력
adb shell input keyevent KEYCODE_HOME
```

### ccNC (실제 확인된 명령어)
```bash
# 화면 캡처
python3 automation_client.py localhost 20000 --cmd capture --left 0 --top 0 --right 1920 --bottom 1080 --format png --output screen.png

# 터치 (간단)
python3 automation_client.py localhost 20000 --cmd touch-sim --x 100 --y 200

# 터치 (세밀한 제어)
python3 automation_client.py localhost 20000 --cmd touch --x 100 --y 200 --action press
python3 automation_client.py localhost 20000 --cmd touch --x 100 --y 200 --action release
python3 automation_client.py localhost 20000 --cmd touch --x 100 --y 200 --action move

# 반복 터치
python3 automation_client.py localhost 20000 --cmd touch-fast --x 100 --y 200 --repeat 5 --touch-delay 100

# 드래그 (스와이프)
python3 automation_client.py localhost 20000 --cmd drag --start-x 100 --start-y 200 --end-x 300 --end-y 400 --drag-time 1000

# 앱 실행
python3 automation_client.py localhost 20000 --cmd app-launch --app "AppName"

# UI 정보 가져오기
python3 automation_client.py localhost 20000 --cmd ui-layer-info
python3 automation_client.py localhost 20000 --cmd uic-info --uic-target avnt --uic-extraction foreground

# 기타
python3 automation_client.py localhost 20000 --cmd getversion
python3 automation_client.py localhost 20000 --cmd app-list
```

**참고:**
- 텍스트 입력은 지원하지 않음 (키보드 입력 별도 구현 필요 or 불가능)
- 키 입력 명령어 없음 (HOME, BACK 등 불가능 or 별도 방법 필요)
- monitor 파라미터로 다중 디스플레이 지원 (0x00=front, 0x01=cluster)

## 아키텍처 설계

### 1. Connection Type Enum
```javascript
const ConnectionType = {
  ADB: 'adb',
  CCNC: 'ccnc'
};
```

### 2. Device 데이터 구조 변경
```javascript
// Before
{
  id: '15fb4fb8',
  model: 'connect_s',
  status: 'connected',
  resolution: '2560x1440'
}

// After
{
  id: '15fb4fb8',
  connectionType: 'adb',  // or 'ccnc'
  name: 'Connect-S',
  status: 'connected',

  // Connection-specific info
  connectionInfo: {
    // For ADB
    model: 'connect_s',
    androidVersion: '14',
    // For ccNC
    host: 'localhost',
    port: 20000
  },

  // Screen info
  screen: {
    width: 2560,
    height: 1440,
    density: 160
  }
}
```

### 3. Service Layer - Strategy Pattern

#### BaseConnectionService (Abstract)
```javascript
class BaseConnectionService {
  constructor() {
    this.connectionType = null;
  }

  // Abstract methods - must be implemented by subclasses
  async connect() {
    throw new Error('connect() must be implemented');
  }

  async disconnect() {
    throw new Error('disconnect() must be implemented');
  }

  async captureScreen() {
    throw new Error('captureScreen() must be implemented');
  }

  async tap(x, y) {
    throw new Error('tap() must be implemented');
  }

  async swipe(x1, y1, x2, y2, duration) {
    throw new Error('swipe() must be implemented');
  }

  async input(text) {
    throw new Error('input() must be implemented');
  }

  async keyPress(keyCode) {
    throw new Error('keyPress() must be implemented');
  }
}
```

#### ADBConnectionService
```javascript
class ADBConnectionService extends BaseConnectionService {
  constructor() {
    super();
    this.connectionType = 'adb';
  }

  async connect(deviceId) {
    // Existing ADB connection logic
  }

  async captureScreen() {
    // adb shell screencap
  }

  async tap(x, y) {
    // adb shell input tap
  }

  // ... other methods
}
```

#### CCNCConnectionService
```javascript
class CCNCConnectionService extends BaseConnectionService {
  constructor() {
    super();
    this.connectionType = 'ccnc';
    this.host = null;
    this.port = null;
  }

  async connect(host, port) {
    this.host = host;
    this.port = port;

    // Test connection
    const result = await this.executeCommand('capture', {
      left: 0,
      top: 0,
      right: 100,
      height: 100
    });

    return result.success;
  }

  async executeCommand(cmd, params) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    // Build command
    let command = `python3 automation_client.py ${this.host} ${this.port} --cmd ${cmd}`;

    for (const [key, value] of Object.entries(params)) {
      command += ` --${key} ${value}`;
    }

    try {
      const { stdout, stderr } = await execPromise(command);
      return { success: true, data: stdout };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async captureScreen() {
    const fs = require('fs').promises;
    const path = require('path');
    const { app } = require('electron');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const documentsPath = app.getPath('documents');
    const screenshotsDir = path.join(documentsPath, 'VisionAuto', 'ccnc-screenshots');

    await fs.mkdir(screenshotsDir, { recursive: true });
    const outputPath = path.join(screenshotsDir, `screenshot_${timestamp}.png`);

    const result = await this.executeCommand('capture', {
      left: 0,
      top: 0,
      right: 1920,  // Should use device screen width
      bottom: 1080, // Should use device screen height
      format: 'png',
      output: outputPath
    });

    if (result.success) {
      return { success: true, path: outputPath };
    }
    return result;
  }

  async tap(x, y) {
    // Use touch-sim for simple tap (press + release)
    return await this.executeCommand('touch-sim', { x, y });
  }

  async swipe(x1, y1, x2, y2, duration) {
    // Use drag command for swipe
    return await this.executeCommand('drag', {
      'start-x': x1,
      'start-y': y1,
      'end-x': x2,
      'end-y': y2,
      'drag-time': duration || 500  // Default 500ms
    });
  }

  async input(text) {
    // ccNC does not support text input
    // This would need to be implemented differently (e.g., virtual keyboard)
    throw new Error('Text input not supported by ccNC connection');
  }

  async keyPress(keyCode) {
    // ccNC does not support key press
    // This would need to be implemented differently
    throw new Error('Key press not supported by ccNC connection');
  }
}
```

#### DeviceService (Refactored)
```javascript
class DeviceService {
  constructor() {
    this.devices = [];
    this.selectedDevice = null;
    this.connectionService = null;  // Current active connection
  }

  async listDevices() {
    const devices = [];

    // List ADB devices
    const adbDevices = await this.listADBDevices();
    devices.push(...adbDevices);

    // List ccNC devices (manual configuration)
    const ccncDevices = await this.listCCNCDevices();
    devices.push(...ccncDevices);

    this.devices = devices;
    return devices;
  }

  async listADBDevices() {
    // Existing ADB device listing
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    const { stdout } = await execPromise('adb devices');
    // Parse and return
  }

  async listCCNCDevices() {
    // Load from config or manual entry
    // For now, return configured ccNC connections
    const settings = require('./settings.service');
    return settings.getCCNCConnections() || [];
  }

  async selectDevice(deviceId) {
    const device = this.devices.find(d => d.id === deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    // Create appropriate connection service
    if (device.connectionType === 'adb') {
      this.connectionService = new ADBConnectionService();
      await this.connectionService.connect(device.id);
    } else if (device.connectionType === 'ccnc') {
      this.connectionService = new CCNCConnectionService();
      await this.connectionService.connect(
        device.connectionInfo.host,
        device.connectionInfo.port
      );
    }

    this.selectedDevice = device;
    return device;
  }

  // Delegate methods to current connection service
  async captureScreen() {
    if (!this.connectionService) {
      throw new Error('No device selected');
    }
    return await this.connectionService.captureScreen();
  }

  async tap(x, y) {
    if (!this.connectionService) {
      throw new Error('No device selected');
    }
    return await this.connectionService.tap(x, y);
  }

  async swipe(x1, y1, x2, y2, duration) {
    if (!this.connectionService) {
      throw new Error('No device selected');
    }
    return await this.connectionService.swipe(x1, y1, x2, y2, duration);
  }

  async input(text) {
    if (!this.connectionService) {
      throw new Error('No device selected');
    }
    return await this.connectionService.input(text);
  }

  async keyPress(keyCode) {
    if (!this.connectionService) {
      throw new Error('No device selected');
    }
    return await this.connectionService.keyPress(keyCode);
  }
}
```

### 4. UI Changes

#### Device Panel
```html
<!-- Before -->
<select id="device-select">
  <option value="15fb4fb8">Connect-S (15fb4fb8)</option>
</select>

<!-- After -->
<div class="device-panel">
  <!-- Connection Type Selector -->
  <div class="connection-type-selector">
    <button class="connection-type-btn active" data-type="adb">ADB</button>
    <button class="connection-type-btn" data-type="ccnc">ccNC</button>
  </div>

  <!-- Device List (filtered by connection type) -->
  <div class="device-list" id="adb-devices">
    <div class="device-item" data-device-id="15fb4fb8">
      <span class="device-icon">📱</span>
      <div class="device-info">
        <div class="device-name">Connect-S</div>
        <div class="device-detail">ADB • 15fb4fb8</div>
      </div>
      <button class="btn btn-sm">연결</button>
    </div>
  </div>

  <div class="device-list hidden" id="ccnc-devices">
    <div class="device-item" data-device-id="ccnc-1">
      <span class="device-icon">🖥️</span>
      <div class="device-info">
        <div class="device-name">Local Server</div>
        <div class="device-detail">ccNC • localhost:20000</div>
      </div>
      <button class="btn btn-sm">연결</button>
    </div>
    <button class="btn btn-sm btn-primary" onclick="ui.addCCNCDevice()">
      + ccNC 추가
    </button>
  </div>
</div>
```

#### ccNC 추가 모달
```html
<div class="modal" id="ccnc-modal">
  <div class="modal-content">
    <div class="modal-header">
      <h3>ccNC 연결 추가</h3>
      <button class="modal-close" onclick="ui.closeModal('ccnc-modal')">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>이름</label>
        <input type="text" id="ccnc-name" placeholder="예: Local PC">
      </div>
      <div class="form-group">
        <label>호스트</label>
        <input type="text" id="ccnc-host" value="localhost">
      </div>
      <div class="form-group">
        <label>포트</label>
        <input type="number" id="ccnc-port" value="20000">
      </div>
      <div class="form-group">
        <label>해상도</label>
        <div style="display: flex; gap: 8px;">
          <input type="number" id="ccnc-width" placeholder="1920" style="flex: 1;">
          <span>×</span>
          <input type="number" id="ccnc-height" placeholder="1080" style="flex: 1;">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="ui.closeModal('ccnc-modal')">취소</button>
      <button class="btn btn-primary" onclick="ui.confirmAddCCNC()">연결 테스트 및 추가</button>
    </div>
  </div>
</div>
```

### 5. Action Execution Changes

현재 액션 실행 코드는 변경 불필요! DeviceService가 connectionService로 위임하므로:

```javascript
// unified-app.js - executeAction()
async executeAction(action) {
  switch (action.type) {
    case 'tap':
      // This automatically uses the right connection service
      await window.api.action.tap(action.x, action.y);
      break;
    // ... other actions work the same way
  }
}
```

### 6. Settings Storage

#### settings.json 구조
```json
{
  "ccncConnections": [
    {
      "id": "ccnc-1",
      "name": "Local PC",
      "host": "localhost",
      "port": 20000,
      "width": 1920,
      "height": 1080
    },
    {
      "id": "ccnc-2",
      "name": "Remote Server",
      "host": "192.168.1.100",
      "port": 20000,
      "width": 2560,
      "height": 1440
    }
  ]
}
```

## 구현 순서

### Phase 1: Service Layer Refactoring
1. ✅ Create BaseConnectionService abstract class
2. ✅ Create ADBConnectionService (extract from DeviceService)
3. ✅ Create CCNCConnectionService
4. ✅ Refactor DeviceService to use strategy pattern
5. ✅ Update IPC handlers

### Phase 2: ccNC Implementation
1. ✅ Implement CCNCConnectionService methods
2. ✅ Test python3 automation_client.py commands
3. ✅ Add error handling and logging
4. ✅ Handle file paths for screenshots

### Phase 3: Settings Management
1. ✅ Add ccNC connection storage to SettingsService
2. ✅ Add/remove/edit ccNC connections
3. ✅ Persist to settings.json

### Phase 4: UI Changes
1. ✅ Add connection type selector
2. ✅ Update device list UI
3. ✅ Add ccNC add/edit modal
4. ✅ Update device info display

### Phase 5: Testing & Polish
1. Test ADB connections (ensure backward compatibility)
2. Test ccNC connections
3. Test switching between connection types
4. Add connection status indicators
5. Handle disconnection/reconnection

## 고려사항

### ccNC 명령어 확인 필요
현재 가정한 명령어들이 실제와 다를 수 있음:
- `--cmd click` vs `--cmd tap`
- `--cmd input` 파라미터 형식
- `--cmd key` 지원 여부 및 키코드 형식
- 실제 automation_client.py 도움말 확인 필요

### OS 의존성
- ccNC는 OS별로 키코드가 다를 수 있음
- Windows: VK_* codes
- macOS: NSEvent key codes
- Linux: X11 key codes

### 에러 처리
- ADB 연결 끊김 감지
- ccNC 서버 응답 없음
- Python 스크립트 실행 실패
- 네트워크 연결 문제

### 성능
- ccNC는 네트워크 기반이므로 지연 가능
- 스크린 캡처 속도 비교 필요
- 대량 액션 실행 시 병목 확인

## 마이그레이션 전략

### 기존 사용자
- 기존 매크로는 그대로 동작 (ADB 기본값)
- 설정 파일 자동 마이그레이션
- 첫 실행 시 연결 방식 선택 가이드

### 새 사용자
- 첫 실행 시 연결 방식 선택
- ADB 또는 ccNC 설정 마법사
- 예제 매크로 제공

## 추가 기능 아이디어

### 연결 프로필
- 여러 디바이스 프로필 저장
- 빠른 전환
- 프로필별 설정 (해상도, 지연시간 등)

### 혼합 사용
- 동시에 여러 디바이스 연결
- 디바이스별로 다른 매크로 실행
- 분산 처리

### 자동 감지
- ADB 디바이스 자동 감지 (현재 구현)
- ccNC 서버 자동 검색 (mDNS/Bonjour)
- LAN 내 디바이스 스캔
