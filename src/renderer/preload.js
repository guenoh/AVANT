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
    connectCCNC: (host, port) => ipcRenderer.invoke('device:connect-ccnc', { host, port }),
    disconnectCCNC: () => ipcRenderer.invoke('device:disconnect-ccnc'),
    onStatus: (callback) => {
      ipcRenderer.on('device:status', (event, status) => callback(status));
    }
  },

  // Screen APIs
  screen: {
    capture: () => ipcRenderer.invoke('screen:capture'),
    startStream: (options) => ipcRenderer.invoke('screen:start-stream', options),
    stopStream: () => ipcRenderer.invoke('screen:stop-stream'),
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
    saveScreenshot: (dataUrl) => ipcRenderer.invoke('file:save-screenshot', dataUrl)
  },

  // ADB APIs
  adb: {
    screenshot: () => ipcRenderer.invoke('adb:screenshot'),
    logcat: () => ipcRenderer.invoke('adb:logcat')
  }
});

console.log('[Preload] Script loaded successfully');