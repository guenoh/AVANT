/**
 * Device Panel Component - Handles device connection UI
 * Subscribes to DeviceStore for reactive updates
 */

class DevicePanel {
  constructor(apiClient, deviceStore) {
    this.api = apiClient;
    this.deviceStore = deviceStore;
    this.elements = {};
    this.unsubscribe = null;
  }

  /**
   * Initialize component and bind to DOM
   */
  init() {
    this._bindElements();
    this._setupEventListeners();
    this._subscribeToStore();
    this._render();
  }

  /**
   * Bind DOM elements
   */
  _bindElements() {
    this.elements = {
      // Protocol selector
      protocolRadios: document.querySelectorAll('input[name="protocol"]'),

      // Connection areas
      adbArea: document.getElementById('adb-connection-area'),
      ccncArea: document.getElementById('ccnc-connection-area'),
      protocolSelector: document.querySelector('.protocol-selector'),

      // ADB elements
      adbDeviceList: document.getElementById('adb-device-list'),
      adbConnectBtn: document.getElementById('adb-connect-btn'),

      // ccNC elements
      ccncHost: document.getElementById('ccnc-host'),
      ccncPort: document.getElementById('ccnc-port'),
      ccncFps: document.getElementById('ccnc-fps'),
      ccncConnectBtn: document.getElementById('ccnc-connect-btn'),

      // Status card
      statusCard: document.getElementById('connection-status-card'),
      statusText: document.querySelector('.status-text'),
      statusDetails: document.querySelector('.status-details span'),
      statusActionBtn: document.getElementById('status-action-btn'),

      // Inline status
      inlineStatus: document.getElementById('connection-status-inline'),
      inlineText: document.getElementById('status-inline-text'),
      inlineDisconnectBtn: document.getElementById('status-inline-disconnect-btn')
    };
  }

  /**
   * Setup event listeners
   */
  _setupEventListeners() {
    // Protocol change
    this.elements.protocolRadios.forEach(radio => {
      radio.addEventListener('change', (e) => this._onProtocolChange(e.target.value));
    });

    // ADB scan button (inside select wrapper)
    const scanBtn = document.querySelector('.device-select-wrapper .btn-secondary');
    if (scanBtn) {
      scanBtn.addEventListener('click', () => this.scanDevices());
    }

    // ADB connect
    if (this.elements.adbConnectBtn) {
      this.elements.adbConnectBtn.addEventListener('click', () => this.connectADB());
    }

    // ccNC connect
    if (this.elements.ccncConnectBtn) {
      this.elements.ccncConnectBtn.addEventListener('click', () => this.connectCCNC());
    }

    // Inline disconnect
    if (this.elements.inlineDisconnectBtn) {
      this.elements.inlineDisconnectBtn.addEventListener('click', () => this.disconnect());
    }
  }

  /**
   * Subscribe to store changes
   */
  _subscribeToStore() {
    this.unsubscribe = this.deviceStore.subscribe((event) => {
      this._render();
    });
  }

  /**
   * Render component based on store state
   */
  _render() {
    const state = this.deviceStore.getState();

    // Update connection type UI
    this._updateConnectionTypeUI(state.connectionType);

    // Update connection status UI
    this._updateConnectionStatus(
      state.connectionStatus,
      state.selectedDevice,
      state.lastError
    );

    // Update available devices
    if (state.availableDevices.length > 0) {
      this._updateDeviceList(state.availableDevices);
    }
  }

  /**
   * Update connection type UI (ADB vs ccNC)
   */
  _updateConnectionTypeUI(type) {
    const { adbArea, ccncArea } = this.elements;

    if (type === 'adb') {
      if (adbArea) adbArea.style.display = 'flex';
      if (ccncArea) ccncArea.style.display = 'none';
    } else {
      if (adbArea) adbArea.style.display = 'none';
      if (ccncArea) ccncArea.style.display = 'flex';
    }
  }

  /**
   * Update connection status display
   */
  _updateConnectionStatus(status, device, error) {
    const {
      statusCard,
      statusText,
      statusDetails,
      statusActionBtn,
      protocolSelector,
      adbArea,
      ccncArea,
      inlineStatus,
      inlineText
    } = this.elements;

    // Remove all status classes
    statusCard.classList.remove('status-disconnected', 'status-connecting', 'status-connected', 'status-failed');

    switch (status) {
      case 'disconnected':
        // Show connection form
        statusCard.classList.add('hidden');
        if (inlineStatus) inlineStatus.classList.add('hidden');
        if (protocolSelector) protocolSelector.style.display = 'flex';

        const connectionType = this.deviceStore.get('connectionType');
        if (connectionType === 'adb') {
          if (adbArea) adbArea.style.display = 'flex';
          if (ccncArea) ccncArea.style.display = 'none';
        } else {
          if (adbArea) adbArea.style.display = 'none';
          if (ccncArea) ccncArea.style.display = 'flex';
        }
        break;

      case 'connected':
        // Show inline status only (compact 1-line)
        statusCard.classList.add('hidden');
        if (protocolSelector) protocolSelector.style.display = 'none';
        if (adbArea) adbArea.style.display = 'none';
        if (ccncArea) ccncArea.style.display = 'none';

        if (inlineStatus) {
          inlineStatus.classList.remove('hidden');
          if (inlineText && device) {
            const deviceInfo = device.connectionType === 'ccnc'
              ? `ccNC ${device.version || ''}: ${device.host}:${device.port}`
              : `ADB: ${device.model || device.id}`;
            inlineText.textContent = `연결됨 - ${deviceInfo}`;
          }
        }
        break;

      case 'connecting':
        // Show status card
        if (protocolSelector) protocolSelector.style.display = 'none';
        if (adbArea) adbArea.style.display = 'none';
        if (ccncArea) ccncArea.style.display = 'none';
        if (inlineStatus) inlineStatus.classList.add('hidden');

        statusCard.classList.add('status-connecting');
        statusCard.classList.remove('hidden');
        if (statusText) statusText.textContent = '연결 중...';
        if (statusDetails && device) {
          const details = device.connectionType === 'ccnc'
            ? `${device.host}:${device.port}`
            : device.id;
          statusDetails.textContent = details;
        }
        if (statusActionBtn) {
          statusActionBtn.textContent = '취소';
          statusActionBtn.onclick = () => this.disconnect();
        }
        break;

      case 'failed':
        // Show status card with error
        if (protocolSelector) protocolSelector.style.display = 'none';
        if (adbArea) adbArea.style.display = 'none';
        if (ccncArea) ccncArea.style.display = 'none';
        if (inlineStatus) inlineStatus.classList.add('hidden');

        statusCard.classList.add('status-failed');
        statusCard.classList.remove('hidden');
        if (statusText) statusText.textContent = '연결 실패';
        if (statusDetails && error) {
          statusDetails.textContent = error;
        }
        if (statusActionBtn) {
          statusActionBtn.textContent = '재시도';
          const connectionType = this.deviceStore.get('connectionType');
          statusActionBtn.onclick = () => {
            connectionType === 'adb' ? this.connectADB() : this.connectCCNC();
          };
        }
        break;
    }
  }

  /**
   * Update device list dropdown
   */
  _updateDeviceList(devices) {
    const { adbDeviceList } = this.elements;
    if (!adbDeviceList) return;

    adbDeviceList.innerHTML = '<option value="">장치를 선택하세요</option>';

    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.id;
      option.textContent = `${device.model || 'Unknown'} (${device.id})`;
      adbDeviceList.appendChild(option);
    });
  }

  /**
   * Handle protocol change
   */
  _onProtocolChange(protocol) {
    this.deviceStore.setConnectionType(protocol);
  }

  /**
   * Scan for ADB devices
   */
  async scanDevices() {
    try {
      this.deviceStore.setScanning(true);

      const devices = await this.api.device.list();

      this.deviceStore.setAvailableDevices(devices);
      this.deviceStore.setScanning(false);

      // Emit event for logging
      this._emitEvent('devices-scanned', { count: devices.length });
    } catch (error) {
      console.error('Failed to scan devices:', error);
      this.deviceStore.setScanning(false);
      this.deviceStore.setError('장치 스캔 실패');
    }
  }

  /**
   * Connect to ADB device
   */
  async connectADB() {
    try {
      const { adbDeviceList } = this.elements;
      const selectedId = adbDeviceList?.value;

      if (!selectedId) {
        this.deviceStore.setError('장치를 선택하세요');
        return;
      }

      this.deviceStore.setConnectionStatus('connecting');
      this.deviceStore.setSelectedDevice({
        id: selectedId,
        connectionType: 'adb'
      });

      const result = await this.api.device.select(selectedId);

      if (result.success) {
        const info = await this.api.device.getInfo();

        this.deviceStore.setSelectedDevice({
          id: selectedId,
          model: info.model || 'Unknown',
          device: info.device || 'Unknown',
          androidVersion: info.androidVersion || 'Unknown',
          connectionType: 'adb'
        });

        this.deviceStore.setConnectionStatus('connected');

        this._emitEvent('device-connected', { type: 'adb', device: info });
      } else {
        throw new Error(result.error || 'Connection failed');
      }
    } catch (error) {
      console.error('ADB connection failed:', error);
      this.deviceStore.setError(error.message);
      this.deviceStore.setConnectionStatus('failed');
    }
  }

  /**
   * Connect to ccNC device
   */
  async connectCCNC() {
    const maxRetries = 5;

    try {
      const { ccncHost, ccncPort, ccncFps } = this.elements;

      const host = ccncHost?.value || 'localhost';
      const port = parseInt(ccncPort?.value) || 20000;
      const fps = parseInt(ccncFps?.value) || 30;

      this.deviceStore.setCCNCParams(host, port, fps);

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          this.deviceStore.setConnectionStatus('connecting');
          this.deviceStore.setSelectedDevice({
            host,
            port,
            connectionType: 'ccnc'
          });

          this._emitEvent('connection-attempt', { attempt, maxRetries, host, port });

          const result = await this.api.device.connectCCNC(host, port, fps);

          if (result.success) {
            this.deviceStore.setSelectedDevice({
              id: 'ccnc',
              model: 'ccNC',
              device: 'ccNC',
              connectionType: 'ccnc',
              host,
              port,
              version: result.version || 'unknown'
            });

            this.deviceStore.setConnectionStatus('connected');

            this._emitEvent('device-connected', { type: 'ccnc', version: result.version });
            return;
          } else {
            throw new Error(result.error || 'Connection failed');
          }
        } catch (error) {
          if (attempt === maxRetries) {
            throw error;
          }
          // Wait 1 second before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error('ccNC connection failed:', error);
      this.deviceStore.setError(error.message);
      this.deviceStore.setConnectionStatus('failed');
    }
  }

  /**
   * Disconnect device
   */
  async disconnect() {
    try {
      const device = this.deviceStore.get('selectedDevice');

      if (device?.connectionType === 'ccnc') {
        await this.api.device.disconnectCCNC();
      }

      this.deviceStore.clearDevice();

      this._emitEvent('device-disconnected', {});
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  }

  /**
   * Emit custom event
   */
  _emitEvent(eventName, detail) {
    const event = new CustomEvent(`device-panel:${eventName}`, { detail });
    document.dispatchEvent(event);
  }

  /**
   * Cleanup component
   */
  cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

// Expose class globally
window.DevicePanel = DevicePanel;
