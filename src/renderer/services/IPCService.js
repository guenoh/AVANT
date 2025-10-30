/**
 * IPC Service - Centralized IPC communication layer
 * Wraps window.api calls with error handling and logging
 */

class IPCService {
  constructor() {
    this.api = window.api;
    this._validateAPI();
  }

  /**
   * Validate that API is available
   */
  _validateAPI() {
    if (!this.api) {
      throw new Error('window.api is not available. Check preload.js');
    }
  }

  /**
   * Execute IPC call with error handling
   */
  async _call(method, ...args) {
    try {
      const result = await method(...args);
      return result;
    } catch (error) {
      console.error('IPC call failed:', error);
      throw error;
    }
  }

  // ========================================
  // Device API
  // ========================================

  /**
   * List available ADB devices
   */
  async listDevices() {
    return this._call(this.api.device.list);
  }

  /**
   * Select ADB device
   */
  async selectDevice(deviceId) {
    return this._call(this.api.device.select, deviceId);
  }

  /**
   * Get current device info
   */
  async getDeviceInfo() {
    return this._call(this.api.device.getInfo);
  }

  /**
   * Connect to ccNC server
   */
  async connectCCNC(host, port, fps) {
    return this._call(this.api.device.connectCCNC, host, port, fps);
  }

  /**
   * Disconnect from ccNC server
   */
  async disconnectCCNC() {
    return this._call(this.api.device.disconnectCCNC);
  }

  /**
   * Subscribe to device status updates
   */
  onDeviceStatus(callback) {
    return this.api.device.onStatus(callback);
  }

  // ========================================
  // Screen API
  // ========================================

  /**
   * Take screenshot
   */
  async takeScreenshot() {
    return this._call(this.api.screen.capture);
  }

  /**
   * Start screen streaming
   */
  async startStream(fps = 30) {
    return this._call(this.api.screen.startStream, fps);
  }

  /**
   * Stop screen streaming
   */
  async stopStream() {
    return this._call(this.api.screen.stopStream);
  }

  /**
   * Subscribe to stream data
   */
  onStreamData(callback) {
    return this.api.screen.onStreamData(callback);
  }

  /**
   * Start recording
   */
  async startRecording(options = {}) {
    return this._call(this.api.screen.startRecording, options);
  }

  /**
   * Stop recording
   */
  async stopRecording() {
    return this._call(this.api.screen.stopRecording);
  }

  // ========================================
  // Action API
  // ========================================

  /**
   * Execute tap action
   */
  async tap(x, y) {
    return this._call(this.api.action.tap, x, y);
  }

  /**
   * Execute swipe action
   */
  async swipe(x1, y1, x2, y2, duration = 300) {
    return this._call(this.api.action.swipe, x1, y1, x2, y2, duration);
  }

  /**
   * Execute scroll action
   */
  async scroll(direction, distance = 300) {
    return this._call(this.api.action.scroll, direction, distance);
  }

  /**
   * Execute input text action
   */
  async inputText(text) {
    return this._call(this.api.action.input, text);
  }

  /**
   * Execute key press action
   */
  async pressKey(keyCode) {
    return this._call(this.api.action.key, keyCode);
  }

  /**
   * Execute single action
   */
  async executeAction(action) {
    return this._call(this.api.action.execute, action);
  }

  /**
   * Execute multiple actions
   */
  async executeActions(actions) {
    return this._call(this.api.action.executeMultiple, actions);
  }

  // ========================================
  // Macro API
  // ========================================

  /**
   * Save macro
   */
  async saveMacro(macro) {
    return this._call(this.api.macro.save, macro);
  }

  /**
   * Load macro
   */
  async loadMacro(id) {
    return this._call(this.api.macro.load, id);
  }

  /**
   * List all macros
   */
  async listMacros() {
    return this._call(this.api.macro.list);
  }

  /**
   * Delete macro
   */
  async deleteMacro(id) {
    return this._call(this.api.macro.delete, id);
  }

  /**
   * Run macro
   */
  async runMacro(id) {
    return this._call(this.api.macro.run, id);
  }

  // ========================================
  // Settings API
  // ========================================

  /**
   * Get settings
   */
  async getSettings() {
    return this._call(this.api.settings.get);
  }

  /**
   * Update settings
   */
  async updateSettings(settings) {
    return this._call(this.api.settings.update, settings);
  }

  // ========================================
  // Logger API
  // ========================================

  /**
   * Log message
   */
  async log(message, level = 'info') {
    return this._call(this.api.logger.log, message, level);
  }

  /**
   * Get logs
   */
  async getLogs(filters = {}) {
    return this._call(this.api.logger.getLogs, filters);
  }

  /**
   * Clear logs
   */
  async clearLogs() {
    return this._call(this.api.logger.clear);
  }
}

// Create and expose singleton instance globally
window.IPCService = new IPCService();
