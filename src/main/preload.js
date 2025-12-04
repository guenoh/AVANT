/**
 * Preload Script
 * Exposes IPC methods to renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Device APIs
  device: {
    list: () => ipcRenderer.invoke('device:list'),
    select: (deviceId) => ipcRenderer.invoke('device:select', deviceId),
    getInfo: () => ipcRenderer.invoke('device:info'),
    connectWireless: (ip) => ipcRenderer.invoke('device:connect-wireless', ip),
    onStatus: (callback) => {
      ipcRenderer.on('device:status', (event, status) => callback(status));
    }
  },

  // Screen APIs
  screen: {
    capture: () => ipcRenderer.invoke('screen:capture'),
    startStream: (options) => ipcRenderer.invoke('screen:start-stream', options),
    stopStream: () => ipcRenderer.invoke('screen:stop-stream'),
    reconnect: (options) => ipcRenderer.invoke('screen:reconnect', options),
    startRecord: (options) => ipcRenderer.invoke('screen:start-record', options),
    stopRecord: () => ipcRenderer.invoke('screen:stop-record'),
    onStreamData: (callback) => {
      ipcRenderer.on('screen:stream:data', (event, data) => callback(data));
    }
  },

  // Action APIs
  action: {
    execute: (action) => ipcRenderer.invoke('action:execute', action),
    executeBatch: (actions) => ipcRenderer.invoke('action:execute-batch', actions)
  },

  // Macro APIs
  macro: {
    list: () => ipcRenderer.invoke('macro:list'),
    get: (id) => ipcRenderer.invoke('macro:get', id),
    save: (macro) => ipcRenderer.invoke('macro:save', macro),
    delete: (id) => ipcRenderer.invoke('macro:delete', id),
    run: (id, options) => ipcRenderer.invoke('macro:run', id, options),
    stop: (id) => ipcRenderer.invoke('macro:stop', id),
    startRecording: () => ipcRenderer.invoke('macro:start-recording'),
    stopRecording: () => ipcRenderer.invoke('macro:stop-recording'),
    onStatus: (callback) => {
      ipcRenderer.on('macro:status', (event, status) => callback(status));
    }
  },

  // Settings APIs
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    getCategory: (category) => ipcRenderer.invoke('settings:get-category', category),
    update: (updates) => ipcRenderer.invoke('settings:update', updates),
    reset: (category) => ipcRenderer.invoke('settings:reset', category),
    export: (path) => ipcRenderer.invoke('settings:export', path),
    import: (path) => ipcRenderer.invoke('settings:import', path)
  },

  // Logger APIs
  logs: {
    get: (options) => ipcRenderer.invoke('logs:get', options),
    clear: () => ipcRenderer.invoke('logs:clear'),
    export: (path) => ipcRenderer.invoke('logs:export', path),
    onLog: (callback) => {
      ipcRenderer.on('system:log', (event, log) => callback(log));
    }
  },

  // System APIs
  system: {
    onError: (callback) => {
      ipcRenderer.on('system:error', (event, error) => callback(error));
    },
    onReady: (callback) => {
      ipcRenderer.on('system:ready', () => callback());
    }
  },

  // File APIs
  file: {
    saveLogs: (logsText) => ipcRenderer.invoke('file:save-logs', logsText),
    saveScreenshot: (dataUrl) => ipcRenderer.invoke('file:save-screenshot', dataUrl),
    showSaveDialog: (options) => ipcRenderer.invoke('file:show-save-dialog', options),
    showOpenDialog: (options) => ipcRenderer.invoke('file:show-open-dialog', options),
    writeFile: (filePath, data) => ipcRenderer.invoke('file:write-file', filePath, data),
    readFile: (filePath) => ipcRenderer.invoke('file:read-file', filePath)
  },

  // Dialog APIs
  dialog: {
    openDirectory: async () => {
      const result = await ipcRenderer.invoke('file:show-open-dialog', {
        properties: ['openDirectory', 'createDirectory']
      });
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false };
      }
      return { success: true, path: result.filePaths[0] };
    }
  },

  // ADB APIs
  adb: {
    screenshot: () => ipcRenderer.invoke('adb:screenshot'),
    logcat: () => ipcRenderer.invoke('adb:logcat')
  },

  // Logcat Streaming APIs (for AI analysis)
  logcat: {
    start: (sessionId, deviceId, options) => ipcRenderer.invoke('logcat:start', sessionId, deviceId, options),
    stop: () => ipcRenderer.invoke('logcat:stop'),
    get: () => ipcRenderer.invoke('logcat:get'),
    status: () => ipcRenderer.invoke('logcat:status')
  },

  // Scenario APIs
  scenario: {
    list: () => ipcRenderer.invoke('scenario:list'),
    save: (scenario) => ipcRenderer.invoke('scenario:save', scenario),
    load: (filename) => ipcRenderer.invoke('scenario:load', filename),
    delete: (filename) => ipcRenderer.invoke('scenario:delete', filename),
    rename: (oldFilename, newFilename) => ipcRenderer.invoke('scenario:rename', oldFilename, newFilename)
  },

  // Result Report APIs
  report: {
    startSession: (options) => ipcRenderer.invoke('report:session:start', options),
    recordAction: (sessionId, actionResult) => ipcRenderer.invoke('report:session:record', sessionId, actionResult),
    finalizeSession: (sessionId, options) => ipcRenderer.invoke('report:session:finalize', sessionId, options),
    cancelSession: (sessionId) => ipcRenderer.invoke('report:session:cancel', sessionId),
    getSessionStatus: (sessionId) => ipcRenderer.invoke('report:session:status', sessionId),
    saveScreenshot: (data) => ipcRenderer.invoke('report:save:screenshot', data),
    getSessionData: (sessionId) => ipcRenderer.invoke('report:session:data', sessionId),
    storeAIAnalysis: (sessionId, analysisResult) => ipcRenderer.invoke('report:session:ai-analysis', sessionId, analysisResult)
  },

  // AI Analysis APIs
  ai: {
    analyze: (sessionData, scenario) => ipcRenderer.invoke('ai:analyze', sessionData, scenario),
    configure: (config) => ipcRenderer.invoke('ai:configure', config),
    getStatus: () => ipcRenderer.invoke('ai:status')
  },

  // Protocol APIs
  protocol: {
    connect: (deviceId, protocolName) => ipcRenderer.invoke('protocol:connect', deviceId, protocolName),
    disconnect: () => ipcRenderer.invoke('protocol:disconnect'),
    execute: (method, ...params) => ipcRenderer.invoke('protocol:execute', method, params),
    getStatus: () => ipcRenderer.invoke('protocol:status'),
    list: () => ipcRenderer.invoke('protocol:list'),
    getResolution: () => ipcRenderer.invoke('protocol:get-resolution'),

    // Action shortcuts
    tap: (x, y) => ipcRenderer.invoke('protocol:tap', x, y),
    longPress: (x, y, duration) => ipcRenderer.invoke('protocol:long-press', x, y, duration),
    swipe: (x1, y1, x2, y2, duration) => ipcRenderer.invoke('protocol:swipe', x1, y1, x2, y2, duration),
    drag: (x1, y1, x2, y2, duration) => ipcRenderer.invoke('protocol:drag', x1, y1, x2, y2, duration),
    scroll: (direction, amount) => ipcRenderer.invoke('protocol:scroll', direction, amount),
    inputText: (text) => ipcRenderer.invoke('protocol:input-text', text),
    pressKey: (keyCode) => ipcRenderer.invoke('protocol:press-key', keyCode)
  }
});

console.log('[Preload] Script loaded successfully');