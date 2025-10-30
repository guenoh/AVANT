/**
 * Macro Editor - Main Controller
 * 매크로 에디터의 메인 컨트롤러
 * 전체 에디터 상태 관리 및 패널 간 조율
 */

class MacroEditor {
  constructor() {
    // Stores
    this.deviceStore = window.DeviceStore;
    this.screenStore = window.ScreenStore;
    this.macroStore = window.MacroStore;
    this.actionStore = window.ActionStore;

    // Services
    this.ipcService = window.IPCService;
    this.eventBus = window.EventBus;
    this.api = window.api;

    // Legacy components (for IPC communication)
    this.devicePanel = null;
    this.screenPanel = null;
    this.macroPanel = null;
    this.actionPanel = null;

    // New editor panels
    this.macroListPanel = null;
    this.timelineEditor = null;
    this.propertiesPanel = null;

    // State
    this.currentMacro = null;
    this.isRunning = false;
    this.debugMode = false;
  }

  /**
   * Initialize the editor
   */
  async init() {
    console.log('[MacroEditor] Initializing...');

    // Initialize legacy components (for IPC)
    this._initLegacyComponents();

    // Initialize new editor panels
    this._initEditorPanels();

    // Setup event listeners
    this._setupEventListeners();

    // Subscribe to store changes
    this._subscribeToStores();

    // Load initial data
    await this._loadInitialData();

    // Show device connection modal if not connected
    const deviceState = this.deviceStore.getState();
    if (!deviceState.isConnected) {
      setTimeout(() => this.showDeviceModal(), 500);
    }

    console.log('[MacroEditor] Initialization complete');
  }

  /**
   * Initialize legacy components (needed for IPC communication)
   */
  _initLegacyComponents() {
    // These are used for IPC communication with main process
    this.devicePanel = new window.DevicePanel(this.api, this.deviceStore);
    this.devicePanel.init();

    const canvas = document.getElementById('screen-canvas');
    this.screenPanel = new window.ScreenPanel(this.api, this.screenStore, canvas);
    this.screenPanel.init();

    this.macroPanel = new window.MacroPanel(this.api, this.macroStore, this.actionStore);
    this.macroPanel.init();

    this.actionPanel = new window.ActionPanel(this.api, this.actionStore, this.screenPanel);
    this.actionPanel.init();

    console.log('[MacroEditor] Legacy components initialized');
  }

  /**
   * Initialize new editor panels
   */
  _initEditorPanels() {
    // Create and initialize panels
    this.macroListPanel = new window.MacroListPanel(this.macroStore, this);
    this.macroListPanel.init();

    this.timelineEditor = new window.TimelineEditor(this.actionStore, this);
    this.timelineEditor.init();

    this.propertiesPanel = new window.PropertiesPanel(this.actionStore, this);
    this.propertiesPanel.init();

    // Expose panels globally for onclick handlers
    window.macroListPanel = this.macroListPanel;
    window.timelineEditor = this.timelineEditor;
    window.propertiesPanel = this.propertiesPanel;

    console.log('[MacroEditor] Editor panels initialized');
  }

  /**
   * Setup global event listeners
   */
  _setupEventListeners() {
    // Listen to custom events from panels
    document.addEventListener('macro-selected', (e) => {
      this.onMacroSelected(e.detail.macro);
    });

    document.addEventListener('action-selected', (e) => {
      this.propertiesPanel.loadAction(e.detail.action);
    });

    document.addEventListener('macro-list:macro-run', (e) => {
      this.runMacroById(e.detail.macroId);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this._handleKeyboardShortcut(e);
    });
  }

  /**
   * Subscribe to store changes
   */
  _subscribeToStores() {
    // Device store
    this.deviceStore.subscribe((event) => {
      if (event.type === 'state-change') {
        this._updateDeviceStatus();
      }
    });

    // Action store
    this.actionStore.subscribe((event) => {
      if (event.type === 'state-change') {
        this._updateActionStats();
      }
    });

    // Macro store
    this.macroStore.subscribe((event) => {
      if (event.type === 'state-change') {
        if (event.changes.isRunning !== undefined) {
          this.isRunning = event.changes.isRunning;
          this._updateRunButtons();
        }
      }
    });
  }

  /**
   * Load initial data
   */
  async _loadInitialData() {
    // Scan devices
    await this.devicePanel.scanDevices();

    // Load macros
    await this.macroListPanel.loadMacros();

    console.log('[MacroEditor] Initial data loaded');
  }

  /**
   * Update device status in toolbar
   */
  _updateDeviceStatus() {
    const state = this.deviceStore.getState();
    const iconEl = document.getElementById('device-status-icon');
    const nameEl = document.getElementById('device-status-name');

    if (state.isConnected && state.selectedDevice) {
      iconEl.textContent = '🟢';
      nameEl.textContent = state.selectedDevice.model || state.selectedDevice.id;
    } else {
      iconEl.textContent = '🔴';
      nameEl.textContent = '연결 안 됨';
    }
  }

  /**
   * Update action statistics
   */
  _updateActionStats() {
    const actions = this.actionStore.get('actions');
    const totalCount = actions.length;

    // Calculate estimated time
    let estimatedTime = 0;
    actions.forEach(action => {
      if (action.type === 'wait') {
        estimatedTime += action.duration || 0;
      } else {
        estimatedTime += 500; // Default action time
      }
    });

    document.getElementById('stat-total-actions').textContent = totalCount;
    document.getElementById('stat-estimated-time').textContent = `${(estimatedTime / 1000).toFixed(1)}초`;
    document.getElementById('timeline-action-count').textContent = `${totalCount}개`;
  }

  /**
   * Update run/stop buttons state
   */
  _updateRunButtons() {
    const runBtn = document.getElementById('btn-run-macro');
    const stopBtn = document.getElementById('btn-stop-macro');

    if (this.isRunning) {
      runBtn.disabled = true;
      stopBtn.disabled = false;
    } else {
      const hasActions = this.actionStore.get('actions').length > 0;
      runBtn.disabled = !hasActions;
      stopBtn.disabled = true;
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  _handleKeyboardShortcut(e) {
    // Ctrl/Cmd + S: Save macro
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      this.saveMacro();
    }

    // Ctrl/Cmd + Enter: Run macro
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      this.runCurrentMacro();
    }

    // Ctrl/Cmd + N: New macro
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      this.macroListPanel.createNewMacro();
    }

    // Delete: Delete selected action
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.timelineEditor.selectedActionIndex !== -1) {
        e.preventDefault();
        this.timelineEditor.deleteSelectedAction();
      }
    }
  }

  /**
   * Show device connection modal
   */
  showDeviceModal() {
    const modal = document.getElementById('device-modal');
    modal.style.display = 'flex';
  }

  /**
   * Close device connection modal
   */
  closeDeviceModal() {
    const modal = document.getElementById('device-modal');
    modal.style.display = 'none';
  }

  /**
   * Protocol change handler
   */
  onProtocolChange(protocol) {
    const adbArea = document.getElementById('adb-connection-area');
    const ccncArea = document.getElementById('ccnc-connection-area');

    if (protocol === 'adb') {
      adbArea.style.display = 'block';
      ccncArea.style.display = 'none';
    } else {
      adbArea.style.display = 'none';
      ccncArea.style.display = 'block';
    }
  }

  /**
   * Scan for ADB devices
   */
  async scanDevices() {
    await this.devicePanel.scanDevices();
  }

  /**
   * Connect to ADB device
   */
  async connectADB() {
    await this.devicePanel.connectADB();
    this.closeDeviceModal();
  }

  /**
   * Connect to ccNC device
   */
  async connectCCNC() {
    await this.devicePanel.connectCCNC();
    this.closeDeviceModal();
  }

  /**
   * Macro selected handler
   */
  onMacroSelected(macro) {
    console.log('[MacroEditor] Macro selected:', macro);
    this.currentMacro = macro;

    // Load macro actions into timeline
    if (macro && macro.actions) {
      this.actionStore.setActions(macro.actions);
      this.timelineEditor.render();
    }
  }

  /**
   * Run current macro
   */
  async runCurrentMacro() {
    const actions = this.actionStore.get('actions');
    if (actions.length === 0) {
      alert('실행할 액션이 없습니다.');
      return;
    }

    console.log('[MacroEditor] Running current macro...');
    await this.actionPanel.runActions();
  }

  /**
   * Run macro by ID
   */
  async runMacroById(macroId) {
    const macro = this.macroStore.getMacroById(macroId);
    if (!macro) {
      console.error('[MacroEditor] Macro not found:', macroId);
      return;
    }

    console.log('[MacroEditor] Running macro:', macro.name);
    await this.macroPanel.runMacro(macroId);
  }

  /**
   * Stop macro execution
   */
  stopMacro() {
    console.log('[MacroEditor] Stopping macro...');
    // TODO: Implement stop functionality
    this.macroStore.setRunning(false);
  }

  /**
   * Save current macro
   */
  async saveMacro() {
    const actions = this.actionStore.get('actions');
    if (actions.length === 0) {
      alert('저장할 액션이 없습니다.');
      return;
    }

    const macroName = prompt('매크로 이름을 입력하세요:');
    if (!macroName) return;

    console.log('[MacroEditor] Saving macro:', macroName);
    await this.macroPanel.saveMacro(macroName);

    // Reload macro list
    await this.macroListPanel.loadMacros();
  }

  /**
   * Import macro from file
   */
  async importMacro() {
    console.log('[MacroEditor] Import macro');
    // TODO: Implement import functionality
    alert('Import 기능은 곧 추가됩니다.');
  }

  /**
   * Export macro to file
   */
  async exportMacro() {
    console.log('[MacroEditor] Export macro');
    // TODO: Implement export functionality
    alert('Export 기능은 곧 추가됩니다.');
  }

  /**
   * Toggle debug mode
   */
  toggleDebugMode() {
    this.debugMode = !this.debugMode;
    console.log('[MacroEditor] Debug mode:', this.debugMode);

    if (this.debugMode) {
      alert('디버그 모드 활성화\n- 상세 로그 출력\n- 액션 실행 단계별 확인');
    }
  }

  /**
   * Show settings
   */
  showSettings() {
    console.log('[MacroEditor] Show settings');
    // TODO: Implement settings modal
    alert('설정 기능은 곧 추가됩니다.');
  }
}

// Expose globally
window.MacroEditor = MacroEditor;
