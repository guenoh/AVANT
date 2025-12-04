/**
 * Main Process Entry Point
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Services
const deviceService = require('./services/device.service');
const screenService = require('./services/screen.service');
const actionService = require('./services/action.service');
const macroService = require('./services/macro.service');
const settingsService = require('./services/settings.service');
const loggerService = require('./services/logger.service');
const { CCNCConnectionService } = require('./services/ccnc-connection.service');
const { SCREEN } = require('../shared/constants');

// Protocol System
const ProtocolManager = require('./services/ProtocolManager');
const AdbProtocol = require('./services/protocols/AdbProtocol');

// Result Report Service
const ResultReportService = require('./services/result-report.service');
const resultReportService = new ResultReportService();

// AI Analysis Service
const AIAnalysisService = require('./services/ai-analysis.service');
const aiAnalysisService = new AIAnalysisService();

// ADB Logcat Service
const adbLogcatService = require('./services/adb-logcat.service');

// Protocol manager instance
let protocolManager = null;

// ccNC connection instance
let ccncService = null;

// ccNC streaming state
let ccncStreamActive = false;

let mainWindow = null;

// Device heartbeat for connection monitoring
let deviceHeartbeatInterval = null;
let lastKnownDeviceId = null;
let wasDeviceConnected = false; // Track previous connection state to avoid duplicate notifications

/**
 * Create standardized error response and log error
 * @param {string} message - Error message for logging
 * @param {Error|string} error - Error object or message
 * @returns {{ success: false, error: string }}
 */
function errorResponse(message, error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  loggerService.error(message, error);
  return { success: false, error: errorMsg };
}

/**
 * Execute a single action via Protocol Manager
 * @param {Object} action - Action to execute
 * @returns {Promise<Object>} Result with success status
 */
async function executeAction(action) {
  switch (action.type) {
    case 'tap':
    case 'click':
      await protocolManager.tap(action.x, action.y);
      return { success: true };

    case 'long-press':
      await protocolManager.longPress(action.x, action.y, action.duration || 1000);
      return { success: true };

    case 'swipe':
    case 'drag':
      await protocolManager.swipe(
        action.x1 || action.startX || action.x,
        action.y1 || action.startY || action.y,
        action.x2 || action.endX,
        action.y2 || action.endY,
        action.duration || 300
      );
      return { success: true };

    case 'scroll':
      await protocolManager.scroll(action.direction, action.distance || 600);
      return { success: true };

    case 'input':
      await protocolManager.inputText(action.text);
      return { success: true };

    case 'back':
      await protocolManager.pressKey('KEYCODE_BACK');
      return { success: true };

    case 'home':
      await protocolManager.pressKey('KEYCODE_HOME');
      return { success: true };

    case 'recent':
      await protocolManager.pressKey('KEYCODE_APP_SWITCH');
      return { success: true };

    case 'wait':
      await new Promise(resolve => setTimeout(resolve, action.duration || 1000));
      return { success: true };

    case 'get-volume':
      return await actionService.getVolume(action);

    case 'log':
      loggerService.info(`[LOG] ${action.message || ''}`);
      return { success: true, message: action.message };

    case 'success':
      loggerService.info(`[SUCCESS] ${action.message || 'Macro completed successfully'}`);
      return { success: true, message: action.message, exitType: 'success' };

    case 'skip':
      loggerService.info('[SKIP] Action skipped');
      return { success: true, exitType: 'skip' };

    case 'fail':
      loggerService.info(`[FAIL] ${action.message || 'Macro failed'}`);
      return { success: false, message: action.message, exitType: 'fail' };

    case 'adb-reboot':
      return await executeAdbReboot(action);

    case 'endif':
    case 'else':
    case 'else-if':
    case 'end-if':
    case 'end-loop':
    case 'end-while':
      return { success: true };

    default:
      throw new Error(`Unsupported action type: ${action.type}`);
  }
}

/**
 * Execute ADB reboot action
 * @param {Object} action - Reboot action configuration
 * @returns {Promise<Object>} Result with success status
 */
async function executeAdbReboot(action) {
  loggerService.info('[ADB] Initiating device reboot...');
  const { execSync } = require('child_process');
  const shouldWaitForDevice = action.waitForDevice === 'true' || action.waitForDevice === true;
  const rebootTimeout = action.timeout || 120000;

  try {
    execSync('adb reboot', { timeout: 10000 });
    loggerService.info('[ADB] Reboot command sent');

    if (shouldWaitForDevice) {
      loggerService.info('[ADB] Waiting for device to come back online...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      const rebootStartTime = Date.now();
      let deviceOnline = false;

      while (Date.now() - rebootStartTime < rebootTimeout) {
        try {
          const devices = execSync('adb devices', { timeout: 5000, encoding: 'utf8' });
          if (!devices.includes('device')) {
            loggerService.debug('[ADB] Device not yet visible, waiting...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }

          const bootResult = execSync('adb shell getprop sys.boot_completed', {
            timeout: 10000,
            encoding: 'utf8'
          }).trim();

          if (bootResult === '1') {
            deviceOnline = true;
            loggerService.info('[ADB] Device is back online and boot completed');
            break;
          } else {
            loggerService.debug('[ADB] Device visible but boot not completed yet...');
          }
        } catch (e) {
          loggerService.debug('[ADB] Device not ready yet:', e.message);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (!deviceOnline) {
        throw new Error('Device did not come back online within timeout');
      }

      loggerService.info('[ADB] Waiting for UI to be ready...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      try {
        loggerService.info('[ADB] Reconnecting protocol...');
        await protocolManager.disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000));

        const deviceList = await deviceService.getDevices();
        if (deviceList && deviceList.length > 0) {
          await protocolManager.connect(deviceList[0].id, 'adb');
          loggerService.info('[ADB] Protocol reconnected successfully');
        }
      } catch (reconnectError) {
        loggerService.warn('[ADB] Protocol reconnect warning:', reconnectError.message);
      }
    }

    return { success: true, message: 'Device rebooted successfully' };
  } catch (rebootError) {
    loggerService.error('[ADB] Reboot failed:', rebootError.message);
    return { success: false, error: rebootError.message };
  }
}

/**
 * Start device connection heartbeat
 */
function startDeviceHeartbeat(deviceId) {
  stopDeviceHeartbeat();
  lastKnownDeviceId = deviceId;
  wasDeviceConnected = true;

  deviceHeartbeatInterval = setInterval(async () => {
    if (!lastKnownDeviceId) {
      return;
    }

    try {
      const devices = await deviceService.listDevices();
      // Check if device is connected AND has 'device' status (not 'offline', 'unauthorized', etc.)
      const connectedDevice = devices.find(d => d.id === lastKnownDeviceId);
      const isConnected = connectedDevice && connectedDevice.status === 'device';

      if (!isConnected && wasDeviceConnected) {
        // Device just disconnected
        const reason = connectedDevice ? `status: ${connectedDevice.status}` : 'not found';
        loggerService.info(`[Heartbeat] Device disconnected: ${lastKnownDeviceId} (${reason})`);
        wasDeviceConnected = false;

        // Stop streaming
        if (ccncStreamActive) {
          ccncStreamActive = false;
        }
        try {
          await screenService.stopStream();
        } catch (e) {
          // Ignore
        }

        // Notify renderer
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('device:status', {
            connected: false,
            device: null,
            reason: reason
          });
        }
        // Don't stop heartbeat - keep monitoring for reconnection
      } else if (isConnected && !wasDeviceConnected) {
        // Device just reconnected
        loggerService.info(`[Heartbeat] Device reconnected: ${lastKnownDeviceId}`);
        wasDeviceConnected = true;

        // Get device info for notification
        let deviceInfo = connectedDevice;
        try {
          deviceInfo = await deviceService.getDeviceInfo(lastKnownDeviceId);
        } catch (e) {
          loggerService.warn('[Heartbeat] Could not get device info: ' + e.message);
        }

        // Notify renderer about reconnection
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('device:status', {
            connected: true,
            device: {
              id: lastKnownDeviceId,
              ...deviceInfo
            },
            reconnected: true
          });
        }
      }
    } catch (error) {
      loggerService.error('[Heartbeat] Error checking device', error);
    }
  }, 3000); // Check every 3 seconds
}

/**
 * Stop device heartbeat
 */
function stopDeviceHeartbeat() {
  if (deviceHeartbeatInterval) {
    clearInterval(deviceHeartbeatInterval);
    deviceHeartbeatInterval = null;
  }
  lastKnownDeviceId = null;
  wasDeviceConnected = false;
}

/**
 * Create the main application window
 */
async function createWindow() {
  const isDev = process.env.NODE_ENV === 'development';

  mainWindow = new BrowserWindow({
    width: isDev ? 2000 : 1800,  // 개발 모드에서 더 넓게
    height: 1425,
    minWidth: 1400,
    minHeight: 900,
    title: 'Vision Auto v2',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: isDev,
      cache: !isDev  // Disable cache in development mode
    },
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  // CSP 헤더 설정 - data URLs 허용
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' data: 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval';"]
      }
    });
  });

  // Load the HTML file
  await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
    // Clear cache in development mode
    await mainWindow.webContents.session.clearCache();
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Initialize all services
 */
async function initializeServices() {
  try {
    // Initialize logger first
    await loggerService.initialize();
    loggerService.info('Starting Vision Auto v2');

    // Initialize Protocol Manager
    protocolManager = new ProtocolManager();

    // Register ADB protocol
    protocolManager.registerProtocol('adb', AdbProtocol, {
      adbPath: 'adb'
    });

    // Set protocol priority (can add ccNC later)
    protocolManager.setProtocolPriority(['adb']);

    loggerService.info('Protocol Manager initialized');

    // Initialize other services
    await settingsService.initialize();
    await deviceService.initialize();
    await screenService.initialize(deviceService);
    await actionService.initialize(deviceService, ccncService);
    await macroService.initialize();

    // Listen for device disconnection from screen service (ADB stream errors)
    screenService.on('device-disconnected', (data) => {
      loggerService.info(`[ScreenService] Device disconnected event: ${data.reason || 'unknown'}`);

      // Stop heartbeat
      stopDeviceHeartbeat();

      // Notify renderer
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('device:status', {
          connected: false,
          device: null,
          reason: data.reason || 'stream_error'
        });
      }
    });

    loggerService.info('All services initialized successfully');
  } catch (error) {
    loggerService.error('Failed to initialize services', error);
    throw error;
  }
}

/**
 * Setup IPC handlers
 */
function setupIpcHandlers() {
  // Device handlers
  ipcMain.handle('device:list', async () => {
    try {
      const devices = await deviceService.listDevices();
      return { success: true, devices };
    } catch (error) {
      return errorResponse('Failed to list devices', error);
    }
  });

  ipcMain.handle('device:select', async (event, deviceId) => {
    try {
      loggerService.debug(`[IPC] device:select called with: ${deviceId}`);
      const result = await deviceService.selectDevice(deviceId);

      // Start heartbeat monitoring for this device
      startDeviceHeartbeat(deviceId);

      // Send device status update to renderer
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('device:status', {
          connected: true,
          device: result
        });
      } else {
        loggerService.warn('[IPC] Cannot send device:status - mainWindow or webContents is null');
      }

      return { success: true, info: result };
    } catch (error) {
      return errorResponse('Failed to select device', error);
    }
  });

  ipcMain.handle('device:info', async () => {
    try {
      const info = await deviceService.getDeviceInfo();
      return { success: true, info };
    } catch (error) {
      return errorResponse('Failed to get device info', error);
    }
  });

  ipcMain.handle('device:connect-ccnc', async (event, { host, port, fps }) => {
    try {
      loggerService.debug(`[IPC] device:connect-ccnc called with: ${host}:${port}, fps=${fps}`);

      // Create new ccNC service if not exists
      if (!ccncService) {
        ccncService = new CCNCConnectionService();

        // Handle ccNC errors to prevent uncaughtException
        ccncService.on('error', (error) => {
          loggerService.error('[ccNC] Service error', error);
        });
      }

      // Store FPS setting on ccNC service
      ccncService.targetFPS = fps || 30;

      // Disconnect first if already connected or in error state
      if (ccncService.getState() !== 'disconnected') {
        ccncService.disconnect();
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Connect to ccNC server
      await ccncService.connect(host, port);

      // Update actionService with ccNC service
      actionService.ccncService = ccncService;

      // Try to get version (optional)
      let version = 'unknown';
      try {
        version = await ccncService.getVersion();
      } catch (versionError) {
        loggerService.debug('[ccNC] Version query failed, continuing: ' + versionError.message);
      }

      loggerService.info(`ccNC connected: ${host}:${port} (version: ${version})`);

      return {
        success: true,
        version,
        host,
        port
      };
    } catch (error) {
      return errorResponse('Failed to connect ccNC', error);
    }
  });

  ipcMain.handle('device:disconnect-ccnc', async () => {
    try {
      if (ccncService) {
        ccncService.disconnect();
        ccncService = null;
      }

      loggerService.info('ccNC disconnected');
      return { success: true };
    } catch (error) {
      return errorResponse('Failed to disconnect ccNC', error);
    }
  });

  // Screen handlers
  ipcMain.handle('screen:capture', async () => {
    try {
      // Use ccNC if connected, otherwise use ADB
      if (ccncService && ccncService.isConnected()) {
        // Capture full screen using ccNC resolution constants
        const imageData = await ccncService.capture(0, 0, SCREEN.CCNC_WIDTH, SCREEN.CCNC_HEIGHT, { format: 'jpeg' });
        const base64 = imageData.toString('base64');
        return { success: true, screenshot: `data:image/jpeg;base64,${base64}` };
      } else {
        const screenshot = await screenService.takeScreenshot();
        return { success: true, screenshot };
      }
    } catch (error) {
      return errorResponse('Failed to capture screen', error);
    }
  });

  // ccNC streaming loop function
  let ccncDisconnectNotified = false; // Track if disconnect has been notified
  let ccncStreamSessionId = 0; // Session ID to prevent duplicate loops

  async function ccncStreamLoop(targetInterval, sessionId) {
    // Check if this loop should continue (session ID must match current session)
    if (sessionId !== ccncStreamSessionId) {
      loggerService.debug(`[ccNC Stream] Loop terminated - old session ${sessionId}, current ${ccncStreamSessionId}`);
      return;
    }

    if (!ccncStreamActive || !ccncService || !ccncService.isConnected()) {
      // Notify renderer about disconnect (only once)
      if (ccncStreamActive && !ccncDisconnectNotified) {
        ccncDisconnectNotified = true;
        ccncStreamActive = false;
        loggerService.warn('ccNC connection lost - notifying renderer');
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('device:status', {
            connected: false,
            deviceType: 'ccnc',
            deviceName: null,
            deviceId: null,
            reason: 'connection_lost'
          });
        }
      }
      return;
    }

    // Reset disconnect notification flag when connected
    ccncDisconnectNotified = false;

    try {
      // Capture full screen using ccNC resolution constants
      // Wait for complete frame before requesting next one (prevents partial frames on slow devices)
      const imageData = await ccncService.capture(0, 0, SCREEN.CCNC_WIDTH, SCREEN.CCNC_HEIGHT, { format: 'jpeg' });
      const base64 = imageData.toString('base64');

      if (mainWindow && mainWindow.webContents && ccncStreamActive && sessionId === ccncStreamSessionId) {
        mainWindow.webContents.send('screen:stream:data', {
          dataUrl: `data:image/jpeg;base64,${base64}`,
          width: SCREEN.CCNC_WIDTH,
          height: SCREEN.CCNC_HEIGHT,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      loggerService.error('[ccNC Stream] Capture error', error);
    }

    // Request next frame immediately after current frame is complete
    // This ensures we always get complete frames even if device is slow due to heat
    if (ccncStreamActive && sessionId === ccncStreamSessionId) {
      // Use setImmediate to avoid blocking and allow event loop to process
      setImmediate(() => ccncStreamLoop(targetInterval, sessionId));
    }
  }

  // Helper to start a new stream session
  function startCcncStreamSession(interval) {
    ccncStreamSessionId++; // Increment session ID to invalidate old loops
    ccncStreamActive = true;
    ccncDisconnectNotified = false;
    const currentSession = ccncStreamSessionId;
    loggerService.debug(`[ccNC Stream] Starting new session ${currentSession}`);
    ccncStreamLoop(interval, currentSession);
    return currentSession;
  }

  ipcMain.handle('screen:start-stream', async (event, options) => {
    try {
      // Check if ccNC service exists (was previously connected)
      if (ccncService) {
        // If ccNC is connected, use it
        if (ccncService.isConnected()) {
          const fps = ccncService.targetFPS || 30;
          const interval = 1000 / fps;

          // Start new stream session (invalidates any old loops)
          startCcncStreamSession(interval);

          loggerService.info(`ccNC stream started at ${fps} FPS (JPEG, ${SCREEN.CCNC_WIDTH}x${SCREEN.CCNC_HEIGHT})`);
          return { success: true };
        }

        // ccNC service exists but not connected - try to reconnect
        // This happens after device reboot when TCP connection was lost
        const host = ccncService.host || 'localhost';
        const port = ccncService.port || 20000;
        const fps = ccncService.targetFPS || 30;

        loggerService.info(`ccNC disconnected, attempting reconnect to ${host}:${port}...`);

        try {
          await ccncService.connect(host, port);
          loggerService.info(`ccNC reconnected successfully`);

          const interval = 1000 / fps;
          // Start new stream session (invalidates any old loops)
          startCcncStreamSession(interval);

          loggerService.info(`ccNC stream started at ${fps} FPS (JPEG, ${SCREEN.CCNC_WIDTH}x${SCREEN.CCNC_HEIGHT})`);
          return { success: true };
        } catch (reconnectError) {
          loggerService.warn(`ccNC reconnect failed: ${reconnectError.message}, falling back to ADB`);
          // Fall through to ADB
        }
      }

      // ADB: Use requested FPS (default 30)
      // If no device is currently selected, try to find and select one
      if (!deviceService.currentDevice) {
        loggerService.info('No device selected, attempting auto-select...');
        const devices = await deviceService.listDevices();
        if (devices && devices.length > 0) {
          const connectedDevice = devices.find(d => d.status === 'device') || devices[0];
          await deviceService.selectDevice(connectedDevice.id);
          loggerService.info(`Auto-selected device: ${connectedDevice.id}`);
          // Give ADB a moment to stabilize after device selection
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          loggerService.error('No devices available for auto-select');
          return { success: false, error: 'No devices available' };
        }
      }

      const streamResult = await screenService.startStream(options);
      return {
        success: true,
        width: streamResult.width,
        height: streamResult.height,
        isValidResolution: streamResult.isValidResolution,
        retryCount: streamResult.retryCount
      };
    } catch (error) {
      return errorResponse('Failed to start stream', error);
    }
  });

  ipcMain.handle('screen:stop-stream', async () => {
    try {
      // Stop ccNC stream if active
      if (ccncStreamActive) {
        ccncStreamActive = false;
        loggerService.info('ccNC stream stopped');
        return { success: true };
      } else {
        await screenService.stopStream();
        return { success: true };
      }
    } catch (error) {
      return errorResponse('Failed to stop stream', error);
    }
  });

  // Reconnect stream (stop and restart with fresh dimensions)
  ipcMain.handle('screen:reconnect', async (event, options) => {
    try {
      loggerService.debug('[screen:reconnect] Reconnecting stream...');

      // Stop existing stream (session ID will be invalidated when starting new session)
      if (ccncStreamActive) {
        ccncStreamActive = false;
      } else {
        await screenService.stopStream();
      }

      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get fresh screen resolution before restarting stream
      let resolution = null;
      try {
        resolution = await protocolManager.getScreenResolution();
        loggerService.debug(`[screen:reconnect] Fresh resolution: ${resolution?.width}x${resolution?.height}`);
      } catch (resErr) {
        loggerService.warn('[screen:reconnect] Could not get resolution: ' + resErr.message);
      }

      // Start new stream (ccNC or ADB)
      if (ccncService && ccncService.isConnected()) {
        const fps = ccncService.targetFPS || 30;
        const interval = 1000 / fps;
        // Start new stream session (invalidates any old loops)
        startCcncStreamSession(interval);
        loggerService.info('ccNC stream reconnected');
      } else {
        // If no device is currently selected, try to find and select one
        if (!deviceService.currentDevice) {
          loggerService.info('[screen:reconnect] No device selected, attempting auto-select...');
          const devices = await deviceService.listDevices();
          if (devices && devices.length > 0) {
            const connectedDevice = devices.find(d => d.status === 'device') || devices[0];
            await deviceService.selectDevice(connectedDevice.id);
            loggerService.info(`[screen:reconnect] Auto-selected device: ${connectedDevice.id}`);
          } else {
            loggerService.error('[screen:reconnect] No devices available for auto-select');
            return { success: false, error: 'No devices available' };
          }
        }
        await screenService.startStream(options);
        loggerService.info('ADB stream reconnected');
      }

      return { success: true, resolution };
    } catch (error) {
      return errorResponse('Failed to reconnect stream', error);
    }
  });

  ipcMain.handle('screen:start-record', async (event, options) => {
    try {
      const recordingPath = await screenService.startRecording(options);
      return { success: true, path: recordingPath };
    } catch (error) {
      return errorResponse('Failed to start recording', error);
    }
  });

  ipcMain.handle('screen:stop-record', async () => {
    try {
      const recordingPath = await screenService.stopRecording();
      return { success: true, path: recordingPath };
    } catch (error) {
      return errorResponse('Failed to stop recording', error);
    }
  });

  // Action handlers
  ipcMain.handle('action:execute', async (event, action) => {
    try {
      return await executeAction(action);
    } catch (error) {
      return errorResponse('Failed to execute action', error);
    }
  });

  ipcMain.handle('action:execute-batch', async (event, actions) => {
    try {
      const results = [];
      for (const action of actions) {
        try {
          const result = await executeAction(action);
          results.push(result);

          if (action.delay) {
            await new Promise(resolve => setTimeout(resolve, action.delay));
          }
        } catch (error) {
          results.push({ success: false, error: error.message });
        }
      }
      return { success: true, results };
    } catch (error) {
      return errorResponse('Failed to execute batch actions', error);
    }
  });

  // Macro handlers
  ipcMain.handle('macro:list', async () => {
    try {
      const macros = await macroService.listMacros();
      return { success: true, macros };
    } catch (error) {
      return errorResponse('Failed to list macros', error);
    }
  });

  ipcMain.handle('macro:get', async (event, id) => {
    try {
      const macro = await macroService.loadMacro(id);
      return { success: true, macro };
    } catch (error) {
      return errorResponse('Failed to get macro', error);
    }
  });

  ipcMain.handle('macro:save', async (event, macro) => {
    try {
      const savedMacro = await macroService.saveMacro(macro);
      return { success: true, macro: savedMacro };
    } catch (error) {
      return errorResponse('Failed to save macro', error);
    }
  });

  ipcMain.handle('macro:delete', async (event, id) => {
    try {
      await macroService.deleteMacro(id);
      return { success: true };
    } catch (error) {
      return errorResponse('Failed to delete macro', error);
    }
  });

  ipcMain.handle('macro:run', async (event, id, options) => {
    try {
      await macroService.runMacro(id, options);
      return { success: true };
    } catch (error) {
      return errorResponse('Failed to run macro', error);
    }
  });

  ipcMain.handle('macro:stop', async (event, id) => {
    try {
      await macroService.stopMacro(id);
      return { success: true };
    } catch (error) {
      return errorResponse('Failed to stop macro', error);
    }
  });

  ipcMain.handle('macro:start-recording', async () => {
    try {
      await macroService.startRecording();
      return { success: true };
    } catch (error) {
      return errorResponse('Failed to start recording', error);
    }
  });

  ipcMain.handle('macro:stop-recording', async () => {
    try {
      const macro = await macroService.stopRecording();
      return { success: true, macro };
    } catch (error) {
      return errorResponse('Failed to stop recording', error);
    }
  });

  // Settings handlers
  ipcMain.handle('settings:get', async () => {
    try {
      const settings = await settingsService.getAll();
      return { success: true, settings };
    } catch (error) {
      return errorResponse('Failed to get settings', error);
    }
  });

  ipcMain.handle('settings:get-category', async (event, category) => {
    try {
      const settings = await settingsService.getCategory(category);
      return { success: true, settings };
    } catch (error) {
      return errorResponse('Failed to get settings category', error);
    }
  });

  ipcMain.handle('settings:update', async (event, updates) => {
    try {
      const settings = await settingsService.update(updates);
      return { success: true, settings };
    } catch (error) {
      return errorResponse('Failed to update settings', error);
    }
  });

  ipcMain.handle('settings:reset', async (event, category) => {
    try {
      const settings = await settingsService.reset(category);
      return { success: true, settings };
    } catch (error) {
      return errorResponse('Failed to reset settings', error);
    }
  });

  ipcMain.handle('settings:export', async (event, path) => {
    try {
      const exportPath = await settingsService.exportSettings(path);
      return { success: true, path: exportPath };
    } catch (error) {
      return errorResponse('Failed to export settings', error);
    }
  });

  ipcMain.handle('settings:import', async (event, path) => {
    try {
      const settings = await settingsService.importSettings(path);
      return { success: true, settings };
    } catch (error) {
      return errorResponse('Failed to import settings', error);
    }
  });

  // Logger handlers
  ipcMain.handle('logs:get', async (event, options) => {
    try {
      const logs = await loggerService.getLogs(options);
      return { success: true, logs };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('logs:clear', async () => {
    try {
      await loggerService.clearLogs();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('logs:export', async (event, path) => {
    try {
      const exportPath = await loggerService.exportLogs(path);
      return { success: true, path: exportPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ADB handlers
  ipcMain.handle('adb:screenshot', async () => {
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      const fs = require('fs').promises;

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const devicePath = `/sdcard/screenshot_${timestamp}.png`;
      const documentsPath = app.getPath('documents');
      const screenshotsDir = path.join(documentsPath, 'VisionAuto', 'adb-screenshots');

      // Create directory if it doesn't exist
      await fs.mkdir(screenshotsDir, { recursive: true });

      const localPath = path.join(screenshotsDir, `screenshot_${timestamp}.png`);

      // Capture screenshot on device
      await execPromise(`adb shell screencap -p ${devicePath}`);

      // Pull screenshot from device
      await execPromise(`adb pull ${devicePath} "${localPath}"`);

      // Clean up device file
      await execPromise(`adb shell rm ${devicePath}`);

      loggerService.info('[ADB] Screenshot captured: ' + localPath);

      // Read file and convert to base64 data URL for renderer use
      const imageBuffer = await fs.readFile(localPath);
      const base64Data = imageBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64Data}`;

      return {
        success: true,
        path: localPath,
        data: dataUrl
      };
    } catch (error) {
      return errorResponse('ADB screenshot failed', error);
    }
  });

  ipcMain.handle('adb:logcat', async () => {
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      const fs = require('fs').promises;

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `logcat_${timestamp}.txt`;
      const documentsPath = app.getPath('documents');
      const logcatDir = path.join(documentsPath, 'VisionAuto', 'adb-logcat');

      // Create directory if it doesn't exist
      await fs.mkdir(logcatDir, { recursive: true });

      const filePath = path.join(logcatDir, filename);

      // Capture logcat dump
      const { stdout } = await execPromise('adb logcat -d');

      // Write to file
      await fs.writeFile(filePath, stdout, 'utf8');

      loggerService.info('[ADB] Logcat captured: ' + filePath);

      return {
        success: true,
        path: filePath
      };
    } catch (error) {
      return errorResponse('ADB logcat failed', error);
    }
  });

  // Logcat streaming handlers for AI analysis
  ipcMain.handle('logcat:start', async (event, sessionId, deviceId, options = {}) => {
    try {
      const result = await adbLogcatService.startCollection(sessionId, deviceId, options);
      return { success: result };
    } catch (error) {
      return errorResponse('Failed to start logcat collection', error);
    }
  });

  ipcMain.handle('logcat:stop', async () => {
    try {
      const result = await adbLogcatService.stopCollection();
      return { success: true, data: result };
    } catch (error) {
      return errorResponse('Failed to stop logcat collection', error);
    }
  });

  ipcMain.handle('logcat:get', async () => {
    try {
      const result = adbLogcatService.getCurrentLogs();
      return { success: true, data: result };
    } catch (error) {
      return errorResponse('Failed to get logcat data', error);
    }
  });

  ipcMain.handle('logcat:status', async () => {
    return {
      success: true,
      isCollecting: adbLogcatService.isCollecting()
    };
  });

  // ===== Scenario File Handlers =====

  const scenariosDir = path.join(__dirname, '../../scenarios');

  ipcMain.handle('scenario:list', async () => {
    try {
      const fs = require('fs').promises;

      // Create directory if it doesn't exist
      await fs.mkdir(scenariosDir, { recursive: true });

      const files = await fs.readdir(scenariosDir);
      const scenarios = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(scenariosDir, file);
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);
            scenarios.push({
              id: data.id || file.replace('.json', ''),
              name: data.name || file.replace('.json', ''),
              filename: file,
              path: filePath,
              ...data
            });
          } catch (parseError) {
            loggerService.warn(`[Scenario] Failed to parse ${file}: ${parseError.message}`);
          }
        }
      }

      loggerService.debug(`[Scenario] Listed scenarios: ${scenarios.length}`);
      return { success: true, scenarios };
    } catch (error) {
      return errorResponse('Scenario list failed', error);
    }
  });

  ipcMain.handle('scenario:save', async (event, scenario) => {
    try {
      const fs = require('fs').promises;

      // Create directory if it doesn't exist
      await fs.mkdir(scenariosDir, { recursive: true });

      // Generate filename from scenario name or id
      const filename = `${scenario.name || scenario.id || 'untitled'}.json`;
      const filePath = path.join(scenariosDir, filename);

      // Add metadata
      const dataToSave = {
        ...scenario,
        savedAt: new Date().toISOString()
      };

      await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2), 'utf8');

      loggerService.debug('[Scenario] Saved: ' + filePath);
      return { success: true, path: filePath, filename };
    } catch (error) {
      return errorResponse('Scenario save failed', error);
    }
  });

  ipcMain.handle('scenario:load', async (event, filename) => {
    try {
      const fs = require('fs').promises;
      const filePath = path.join(scenariosDir, filename);

      const content = await fs.readFile(filePath, 'utf8');
      const scenario = JSON.parse(content);

      loggerService.debug('[Scenario] Loaded: ' + filePath);
      return { success: true, scenario };
    } catch (error) {
      return errorResponse('Scenario load failed', error);
    }
  });

  ipcMain.handle('scenario:delete', async (event, filename) => {
    try {
      const fs = require('fs').promises;
      const filePath = path.join(scenariosDir, filename);

      await fs.unlink(filePath);

      loggerService.debug('[Scenario] Deleted: ' + filePath);
      return { success: true };
    } catch (error) {
      return errorResponse('Scenario delete failed', error);
    }
  });

  ipcMain.handle('scenario:rename', async (event, oldFilename, newFilename) => {
    try {
      const fs = require('fs').promises;
      const oldPath = path.join(scenariosDir, oldFilename);
      const newPath = path.join(scenariosDir, newFilename);

      await fs.rename(oldPath, newPath);

      loggerService.debug(`[Scenario] Renamed: ${oldFilename} -> ${newFilename}`);
      return { success: true };
    } catch (error) {
      return errorResponse('Scenario rename failed', error);
    }
  });

  // ===== File Dialog Handlers =====

  ipcMain.handle('file:show-save-dialog', async (event, options) => {
    try {
      const { dialog } = require('electron');
      const result = await dialog.showSaveDialog(mainWindow, options);
      return result;
    } catch (error) {
      loggerService.error('[File] showSaveDialog error', error);
      return { canceled: true, error: error.message };
    }
  });

  ipcMain.handle('file:show-open-dialog', async (event, options) => {
    try {
      const { dialog } = require('electron');
      const result = await dialog.showOpenDialog(mainWindow, options);
      return result;
    } catch (error) {
      loggerService.error('[File] showOpenDialog error', error);
      return { canceled: true, error: error.message };
    }
  });

  ipcMain.handle('file:write-file', async (event, filePath, data) => {
    try {
      const fs = require('fs').promises;
      await fs.writeFile(filePath, data, 'utf8');
      return { success: true, path: filePath };
    } catch (error) {
      return errorResponse('File write failed', error);
    }
  });

  ipcMain.handle('file:read-file', async (event, filePath) => {
    try {
      const fs = require('fs').promises;
      const data = await fs.readFile(filePath, 'utf8');
      return { success: true, data };
    } catch (error) {
      return errorResponse('File read failed', error);
    }
  });

  // ===== Result Report Handlers =====

  /**
   * Start a new report session
   */
  ipcMain.handle('report:session:start', async (event, options) => {
    try {
      const result = resultReportService.startSession(options);
      return { success: true, ...result };
    } catch (error) {
      return errorResponse('Report session start failed', error);
    }
  });

  /**
   * Record an action result to the session
   */
  ipcMain.handle('report:session:record', async (event, sessionId, actionResult) => {
    try {
      const result = resultReportService.recordAction(sessionId, actionResult);
      return result;
    } catch (error) {
      return errorResponse('Report record action failed', error);
    }
  });

  /**
   * Finalize session and generate report
   */
  ipcMain.handle('report:session:finalize', async (event, sessionId, options) => {
    try {
      const result = await resultReportService.finalizeSession(sessionId, options);
      return result;
    } catch (error) {
      return errorResponse('Report finalize failed', error);
    }
  });

  /**
   * Cancel a session without generating report
   */
  ipcMain.handle('report:session:cancel', async (event, sessionId) => {
    try {
      const result = resultReportService.cancelSession(sessionId);
      return result;
    } catch (error) {
      return errorResponse('Report cancel failed', error);
    }
  });

  /**
   * Get session status
   */
  ipcMain.handle('report:session:status', async (event, sessionId) => {
    try {
      return resultReportService.getSessionStatus(sessionId);
    } catch (error) {
      loggerService.error('[Report] Status error', error);
      return { exists: false, error: error.message };
    }
  });

  /**
   * Save screenshot to temp file (for report)
   */
  ipcMain.handle('report:save:screenshot', async (event, data) => {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const os = require('os');

      const { content, filename } = data;
      const tempDir = path.join(os.tmpdir(), 'vision-auto-screenshots');
      await fs.mkdir(tempDir, { recursive: true });

      const filePath = path.join(tempDir, filename || `screenshot_${Date.now()}.png`);
      const base64Data = content.replace(/^data:image\/\w+;base64,/, '');
      await fs.writeFile(filePath, Buffer.from(base64Data, 'base64'));

      return { success: true, path: filePath };
    } catch (error) {
      return errorResponse('Report save screenshot failed', error);
    }
  });

  /**
   * Get session data for AI analysis
   */
  ipcMain.handle('report:session:data', async (event, sessionId) => {
    try {
      const data = resultReportService.getSessionData(sessionId);
      return { success: true, data };
    } catch (error) {
      return errorResponse('Get session data failed', error);
    }
  });

  /**
   * Store AI analysis result in session
   */
  ipcMain.handle('report:session:ai-analysis', async (event, sessionId, analysisResult) => {
    try {
      const result = resultReportService.storeAIAnalysis(sessionId, analysisResult);
      return result;
    } catch (error) {
      return errorResponse('Store AI analysis failed', error);
    }
  });

  // ===== AI Analysis Handlers =====

  /**
   * Analyze failure with AI
   */
  ipcMain.handle('ai:analyze', async (event, sessionData, scenario) => {
    try {
      if (!aiAnalysisService.isEnabled()) {
        return {
          success: false,
          error: 'AI Analysis is not enabled. Please configure API key in settings.'
        };
      }
      const result = await aiAnalysisService.analyzeFailure(sessionData, scenario);
      return result;
    } catch (error) {
      loggerService.error('[AIAnalysis] Analysis error', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Configure AI analysis service
   */
  ipcMain.handle('ai:configure', async (event, config) => {
    try {
      aiAnalysisService.configure(config);
      return { success: true, enabled: aiAnalysisService.isEnabled() };
    } catch (error) {
      return errorResponse('AI configuration failed', error);
    }
  });

  /**
   * Check AI analysis status
   */
  ipcMain.handle('ai:status', async () => {
    try {
      return {
        success: true,
        enabled: aiAnalysisService.isEnabled(),
        model: aiAnalysisService.model
      };
    } catch (error) {
      return errorResponse('AI status check failed', error);
    }
  });

  // ===== Protocol Manager Handlers =====

  // Connect to device via protocol
  ipcMain.handle('protocol:connect', async (event, deviceId, protocolName) => {
    try {
      loggerService.debug(`[Protocol] Connect called: ${deviceId}, ${protocolName}`);
      const result = await protocolManager.connect(deviceId, protocolName);
      loggerService.info(`Connected to ${deviceId} via ${result.protocol}`);
      return { success: true, ...result };
    } catch (error) {
      loggerService.error('Protocol connection failed', error);
      return { success: false, error: error.message };
    }
  });

  // Disconnect from device
  ipcMain.handle('protocol:disconnect', async () => {
    try {
      await protocolManager.disconnect();
      return { success: true };
    } catch (error) {
      return errorResponse('Protocol disconnect failed', error);
    }
  });

  // Execute action via protocol
  ipcMain.handle('protocol:execute', async (event, method, params) => {
    try {
      const result = await protocolManager[method](...params);
      return { success: true, result };
    } catch (error) {
      loggerService.error(`[Protocol] Execute ${method} error`, error);
      return { success: false, error: error.message };
    }
  });

  // Get protocol status
  ipcMain.handle('protocol:status', async () => {
    try {
      const status = protocolManager.getStatus();
      return { success: true, status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // List available protocols
  ipcMain.handle('protocol:list', async () => {
    try {
      const protocols = protocolManager.listProtocols();
      return { success: true, protocols };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get screen resolution via protocol
  ipcMain.handle('protocol:get-resolution', async () => {
    try {
      const resolution = await protocolManager.getScreenResolution();
      return { success: true, resolution };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Tap via protocol
  ipcMain.handle('protocol:tap', async (event, x, y) => {
    try {
      await protocolManager.tap(x, y);
      return { success: true };
    } catch (error) {
      return errorResponse('[Protocol] Tap failed', error);
    }
  });

  // Long press via protocol
  ipcMain.handle('protocol:long-press', async (event, x, y, duration) => {
    try {
      await protocolManager.longPress(x, y, duration);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Swipe via protocol
  ipcMain.handle('protocol:swipe', async (event, x1, y1, x2, y2, duration) => {
    try {
      await protocolManager.swipe(x1, y1, x2, y2, duration);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Drag via protocol
  ipcMain.handle('protocol:drag', async (event, x1, y1, x2, y2, duration) => {
    try {
      await protocolManager.drag(x1, y1, x2, y2, duration);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Scroll via protocol
  ipcMain.handle('protocol:scroll', async (event, direction, amount) => {
    try {
      await protocolManager.scroll(direction, amount);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Input text via protocol
  ipcMain.handle('protocol:input-text', async (event, text) => {
    try {
      await protocolManager.inputText(text);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Press key via protocol
  ipcMain.handle('protocol:press-key', async (event, keyCode) => {
    try {
      await protocolManager.pressKey(keyCode);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

/**
 * App event handlers
 */
app.whenReady().then(async () => {
  try {
    // Initialize services
    await initializeServices();

    // Setup IPC handlers
    setupIpcHandlers();

    // Create main window
    await createWindow();

    loggerService.info('Application started successfully');
  } catch (error) {
    loggerService.fatal('Failed to start application', error);
    app.quit();
  }
});

app.on('window-all-closed', async () => {
  // Clean up services before quitting
  try {
    // Stop ccNC stream if active
    if (ccncStreamActive) {
      ccncStreamActive = false;
    }

    // Disconnect ccNC if connected
    if (ccncService) {
      ccncService.disconnect();
      ccncService = null;
    }

    // Cleanup services
    await screenService.cleanup();
    await deviceService.cleanup();
    await macroService.cleanup();
    await actionService.cleanup();
  } catch (error) {
    loggerService.error('Error during cleanup', error);
  }

  // Always quit on all platforms (including macOS)
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  loggerService.info('Application shutting down');

  // Cleanup services
  await screenService.cleanup();
  await deviceService.cleanup();
  await macroService.cleanup();
  await actionService.cleanup();
  await settingsService.cleanup();
  await loggerService.cleanup();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  loggerService.fatal('Uncaught exception', error);
});

process.on('unhandledRejection', (reason, promise) => {
  loggerService.fatal('Unhandled rejection', { reason, promise });
});