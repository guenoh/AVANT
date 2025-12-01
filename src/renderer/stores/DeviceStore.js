/**
 * Device Store - Manages device connection state
 * Extends BaseStore for reactive state management
 */

class DeviceStore extends BaseStore {
  constructor() {
    super({
      // Connection state
      selectedDevice: null,
      connectionType: 'adb', // 'adb' | 'ccnc'
      connectionStatus: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'failed'

      // Available devices
      availableDevices: [],
      isScanning: false,

      // Connection details
      ccncHost: 'localhost',
      ccncPort: 20000,
      ccncFps: 30,

      // Error state
      lastError: null
    });
  }

  /**
   * Set connection type (adb or ccnc)
   */
  setConnectionType(type) {
    if (type !== 'adb' && type !== 'ccnc') {
      console.error('[DeviceStore] Invalid connection type:', type);
      return;
    }
    this.setState({ connectionType: type });
  }

  /**
   * Set connection status
   */
  setConnectionStatus(status, error = null) {
    this.setState({
      connectionStatus: status,
      lastError: error
    });
  }

  /**
   * Set selected device
   */
  setSelectedDevice(device) {
    this.setState({ selectedDevice: device });
  }

  /**
   * Set available devices list
   */
  setAvailableDevices(devices) {
    this.setState({ availableDevices: devices });
  }

  /**
   * Set scanning state
   */
  setScanning(isScanning) {
    this.setState({ isScanning });
  }

  /**
   * Set ccNC connection parameters
   */
  setCCNCParams(host, port, fps) {
    this.setState({
      ccncHost: host,
      ccncPort: port,
      ccncFps: fps
    });
  }

  /**
   * Clear device connection
   */
  clearDevice() {
    this.setState({
      selectedDevice: null,
      connectionStatus: 'disconnected',
      lastError: null
    });
  }

  /**
   * Handle connection error
   */
  setError(error) {
    this.setState({
      lastError: error,
      connectionStatus: 'failed'
    });
  }
}

// Create and expose singleton instance globally
window.DeviceStore = new DeviceStore();
