/**
 * Unified App - 통합 레이아웃 애플리케이션
 */

class UnifiedApp {
  constructor() {
    this.state = {
      selectedDevice: null,
      connectionType: 'adb',
      isStreaming: false,
      isRecording: false,
      isMacroRecording: false,
      isClickMode: false,
      clickModeType: null,
      clickModePoints: [],
      currentExecutingActionIndex: -1,
      actions: [],
      macros: [],
      logs: [],
      streamStats: {
        fps: 0,
        latency: 0
      },
      isEditMode: false,
      selectedMacro: null
    };

    this.canvas = null;
    this.ctx = null;
    this.streamInterval = null;
    this.fpsCounter = 0;
    this.lastFpsUpdate = Date.now();

    // Initialize new architecture components
    this.deviceStore = window.DeviceStore;
    this.screenStore = window.ScreenStore;
    this.macroStore = window.MacroStore;
    this.actionStore = window.ActionStore;
    this.ipcService = window.IPCService;
    this.eventBus = window.EventBus;
    this.devicePanel = null; // Will be initialized in init()
    this.screenPanel = null; // Will be initialized in init()
    this.macroPanel = null; // Will be initialized in init()
    this.actionPanel = null; // Will be initialized in init()

    this.init();
  }

  async init() {
    // Canvas 초기화
    this.canvas = document.getElementById('screen-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    // Initialize DevicePanel
    this.devicePanel = new window.DevicePanel(window.api, this.deviceStore);
    this.devicePanel.init();

    // Initialize ScreenPanel
    this.screenPanel = new window.ScreenPanel(window.api, this.screenStore, this.canvas);
    this.screenPanel.init();

    // Initialize MacroPanel
    this.macroPanel = new window.MacroPanel(window.api, this.macroStore, this.actionStore);
    this.macroPanel.init();

    // Initialize ActionPanel
    this.actionPanel = new window.ActionPanel(window.api, this.actionStore, this.screenPanel);
    this.actionPanel.init();

    // Subscribe to panel events
    this._setupDevicePanelListeners();
    this._setupScreenPanelListeners();
    this._setupMacroPanelListeners();
    this._setupActionPanelListeners();

    // 초기 디바이스 목록 로드
    await this.scanDevices();

    // 이벤트 리스너 설정
    this.setupEventListeners();

    // IPC 이벤트 리스너 설정
    this.setupIPCListeners();

    // 탭 기능 설정
    this.setupTabs();

    // FPS 슬라이더 설정
    this.setupFpsSlider();

    // 로그 필터 설정
    this.setupLogFilter();

    // 저장된 매크로 로드
    await this.loadMacro();

    // Edit mode indicator 초기 상태 확인
    this.hideEditMode();

    this.log('Vision Auto v2 시작됨', 'info');
  }

  /**
   * Setup listeners for DevicePanel events
   */
  _setupDevicePanelListeners() {
    // Device connected event
    document.addEventListener('device-panel:device-connected', (e) => {
      const { type, device, version } = e.detail;
      this.log(`디바이스 연결됨: ${type} ${version || ''}`, 'success');

      // Update internal state
      const deviceInfo = this.deviceStore.get('selectedDevice');
      this.state.selectedDevice = deviceInfo;

      // Enable streaming/recording buttons
      this._updateUIAfterConnection(true);
    });

    // Device disconnected event
    document.addEventListener('device-panel:device-disconnected', () => {
      this.log('디바이스 연결 해제', 'info');

      // Update internal state
      this.state.selectedDevice = null;

      // Disable streaming/recording buttons
      this._updateUIAfterConnection(false);
    });

    // Devices scanned event
    document.addEventListener('device-panel:devices-scanned', (e) => {
      const { count } = e.detail;
      this.log(`${count}개의 디바이스 발견`, 'info');
    });

    // Connection attempt event (for ccNC retries)
    document.addEventListener('device-panel:connection-attempt', (e) => {
      const { attempt, maxRetries, host, port } = e.detail;
      this.log(`연결 시도 ${attempt}/${maxRetries}: ${host}:${port}`, 'info');
    });
  }

  /**
   * Update UI after device connection/disconnection
   */
  _updateUIAfterConnection(connected) {
    const streamBtn = document.getElementById('stream-btn');
    const recordBtn = document.getElementById('record-btn');

    if (streamBtn) streamBtn.disabled = !connected;
    if (recordBtn) recordBtn.disabled = !connected;
  }

  /**
   * Setup listeners for ScreenPanel events
   */
  _setupScreenPanelListeners() {
    // Screenshot events
    document.addEventListener('screen-panel:screenshot-success', (e) => {
      this.log('스크린샷 캡처 완료', 'success');
    });

    document.addEventListener('screen-panel:screenshot-error', (e) => {
      this.log(`스크린샷 실패: ${e.detail.error}`, 'error');
    });

    // Streaming events
    document.addEventListener('screen-panel:stream-started', (e) => {
      const { fps } = e.detail;
      this.log(`스트리밍 시작: ${fps} FPS`, 'success');
    });

    document.addEventListener('screen-panel:stream-stopped', () => {
      this.log('스트리밍 중지', 'info');
    });

    document.addEventListener('screen-panel:stream-error', (e) => {
      this.log(`스트리밍 오류: ${e.detail.error}`, 'error');
    });

    // Recording events
    document.addEventListener('screen-panel:recording-started', () => {
      this.log('화면 녹화 시작', 'success');
    });

    document.addEventListener('screen-panel:recording-stopped', (e) => {
      const { path, duration } = e.detail;
      this.log(`녹화 완료: ${path} (${duration}초)`, 'success');
    });

    document.addEventListener('screen-panel:recording-error', (e) => {
      this.log(`녹화 오류: ${e.detail.error}`, 'error');
    });
  }

  /**
   * Setup listeners for MacroPanel events
   */
  _setupMacroPanelListeners() {
    // Macro loaded
    document.addEventListener('macro-panel:macros-loaded', (e) => {
      this.log(`${e.detail.count}개의 매크로 로드됨`, 'info');
    });

    // Macro saved
    document.addEventListener('macro-panel:macro-saved', (e) => {
      this.log(`매크로 저장됨: ${e.detail.macro.name}`, 'success');
    });

    // Macro run
    document.addEventListener('macro-panel:macro-run-start', (e) => {
      this.log(`매크로 실행: ${e.detail.name}`, 'info');
    });

    document.addEventListener('macro-panel:macro-run-success', (e) => {
      this.log('매크로 실행 완료', 'success');
    });

    document.addEventListener('macro-panel:macro-run-error', (e) => {
      this.log(`매크로 실행 실패: ${e.detail.error}`, 'error');
    });

    // Macro deleted
    document.addEventListener('macro-panel:macro-deleted', (e) => {
      this.log('매크로 삭제됨', 'info');
    });

    // Edit mode
    document.addEventListener('macro-panel:macro-edit-start', (e) => {
      this.log(`매크로 편집 시작: ${e.detail.name}`, 'info');
    });
  }

  /**
   * Setup listeners for ActionPanel events
   */
  _setupActionPanelListeners() {
    // Action added
    document.addEventListener('action-panel:action-added', (e) => {
      this.log(`액션 추가됨: ${e.detail.action.type}`, 'info');
    });

    // Actions run
    document.addEventListener('action-panel:run-start', (e) => {
      this.log(`${e.detail.count}개 액션 실행 시작`, 'info');
    });

    document.addEventListener('action-panel:run-complete', (e) => {
      this.log('액션 실행 완료', 'success');
    });

    document.addEventListener('action-panel:run-error', (e) => {
      this.log(`액션 실행 오류: ${e.detail.error}`, 'error');
    });

    // Recording
    document.addEventListener('action-panel:recording-started', () => {
      this.log('액션 녹화 시작', 'info');
    });

    document.addEventListener('action-panel:recording-stopped', () => {
      this.log('액션 녹화 중지', 'info');
    });

    // Click mode
    document.addEventListener('action-panel:click-mode-entered', (e) => {
      this.log(`클릭 모드: ${e.detail.type}`, 'info');
    });
  }

  setupEventListeners() {
    // 전역 UI 객체로 메서드 노출
    window.ui = {
      // Delegate device methods to DevicePanel
      scanDevices: () => this.devicePanel.scanDevices(),
      connectADB: () => this.devicePanel.connectADB(),
      connectCCNC: () => this.devicePanel.connectCCNC(),
      disconnectDevice: () => this.devicePanel.disconnect(),
      onProtocolChange: (protocol) => this.devicePanel._onProtocolChange(protocol),

      // Keep legacy methods for backwards compatibility
      wirelessConnect: () => this.wirelessConnect(),
      connectDevice: (deviceId) => this.connectDevice(deviceId),
      connectSelectedDevice: () => this.connectSelectedDevice(),
      onConnectionTypeChange: (type) => this.onConnectionTypeChange(type),

      // Delegate screen methods to ScreenPanel
      takeScreenshot: () => this.screenPanel.takeScreenshot(),
      toggleStream: () => this.screenPanel.toggleStream(),
      toggleRecord: () => this.screenPanel.toggleRecord(),

      // Other UI methods
      toggleSettings: () => this.toggleSettings(),
      quickAction: (action) => this.quickAction(action),
      createNewMacro: () => this.createNewMacro(),
      toggleTrackingOverlay: () => this.toggleTrackingOverlay(),

      // Delegate action methods to ActionPanel
      addAction: (type) => this.actionPanel.addAction(type),
      addScrollAction: (direction) => this.actionPanel.addScrollAction(direction),
      removeAction: (index) => this.actionPanel.removeAction(index),
      clearActions: () => this.actionPanel.clearActions(),
      runActions: () => this.actionPanel.runActions(),

      // Delegate macro methods to MacroPanel
      loadMacro: () => this.macroPanel.loadMacros(),
      saveMacro: () => this.macroPanel.saveMacro(),
      runMacro: () => this.runSelectedMacro(),
      runMacroById: (macroId) => this.macroPanel.runMacro(macroId),
      editMacro: () => this.editSelectedMacro(),
      editMacroById: (macroId) => this.macroPanel.editMacro(macroId),
      deleteMacro: () => this.deleteSelectedMacro(),
      deleteMacroById: (macroId) => this.macroPanel.deleteMacro(macroId),
      runSelectedMacros: () => this.macroPanel.runSelectedMacros(),
      deleteSelectedMacros: () => this.macroPanel.deleteSelectedMacros(),
      toggleSelectAll: () => this.macroPanel.toggleSelectAll(),
      updateSelectAllState: () => this.updateSelectAllState(),
      runSelectedMacros: () => this.runSelectedMacros(),
      deleteSelectedMacros: () => this.deleteSelectedMacros(),
      cancelEdit: () => this.cancelEdit(),
      startRecording: () => this.startMacroRecording(),
      stopRecording: () => this.stopMacroRecording(),
      clearLogs: () => this.clearLogs(),
      toggleQuickPanel: () => this.toggleQuickPanel(),
      closeModal: (modalId) => this.closeModal(modalId),
      confirmCreateMacro: () => this.confirmCreateMacro(),
      confirmAddAction: () => this.confirmAddAction(),
      cancelEditLabel: () => this.cancelEditLabel(),
      confirmEditLabel: () => this.confirmEditLabel(),
      confirmImageMatch: () => this.confirmImageMatch(),
      autoCropBackground: () => this.autoCropBackground(),
      resetCrop: () => this.resetCrop()
    };
  }

  setupIPCListeners() {
    if (window.api) {
      // 디바이스 상태 변경 리스너
      if (window.api.device && window.api.device.onStatus) {
        window.api.device.onStatus((statusData) => {
          // Main process sends: {status: 'connected', device: {...}}
          if (statusData.status === 'connected' && statusData.device) {
            this.updateDeviceStatus(statusData.device, true);
            this.log(`디바이스 연결: ${statusData.device.model || statusData.device.id}`, 'info');
          } else if (statusData.status === 'disconnected') {
            this.updateDeviceStatus(null, false);
            this.log('디바이스 연결 해제', 'warning');
          }
        });
      }

      // 스트리밍 데이터 리스너
      if (window.api.screen && window.api.screen.onStreamData) {
        window.api.screen.onStreamData((frameData) => {
          this.renderFrame(frameData);
        });
      }

      // 시스템 로그 리스너
      if (window.api.logs && window.api.logs.onLog) {
        window.api.logs.onLog((logData) => {
          this.log(logData.message, logData.level);
        });
      }
    }
  }

  setupTabs() {
    const tabs = document.querySelectorAll('.mini-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Action category tabs
    const actionTabs = document.querySelectorAll('.action-tab');
    actionTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Remove active from all tabs
        actionTabs.forEach(t => t.classList.remove('active'));
        // Add active to clicked tab
        tab.classList.add('active');

        // Show corresponding content
        const category = tab.dataset.category;
        document.querySelectorAll('.action-category-content').forEach(content => {
          content.classList.remove('active');
        });
        const targetContent = document.querySelector(`.action-category-content[data-category="${category}"]`);
        if (targetContent) {
          targetContent.classList.add('active');
        }
      });
    });
  }

  switchTab(tabName) {
    // 모든 탭 비활성화
    const tabs = document.querySelectorAll('.mini-tab');
    tabs.forEach(t => t.classList.remove('active'));

    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });

    // 선택한 탭 활성화
    const selectedTab = document.querySelector(`.mini-tab[data-tab="${tabName}"]`);
    if (selectedTab) {
      selectedTab.classList.add('active');
    }

    const tabContent = document.getElementById(`${tabName}-tab`);
    if (tabContent) {
      tabContent.classList.remove('hidden');
    }
  }

  setupFpsSlider() {
    // FPS slider removed with quick settings panel
    // Using default FPS of 30
  }

  setupLogFilter() {
    const logLevel = document.getElementById('log-level');
    if (logLevel) {
      logLevel.addEventListener('change', (e) => {
        this.filterLogs(e.target.value);
      });
    }
  }

  // 디바이스 관리
  async scanDevices() {
    try {
      this.log('디바이스 검색 중...', 'info');

      if (!window.api) {
        throw new Error('API가 초기화되지 않았습니다');
      }

      const result = await window.api.device.list();

      // API 응답이 {success: true, devices: [...]} 형태인 경우 처리
      let devices = [];
      if (result && result.success && Array.isArray(result.devices)) {
        devices = result.devices;
      } else if (Array.isArray(result)) {
        devices = result;
      }

      // Store devices in state for later use
      this.state.devices = devices;

      this.displayDevices(devices);

      if (devices.length === 0) {
        this.log('연결된 디바이스가 없습니다', 'warning');
      } else {
        this.log(`${devices.length}개의 디바이스 발견`, 'info');
      }
    } catch (error) {
      console.error('디바이스 검색 오류:', error);
      this.log(`디바이스 검색 실패: ${error.message}`, 'error');
    }
  }

  displayDevices(devices) {
    // Try new design first (select dropdown)
    const select = document.getElementById('adb-device-list');
    if (select) {
      select.innerHTML = '<option value="">장치를 선택하세요</option>';

      devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.id;
        option.textContent = `${device.model || 'Unknown'} (${device.id})`;
        select.appendChild(option);
      });
      return;
    }

    // Fallback to old design (inline list)
    const deviceList = document.getElementById('device-list-mini');
    if (!deviceList) return;

    deviceList.innerHTML = '';

    if (devices.length === 0) {
      deviceList.innerHTML = '<div class="empty-state">연결된 디바이스 없음</div>';
      return;
    }

    devices.forEach(device => {
      const deviceItem = document.createElement('div');
      deviceItem.className = 'device-item-mini';
      deviceItem.dataset.deviceId = device.id;
      deviceItem.innerHTML = `
        <div class="device-info">
          <span class="device-name">${device.model || 'Unknown'}</span>
          <span class="device-id">${device.id}</span>
        </div>
        <button class="btn btn-sm btn-primary device-connect-btn" onclick="ui.connectDevice('${device.id}'); event.stopPropagation();">연결</button>
      `;

      deviceItem.addEventListener('click', (e) => {
        if (!e.target.classList.contains('device-connect-btn')) {
          this.selectDevice(device, e.currentTarget);
        }
      });
      deviceList.appendChild(deviceItem);
    });
  }

  async selectDevice(device, clickedElement) {
    try {
      if (!window.api) {
        throw new Error('API가 초기화되지 않았습니다');
      }

      this.state.selectedDevice = device;

      // UI 업데이트
      document.querySelectorAll('.device-item-mini').forEach(item => {
        item.classList.remove('selected');
      });
      if (clickedElement) {
        clickedElement.classList.add('selected');
      }

      // 디바이스 정보 표시
      this.showDeviceInfo(device);

      this.log(`디바이스 선택: ${device.model || device.id}`, 'info');
    } catch (error) {
      console.error('디바이스 선택 오류:', error);
      this.log(`디바이스 선택 실패: ${error.message}`, 'error');
    }
  }

  async connectDevice(deviceId) {
    try {
      if (!window.api) {
        throw new Error('API가 초기화되지 않았습니다');
      }

      // Find device in current state
      const device = this.state.devices?.find(d => d.id === deviceId);
      if (!device) {
        this.log('디바이스를 찾을 수 없습니다', 'error');
        return;
      }

      // Select device (this already calls getDeviceInfo in the backend)
      const response = await window.api.device.select(deviceId);

      // Extract device info from response
      const deviceWithInfo = response.success ? (response.device || response.info || response) : null;

      if (!deviceWithInfo) {
        throw new Error('디바이스 정보를 가져올 수 없습니다');
      }

      this.state.selectedDevice = deviceWithInfo;

      // Update button text to show connected
      const deviceItems = document.querySelectorAll('.device-item-mini');
      deviceItems.forEach(item => {
        if (item.dataset.deviceId === deviceId) {
          const btn = item.querySelector('.device-connect-btn');
          if (btn) {
            btn.textContent = '연결됨';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-success');
            btn.disabled = true;
          }
        } else {
          // Reset other buttons
          const btn = item.querySelector('.device-connect-btn');
          if (btn) {
            btn.textContent = '연결';
            btn.classList.add('btn-primary');
            btn.classList.remove('btn-success');
            btn.disabled = false;
          }
        }
      });

      // Show device info
      this.showDeviceInfo(deviceWithInfo);

      // Enable streaming button
      const streamBtn = document.getElementById('btn-stream');
      if (streamBtn) {
        streamBtn.disabled = false;
      }

      this.log(`디바이스 연결 완료: ${device.model || device.id}`, 'info');
    } catch (error) {
      console.error('디바이스 연결 오류:', error);
      this.log(`디바이스 연결 실패: ${error.message}`, 'error');
    }
  }

  showDeviceInfo(device) {
    const infoPanel = document.getElementById('device-info-mini');
    if (!infoPanel) {
      return;
    }

    infoPanel.classList.remove('hidden');

    const modelEl = document.getElementById('info-model');
    const androidEl = document.getElementById('info-android');
    const resolutionEl = document.getElementById('info-resolution');
    const batteryEl = document.getElementById('info-battery');

    if (modelEl) {
      modelEl.textContent = device.model || device.device || 'Unknown';
    }

    if (androidEl) {
      androidEl.textContent = device.androidVersion || device.android || device.version || '-';
    }

    if (resolutionEl) {
      resolutionEl.textContent = device.resolution || device.screen || '-';
    }

    if (batteryEl) {
      const battery = device.battery || device.batteryLevel;
      batteryEl.textContent = battery && battery !== 'Unknown' ? `${battery}%` : '-';
    }
  }

  showDeviceStatusCard(info) {
    // Try inline style first
    const statusInline = document.getElementById('device-status-inline');
    const statusInfo = document.getElementById('status-info-inline');
    const emptyInline = document.getElementById('device-empty-inline');

    if (statusInline && statusInfo) {
      statusInfo.textContent = `${info.name || 'Device'} ${info.version || ''}`;
      statusInline.classList.remove('hidden');
      if (emptyInline) emptyInline.classList.add('hidden');
      return;
    }

    // Fallback to old card style
    const statusCard = document.getElementById('device-status-card');
    if (!statusCard) return;

    const deviceName = document.getElementById('status-device-name');
    const deviceVersion = document.getElementById('status-device-version');
    const modelText = document.getElementById('info-model');
    const androidText = document.getElementById('info-android');

    if (deviceName) {
      deviceName.textContent = info.name || 'Device';
    }

    if (deviceVersion) {
      deviceVersion.textContent = `버전: ${info.version || 'unknown'}`;
    }

    if (modelText) {
      modelText.textContent = `모델: ${info.model || '-'}`;
    }

    if (androidText) {
      androidText.textContent = `안드로이드: ${info.android || '-'}`;
    }

    statusCard.classList.remove('hidden');
  }

  disconnectDevice() {
    // Hide inline style
    const statusInline = document.getElementById('device-status-inline');
    const emptyInline = document.getElementById('device-empty-inline');
    if (statusInline) {
      statusInline.classList.add('hidden');
    }
    if (emptyInline) {
      emptyInline.classList.remove('hidden');
    }

    // Hide old card style
    const statusCard = document.getElementById('device-status-card');
    if (statusCard) {
      statusCard.classList.add('hidden');
    }

    this.state.selectedDevice = null;

    // Disable streaming button
    const streamBtn = document.getElementById('btn-stream');
    if (streamBtn) {
      streamBtn.disabled = true;
    }

    // Update new connection status UI to disconnected state
    this.updateConnectionStatus('disconnected', '연결 안 됨', '');

    this.log('디바이스 연결 해제', 'info');
  }

  updateDeviceStatus(device, isConnected) {
    const indicator = document.getElementById('main-status-indicator');
    const deviceName = document.getElementById('main-device-name');

    if (indicator && deviceName) {
      if (isConnected && device) {
        indicator.classList.add('connected');
        deviceName.textContent = device.model || device.id || '디바이스 연결됨';
      } else {
        indicator.classList.remove('connected');
        deviceName.textContent = '연결 안됨';
      }
    }
  }

  async wirelessConnect() {
    const modal = this.createInputModal('무선 연결', 'IP 주소를 입력하세요 (예: 192.168.1.100:5555)');
    const ip = await modal.show();

    if (ip && window.api) {
      try {
        await window.api.device.connectWireless(ip);
        this.log(`무선 연결 시도: ${ip}`, 'info');
        await this.scanDevices();
      } catch (error) {
        this.log(`무선 연결 실패: ${error.message}`, 'error');
      }
    }
  }

  onConnectionTypeChange(type) {
    const adbArea = document.getElementById('adb-connection-area');
    const ccncArea = document.getElementById('ccnc-connection-area');

    // Update tab active state (both old and new styles)
    document.querySelectorAll('.device-tab, .device-tab-inline').forEach(tab => {
      if (tab.dataset.type === type) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    if (type === 'adb') {
      adbArea.style.display = 'flex';
      ccncArea.style.display = 'none';
      this.state.connectionType = 'adb';
    } else if (type === 'ccnc') {
      adbArea.style.display = 'none';
      ccncArea.style.display = 'flex';
      this.state.connectionType = 'ccnc';
    }
  }

  async connectCCNC() {
    const maxRetries = 5;
    const retryDelay = 1000; // 1 second

    const host = document.getElementById('ccnc-host')?.value || 'localhost';
    const port = parseInt(document.getElementById('ccnc-port')?.value) || 20000;
    const fps = parseInt(document.getElementById('ccnc-fps')?.value) || 30;
    const statusDiv = document.getElementById('ccnc-status');

    if (!window.api || !window.api.device.connectCCNC) {
      this.log('ccNC API가 초기화되지 않았습니다', 'error');
      return;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.log(`ccNC 연결 시도 ${attempt}/${maxRetries}: ${host}:${port} (${fps} FPS)`, 'info');

        // Update status card
        this.updateConnectionStatus('connecting', `ccNC 연결 중... (${attempt}/${maxRetries})`, `${host}:${port}`);

        const result = await window.api.device.connectCCNC(host, port, fps);

        if (result.success) {
          this.log(`ccNC 연결 성공: ${result.version || 'unknown'}`, 'success');

          // Store ccNC connection info
          this.state.selectedDevice = {
            id: 'ccnc',
            model: 'ccNC',
            device: 'ccNC',
            connectionType: 'ccnc',
            host,
            port,
            fps,
            version: result.version
          };

          // Update status card
          this.updateConnectionStatus('connected', 'ccNC 연결됨', `${host}:${port} (v${result.version || 'unknown'})`);

          // Enable streaming button
          const streamBtn = document.getElementById('btn-stream');
          if (streamBtn) {
            streamBtn.disabled = false;
          }

          return; // Success, exit function
        } else {
          throw new Error(result.error || 'ccNC 연결 실패');
        }
      } catch (error) {
        console.error(`ccNC 연결 시도 ${attempt} 실패:`, error);

        if (attempt === maxRetries) {
          // Final attempt failed
          this.log(`ccNC 연결 실패 (${maxRetries}번 시도): ${error.message}`, 'error');
          this.log('ccNC 서버가 실행 중인지 확인해주세요', 'warning');

          // Update status card
          this.updateConnectionStatus('failed', 'ccNC 연결 실패', `${error.message} (${maxRetries}번 시도)`);
        } else {
          // Not final attempt, wait and retry
          this.log(`재시도 대기 중... (${attempt}/${maxRetries})`, 'warning');
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
  }

  async connectSelectedDevice() {
    try {
      if (!this.state.selectedDevice) {
        this.log('먼저 디바이스를 선택하세요', 'warning');
        return;
      }

      if (!window.api) {
        throw new Error('API가 초기화되지 않았습니다');
      }

      // Show connection status UI
      const statusPanel = document.getElementById('device-connection-status');
      const statusDot = document.getElementById('device-status-dot');
      const statusText = document.getElementById('device-status-text');
      const connectBtn = document.getElementById('btn-connect');

      if (statusPanel) {
        statusPanel.classList.remove('hidden');
      }

      if (statusDot) {
        statusDot.classList.add('connected');
      }

      if (statusText) {
        statusText.textContent = '연결됨';
      }

      if (connectBtn) {
        connectBtn.classList.add('hidden');
      }

      this.log(`디바이스 연결 완료: ${this.state.selectedDevice.model || this.state.selectedDevice.id}`, 'info');
    } catch (error) {
      console.error('디바이스 연결 오류:', error);
      this.log(`디바이스 연결 실패: ${error.message}`, 'error');
    }
  }

  // 화면 미러링
  async toggleStream() {
    if (this.state.isStreaming) {
      await this.stopStream();
    } else {
      await this.startStream();
    }
  }

  async startStream() {
    try {
      if (!this.state.selectedDevice) {
        throw new Error('디바이스를 먼저 선택하세요');
      }

      if (!window.api) {
        throw new Error('API가 초기화되지 않았습니다');
      }

      // Default FPS to 30 (stream-fps element was removed with quick settings)
      const fps = 30;
      await window.api.screen.startStream({ fps });

      this.state.isStreaming = true;
      const btnStream = document.getElementById('btn-stream');
      const placeholder = document.getElementById('stream-placeholder');
      const canvas = document.getElementById('screen-canvas');

      if (btnStream) {
        btnStream.textContent = '스트리밍 중지';
        btnStream.classList.remove('btn-primary');
        btnStream.classList.add('btn-danger');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (canvas) canvas.classList.remove('hidden');

      // Enable macro panel when streaming starts
      const newMacroBtn = document.getElementById('new-macro-btn');
      if (newMacroBtn) newMacroBtn.removeAttribute('disabled');

      // FPS 카운터 시작
      this.startFpsCounter();

      this.log('스트리밍 시작', 'info');
    } catch (error) {
      console.error('스트리밍 시작 오류:', error);
      this.log(`스트리밍 시작 실패: ${error.message}`, 'error');

      // Reset state on error
      this.state.isStreaming = false;

      // Ensure UI is in correct state
      const btnStream = document.getElementById('btn-stream');
      const placeholder = document.getElementById('stream-placeholder');
      const canvas = document.getElementById('screen-canvas');

      if (btnStream) {
        btnStream.textContent = '스트리밍 시작';
        btnStream.classList.add('btn-primary');
        btnStream.classList.remove('btn-danger');
      }
      if (canvas) canvas.classList.add('hidden');
      if (placeholder) placeholder.classList.remove('hidden');
    }
  }

  async stopStream() {
    try {
      if (window.api) {
        await window.api.screen.stopStream();
      }

      this.state.isStreaming = false;
      const btnStream = document.getElementById('btn-stream');
      const placeholder = document.getElementById('stream-placeholder');
      const canvas = document.getElementById('screen-canvas');

      if (btnStream) {
        btnStream.textContent = '스트리밍 시작';
        btnStream.classList.add('btn-primary');
        btnStream.classList.remove('btn-danger');
      }
      if (canvas) canvas.classList.add('hidden');
      if (placeholder) {
        placeholder.classList.remove('hidden');
        // Update placeholder message for stopped state
        const placeholderText = placeholder.querySelector('.placeholder-text');
        if (placeholderText) {
          placeholderText.innerHTML = `
            <p class="placeholder-title">스트리밍 중지됨</p>
            <p class="placeholder-description">스트리밍이 중지되었습니다</p>
            <p class="placeholder-description">다시 시작하려면 스트리밍 시작 버튼을 눌러주세요</p>
          `;
        }
      }

      // FPS 카운터 중지
      this.stopFpsCounter();

      // 매크로 패널 비활성화 - 스트리밍이 중지되면 매크로 사용 불가
      const newMacroBtn = document.getElementById('new-macro-btn');
      if (newMacroBtn) newMacroBtn.setAttribute('disabled', 'disabled');

      // Canvas 초기화
      if (this.ctx && this.canvas) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }

      this.log('스트리밍 중지', 'info');
    } catch (error) {
      console.error('스트리밍 중지 오류:', error);
      this.log(`스트리밍 중지 실패: ${error.message}`, 'error');
    }
  }

  renderFrame(frameData) {
    if (!this.canvas || !this.ctx) return;

    // frameData is an object: {dataUrl, width, height, timestamp}
    if (!frameData || !frameData.dataUrl) {
      console.error('Invalid frame data:', frameData);
      return;
    }

    const img = new Image();
    img.onload = () => {
      // Canvas 크기 조정
      if (frameData.width && frameData.height) {
        if (this.canvas.width !== frameData.width || this.canvas.height !== frameData.height) {
          this.canvas.width = frameData.width;
          this.canvas.height = frameData.height;
        }
      }

      // 프레임 그리기
      this.ctx.drawImage(img, 0, 0);

      // FPS 카운팅
      this.fpsCounter++;
    };
    img.src = frameData.dataUrl;
  }

  startFpsCounter() {
    this.streamInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - this.lastFpsUpdate;
      const fps = Math.round(this.fpsCounter * 1000 / elapsed);

      document.getElementById('fps-display').textContent = fps;

      this.fpsCounter = 0;
      this.lastFpsUpdate = now;
    }, 1000);
  }

  stopFpsCounter() {
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
    }
    document.getElementById('fps-display').textContent = '0';
  }

  async takeScreenshot() {
    try {
      if (!this.state.selectedDevice) {
        throw new Error('디바이스를 먼저 선택하세요');
      }

      if (!window.api) {
        throw new Error('API가 초기화되지 않았습니다');
      }

      const result = await window.api.screen.capture();
      if (result.success) {
        this.log(`스크린샷 저장: ${result.path}`, 'info');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('스크린샷 오류:', error);
      this.log(`스크린샷 실패: ${error.message}`, 'error');
    }
  }

  async toggleRecord() {
    if (this.state.isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  async startRecording() {
    try {
      if (!this.state.selectedDevice) {
        throw new Error('디바이스를 먼저 선택하세요');
      }

      if (window.api) {
        await window.api.screen.startRecord();
        this.state.isRecording = true;

        const btn = document.getElementById('btn-record');
        if (btn) {
          btn.textContent = '⏹ 녹화 중지';
          btn.classList.add('btn-danger');
        }

        this.log('화면 녹화 시작', 'info');
      }
    } catch (error) {
      this.log(`녹화 시작 실패: ${error.message}`, 'error');
    }
  }

  async stopRecording() {
    try {
      if (window.api) {
        const result = await window.api.screen.stopRecord();
        this.state.isRecording = false;

        const btn = document.getElementById('btn-record');
        if (btn) {
          btn.textContent = '🔴 녹화';
          btn.classList.remove('btn-danger');
        }

        if (result && result.success) {
          this.log(`녹화 저장: ${result.path}`, 'info');
        }
      }
    } catch (error) {
      this.log(`녹화 중지 실패: ${error.message}`, 'error');
    }
  }

  // 빠른 액션
  async quickAction(action) {
    try {
      if (!this.state.selectedDevice) {
        throw new Error('디바이스를 먼저 선택하세요');
      }

      if (!window.api) {
        throw new Error('API가 초기화되지 않았습니다');
      }

      let actionObj;
      switch(action) {
        case 'home':
          actionObj = { type: 'key', keycode: 'HOME' };
          break;
        case 'back':
          actionObj = { type: 'key', keycode: 'BACK' };
          break;
        case 'recent':
          actionObj = { type: 'key', keycode: 'APP_SWITCH' };
          break;
        case 'rotate':
          actionObj = { type: 'rotate' };
          break;
      }

      const result = await window.api.action.execute(actionObj);

      if (result && result.success) {
        this.log(`빠른 액션 실행: ${action}`, 'info');
      }
    } catch (error) {
      this.log(`액션 실행 실패: ${error.message}`, 'error');
    }
  }

  // 매크로 & 액션
  createNewMacro() {
    // Clear current actions and selected macro
    this.state.actions = [];
    this.state.selectedMacro = null;
    this.displayActions();

    // Switch to add tab
    this.switchTab('add');

    this.log('새 매크로 만들기 시작', 'info');
  }

  toggleTrackingOverlay() {
    if (!window.trackingOverlay) {
      this.log('추적 오버레이 시스템이 초기화되지 않음', 'error');
      return;
    }

    const isActive = window.trackingOverlay.toggle();

    // Update checkbox state to match
    const checkbox = document.getElementById('tracking-toggle');
    if (checkbox) {
      checkbox.checked = isActive;
    }

    if (isActive) {
      this.log('추적 표시 모드 활성화', 'info');
      // Display current actions on overlay when activated
      this.refreshTrackingOverlay();
    } else {
      this.log('추적 표시 모드 비활성화', 'info');
    }
  }

  refreshTrackingOverlay() {
    // Display all current actions in the overlay
    if (!window.trackingOverlay || !window.trackingOverlay.isActive) return;

    // Clear existing overlays
    window.trackingOverlay.clear();

    // Add each action to the overlay
    this.state.actions.forEach((action, index) => {
      if (action.type === 'tap' && action.x && action.y) {
        window.trackingOverlay.trackAction({
          type: 'TAP',
          x: action.x,
          y: action.y,
          label: `${index + 1}: 탭`
        });
      } else if (action.type === 'swipe' && action.startX && action.startY && action.endX && action.endY) {
        window.trackingOverlay.trackAction({
          type: 'SWIPE',
          startX: action.startX,
          startY: action.startY,
          endX: action.endX,
          endY: action.endY
        });
      }
      // Image actions are only tracked during execution, not during refresh
      // This prevents showing incorrect crop locations from saved actions
    });

    console.log(`Tracking overlay refreshed with ${this.state.actions.length} actions`);
  }

  async confirmCreateMacro() {
    const nameInput = document.getElementById('macro-name-input');
    const descInput = document.getElementById('macro-description-input');

    if (nameInput && nameInput.value) {
      // Debug: Log current actions
      console.log('[confirmCreateMacro] Current actions:', this.state.actions);
      console.log('[confirmCreateMacro] Actions count:', this.state.actions.length);

      const macro = {
        id: Date.now().toString(),
        name: nameInput.value,
        description: descInput ? descInput.value : '',
        actions: [...this.state.actions],
        createdAt: new Date().toISOString()
      };

      console.log('[confirmCreateMacro] Macro to save:', macro);

      // Save to backend
      if (window.api) {
        try {
          const result = await window.api.macro.save(macro);
          console.log('[confirmCreateMacro] Save result:', result);

          if (result && result.success) {
            this.log(`매크로 생성 및 저장: ${macro.name} (${macro.actions.length}개 액션)`, 'info');

            // Reload macro list
            await this.loadMacro();

            // Clear current actions and selected macro
            this.state.actions = [];
            this.state.selectedMacro = null;
            this.displayActions();

            // Switch to manage tab to show saved macro
            this.switchTab('manage');
          }
        } catch (error) {
          this.log(`매크로 저장 실패: ${error.message}`, 'error');
          return;
        }
      } else {
        // Fallback: just add to local state
        this.state.macros.push(macro);
        this.displayMacros();
        this.log(`매크로 생성: ${macro.name}`, 'info');
      }

      // 입력 초기화
      nameInput.value = '';
      if (descInput) descInput.value = '';

      this.closeModal('macro-name-modal');
    }
  }

  displayMacros() {
    const macroList = document.getElementById('macro-list');
    if (!macroList) return;

    macroList.innerHTML = '';

    if (this.state.macros.length === 0) {
      macroList.innerHTML = '<div class="empty-state">저장된 매크로 없음</div>';
      return;
    }

    this.state.macros.forEach(macro => {
      const item = document.createElement('div');
      item.className = 'macro-item-mini';
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" class="macro-checkbox" data-macro-id="${macro.id}" onchange="ui.updateSelectAllState()">
          <div style="flex: 1;">
            <div><strong>${macro.name}</strong></div>
            <div class="macro-actions" style="font-size: 0.7rem; color: var(--color-text-light);">${macro.actionCount || 0}개 액션</div>
          </div>
          <button class="btn btn-sm btn-success" onclick="ui.editMacroById('${macro.id}'); event.stopPropagation();">수정</button>
        </div>
      `;
      macroList.appendChild(item);
    });
  }

  selectMacro(macro) {
    this.state.selectedMacro = macro;
    document.querySelectorAll('.macro-item-mini').forEach(item => {
      item.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
  }

  addAction(type) {
    this.currentActionType = type;

    // Tap, Swipe, and Image: enable click mode on canvas
    if (type === 'tap' || type === 'swipe' || type === 'image') {
      this.startClickMode(type);
      return;
    }

    // IF: add IF+ENDIF pair automatically
    if (type === 'if') {
      // Generate unique pair ID
      const pairId = `if-pair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Add IF and ENDIF as a pair
      const ifAction = { type: 'if', pairId: pairId };
      const endifAction = { type: 'endif', pairId: pairId };

      this.state.actions.push(ifAction);
      this.state.actions.push(endifAction);

      this.displayActions();
      this.log('조건문 블록 추가 (IF + ENDIF)', 'info');
      return;
    }

    // ELSEIF, ELSE: add directly without modal (must be between IF-ENDIF)
    if (type === 'elseif' || type === 'else') {
      // Find the last IF before the current position
      const lastIfIndex = this.findLastIfBeforeEnd();

      if (lastIfIndex === -1) {
        this.log('오류: ELSEIF/ELSE는 IF 블록 안에서만 사용할 수 있습니다', 'error');
        return;
      }

      const action = { type: type };
      // Insert before the matching ENDIF
      const endifIndex = this.findMatchingEndif(lastIfIndex);
      if (endifIndex !== -1) {
        this.state.actions.splice(endifIndex, 0, action);
      } else {
        this.state.actions.push(action);
      }

      this.displayActions();
      this.log(`조건 액션 추가: ${type}`, 'info');
      return;
    }

    // ENDIF: no longer manually added (automatically added with IF)
    if (type === 'endif') {
      this.log('정보: ENDIF는 IF와 함께 자동으로 추가됩니다', 'info');
      return;
    }

    // Tap last match: add directly without modal
    if (type === 'tap_last_match') {
      const action = { type: type };
      this.state.actions.push(action);
      this.displayActions();
      this.log('찾은 위치 탭 액션 추가', 'info');
      return;
    }

    // BREAK: add directly without modal (must be inside LOOP)
    if (type === 'break') {
      const action = { type: type };
      this.state.actions.push(action);
      this.displayActions();
      this.log('BREAK 액션 추가', 'info');
      return;
    }

    // Other actions: show modal
    const modal = document.getElementById('action-modal');
    const modalTitle = document.getElementById('action-modal-title');
    const modalBody = document.getElementById('action-modal-body');

    if (!modal || !modalTitle || !modalBody) return;

    modalTitle.textContent = `${type} 액션 추가`;

    // 액션 타입별 폼 생성
    let formHtml = '';
    switch(type) {

      case 'loop_count':
        formHtml = `
          <div class="form-group">
            <label>반복 횟수 (1-1000)</label>
            <input type="number" id="action-loop-count" class="form-control" value="5" min="1" max="1000">
          </div>
        `;
        break;

      case 'input':
        formHtml = `
          <div class="form-group">
            <label>텍스트</label>
            <input type="text" id="action-text" class="form-control" placeholder="입력할 텍스트">
          </div>
        `;
        break;

      case 'wait':
        formHtml = `
          <div class="form-group">
            <label>딜레이 시간 (ms)</label>
            <input type="number" id="action-delay" class="form-control" value="1000">
          </div>
        `;
        break;

      case 'key':
        formHtml = `
          <div class="form-group">
            <label>키 코드</label>
            <select id="action-keycode" class="form-control">
              <option value="HOME">홈</option>
              <option value="BACK">뒤로</option>
              <option value="MENU">메뉴</option>
              <option value="ENTER">엔터</option>
              <option value="TAB">탭</option>
              <option value="SPACE">스페이스</option>
              <option value="DEL">삭제</option>
            </select>
          </div>
        `;
        break;

      case 'adb_screenshot':
      case 'adb_logcat':
        // No parameters needed, add action directly
        this.state.actions.push({ type: type });
        this.displayActions();
        return;
    }

    modalBody.innerHTML = formHtml;
    this.openModal('action-modal');
  }

  // Check if an action returns true/false and can be used as a condition
  isValidCondition(action) {
    if (!action) return false;
    // All image matching actions can be used as condition
    return action.type === 'image';
  }

  confirmAddAction() {
    const action = { type: this.currentActionType };

    switch(this.currentActionType) {
      case 'loop_count':
        const count = parseInt(document.getElementById('action-loop-count').value) || 5;
        if (count < 1 || count > 1000) {
          this.log('오류: 반복 횟수는 1-1000 사이여야 합니다', 'error');
          return;
        }

        // Generate unique pair ID
        const loopId = `loop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Add LOOP and ENDLOOP as a pair
        const loopAction = { type: 'loop_count', count: count, loopId: loopId };
        const endloopAction = { type: 'endloop', loopId: loopId };

        this.state.actions.push(loopAction);
        this.state.actions.push(endloopAction);

        this.displayActions();
        this.closeModal('action-modal');
        this.log(`횟수 반복 블록 추가 (${count}회)`, 'info');
        return;

      case 'input':
        action.text = document.getElementById('action-text').value || '';
        break;

      case 'wait':
        action.delay = parseInt(document.getElementById('action-delay').value) || 1000;
        break;

      case 'key':
        action.keycode = document.getElementById('action-keycode').value;
        break;
    }

    this.state.actions.push(action);
    this.displayActions();
    this.closeModal('action-modal');
    this.log(`액션 추가: ${action.type}`, 'info');
  }

  addScrollAction(direction) {
    const action = {
      type: 'scroll',
      direction: direction,
      distance: 600,
      duration: 300
    };

    this.state.actions.push(action);
    this.displayActions();

    const directionText = {
      'up': '위',
      'down': '아래',
      'left': '왼쪽',
      'right': '오른쪽'
    }[direction] || direction;

    this.log(`스크롤 ${directionText} 액션 추가`, 'info');
  }

  displayActions() {
    const actionList = document.getElementById('action-list');
    if (!actionList) return;

    actionList.innerHTML = '';

    if (this.state.actions.length === 0) {
      actionList.innerHTML = '<div class="empty-state">액션 없음</div>';
      return;
    }

    // Color palette for different nesting depths
    const depthColors = [
      '#2196f3', // depth 0: blue
      '#9c27b0', // depth 1: purple
      '#e91e63', // depth 2: pink
      '#ff9800', // depth 3: orange
      '#4caf50'  // depth 4: green
    ];

    // Calculate depth for each pairId (both IF and LOOP)
    const pairDepths = new Map();
    let currentDepth = 0;
    const depthStack = [];

    for (let i = 0; i < this.state.actions.length; i++) {
      const action = this.state.actions[i];

      if (action.type === 'if' && action.pairId) {
        pairDepths.set(action.pairId, currentDepth);
        depthStack.push(action.pairId);
        currentDepth++;
      } else if (action.type === 'endif' && action.pairId) {
        if (depthStack.length > 0) {
          depthStack.pop();
          currentDepth = Math.max(0, currentDepth - 1);
        }
      } else if (action.type === 'loop_count' && action.loopId) {
        pairDepths.set(action.loopId, currentDepth);
        depthStack.push(action.loopId);
        currentDepth++;
      } else if (action.type === 'endloop' && action.loopId) {
        if (depthStack.length > 0) {
          depthStack.pop();
          currentDepth = Math.max(0, currentDepth - 1);
        }
      }
    }

    let indentLevel = 0;
    let skipNext = false; // Flag to skip condition action after 'if'
    const ifStack = []; // Track current IF pairIds for ELSEIF/ELSE color matching

    this.state.actions.forEach((action, index) => {
      // Skip this action if it's a condition following an 'if'
      if (skipNext) {
        skipNext = false;
        return;
      }

      const item = document.createElement('div');
      item.className = 'action-item-mini';

      // Add executing class if this action is currently being executed
      if (index === this.state.currentExecutingActionIndex) {
        item.classList.add('executing');
      }

      // Track IF stack for color matching
      if (action.type === 'if' && action.pairId) {
        ifStack.push(action.pairId);
      } else if (action.type === 'endif' && action.pairId) {
        if (ifStack.length > 0 && ifStack[ifStack.length - 1] === action.pairId) {
          ifStack.pop();
        }
      }

      // Handle indentation for conditional blocks and loop blocks
      let currentIndent = indentLevel;
      if (action.type === 'else' || action.type === 'endif' || action.type === 'elseif' || action.type === 'endloop') {
        currentIndent = Math.max(0, indentLevel - 1);
      }

      // Apply indentation and vertical lines
      if (currentIndent > 0) {
        item.style.marginLeft = `${currentIndent * 20}px`;

        // Add vertical lines for each active depth level
        // Build gradient with multiple vertical lines
        const borderColors = [];
        for (let d = 0; d < currentIndent; d++) {
          const color = depthColors[d % depthColors.length];
          const xPos = d * 20 + 10; // Center each line at depth position
          borderColors.push(`${color} ${xPos}px, ${color} ${xPos + 2}px`);
        }

        if (borderColors.length > 0) {
          item.style.background = `linear-gradient(to right, ${borderColors.join(', ')}, transparent ${currentIndent * 20}px), var(--color-surface)`;
        }
      }

      // Update indent level for next action
      if (action.type === 'if') {
        indentLevel++;
      } else if (action.type === 'elseif') {
        // elseif stays at the same level as if
      } else if (action.type === 'else') {
        // else stays at the same level as if
      } else if (action.type === 'endif') {
        indentLevel = Math.max(0, indentLevel - 1);
      } else if (action.type === 'loop_count') {
        indentLevel++;
      } else if (action.type === 'endloop') {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      let description = '';
      let showButtons = true;

      switch(action.type) {
        case 'tap':
          description = `탭 (${action.x}, ${action.y})`;
          break;
        case 'tap_last_match':
          // Check if there's any IMAGE action before this
          const hasImageBefore = this.state.actions.slice(0, index).some(a => a.type === 'image');
          if (!hasImageBefore) {
            const warningIcon = '<span style="color: #dc2626; font-weight: bold;" title="경고: 이전에 이미지 매칭 액션이 없습니다."> ⚠</span>';
            description = `찾은 위치 탭${warningIcon}`;
          } else {
            description = `찾은 위치 탭`;
          }
          break;
        case 'swipe':
          description = `스와이프 (${action.x1},${action.y1} → ${action.x2},${action.y2})`;
          break;
        case 'scroll':
          const directionText = {
            'up': '↑ 위',
            'down': '↓ 아래',
            'left': '← 왼쪽',
            'right': '→ 오른쪽'
          }[action.direction] || action.direction;
          description = `스크롤 ${directionText}`;
          break;
        case 'input':
          description = `입력: "${action.text}"`;
          break;
        case 'wait':
          description = `딜레이: ${action.delay}ms`;
          break;
        case 'key':
          description = `키: ${action.keycode}`;
          break;
        case 'adb_screenshot':
          description = `ADB 스크린샷 저장`;
          break;
        case 'adb_logcat':
          description = `ADB Logcat 저장`;
          break;
        case 'image':
          description = `이미지 매칭 (${((action.threshold || 0.95) * 100).toFixed(0)}%)`;
          break;
        case 'if':
          // Check if next action exists and can be used as condition
          const nextAction = this.state.actions[index + 1];
          // Get color based on depth
          const ifDepth = pairDepths.get(action.pairId) || 0;
          const ifColor = depthColors[ifDepth % depthColors.length];
          const depthWarning = ifDepth >= 3 ? ' <span style="color: #ff9800;" title="경고: 3단계 이상 중첩">⚠ </span>' : '';

          if (nextAction) {
            // Check if the condition is valid
            const isValid = this.isValidCondition(nextAction);

            if (nextAction.type === 'image') {
              description = `<strong style="color: ${ifColor};">if</strong> (이미지 매칭 ${((nextAction.threshold || 0.95) * 100).toFixed(0)}%)${depthWarning}`;
              skipNext = true;
              showButtons = true;
            } else {
              // Invalid condition: show warning
              let condDesc = '';
              switch(nextAction.type) {
                case 'tap':
                  condDesc = `탭 (${nextAction.x}, ${nextAction.y})`;
                  break;
                case 'swipe':
                  condDesc = `스와이프`;
                  break;
                case 'wait':
                  condDesc = `딜레이 ${nextAction.delay}ms`;
                  break;
                case 'input':
                  condDesc = `입력 "${nextAction.text}"`;
                  break;
                case 'key':
                  condDesc = `키 ${nextAction.keycode}`;
                  break;
                default:
                  condDesc = nextAction.type;
              }
              const warningIcon = '<span style="color: #dc2626; font-weight: bold;" title="오류: 이 액션은 true/false를 반환하지 않아 조건으로 사용할 수 없습니다."> ⚠</span>';
              description = `<strong style="color: ${ifColor};">if</strong> (${condDesc})${warningIcon}${depthWarning}`;
              skipNext = true;
              showButtons = true;
            }
          } else {
            description = `<strong style="color: ${ifColor};">if</strong> <span style="color: #dc2626;">(조건 없음 ⚠)</span>${depthWarning}`;
            showButtons = false;
          }
          break;
        case 'elseif':
          // Check if next action exists and can be used as condition
          const elseifNextAction = this.state.actions[index + 1];
          // Get color from parent IF (last IF in stack)
          const elseifPairId = ifStack.length > 0 ? ifStack[ifStack.length - 1] : null;
          const elseifDepth = elseifPairId ? (pairDepths.get(elseifPairId) || 0) : 0;
          const elseifColor = depthColors[elseifDepth % depthColors.length];

          if (elseifNextAction) {
            // Check if the condition is valid
            const isElseifValid = this.isValidCondition(elseifNextAction);

            if (elseifNextAction.type === 'image') {
              description = `<strong style="color: ${elseifColor};">elseif</strong> (이미지 매칭 ${((elseifNextAction.threshold || 0.95) * 100).toFixed(0)}%)`;
              skipNext = true;
              showButtons = true;
            } else {
              // Invalid condition: show warning
              let elseifCondDesc = '';
              switch(elseifNextAction.type) {
                case 'tap':
                  elseifCondDesc = `탭 (${elseifNextAction.x}, ${elseifNextAction.y})`;
                  break;
                case 'swipe':
                  elseifCondDesc = `스와이프`;
                  break;
                case 'wait':
                  elseifCondDesc = `딜레이 ${elseifNextAction.delay}ms`;
                  break;
                case 'input':
                  elseifCondDesc = `입력 "${elseifNextAction.text}"`;
                  break;
                case 'key':
                  elseifCondDesc = `키 ${elseifNextAction.keycode}`;
                  break;
                default:
                  elseifCondDesc = elseifNextAction.type;
              }
              const elseifWarningIcon = '<span style="color: #dc2626; font-weight: bold;" title="오류: 이 액션은 true/false를 반환하지 않아 조건으로 사용할 수 없습니다."> ⚠</span>';
              description = `<strong style="color: ${elseifColor};">elseif</strong> (${elseifCondDesc})${elseifWarningIcon}`;
              skipNext = true;
              showButtons = true;
            }
          } else {
            description = `<strong style="color: ${elseifColor};">elseif</strong> <span style="color: #dc2626;">(조건 없음 ⚠)</span>`;
            showButtons = false;
          }
          break;
        case 'else':
          // Get color from parent IF (last IF in stack)
          const elsePairId = ifStack.length > 0 ? ifStack[ifStack.length - 1] : null;
          const elseDepth = elsePairId ? (pairDepths.get(elsePairId) || 0) : 0;
          const elseColor = depthColors[elseDepth % depthColors.length];
          description = `<strong style="color: ${elseColor};">else</strong>`;
          showButtons = false;
          break;
        case 'endif':
          // Get color based on depth
          const endifDepth = pairDepths.get(action.pairId) || 0;
          const endifColor = depthColors[endifDepth % depthColors.length];
          description = `<strong style="color: ${endifColor};">endif</strong>`;
          showButtons = false;
          break;
        case 'loop_count':
          // Get color based on depth
          const loopDepth = pairDepths.get(action.loopId) || 0;
          const loopColor = depthColors[loopDepth % depthColors.length];
          description = `<strong style="color: ${loopColor};">LOOP</strong> ${action.count}회`;
          showButtons = false;
          break;
        case 'endloop':
          // Get color based on depth (same as matching LOOP)
          const endloopDepth = pairDepths.get(action.loopId) || 0;
          const endloopColor = depthColors[endloopDepth % depthColors.length];
          description = `<strong style="color: ${endloopColor};">ENDLOOP</strong>`;
          showButtons = false;
          break;
        case 'break':
          description = `<strong style="color: #f44336;">BREAK</strong> (반복 중단)`;
          showButtons = false;
          break;
      }

      // Show label as badge if exists
      const labelBadge = action.label ? `<span class="action-label">${action.label}</span>` : '';

      // Only show settings and edit buttons for non-control-flow actions
      const buttonsHtml = showButtons ? `
        <div class="action-buttons">
          <button class="btn-settings">설정</button>
          <button class="btn-edit">이름변경</button>
          <button class="btn-remove">삭제</button>
        </div>
      ` : `
        <div class="action-buttons">
          <button class="btn-remove">삭제</button>
        </div>
      `;

      item.innerHTML = `
        <span class="drag-handle" title="드래그하여 순서 변경">☰</span>
        <span class="action-text">${index + 1}. ${labelBadge}${description}</span>
        ${buttonsHtml}
      `;

      // Set up draggable functionality
      item.setAttribute('draggable', false); // Initially not draggable
      item.dataset.index = index;

      const dragHandle = item.querySelector('.drag-handle');

      // Enable dragging only when drag handle is used
      if (dragHandle) {
        dragHandle.addEventListener('mousedown', (e) => {
          item.setAttribute('draggable', true);
        });

        dragHandle.addEventListener('mouseup', (e) => {
          item.setAttribute('draggable', false);
        });
      }

      // Item drag events
      item.addEventListener('dragstart', (e) => {
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index);
      });

      item.addEventListener('dragend', (e) => {
        item.classList.remove('dragging');
        item.setAttribute('draggable', false);
        // Remove all drag-over classes
        document.querySelectorAll('.action-item-mini').forEach(el => {
          el.classList.remove('drag-over');
        });
      });

      // Item drag over events
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const draggingItem = document.querySelector('.action-item-mini.dragging');
        if (draggingItem && draggingItem !== item) {
          item.classList.add('drag-over');
        }
      });

      item.addEventListener('dragleave', (e) => {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');

        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const toIndex = parseInt(item.dataset.index);

        if (fromIndex !== toIndex) {
          this.moveAction(fromIndex, toIndex);
        }
      });

      // Add event listeners
      if (showButtons) {
        const settingsBtn = item.querySelector('.btn-settings');
        const editBtn = item.querySelector('.btn-edit');

        if (settingsBtn) {
          settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editAction(index);
          });
        }

        if (editBtn) {
          editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editActionLabel(index);
          });
        }
      }

      const removeBtn = item.querySelector('.btn-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeAction(index);
        });
      }

      actionList.appendChild(item);
    });

    // Refresh tracking overlay if active
    if (window.trackingOverlay && window.trackingOverlay.isActive) {
      this.refreshTrackingOverlay();
    }
  }

  moveAction(fromIndex, toIndex) {
    // Remove the action from the old position
    const [movedAction] = this.state.actions.splice(fromIndex, 1);

    // Insert it at the new position
    this.state.actions.splice(toIndex, 0, movedAction);

    // Refresh the display
    this.displayActions();
    this.log(`액션 순서 변경: ${fromIndex + 1} → ${toIndex + 1}`, 'info');
  }

  editActionLabel(index) {
    console.log('editActionLabel called with index:', index);
    const action = this.state.actions[index];

    if (!action) {
      console.error('Action not found at index:', index);
      return;
    }

    // Store the current action index
    this.currentEditingActionIndex = index;

    // Check if modal exists
    const modal = document.getElementById('edit-label-modal');
    if (!modal) {
      console.error('Modal element not found in DOM!');
      // Create modal if it doesn't exist
      this.createEditLabelModal();
      return;
    }

    // Get the input field and set current value
    const inputField = document.getElementById('edit-label-input');
    if (inputField) {
      inputField.value = action.label || '';
    } else {
      console.error('Input field not found!');
    }

    // Show the modal using centralized function
    this.openModal('edit-label-modal');

    // Focus the input field after a short delay
    setTimeout(() => {
      if (inputField) {
        inputField.focus();
        inputField.select();
      }
    }, 100);
  }

  createEditLabelModal() {
    // Remove existing modal if any
    const existing = document.getElementById('edit-label-modal');
    if (existing) {
      existing.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'edit-label-modal';
    modal.className = 'modal';
    modal.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      z-index: 999999 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: rgba(0, 0, 0, 0.7) !important;
    `;

    modal.innerHTML = `
      <div class="modal-content" style="
        background: white !important;
        color: black !important;
        border-radius: 8px !important;
        padding: 0 !important;
        width: 90% !important;
        max-width: 500px !important;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5) !important;
      ">
        <div class="modal-header" style="
          padding: 16px !important;
          border-bottom: 1px solid #e5e5e5 !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
        ">
          <h3 style="margin: 0 !important; font-size: 1.25rem !important;">액션 별칭 편집</h3>
          <button class="modal-close" onclick="ui.cancelEditLabel()" style="
            background: none !important;
            border: none !important;
            font-size: 1.5rem !important;
            cursor: pointer !important;
            padding: 0 !important;
            width: 32px !important;
            height: 32px !important;
          ">&times;</button>
        </div>
        <div class="modal-body" style="padding: 16px !important;">
          <p style="margin: 0 0 12px 0 !important;">이 액션의 별칭을 입력하세요 (별칭을 제거하려면 비워두세요)</p>
          <input type="text" id="edit-label-input" class="form-control" placeholder="예: 로그인 버튼" style="
            width: 100% !important;
            padding: 8px 12px !important;
            border: 1px solid #d1d5db !important;
            border-radius: 6px !important;
            font-size: 14px !important;
          ">
        </div>
        <div class="modal-footer" style="
          padding: 16px !important;
          border-top: 1px solid #e5e5e5 !important;
          display: flex !important;
          justify-content: flex-end !important;
          gap: 8px !important;
        ">
          <button class="btn btn-secondary" onclick="ui.cancelEditLabel()" style="
            padding: 8px 16px !important;
            border-radius: 6px !important;
            border: 1px solid #d1d5db !important;
            background: #f3f4f6 !important;
            color: #374151 !important;
            cursor: pointer !important;
          ">취소</button>
          <button class="btn btn-primary" onclick="ui.confirmEditLabel()" style="
            padding: 8px 16px !important;
            border-radius: 6px !important;
            border: none !important;
            background: #2563eb !important;
            color: white !important;
            cursor: pointer !important;
          ">확인</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Re-trigger edit action after creating modal
    setTimeout(() => {
      this.editActionLabel(this.currentEditingActionIndex);
    }, 100);
  }

  cancelEditLabel() {
    this.closeModal('edit-label-modal');
    this.currentEditingActionIndex = null;
  }

  confirmEditLabel() {
    const index = this.currentEditingActionIndex;
    if (index === null || index === undefined) return;

    const action = this.state.actions[index];
    if (!action) return;

    const inputField = document.getElementById('edit-label-input');
    const newLabel = inputField ? inputField.value : '';

    // Update label
    if (newLabel.trim()) {
      action.label = newLabel.trim();
      this.log(`액션 별칭 설정: "${newLabel.trim()}"`, 'info');
    } else {
      delete action.label;
      this.log('액션 별칭 제거', 'info');
    }

    this.displayActions();

    // Hide modal using centralized function
    this.closeModal('edit-label-modal');

    this.currentEditingActionIndex = null;
  }

  editAction(index) {
    const action = this.state.actions[index];

    if (!action) {
      console.error('Action not found at index:', index);
      return;
    }

    // Store the editing index
    this.currentEditingActionIndex = index;

    // Handle different action types
    switch(action.type) {
      case 'tap':
      case 'swipe':
        // Re-enter click mode to select new coordinates
        this.log(`${action.type} 액션 좌표 재설정 중...`, 'info');
        this.startClickMode(action.type);
        break;

      case 'wait':
        // Show modal to edit wait time
        this.showEditWaitModal(action);
        break;

      case 'input':
        // Show modal to edit text
        this.showEditInputModal(action);
        break;

      case 'key':
        // Show modal to edit key code
        this.showEditKeyModal(action);
        break;

      case 'image':
        // Show modal to edit image matching settings
        this.showEditImageModal(action);
        break;
    }
  }

  showEditWaitModal(action) {
    const modal = document.getElementById('action-modal');
    const modalTitle = document.getElementById('action-modal-title');
    const modalBody = document.getElementById('action-modal-body');

    if (!modal || !modalTitle || !modalBody) return;

    modalTitle.textContent = '딜레이 액션 수정';
    modalBody.innerHTML = `
      <div class="form-group">
        <label>딜레이 시간 (ms)</label>
        <input type="number" id="action-delay" class="form-control" value="${action.delay || 1000}">
      </div>
    `;

    this.openModal('action-modal');

    // Override confirm button to update instead of add
    const confirmBtn = modal.querySelector('.btn-primary');
    if (confirmBtn) {
      confirmBtn.onclick = () => this.confirmEditAction();
    }
  }

  showEditInputModal(action) {
    const modal = document.getElementById('action-modal');
    const modalTitle = document.getElementById('action-modal-title');
    const modalBody = document.getElementById('action-modal-body');

    if (!modal || !modalTitle || !modalBody) return;

    modalTitle.textContent = '입력 액션 수정';
    modalBody.innerHTML = `
      <div class="form-group">
        <label>텍스트</label>
        <input type="text" id="action-text" class="form-control" value="${action.text || ''}" placeholder="입력할 텍스트">
      </div>
    `;

    this.openModal('action-modal');

    // Override confirm button
    const confirmBtn = modal.querySelector('.btn-primary');
    if (confirmBtn) {
      confirmBtn.onclick = () => this.confirmEditAction();
    }
  }

  showEditKeyModal(action) {
    const modal = document.getElementById('action-modal');
    const modalTitle = document.getElementById('action-modal-title');
    const modalBody = document.getElementById('action-modal-body');

    if (!modal || !modalTitle || !modalBody) return;

    modalTitle.textContent = '키 액션 수정';
    modalBody.innerHTML = `
      <div class="form-group">
        <label>키 코드</label>
        <select id="action-keycode" class="form-control">
          <option value="HOME" ${action.keycode === 'HOME' ? 'selected' : ''}>홈</option>
          <option value="BACK" ${action.keycode === 'BACK' ? 'selected' : ''}>뒤로</option>
          <option value="MENU" ${action.keycode === 'MENU' ? 'selected' : ''}>메뉴</option>
          <option value="ENTER" ${action.keycode === 'ENTER' ? 'selected' : ''}>엔터</option>
          <option value="TAB" ${action.keycode === 'TAB' ? 'selected' : ''}>탭</option>
          <option value="SPACE" ${action.keycode === 'SPACE' ? 'selected' : ''}>스페이스</option>
          <option value="DEL" ${action.keycode === 'DEL' ? 'selected' : ''}>삭제</option>
        </select>
      </div>
    `;

    this.openModal('action-modal');

    // Override confirm button
    const confirmBtn = modal.querySelector('.btn-primary');
    if (confirmBtn) {
      confirmBtn.onclick = () => this.confirmEditAction();
    }
  }

  showEditImageModal(action) {
    // Store that we're editing (not adding new)
    this.editingImageAction = true;

    // Open the image match modal
    const modal = document.getElementById('image-match-modal');
    if (!modal) return;

    // Set existing threshold value
    const thresholdInput = document.getElementById('match-threshold');
    const thresholdValue = document.getElementById('threshold-value');
    if (thresholdInput && thresholdValue) {
      thresholdInput.value = action.threshold || 0.95;
      thresholdValue.textContent = ((action.threshold || 0.95) * 100).toFixed(0) + '%';
    }

    // Display existing image if available
    if (action.imageData) {
      const canvas = document.getElementById('crop-canvas');
      const preview = document.getElementById('captured-image-preview');
      const autoCropBtn = document.getElementById('auto-crop-btn');
      const resetCropBtn = document.getElementById('reset-crop-btn');

      if (canvas && preview) {
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          canvas.style.display = 'block';
          preview.style.display = 'none';

          if (autoCropBtn) autoCropBtn.style.display = 'inline-block';
          if (resetCropBtn) resetCropBtn.style.display = 'inline-block';
        };
        img.src = action.imageData;
      }

      // Store the existing image data for editing
      this.capturedImageDataUrl = action.imageData;
    }

    this.openModal('image-match-modal');
    this.log('이미지 매칭 액션 수정 중', 'info');
  }

  confirmEditAction() {
    const index = this.currentEditingActionIndex;
    if (index === null || index === undefined) return;

    const action = this.state.actions[index];
    if (!action) return;

    // Update action based on type
    switch(action.type) {
      case 'wait':
        const delayInput = document.getElementById('action-delay');
        if (delayInput) {
          action.delay = parseInt(delayInput.value) || 1000;
        }
        break;

      case 'input':
        const textInput = document.getElementById('action-text');
        if (textInput) {
          action.text = textInput.value;
        }
        break;

      case 'key':
        const keycodeSelect = document.getElementById('action-keycode');
        if (keycodeSelect) {
          action.keycode = keycodeSelect.value;
        }
        break;

      case 'image':
        // Update image matching settings
        const thresholdInput = document.getElementById('match-threshold');

        if (thresholdInput) {
          action.threshold = parseFloat(thresholdInput.value) || 0.95;
        }

        // Update image data if it was changed
        if (this.capturedImageDataUrl) {
          action.imageData = this.capturedImageDataUrl;
        }

        this.closeModal('image-match-modal');
        this.editingImageAction = false;
        break;
    }

    this.displayActions();
    if (action.type !== 'image') {
      this.closeModal('action-modal');
    }
    this.currentEditingActionIndex = null;
    this.log('액션 수정 완료', 'info');
  }

  removeAction(index) {
    const action = this.state.actions[index];

    // If deleting an IF, also delete its matching ENDIF
    if (action && action.type === 'if' && action.pairId) {
      const endifIndex = this.findMatchingEndif(index);

      if (endifIndex !== -1) {
        // Remove both IF and ENDIF
        // Remove the higher index first to avoid index shifting issues
        if (endifIndex > index) {
          this.state.actions.splice(endifIndex, 1); // Remove ENDIF first
          this.state.actions.splice(index, 1);      // Then remove IF
        } else {
          this.state.actions.splice(index, 1);      // Remove IF first
          this.state.actions.splice(endifIndex, 1); // Then remove ENDIF
        }

        this.log('조건문 블록 삭제 (IF + ENDIF)', 'info');
      } else {
        // No matching ENDIF found, just remove IF
        this.state.actions.splice(index, 1);
        this.log('IF 액션 삭제 (매칭되는 ENDIF 없음)', 'warning');
      }
    } else {
      // Normal action deletion
      this.state.actions.splice(index, 1);
    }

    this.displayActions();
  }

  clearActions() {
    this.state.actions = [];
    this.displayActions();
    this.log('액션 목록 초기화', 'info');
  }

  async executeAction(action) {
    try {
      if (!this.state.selectedDevice) {
        throw new Error('디바이스를 먼저 선택하세요');
      }

      if (!window.api) {
        throw new Error('API가 초기화되지 않았습니다');
      }

      // 추적 오버레이에 액션 전달
      if (window.trackingOverlay && window.trackingOverlay.isActive) {
        // 액션 타입에 따라 추적 데이터 생성
        let trackingData = null;

        if (action.type === 'tap') {
          console.log('=== executeAction Tap Debug ===');
          console.log('Action:', action);
          trackingData = {
            type: 'TAP',
            x: action.x,
            y: action.y,
            label: action.description || 'Tap'
          };
          console.log('Tracking data:', trackingData);
          console.log('===============================');
        } else if (action.type === 'swipe') {
          trackingData = {
            type: 'SWIPE',
            startX: action.startX,
            startY: action.startY,
            endX: action.endX,
            endY: action.endY
          };
        }
        // Image actions are tracked only after matching completes (in executeImageMatch)
        // to show the actual found location, not the stored crop location
        else if (action.type === 'text') {
          trackingData = {
            type: 'INPUT_TEXT',
            x: action.x || 100,
            y: action.y || 100,
            text: action.text || ''
          };
        }

        if (trackingData) {
          window.trackingOverlay.trackAction(trackingData);
        }
      }

      let result;
      if (action.type === 'wait') {
        await new Promise(resolve => setTimeout(resolve, action.delay));
        result = { success: true };
      } else if (action.type === 'adb_screenshot') {
        // Capture device screenshot via ADB
        result = await window.api.adb.screenshot();
        if (result.success) {
          this.log(`스크린샷 저장 완료: ${result.path}`, 'info');
        }
      } else if (action.type === 'adb_logcat') {
        // Capture device logcat via ADB
        result = await window.api.adb.logcat();
        if (result.success) {
          this.log(`Logcat 저장 완료: ${result.path}`, 'info');
        }
      } else if (action.type === 'image') {
        // Handle image matching in frontend
        result = await this.executeImageMatch(action);
      } else if (action.type === 'tap_last_match') {
        // Tap on last matched image location
        if (!this.lastMatchLocation) {
          throw new Error('이전에 성공한 이미지 매칭이 없습니다. 먼저 이미지 매칭 액션을 실행해주세요.');
        }

        this.log(`찾은 위치 탭 (${this.lastMatchLocation.x}, ${this.lastMatchLocation.y})`, 'info');

        // Create tap action with last match location
        const tapAction = {
          type: 'tap',
          x: this.lastMatchLocation.x,
          y: this.lastMatchLocation.y
        };

        // Track the tap if tracking overlay is active
        if (window.trackingOverlay && window.trackingOverlay.isActive) {
          window.trackingOverlay.trackAction({
            type: 'TAP',
            x: tapAction.x,
            y: tapAction.y,
            label: 'Last Match Tap'
          });
        }

        result = await window.api.action.execute(tapAction);
      } else {
        result = await window.api.action.execute(action);
      }

      if (!result || !result.success) {
        throw new Error('액션 실행 실패');
      }

      return result;
    } catch (error) {
      console.error('액션 실행 오류:', error);
      // Don't log here - error is already logged at lower level
      throw error;
    }
  }

  async executeImageMatch(action) {
    try {
      if (!this.canvas || !this.ctx) {
        throw new Error('캔버스가 초기화되지 않았습니다');
      }

      // Get current screen image data
      const currentImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

      // Load template image
      const templateImage = await this.loadImageFromDataUrl(action.imageData);

      // Set timeout for image matching (default 10 seconds)
      const timeout = action.timeout || 10000;
      const startTime = Date.now();

      // 새로운 ImageMatcher 사용
      const searchStrategy = action.searchStrategy || 'smart'; // smart, fast, thorough, exhaustive

      console.log('Image matching parameters:', {
        threshold: action.threshold || 0.95,
        timeout: timeout,
        useCache: action.useCache !== false,
        searchStrategy: searchStrategy,
        templateSize: { width: templateImage.width, height: templateImage.height },
        sourceSize: { width: currentImageData.width, height: currentImageData.height },
        cropLocation: action.cropX !== null ? { x: action.cropX, y: action.cropY } : null
      });

      // If crop location is available, pre-cache it for faster searching
      if (action.cropX !== null && action.cropY !== null) {
        const imageHash = window.imageMatcher.calculateImageHash(templateImage);
        window.imageMatcher.cacheLocation(imageHash, {
          x: action.cropX,
          y: action.cropY,
          width: action.cropWidth || templateImage.width,
          height: action.cropHeight || templateImage.height
        });
        console.log('Pre-cached crop location:', { x: action.cropX, y: action.cropY, width: action.cropWidth, height: action.cropHeight });
      }

      console.log('[executeImageMatch] Calling findTemplate...');
      const matchResult = await window.imageMatcher.findTemplate(currentImageData, templateImage, {
        threshold: action.threshold || 0.95,
        timeout: timeout,
        useCache: action.useCache !== false, // 기본값: 캐시 사용
        searchStrategy: searchStrategy,
        cropLocation: action.cropX !== null ? {
          x: action.cropX,
          y: action.cropY,
          width: action.cropWidth,
          height: action.cropHeight
        } : null
      });
      console.log('[executeImageMatch] findTemplate completed');

      console.log('Image matching result:', {
        found: matchResult.found,
        score: matchResult.score,
        searchPhases: matchResult.searchPhases,
        totalTime: matchResult.totalTime
      });

      // Store match result for conditional execution
      this.lastConditionResult = matchResult.found;
      console.log(`[IF_IMAGE] Setting lastConditionResult = ${matchResult.found}`);

      // Store last match location for tap_last_match action
      if (matchResult.found) {
        this.lastMatchLocation = {
          x: matchResult.x + Math.floor(matchResult.width / 2),
          y: matchResult.y + Math.floor(matchResult.height / 2),
          rawX: matchResult.x,
          rawY: matchResult.y,
          width: matchResult.width,
          height: matchResult.height
        };
        console.log(`[IMAGE_MATCH] Saved last match location:`, this.lastMatchLocation);
      }

      if (matchResult.timedOut) {
        this.log(`이미지 매칭 타임아웃 (${timeout/1000}초)`, 'warning');
      }

      if (!matchResult.found) {
        // Show the best score found for debugging
        const bestScoreInfo = matchResult.score ? ` (최고 점수: ${(matchResult.score * 100).toFixed(1)}%, 필요: ${(action.threshold || 0.95) * 100}%)` : '';

        // IF_IMAGE is for condition checking - just return false result without throwing error
        this.log(`이미지 매칭 실패${bestScoreInfo}`, 'warning');
        return { success: true, matched: false };
      }

      // Tap on the matched location (center of matched area)
      const tapX = matchResult.x + Math.floor(matchResult.width / 2);
      const tapY = matchResult.y + Math.floor(matchResult.height / 2);

      this.log(`이미지 매칭 성공: (${tapX}, ${tapY}), 점수: ${(matchResult.score * 100).toFixed(1)}%, 소요시간: ${matchResult.totalTime}ms`, 'info');

      // Update tracking overlay with actual found location
      if (window.trackingOverlay && window.trackingOverlay.isActive) {
        const canvas = document.getElementById('screen-canvas');
        window.trackingOverlay.trackAction({
          type: 'IF_IMAGE',
          region: {
            x: matchResult.x,
            y: matchResult.y,
            width: matchResult.width,
            height: matchResult.height
          },
          screenWidth: canvas ? canvas.width : currentImageData.width,
          screenHeight: canvas ? canvas.height : currentImageData.height
        });
      }

      // IF_IMAGE is for condition checking only - no auto tap
      // Just return success with matched status
      return { success: true, matched: true };
    } catch (error) {
      this.lastConditionResult = false;
      this.log(`이미지 매칭 실패: ${error.message}`, 'error');
      throw error;
    }
  }

  async loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        resolve(imageData);
      };
      img.onerror = () => reject(new Error('이미지 로드 실패'));
      img.src = dataUrl;
    });
  }

  async runActions() {
    try {
      if (this.state.actions.length === 0) {
        throw new Error('실행할 액션이 없습니다');
      }

      if (!this.state.selectedDevice) {
        throw new Error('디바이스를 먼저 선택하세요');
      }

      if (!window.api) {
        throw new Error('API가 초기화되지 않았습니다');
      }

      this.log(`${this.state.actions.length}개 액션 실행 시작`, 'info');

      // Loop stack to track nested loops
      const loopStack = [];

      let i = 0;
      while (i < this.state.actions.length) {
        const action = this.state.actions[i];

        // Highlight current action being executed
        this.state.currentExecutingActionIndex = i;
        this.displayActions();

        // Handle conditional actions
        if (action.type === 'if') {
          // Execute the next action (condition) to get the result
          const conditionAction = this.state.actions[i + 1];
          if (!conditionAction || !this.isValidCondition(conditionAction)) {
            throw new Error('if 다음에 유효한 조건 액션이 없습니다');
          }

          // Execute the condition action
          this.state.currentExecutingActionIndex = i + 1;
          this.displayActions();
          await this.executeAction(conditionAction);

          // Now check the result
          this.log(`조건문 시작 (조건: ${this.lastConditionResult ? 'true' : 'false'})`, 'info');

          // Skip the condition action since we just executed it
          i++;

          if (!this.lastConditionResult) {
            // Condition is false, skip to elseif, else or endif
            const skipInfo = this.findElseOrEndif(i);
            if (skipInfo.elseifIndex !== -1) {
              // Skip to elseif block
              this.log('조건 false - elseif 블록으로 이동', 'info');
              i = skipInfo.elseifIndex;
            } else if (skipInfo.elseIndex !== -1) {
              // Skip to else block
              this.log('조건 false - else 블록으로 이동', 'info');
              i = skipInfo.elseIndex;
            } else if (skipInfo.endifIndex !== -1) {
              // Skip to endif
              this.log('조건 false - endif로 이동', 'info');
              i = skipInfo.endifIndex;
            } else {
              throw new Error('조건문이 올바르게 닫히지 않았습니다 (endif 없음)');
            }
          } else {
            this.log('조건 true - if 블록 실행', 'info');
          }
          i++;
          continue;
        }

        if (action.type === 'elseif') {
          // Execute the next action (condition) to get the result
          const elseifConditionAction = this.state.actions[i + 1];
          if (!elseifConditionAction || !this.isValidCondition(elseifConditionAction)) {
            throw new Error('elseif 다음에 유효한 조건 액션이 없습니다');
          }

          // Execute the condition action
          this.state.currentExecutingActionIndex = i + 1;
          this.displayActions();
          await this.executeAction(elseifConditionAction);

          // Now check the result
          this.log(`elseif 조건 확인 (조건: ${this.lastConditionResult ? 'true' : 'false'})`, 'info');

          // Skip the condition action since we just executed it
          i++;

          if (!this.lastConditionResult) {
            // Condition is false, skip to next elseif, else or endif
            const skipInfo = this.findElseOrEndif(i);
            if (skipInfo.elseifIndex !== -1) {
              // Skip to next elseif block
              this.log('조건 false - 다음 elseif 블록으로 이동', 'info');
              i = skipInfo.elseifIndex;
            } else if (skipInfo.elseIndex !== -1) {
              // Skip to else block
              this.log('조건 false - else 블록으로 이동', 'info');
              i = skipInfo.elseIndex;
            } else if (skipInfo.endifIndex !== -1) {
              // Skip to endif
              this.log('조건 false - endif로 이동', 'info');
              i = skipInfo.endifIndex;
            } else {
              throw new Error('elseif가 올바르게 닫히지 않았습니다 (endif 없음)');
            }
          } else {
            this.log('조건 true - elseif 블록 실행', 'info');
          }
          i++;
          continue;
        }

        if (action.type === 'else') {
          // If we reach else, it means all if/elseif blocks were executed
          // Skip to endif
          const endifIndex = this.findEndif(i);
          if (endifIndex === -1) {
            throw new Error('else 블록이 올바르게 닫히지 않았습니다 (endif 없음)');
          }
          this.log('이전 블록 실행 완료 - endif로 이동', 'info');
          i = endifIndex;
          i++;
          continue;
        }

        if (action.type === 'endif') {
          this.log('조건문 종료', 'info');
          i++;
          continue;
        }

        // Handle loop actions
        if (action.type === 'loop_count') {
          // Start a new loop - push to stack
          loopStack.push({
            loopId: action.loopId,
            startIndex: i,
            currentIteration: 0,
            maxIterations: action.count,
            type: 'loop_count'
          });
          this.log(`LOOP ${action.count}회 시작`, 'info');
          i++;
          continue;
        }

        if (action.type === 'endloop') {
          // Check if we should continue looping
          const currentLoop = loopStack[loopStack.length - 1];

          if (!currentLoop || currentLoop.loopId !== action.loopId) {
            throw new Error('LOOP/ENDLOOP 쌍이 맞지 않습니다');
          }

          currentLoop.currentIteration++;

          // Check if we should continue
          if (currentLoop.currentIteration < currentLoop.maxIterations) {
            // Continue looping - jump back to loop start
            this.log(`ENDLOOP (${currentLoop.currentIteration}/${currentLoop.maxIterations}) - 반복 계속`, 'info');
            i = currentLoop.startIndex + 1;
          } else {
            // Loop complete - pop from stack
            this.log(`ENDLOOP - ${currentLoop.maxIterations}회 반복 완료`, 'info');
            loopStack.pop();
            i++;
          }
          continue;
        }

        if (action.type === 'break') {
          // Break out of the nearest loop
          if (loopStack.length === 0) {
            throw new Error('BREAK는 LOOP 내부에서만 사용할 수 있습니다');
          }

          const breakLoop = loopStack.pop();
          this.log(`BREAK - 반복 중단 (${breakLoop.currentIteration}/${breakLoop.maxIterations})`, 'info');

          // Find matching ENDLOOP
          const endloopIndex = this.findMatchingEndloop(i, breakLoop.loopId);
          if (endloopIndex === -1) {
            throw new Error('BREAK: 대응하는 ENDLOOP를 찾을 수 없습니다');
          }

          i = endloopIndex + 1;
          continue;
        }

        // Execute regular action
        this.log(`액션 ${i + 1}/${this.state.actions.length} 실행 중...`, 'info');
        await this.executeAction(action);
        i++;
      }

      // Reset highlighting after all actions complete
      this.state.currentExecutingActionIndex = -1;
      this.displayActions();

      this.log('모든 액션 실행 완료', 'info');
    } catch (error) {
      console.error('액션 실행 오류:', error);
      // Don't log here - error is already logged at lower level

      // Reset highlighting on error
      this.state.currentExecutingActionIndex = -1;
      this.displayActions();
    }
  }

  // Helper function to find matching elseif, else or endif
  findElseOrEndif(ifIndex) {
    let depth = 0;
    let elseifIndex = -1;
    let elseIndex = -1;

    for (let i = ifIndex + 1; i < this.state.actions.length; i++) {
      const action = this.state.actions[i];

      if (action.type === 'if') {
        depth++;
      } else if (action.type === 'endif') {
        if (depth === 0) {
          return { elseifIndex, elseIndex, endifIndex: i };
        }
        depth--;
      } else if (action.type === 'elseif' && depth === 0 && elseifIndex === -1) {
        // Return first elseif found
        elseifIndex = i;
        return { elseifIndex, elseIndex: -1, endifIndex: -1 };
      } else if (action.type === 'else' && depth === 0 && elseIndex === -1) {
        elseIndex = i;
      }
    }

    return { elseifIndex, elseIndex, endifIndex: -1 };
  }

  // Helper function to find matching endif
  findEndif(startIndex) {
    let depth = 0;

    for (let i = startIndex + 1; i < this.state.actions.length; i++) {
      const action = this.state.actions[i];

      if (action.type === 'if') {
        depth++;
      } else if (action.type === 'endif') {
        if (depth === 0) {
          return i;
        }
        depth--;
      }
    }

    return -1;
  }

  // Helper function to find the last IF before the end of actions
  findLastIfBeforeEnd() {
    for (let i = this.state.actions.length - 1; i >= 0; i--) {
      if (this.state.actions[i].type === 'if') {
        return i;
      }
    }
    return -1;
  }

  // Helper function to find matching ENDLOOP for given loop ID
  findMatchingEndloop(startIndex, loopId) {
    for (let i = startIndex + 1; i < this.state.actions.length; i++) {
      const action = this.state.actions[i];
      if (action.type === 'endloop' && action.loopId === loopId) {
        return i;
      }
    }
    return -1;
  }

  // Helper function to find matching ENDIF for given IF using pairId
  findMatchingEndif(ifIndex) {
    const ifAction = this.state.actions[ifIndex];
    if (!ifAction || ifAction.type !== 'if' || !ifAction.pairId) {
      return -1;
    }

    const pairId = ifAction.pairId;

    // Search for ENDIF with matching pairId
    for (let i = ifIndex + 1; i < this.state.actions.length; i++) {
      const action = this.state.actions[i];
      if (action.type === 'endif' && action.pairId === pairId) {
        return i;
      }
    }

    return -1;
  }

  async loadMacro() {
    try {
      if (window.api) {
        const result = await window.api.macro.list();
        // Handle both array and {success, macros} response formats
        const macros = Array.isArray(result) ? result : (result && result.macros) || [];
        this.state.macros = macros;
        this.displayMacros();
        if (macros.length > 0) {
          this.log(`매크로 ${macros.length}개 불러오기 완료`, 'info');
        }
      }
    } catch (error) {
      this.log(`매크로 불러오기 실패: ${error.message}`, 'error');
    }
  }

  async saveMacro() {
    try {
      // If no actions, cannot save
      if (this.state.actions.length === 0) {
        throw new Error('저장할 액션이 없습니다');
      }

      // If editing an existing macro, update it
      if (this.state.selectedMacro) {
        // Update the selected macro's actions
        this.state.selectedMacro.actions = [...this.state.actions];

        if (window.api) {
          const result = await window.api.macro.save(this.state.selectedMacro);
          if (result && result.success) {
            this.log('매크로 업데이트 완료', 'info');

            // Reload macro list
            await this.loadMacro();

            // Clear current actions and selected macro
            this.state.actions = [];
            this.state.selectedMacro = null;
            this.displayActions();

            // Hide edit mode indicator
            this.hideEditMode();

            // Switch to manage tab
            this.switchTab('manage');
          }
        }
      } else {
        // Creating new macro - show modal to enter name
        this.openModal('macro-name-modal');
      }
    } catch (error) {
      this.log(`매크로 저장 실패: ${error.message}`, 'error');
    }
  }

  async runMacro() {
    try {
      if (!this.state.selectedMacro) {
        throw new Error('실행할 매크로를 선택하세요');
      }

      if (!this.state.selectedDevice) {
        throw new Error('디바이스를 먼저 선택하세요');
      }

      // 매크로의 액션들을 현재 액션 목록에 로드
      this.state.actions = [...this.state.selectedMacro.actions];
      this.displayActions();

      // 액션 실행
      await this.runActions();

      this.log(`매크로 실행 완료: ${this.state.selectedMacro.name}`, 'info');
    } catch (error) {
      this.log(`매크로 실행 실패: ${error.message}`, 'error');
    }
  }

  editMacro() {
    try {
      if (!this.state.selectedMacro) {
        throw new Error('수정할 매크로를 선택하세요');
      }

      // 선택된 매크로의 액션들을 현재 액션 목록에 로드
      this.state.actions = [...this.state.selectedMacro.actions];
      this.displayActions();

      // '추가' 탭으로 전환
      this.switchTab('add');

      this.log(`매크로 수정 모드: ${this.state.selectedMacro.name}`, 'info');
    } catch (error) {
      this.log(`매크로 수정 실패: ${error.message}`, 'error');
    }
  }

  async deleteMacro() {
    try {
      if (!this.state.selectedMacro) {
        throw new Error('삭제할 매크로를 선택하세요');
      }

      // 확인 대화상자
      const confirmed = confirm(`"${this.state.selectedMacro.name}" 매크로를 삭제하시겠습니까?`);
      if (!confirmed) {
        return;
      }

      if (window.api) {
        const result = await window.api.macro.delete(this.state.selectedMacro.name);
        if (result && result.success) {
          this.log(`매크로 삭제 완료: ${this.state.selectedMacro.name}`, 'info');
          this.state.selectedMacro = null;
          await this.loadMacro();
        }
      }
    } catch (error) {
      this.log(`매크로 삭제 실패: ${error.message}`, 'error');
    }
  }

  // Edit macro by ID (for individual edit buttons)
  async editMacroById(macroId) {
    try {
      const macro = this.state.macros.find(m => m.id === macroId);
      if (!macro) {
        throw new Error('매크로를 찾을 수 없습니다');
      }

      // Load full macro data with actions
      if (window.api) {
        const result = await window.api.macro.get(macroId);
        if (result && result.success && result.macro) {
          const fullMacro = result.macro;
          this.state.selectedMacro = fullMacro;
          this.state.actions = fullMacro.actions ? [...fullMacro.actions] : [];
          this.state.isEditMode = true;
          this.displayActions();

          // Show edit mode indicator
          this.showEditMode(fullMacro.name);

          // Switch to add tab
          this.switchTab('add');

          this.log(`매크로 수정 모드: ${fullMacro.name}`, 'info');
        }
      }
    } catch (error) {
      this.log(`매크로 불러오기 실패: ${error.message}`, 'error');
    }
  }

  // Show edit mode indicator
  showEditMode(macroName) {
    const indicator = document.getElementById('edit-mode-indicator');
    const nameSpan = document.getElementById('editing-macro-name');

    if (indicator && nameSpan) {
      nameSpan.textContent = macroName;
      indicator.classList.remove('hidden');
    }
  }

  // Hide edit mode indicator
  hideEditMode() {
    const indicator = document.getElementById('edit-mode-indicator');

    if (indicator) {
      indicator.classList.add('hidden');
    }

    this.state.isEditMode = false;
    this.state.selectedMacro = null;
  }

  // Cancel editing
  cancelEdit() {
    if (confirm('수정을 취소하시겠습니까? 저장하지 않은 변경 사항은 사라집니다.')) {
      this.state.actions = [];
      this.displayActions();
      this.hideEditMode();
      this.log('매크로 수정 취소됨', 'info');
    }
  }

  // Toggle select all checkboxes
  toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('select-all-macros');
    const checkboxes = document.querySelectorAll('.macro-checkbox');

    checkboxes.forEach(checkbox => {
      checkbox.checked = selectAllCheckbox.checked;
    });
  }

  // Update select all checkbox state based on individual checkboxes
  updateSelectAllState() {
    const selectAllCheckbox = document.getElementById('select-all-macros');
    const checkboxes = document.querySelectorAll('.macro-checkbox');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;

    selectAllCheckbox.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
    selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
  }

  // Get selected macro IDs
  getSelectedMacroIds() {
    const checkboxes = document.querySelectorAll('.macro-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.dataset.macroId);
  }

  // Run selected macros
  async runSelectedMacros() {
    try {
      const selectedIds = this.getSelectedMacroIds();

      if (selectedIds.length === 0) {
        throw new Error('실행할 매크로를 선택하세요');
      }

      if (!this.state.selectedDevice) {
        throw new Error('디바이스를 먼저 선택하세요');
      }

      if (!window.api) {
        throw new Error('API가 초기화되지 않았습니다');
      }

      this.log(`${selectedIds.length}개 매크로 실행 시작`, 'info');

      for (const macroId of selectedIds) {
        const result = await window.api.macro.get(macroId);
        if (result && result.success && result.macro) {
          const fullMacro = result.macro;
          if (fullMacro.actions) {
            this.log(`매크로 실행 중: ${fullMacro.name}`, 'info');

            for (const action of fullMacro.actions) {
              await this.executeAction(action);
            }

            this.log(`매크로 실행 완료: ${fullMacro.name}`, 'info');
          }
        }
      }

      this.log(`모든 매크로 실행 완료`, 'info');
    } catch (error) {
      this.log(`매크로 실행 실패: ${error.message}`, 'error');
    }
  }

  // Delete selected macros
  async deleteSelectedMacros() {
    try {
      const selectedIds = this.getSelectedMacroIds();

      if (selectedIds.length === 0) {
        throw new Error('삭제할 매크로를 선택하세요');
      }

      // Get macro names for confirmation
      const macroNames = selectedIds.map(id => {
        const macro = this.state.macros.find(m => m.id === id);
        return macro ? macro.name : id;
      });

      // Confirm deletion
      const confirmed = confirm(
        `다음 ${selectedIds.length}개 매크로를 삭제하시겠습니까?\n\n${macroNames.join('\n')}`
      );

      if (!confirmed) {
        return;
      }

      if (!window.api) {
        throw new Error('API가 초기화되지 않았습니다');
      }

      let successCount = 0;
      let failCount = 0;

      for (const macroId of selectedIds) {
        try {
          const result = await window.api.macro.delete(macroId);
          if (result && result.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error(`Failed to delete macro ${macroId}:`, error);
          failCount++;
        }
      }

      this.log(`매크로 삭제 완료: ${successCount}개 성공, ${failCount}개 실패`, 'info');

      // Reload macro list
      await this.loadMacro();

      // Uncheck select all
      const selectAllCheckbox = document.getElementById('select-all-macros');
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
      }
    } catch (error) {
      this.log(`매크로 삭제 실패: ${error.message}`, 'error');
    }
  }

  // 매크로 녹화
  startMacroRecording() {
    this.state.isMacroRecording = true;
    this.state.recordedActions = [];

    const btnStart = document.getElementById('btn-start-rec');
    const btnStop = document.getElementById('btn-stop-rec');
    const indicator = document.querySelector('.rec-indicator');
    const recText = document.getElementById('rec-text');

    if (btnStart) btnStart.classList.add('hidden');
    if (btnStop) btnStop.classList.remove('hidden');
    if (indicator) indicator.classList.add('recording');
    if (recText) recText.textContent = '녹화 중';

    // Canvas 클릭 이벤트 리스너 추가
    if (this.canvas) {
      this.canvas.addEventListener('click', this.recordClick);
    }

    this.log('매크로 녹화 시작', 'info');
  }

  stopMacroRecording() {
    this.state.isMacroRecording = false;

    const btnStart = document.getElementById('btn-start-rec');
    const btnStop = document.getElementById('btn-stop-rec');
    const indicator = document.querySelector('.rec-indicator');
    const recText = document.getElementById('rec-text');

    if (btnStart) btnStart.classList.remove('hidden');
    if (btnStop) btnStop.classList.add('hidden');
    if (indicator) indicator.classList.remove('recording');
    if (recText) recText.textContent = '대기중';

    // Canvas 클릭 이벤트 리스너 제거
    if (this.canvas) {
      this.canvas.removeEventListener('click', this.recordClick);
    }

    // 녹화된 액션을 현재 액션 목록에 추가
    if (this.state.recordedActions && this.state.recordedActions.length > 0) {
      this.state.actions = [...this.state.recordedActions];
      this.displayActions();
      this.log(`매크로 녹화 완료: ${this.state.recordedActions.length}개 액션`, 'info');
    } else {
      this.log('녹화된 액션 없음', 'warning');
    }
  }

  recordClick = (e) => {
    if (!this.state.isMacroRecording) return;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    const action = { type: 'tap', x, y };

    if (!this.state.recordedActions) {
      this.state.recordedActions = [];
    }

    this.state.recordedActions.push(action);
    this.log(`녹화: 탭 (${x}, ${y})`, 'info');
  }

  // Click mode for adding tap/swipe actions
  startClickMode(type) {
    this.state.isClickMode = true;
    this.state.clickModeType = type;
    this.state.clickModePoints = [];

    // Highlight the button that was clicked
    const activeButton = document.querySelector(`[data-action-type="${type}"]`);
    if (activeButton) {
      activeButton.classList.add('active');
    }

    // Change cursor style
    if (this.canvas) {
      this.canvas.style.cursor = 'crosshair';
    }

    // Add click listener
    if (this.canvas) {
      this.canvas.addEventListener('click', this.handleClickModeClick);
    }

    // Add ESC key listener to cancel
    this.handleEscKey = (e) => {
      if (e.key === 'Escape') {
        this.log('클릭 모드 취소됨', 'info');
        this.exitClickMode();
      }
    };
    document.addEventListener('keydown', this.handleEscKey);

    // Show instruction message
    if (type === 'tap') {
      this.log('화면을 클릭하여 탭 위치를 선택하세요 (ESC: 취소)', 'info');
    } else if (type === 'swipe') {
      this.log('화면을 클릭하여 스와이프 시작 위치를 선택하세요 (ESC: 취소)', 'info');
    } else if (type === 'image') {
      this.log('화면을 드래그하여 매칭할 영역을 선택하세요 (ESC: 취소)', 'info');
      // For image matching, use drag selection instead of click
      this.canvas.removeEventListener('click', this.handleClickModeClick);
      this.startDragSelection();
    }
  }

  startDragSelection() {
    // Add drag event listeners for image selection
    this.handleMouseDown = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;

      const x = Math.round((e.clientX - rect.left) * scaleX);
      const y = Math.round((e.clientY - rect.top) * scaleY);

      this.dragStartPoint = { x, y };
      this.isDragging = true;

      // Save current canvas state
      this.savedCanvasImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    };

    this.handleMouseMove = (e) => {
      if (!this.isDragging || !this.dragStartPoint) return;

      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;

      const x = Math.round((e.clientX - rect.left) * scaleX);
      const y = Math.round((e.clientY - rect.top) * scaleY);

      // Restore original canvas
      if (this.savedCanvasImageData) {
        this.ctx.putImageData(this.savedCanvasImageData, 0, 0);
      }

      // Draw selection rectangle
      this.ctx.strokeStyle = '#00ff00';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(
        this.dragStartPoint.x,
        this.dragStartPoint.y,
        x - this.dragStartPoint.x,
        y - this.dragStartPoint.y
      );
    };

    this.handleMouseUp = async (e) => {
      if (!this.isDragging || !this.dragStartPoint) return;

      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;

      const x = Math.round((e.clientX - rect.left) * scaleX);
      const y = Math.round((e.clientY - rect.top) * scaleY);

      this.dragEndPoint = { x, y };
      this.isDragging = false;

      // Restore original canvas
      if (this.savedCanvasImageData) {
        this.ctx.putImageData(this.savedCanvasImageData, 0, 0);
        this.savedCanvasImageData = null;
      }

      // Calculate crop area
      const x1 = Math.min(this.dragStartPoint.x, this.dragEndPoint.x);
      const y1 = Math.min(this.dragStartPoint.y, this.dragEndPoint.y);
      const width = Math.abs(this.dragEndPoint.x - this.dragStartPoint.x);
      const height = Math.abs(this.dragEndPoint.y - this.dragStartPoint.y);

      // Check if area is too small
      if (width < 10 || height < 10) {
        this.log('선택 영역이 너무 작습니다. 다시 시도하세요', 'warning');
        this.dragStartPoint = null;
        this.dragEndPoint = null;
        return;
      }

      // Crop the selected area from canvas
      const croppedImageData = this.ctx.getImageData(x1, y1, width, height);

      // Create a temporary canvas to convert ImageData to data URL
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.putImageData(croppedImageData, 0, 0);
      const croppedImageDataUrl = tempCanvas.toDataURL('image/png');

      // Store captured image with crop location and open edit modal
      this.capturedImageDataUrl = croppedImageDataUrl;
      this.capturedImageCropLocation = { x: x1, y: y1, width: width, height: height };
      this.exitClickMode();
      this.openImageEditModal();
    };

    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
  }

  handleClickModeClick = async (e) => {
    if (!this.state.isClickMode) return;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    // Check if we're editing an existing action
    const isEditing = (this.currentEditingActionIndex !== null && this.currentEditingActionIndex !== undefined);

    if (this.state.clickModeType === 'tap') {
      if (isEditing) {
        // Update existing tap action
        const action = this.state.actions[this.currentEditingActionIndex];
        if (action && action.type === 'tap') {
          action.x = x;
          action.y = y;
          this.displayActions();
          this.log(`탭 액션 좌표 수정: (${x}, ${y})`, 'info');
          this.currentEditingActionIndex = null;
        }
      } else {
        // Add new tap action
        const action = { type: 'tap', x, y };
        this.state.actions.push(action);
        this.displayActions();
        this.log(`탭 액션 추가: (${x}, ${y})`, 'info');

        // Execute tap on device immediately
        await this.executeAction(action);
      }

      this.exitClickMode();
    } else if (this.state.clickModeType === 'swipe') {
      this.state.clickModePoints.push({ x, y });

      if (this.state.clickModePoints.length === 1) {
        // First point selected, wait for second point
        this.log(`시작 위치: (${x}, ${y}). 이제 종료 위치를 클릭하세요`, 'info');
      } else if (this.state.clickModePoints.length === 2) {
        // Both points selected
        const start = this.state.clickModePoints[0];
        const end = this.state.clickModePoints[1];

        if (isEditing) {
          // Update existing swipe action
          const action = this.state.actions[this.currentEditingActionIndex];
          if (action && action.type === 'swipe') {
            action.x1 = start.x;
            action.y1 = start.y;
            action.x2 = end.x;
            action.y2 = end.y;
            this.displayActions();
            this.log(`스와이프 액션 좌표 수정: (${start.x},${start.y}) → (${end.x},${end.y})`, 'info');
            this.currentEditingActionIndex = null;
          }
        } else {
          // Add new swipe action
          const action = {
            type: 'swipe',
            x1: start.x,
            y1: start.y,
            x2: end.x,
            y2: end.y,
            duration: 300
          };
          this.state.actions.push(action);
          this.displayActions();
          this.log(`스와이프 액션 추가: (${start.x},${start.y}) → (${end.x},${end.y})`, 'info');

          // Execute swipe on device immediately
          await this.executeAction(action);
        }

        this.exitClickMode();
      }
    }
  }

  exitClickMode() {
    // Remove active class from all action buttons
    const activeButtons = document.querySelectorAll('.action-btn.active');
    activeButtons.forEach(btn => btn.classList.remove('active'));

    this.state.isClickMode = false;
    this.state.clickModeType = null;
    this.state.clickModePoints = [];

    // Reset cursor style
    if (this.canvas) {
      this.canvas.style.cursor = 'default';
    }

    // Remove click listener
    if (this.canvas) {
      this.canvas.removeEventListener('click', this.handleClickModeClick);
    }

    // Remove drag listeners for image selection
    if (this.handleMouseDown && this.canvas) {
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
      this.handleMouseDown = null;
    }
    if (this.handleMouseMove && this.canvas) {
      this.canvas.removeEventListener('mousemove', this.handleMouseMove);
      this.handleMouseMove = null;
    }
    if (this.handleMouseUp && this.canvas) {
      this.canvas.removeEventListener('mouseup', this.handleMouseUp);
      this.handleMouseUp = null;
    }

    // Remove cursor label
    const cursorLabel = document.getElementById('cursor-label');
    if (cursorLabel) {
      cursorLabel.remove();
    }

    // Remove ESC key listener
    if (this.handleEscKey) {
      document.removeEventListener('keydown', this.handleEscKey);
      this.handleEscKey = null;
    }

    // Restore canvas and clear saved image data
    if (this.savedCanvasImageData && this.ctx) {
      this.ctx.putImageData(this.savedCanvasImageData, 0, 0);
      this.savedCanvasImageData = null;
    }

    // Clear drag state
    this.isDragging = false;
    this.dragStartPoint = null;
    this.dragEndPoint = null;
  }

  // 로그 관리
  log(message, level = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, message, level };

    this.state.logs.push(logEntry);

    // 로그 뷰어에 추가
    const logViewer = document.getElementById('log-viewer');
    if (logViewer) {
      const entry = document.createElement('div');
      entry.className = `log-entry ${level}`;
      entry.textContent = `[${timestamp}] ${message}`;
      entry.dataset.level = level;

      logViewer.appendChild(entry);
      logViewer.scrollTop = logViewer.scrollHeight;

      // 최대 100개 로그 유지
      if (logViewer.children.length > 100) {
        logViewer.removeChild(logViewer.firstChild);
      }
    }

    // 콘솔에도 출력
    console.log(`[${level.toUpperCase()}] ${message}`);
  }

  filterLogs(level) {
    const logViewer = document.getElementById('log-viewer');
    if (!logViewer) return;

    const entries = logViewer.querySelectorAll('.log-entry');
    entries.forEach(entry => {
      if (level === 'all' || entry.dataset.level === level) {
        entry.style.display = 'block';
      } else {
        entry.style.display = 'none';
      }
    });
  }

  clearLogs() {
    this.state.logs = [];
    const logViewer = document.getElementById('log-viewer');
    if (logViewer) {
      logViewer.innerHTML = '';
    }
    this.log('로그 초기화됨', 'info');
  }

  async saveLogs() {
    try {
      // Convert logs to text format
      const logText = this.state.logs.map(log =>
        `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`
      ).join('\n');

      // Save to file system via IPC
      const result = await window.api.file.saveLogs(logText);

      if (result.success) {
        this.log(`로그 저장 완료: ${result.path}`, 'info');
      } else {
        this.log(`로그 저장 실패: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error saving logs:', error);
      this.log(`로그 저장 실패: ${error.message}`, 'error');
    }
  }

  async saveScreenshot() {
    try {
      const canvas = document.getElementById('screen-canvas');
      if (!canvas) {
        this.log('캔버스를 찾을 수 없습니다', 'error');
        return;
      }

      // Convert canvas to data URL
      const dataUrl = canvas.toDataURL('image/png');

      // Save to file system via IPC
      const result = await window.api.file.saveScreenshot(dataUrl);

      if (result.success) {
        this.log(`화면 저장 완료: ${result.path}`, 'info');
      } else {
        this.log(`화면 저장 실패: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error saving screenshot:', error);
      this.log(`화면 저장 실패: ${error.message}`, 'error');
    }
  }

  // 모달 관리
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      modal.style.visibility = 'visible';
      modal.style.opacity = '1';
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
      modal.style.visibility = 'hidden';
      modal.style.opacity = '0';
    }
  }

  createInputModal(title, message) {
    return {
      show: (initialValue = '') => {
        return new Promise((resolve) => {
          console.log('[Modal] Creating modal with title:', title);
          // 임시 모달 생성 (실제로는 HTML에 정의된 모달 사용 권장)
          const modal = document.createElement('div');
          modal.className = 'modal';
          modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
              <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close">&times;</button>
              </div>
              <div class="modal-body">
                <p>${message}</p>
                <input type="text" class="form-control" id="temp-input" value="${initialValue}">
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" id="temp-cancel">취소</button>
                <button class="btn btn-primary" id="temp-confirm">확인</button>
              </div>
            </div>
          `;

          console.log('[Modal] Appending modal to body');
          document.body.appendChild(modal);
          console.log('[Modal] Modal appended, display:', window.getComputedStyle(modal).display);

          const inputField = modal.querySelector('#temp-input');
          console.log('[Modal] Input field found:', !!inputField);

          const cleanup = () => {
            console.log('[Modal] Cleanup called');
            document.body.removeChild(modal);
          };

          const closeBtn = modal.querySelector('.modal-close');
          const cancelBtn = modal.querySelector('#temp-cancel');
          const confirmBtn = modal.querySelector('#temp-confirm');

          console.log('[Modal] Buttons found - close:', !!closeBtn, 'cancel:', !!cancelBtn, 'confirm:', !!confirmBtn);

          closeBtn.addEventListener('click', () => {
            console.log('[Modal] Close button clicked');
            cleanup();
            resolve(null);
          });

          cancelBtn.addEventListener('click', () => {
            console.log('[Modal] Cancel button clicked');
            cleanup();
            resolve(null);
          });

          confirmBtn.addEventListener('click', () => {
            console.log('[Modal] Confirm button clicked');
            const value = inputField.value;
            cleanup();
            resolve(value);
          });

          // Enter key to confirm
          inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              console.log('[Modal] Enter key pressed');
              const value = inputField.value;
              cleanup();
              resolve(value);
            }
          });

          // Focus and select all text
          console.log('[Modal] Focusing input field');
          setTimeout(() => {
            inputField.focus();
            inputField.select();
            console.log('[Modal] Input field focused and selected');
          }, 100);
        });
      }
    };
  }

  // 설정
  toggleSettings() {
    // 설정 패널 토글 (추가 구현 필요)
    this.log('설정 패널 토글', 'info');
  }

  toggleQuickPanel() {
    // 빠른 패널 토글 (추가 구현 필요)
    this.log('빠른 패널 토글', 'info');
  }

  // Image matching methods
  openImageEditModal() {
    if (!this.capturedImageDataUrl) {
      this.log('캡처된 이미지가 없습니다', 'error');
      return;
    }

    // Store the original image for reset functionality
    this.originalCapturedImageDataUrl = this.capturedImageDataUrl;

    // Get canvas and preview elements
    const cropCanvas = document.getElementById('crop-canvas');
    const previewContainer = document.getElementById('captured-image-preview');
    const autoCropBtn = document.getElementById('auto-crop-btn');
    const resetCropBtn = document.getElementById('reset-crop-btn');

    if (cropCanvas && previewContainer) {
      // Load the image to get dimensions
      const img = new Image();
      img.onload = () => {
        // Set canvas size to match image
        cropCanvas.width = img.width;
        cropCanvas.height = img.height;

        // Draw image on canvas
        const ctx = cropCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Show canvas and hide placeholder
        cropCanvas.style.display = 'block';
        previewContainer.style.display = 'none';

        // Show crop buttons
        if (autoCropBtn) autoCropBtn.style.display = 'inline-block';
        if (resetCropBtn) resetCropBtn.style.display = 'inline-block';
      };
      img.src = this.capturedImageDataUrl;
    }

    // Set default threshold to 95% (0.95)
    const thresholdInput = document.getElementById('match-threshold');
    const thresholdValue = document.getElementById('threshold-value');
    if (thresholdInput) {
      thresholdInput.value = '0.95';
      if (thresholdValue) {
        thresholdValue.textContent = '95%';
      }
    }

    // Open the modal
    this.openModal('image-match-modal');

    this.log('이미지 편집 모달 열기', 'info');
  }

  confirmImageMatch() {
    try {
      // If we're in editing mode, call confirmEditAction instead
      if (this.editingImageAction) {
        this.confirmEditAction();
        return;
      }

      // Check if an image has been captured
      if (!this.capturedImageDataUrl) {
        this.log('캡처된 이미지가 없습니다', 'warning');
        return;
      }

      // Get the threshold value
      const thresholdInput = document.getElementById('match-threshold');
      const threshold = thresholdInput ? parseFloat(thresholdInput.value) : 0.95;

      // Validate threshold
      if (threshold < 0 || threshold > 1) {
        this.log('임계값은 0과 1 사이의 값이어야 합니다', 'error');
        return;
      }

      // Get captured image dimensions from canvas
      const cropCanvas = document.getElementById('crop-canvas');
      let imageWidth = 100;
      let imageHeight = 100;

      if (cropCanvas && cropCanvas.width && cropCanvas.height) {
        imageWidth = cropCanvas.width;
        imageHeight = cropCanvas.height;
      }

      // Get crop location if available
      const cropLocation = this.capturedImageCropLocation || null;

      // Create the image matching action
      const action = {
        type: 'image',
        imageData: this.capturedImageDataUrl,
        threshold: threshold,
        // Store image dimensions for tracking overlay
        imageWidth: imageWidth,
        imageHeight: imageHeight,
        // Store crop location for ImageMatcher hint and tracking overlay
        cropX: cropLocation ? cropLocation.x : null,
        cropY: cropLocation ? cropLocation.y : null,
        cropWidth: cropLocation ? cropLocation.width : imageWidth,
        cropHeight: cropLocation ? cropLocation.height : imageHeight
      };

      // Add the action to the list
      this.state.actions.push(action);
      this.displayActions();

      // Clear the captured image and crop location
      this.capturedImageDataUrl = null;
      this.originalCapturedImageDataUrl = null;
      this.capturedImageCropLocation = null;

      // Reset the preview (reuse already declared variables)
      const previewContainer = document.getElementById('captured-image-preview');
      const autoCropBtn = document.getElementById('auto-crop-btn');
      const resetCropBtn = document.getElementById('reset-crop-btn');

      if (previewContainer) {
        previewContainer.innerHTML = '<span style="color: var(--color-text-light);">이미지를 드래그하여 선택하세요</span>';
        previewContainer.style.display = 'flex';
      }

      if (cropCanvas) {
        cropCanvas.style.display = 'none';
      }

      if (autoCropBtn) autoCropBtn.style.display = 'none';
      if (resetCropBtn) resetCropBtn.style.display = 'none';

      // Reset threshold to default
      if (thresholdInput) {
        thresholdInput.value = '0.95';
      }

      // Close the modal
      this.closeModal('image-match-modal');

      this.log(`이미지 매칭 액션 추가 (임계값: ${(threshold * 100).toFixed(0)}%)`, 'info');
    } catch (error) {
      this.log(`이미지 매칭 액션 추가 실패: ${error.message}`, 'error');
    }
  }

  // Auto crop background - removes uniform or transparent background
  autoCropBackground() {
    try {
      const cropCanvas = document.getElementById('crop-canvas');
      if (!cropCanvas) {
        this.log('캔버스를 찾을 수 없습니다', 'error');
        return;
      }

      const ctx = cropCanvas.getContext('2d');
      const width = cropCanvas.width;
      const height = cropCanvas.height;

      // Get image data
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Find the bounding box of non-background pixels
      let minX = width, minY = height, maxX = 0, maxY = 0;

      // Sample corner pixels to determine background color
      const cornerSamples = [
        { x: 0, y: 0 },
        { x: width - 1, y: 0 },
        { x: 0, y: height - 1 },
        { x: width - 1, y: height - 1 }
      ];

      // Calculate average background color from corners
      let bgR = 0, bgG = 0, bgB = 0, bgA = 0;
      cornerSamples.forEach(sample => {
        const idx = (sample.y * width + sample.x) * 4;
        bgR += data[idx];
        bgG += data[idx + 1];
        bgB += data[idx + 2];
        bgA += data[idx + 3];
      });
      bgR = Math.round(bgR / 4);
      bgG = Math.round(bgG / 4);
      bgB = Math.round(bgB / 4);
      bgA = Math.round(bgA / 4);

      // Tolerance for background matching (adjust as needed)
      const tolerance = 30;

      // Scan image to find content boundaries
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];

          // Check if pixel is significantly different from background
          const diffR = Math.abs(r - bgR);
          const diffG = Math.abs(g - bgG);
          const diffB = Math.abs(b - bgB);
          const diffA = Math.abs(a - bgA);

          if (diffR > tolerance || diffG > tolerance || diffB > tolerance || diffA > tolerance) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // Check if we found any content
      if (maxX === 0 && maxY === 0) {
        this.log('자동 크롭할 영역을 찾을 수 없습니다', 'warning');
        return;
      }

      // Add small padding
      const padding = 2;
      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = Math.min(width - 1, maxX + padding);
      maxY = Math.min(height - 1, maxY + padding);

      // Calculate cropped dimensions
      const cropWidth = maxX - minX + 1;
      const cropHeight = maxY - minY + 1;

      // Check if crop area is valid
      if (cropWidth < 10 || cropHeight < 10) {
        this.log('크롭 영역이 너무 작습니다', 'warning');
        return;
      }

      // Get the cropped image data
      const croppedImageData = ctx.getImageData(minX, minY, cropWidth, cropHeight);

      // Create new canvas with cropped size
      const newCanvas = document.createElement('canvas');
      newCanvas.width = cropWidth;
      newCanvas.height = cropHeight;
      const newCtx = newCanvas.getContext('2d');
      newCtx.putImageData(croppedImageData, 0, 0);

      // Update the display canvas
      cropCanvas.width = cropWidth;
      cropCanvas.height = cropHeight;
      ctx.putImageData(croppedImageData, 0, 0);

      // Update the captured image data URL
      this.capturedImageDataUrl = cropCanvas.toDataURL('image/png');

      // IMPORTANT: Update crop location to account for background removal offset
      // The template image is now smaller, but cropX/cropY should point to where
      // the content actually starts in the original screen
      if (this.capturedImageCropLocation) {
        this.capturedImageCropLocation.x += minX;
        this.capturedImageCropLocation.y += minY;
        this.capturedImageCropLocation.width = cropWidth;
        this.capturedImageCropLocation.height = cropHeight;

        console.log(`[AutoCrop] Adjusted crop location for background removal:`);
        console.log(`  Offset: (+${minX}, +${minY})`);
        console.log(`  New location: (${this.capturedImageCropLocation.x}, ${this.capturedImageCropLocation.y})`);
        console.log(`  New size: ${cropWidth}x${cropHeight}`);
      }

      this.log(`배경 자동 제거 완료 (${cropWidth}x${cropHeight}, offset: +${minX},+${minY})`, 'info');
    } catch (error) {
      this.log(`배경 자동 제거 실패: ${error.message}`, 'error');
    }
  }

  // Reset crop to original captured image
  resetCrop() {
    try {
      if (!this.originalCapturedImageDataUrl) {
        this.log('원본 이미지가 없습니다', 'error');
        return;
      }

      // Reset to original image
      this.capturedImageDataUrl = this.originalCapturedImageDataUrl;

      // Reload the canvas with original image
      const cropCanvas = document.getElementById('crop-canvas');
      if (cropCanvas) {
        const img = new Image();
        img.onload = () => {
          cropCanvas.width = img.width;
          cropCanvas.height = img.height;
          const ctx = cropCanvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
        };
        img.src = this.originalCapturedImageDataUrl;
      }

      this.log('원본 이미지로 복원됨', 'info');
    } catch (error) {
      this.log(`원본 복원 실패: ${error.message}`, 'error');
    }
  }

  // New device connection methods (UI.md based)
  onProtocolChange(protocol) {
    const adbArea = document.getElementById('adb-connection-area');
    const ccncArea = document.getElementById('ccnc-connection-area');

    if (protocol === 'adb') {
      adbArea.style.display = 'flex';
      ccncArea.style.display = 'none';
      this.state.connectionType = 'adb';
    } else if (protocol === 'ccnc') {
      adbArea.style.display = 'none';
      ccncArea.style.display = 'flex';
      this.state.connectionType = 'ccnc';
    }
  }

  async connectADB() {
    const select = document.getElementById('adb-device-list');
    const deviceId = select.value;

    if (!deviceId) {
      this.log('장치를 선택해주세요', 'warning');
      return;
    }

    this.updateConnectionStatus('connecting', 'ADB 연결 중...', deviceId);

    try {
      const result = await window.api.device.select(deviceId);

      if (result.success) {
        this.log(`ADB 장치 연결 성공: ${deviceId}`, 'success');
        this.state.selectedDevice = { id: deviceId, connectionType: 'adb' };
        this.updateConnectionStatus('connected', `ADB 연결됨`, deviceId);

        // Enable streaming button
        const streamBtn = document.getElementById('btn-stream');
        if (streamBtn) {
          streamBtn.disabled = false;
        }
      } else {
        throw new Error(result.error || 'ADB 연결 실패');
      }
    } catch (error) {
      this.log(`ADB 연결 실패: ${error.message}`, 'error');
      this.updateConnectionStatus('failed', `연결 실패`, error.message);
    }
  }

  updateConnectionStatus(status, statusText, details = '') {
    const card = document.getElementById('connection-status-card');
    const textEl = card.querySelector('.status-text');
    const detailsEl = card.querySelector('.status-details span');
    const actionBtn = document.getElementById('status-action-btn');
    const adbArea = document.getElementById('adb-connection-area');
    const ccncArea = document.getElementById('ccnc-connection-area');
    const protocolSelector = document.querySelector('.protocol-selector');
    const inlineStatus = document.getElementById('connection-status-inline');
    const inlineText = document.getElementById('status-inline-text');

    // Remove all status classes
    card.classList.remove('status-disconnected', 'status-connecting', 'status-connected', 'status-failed');

    // Toggle visibility based on connection status
    if (status === 'disconnected') {
      // Show: protocol selector + connection area
      // Hide: status card + inline status
      card.classList.add('hidden');
      if (inlineStatus) inlineStatus.classList.add('hidden');
      if (protocolSelector) protocolSelector.style.display = 'flex';

      if (this.state.connectionType === 'adb') {
        if (adbArea) adbArea.style.display = 'flex';
        if (ccncArea) ccncArea.style.display = 'none';
      } else {
        if (adbArea) adbArea.style.display = 'none';
        if (ccncArea) ccncArea.style.display = 'flex';
      }
    } else if (status === 'connected') {
      // Show: inline status only (compact 1-line)
      // Hide: protocol selector + connection areas + status card
      card.classList.add('hidden');
      if (protocolSelector) protocolSelector.style.display = 'none';
      if (adbArea) adbArea.style.display = 'none';
      if (ccncArea) ccncArea.style.display = 'none';

      if (inlineStatus) {
        inlineStatus.classList.remove('hidden');
        if (inlineText) inlineText.textContent = `${statusText}: ${details}`;
      }
    } else {
      // connecting/failed: Show status card
      // Hide: protocol selector + connection areas + inline status
      if (protocolSelector) protocolSelector.style.display = 'none';
      if (adbArea) adbArea.style.display = 'none';
      if (ccncArea) ccncArea.style.display = 'none';
      if (inlineStatus) inlineStatus.classList.add('hidden');

      card.classList.add(`status-${status}`);
      textEl.textContent = statusText;
      detailsEl.textContent = details;
      card.classList.remove('hidden');

      // Update button
      switch (status) {
        case 'connecting':
          actionBtn.textContent = '취소';
          actionBtn.onclick = () => this.disconnectDevice();
          break;
        case 'failed':
          actionBtn.textContent = '재시도';
          actionBtn.onclick = () => this.state.connectionType === 'adb' ? this.connectADB() : this.connectCCNC();
          break;
      }
    }
  }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
  window.unifiedApp = new UnifiedApp();
});