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

// ccNC connection instance
let ccncService = null;

let mainWindow = null;

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
      preload: path.join(__dirname, '../renderer/preload.js'),
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

    // Initialize other services
    await settingsService.initialize();
    await deviceService.initialize();
    await screenService.initialize(deviceService);
    await actionService.initialize(deviceService);
    await macroService.initialize();

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
      console.log('[IPC] device:list called');
      const devices = await deviceService.listDevices();
      console.log('[IPC] device:list result:', devices);
      return { success: true, devices };
    } catch (error) {
      console.error('[IPC] device:list error:', error);
      loggerService.error('Failed to list devices', error);
      return {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  });

  ipcMain.handle('device:select', async (event, deviceId) => {
    try {
      console.log('[IPC] device:select called with:', deviceId);
      const result = await deviceService.selectDevice(deviceId);
      console.log('[IPC] device:select result:', result);

      // 렌더러에 디바이스 상태 업데이트 전송
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('device:status', {
          status: 'connected',
          device: result
        });
      }

      return { success: true, info: result };
    } catch (error) {
      console.error('[IPC] device:select error:', error);
      loggerService.error('Failed to select device', error);
      return {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  });

  ipcMain.handle('device:info', async () => {
    try {
      const info = await deviceService.getDeviceInfo();
      return { success: true, info };
    } catch (error) {
      loggerService.error('Failed to get device info', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('device:connect-ccnc', async (event, { host, port }) => {
    try {
      console.log('[IPC] device:connect-ccnc called with:', host, port);

      // Create new ccNC service if not exists
      if (!ccncService) {
        ccncService = new CCNCConnectionService();
      }

      // Connect to ccNC server
      await ccncService.connect(host, port);

      // Try to get version (optional)
      let version = 'unknown';
      try {
        version = await ccncService.getVersion();
      } catch (versionError) {
        console.log('[ccNC] Version query failed, continuing:', versionError.message);
      }

      loggerService.info(`ccNC connected: ${host}:${port} (version: ${version})`);

      return {
        success: true,
        version,
        host,
        port
      };
    } catch (error) {
      console.error('[IPC] device:connect-ccnc error:', error);
      loggerService.error('Failed to connect ccNC', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('device:disconnect-ccnc', async () => {
    try {
      console.log('[IPC] device:disconnect-ccnc called');

      if (ccncService) {
        ccncService.disconnect();
        ccncService = null;
      }

      loggerService.info('ccNC disconnected');
      return { success: true };
    } catch (error) {
      console.error('[IPC] device:disconnect-ccnc error:', error);
      loggerService.error('Failed to disconnect ccNC', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Screen handlers
  ipcMain.handle('screen:capture', async () => {
    try {
      // Use ccNC if connected, otherwise use ADB
      if (ccncService && ccncService.isConnected()) {
        // Use actual ccNC resolution: 1920x720
        const imageData = await ccncService.capture(0, 0, 1920, 720, { format: 'jpeg' });
        const base64 = imageData.toString('base64');
        return { success: true, screenshot: `data:image/jpeg;base64,${base64}` };
      } else {
        const screenshot = await screenService.takeScreenshot();
        return { success: true, screenshot };
      }
    } catch (error) {
      loggerService.error('Failed to capture screen', error);
      return { success: false, error: error.message };
    }
  });

  // ccNC streaming interval
  let ccncStreamInterval = null;

  ipcMain.handle('screen:start-stream', async (event, options) => {
    try {
      // Use ccNC if connected
      if (ccncService && ccncService.isConnected()) {
        if (ccncStreamInterval) {
          throw new Error('ccNC stream already active');
        }

        const fps = options?.maxFps || 5;
        const interval = 1000 / fps;

        ccncStreamInterval = setInterval(async () => {
          try {
            // Use actual ccNC resolution: 1920x720
            const imageData = await ccncService.capture(0, 0, 1920, 720, { format: 'jpeg' });
            const base64 = imageData.toString('base64');

            if (mainWindow && mainWindow.webContents) {
              mainWindow.webContents.send('screen:stream:data', {
                dataUrl: `data:image/jpeg;base64,${base64}`,
                width: 1920,
                height: 720,
                timestamp: Date.now()
              });
            }
          } catch (error) {
            console.error('[ccNC Stream] Capture error:', error.message);
          }
        }, interval);

        loggerService.info(`ccNC stream started at ${fps} FPS`);
        return { success: true };
      } else {
        await screenService.startStream(options);
        return { success: true };
      }
    } catch (error) {
      loggerService.error('Failed to start stream', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('screen:stop-stream', async () => {
    try {
      // Stop ccNC stream if active
      if (ccncStreamInterval) {
        clearInterval(ccncStreamInterval);
        ccncStreamInterval = null;
        loggerService.info('ccNC stream stopped');
        return { success: true };
      } else {
        await screenService.stopStream();
        return { success: true };
      }
    } catch (error) {
      loggerService.error('Failed to stop stream', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('screen:start-record', async (event, options) => {
    try {
      const recordingPath = await screenService.startRecording(options);
      return { success: true, path: recordingPath };
    } catch (error) {
      loggerService.error('Failed to start recording', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('screen:stop-record', async () => {
    try {
      const recordingPath = await screenService.stopRecording();
      return { success: true, path: recordingPath };
    } catch (error) {
      loggerService.error('Failed to stop recording', error);
      return { success: false, error: error.message };
    }
  });

  // Action handlers
  ipcMain.handle('action:execute', async (event, action) => {
    try {
      // Use ccNC if connected
      if (ccncService && ccncService.isConnected()) {
        switch (action.type) {
          case 'tap':
            await ccncService.tap(action.x, action.y);
            return { success: true };

          case 'swipe':
            await ccncService.drag(
              action.startX,
              action.startY,
              action.endX,
              action.endY,
              { duration: action.duration || 300 }
            );
            return { success: true };

          case 'wait':
            await new Promise(resolve => setTimeout(resolve, action.duration || 1000));
            return { success: true };

          default:
            throw new Error(`Unsupported action type for ccNC: ${action.type}`);
        }
      } else {
        const result = await actionService.execute(action);
        return { success: true, ...result };
      }
    } catch (error) {
      loggerService.error('Failed to execute action', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('action:execute-batch', async (event, actions) => {
    try {
      // Use ccNC if connected
      if (ccncService && ccncService.isConnected()) {
        const results = [];
        for (const action of actions) {
          // Execute action using ccNC
          switch (action.type) {
            case 'tap':
              await ccncService.tap(action.x, action.y);
              results.push({ success: true });
              break;

            case 'swipe':
              await ccncService.drag(
                action.startX,
                action.startY,
                action.endX,
                action.endY,
                { duration: action.duration || 300 }
              );
              results.push({ success: true });
              break;

            case 'wait':
              await new Promise(resolve => setTimeout(resolve, action.duration || 1000));
              results.push({ success: true });
              break;

            default:
              results.push({ success: false, error: `Unsupported action type: ${action.type}` });
          }

          // Add delay between actions
          if (action.delay) {
            await new Promise(resolve => setTimeout(resolve, action.delay));
          }
        }
        return { success: true, results };
      } else {
        const results = await actionService.executeBatch(actions);
        return { success: true, results };
      }
    } catch (error) {
      loggerService.error('Failed to execute batch actions', error);
      return { success: false, error: error.message };
    }
  });

  // Macro handlers
  ipcMain.handle('macro:list', async () => {
    try {
      const macros = await macroService.listMacros();
      return { success: true, macros };
    } catch (error) {
      loggerService.error('Failed to list macros', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('macro:get', async (event, id) => {
    try {
      const macro = await macroService.loadMacro(id);
      return { success: true, macro };
    } catch (error) {
      loggerService.error('Failed to get macro', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('macro:save', async (event, macro) => {
    try {
      const savedMacro = await macroService.saveMacro(macro);
      return { success: true, macro: savedMacro };
    } catch (error) {
      loggerService.error('Failed to save macro', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('macro:delete', async (event, id) => {
    try {
      await macroService.deleteMacro(id);
      return { success: true };
    } catch (error) {
      loggerService.error('Failed to delete macro', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('macro:run', async (event, id, options) => {
    try {
      await macroService.runMacro(id, options);
      return { success: true };
    } catch (error) {
      loggerService.error('Failed to run macro', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('macro:stop', async (event, id) => {
    try {
      await macroService.stopMacro(id);
      return { success: true };
    } catch (error) {
      loggerService.error('Failed to stop macro', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('macro:start-recording', async () => {
    try {
      await macroService.startRecording();
      return { success: true };
    } catch (error) {
      loggerService.error('Failed to start recording', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('macro:stop-recording', async () => {
    try {
      const macro = await macroService.stopRecording();
      return { success: true, macro };
    } catch (error) {
      loggerService.error('Failed to stop recording', error);
      return { success: false, error: error.message };
    }
  });

  // Settings handlers
  ipcMain.handle('settings:get', async () => {
    try {
      const settings = await settingsService.getAll();
      return { success: true, settings };
    } catch (error) {
      loggerService.error('Failed to get settings', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:get-category', async (event, category) => {
    try {
      const settings = await settingsService.getCategory(category);
      return { success: true, settings };
    } catch (error) {
      loggerService.error('Failed to get settings category', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:update', async (event, updates) => {
    try {
      const settings = await settingsService.update(updates);
      return { success: true, settings };
    } catch (error) {
      loggerService.error('Failed to update settings', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:reset', async (event, category) => {
    try {
      const settings = await settingsService.reset(category);
      return { success: true, settings };
    } catch (error) {
      loggerService.error('Failed to reset settings', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:export', async (event, path) => {
    try {
      const exportPath = await settingsService.exportSettings(path);
      return { success: true, path: exportPath };
    } catch (error) {
      loggerService.error('Failed to export settings', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:import', async (event, path) => {
    try {
      const settings = await settingsService.importSettings(path);
      return { success: true, settings };
    } catch (error) {
      loggerService.error('Failed to import settings', error);
      return { success: false, error: error.message };
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

      console.log('[ADB] Screenshot captured:', localPath);

      return {
        success: true,
        path: localPath
      };
    } catch (error) {
      console.error('[ADB] Screenshot error:', error.message);
      return {
        success: false,
        error: error.message
      };
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

      console.log('[ADB] Logcat captured:', filePath);

      return {
        success: true,
        path: filePath
      };
    } catch (error) {
      console.error('[ADB] Logcat error:', error.message);
      return {
        success: false,
        error: error.message
      };
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
    console.error('Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
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
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  loggerService.fatal('Unhandled rejection', { reason, promise });
  console.error('Unhandled rejection:', reason);
});