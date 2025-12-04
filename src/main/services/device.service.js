/**
 * Device Service - ADB Device Management
 */

const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const EventEmitter = require('events');
const path = require('path');

const execAsync = promisify(exec);

class DeviceService extends EventEmitter {
  constructor() {
    super();
    this.currentDevice = null;
    this.adbPath = this._findAdbPath();
    this.deviceWatcher = null;
    this._initialized = false;
  }

  /**
   * Initialize service
   */
  async initialize() {
    if (this._initialized) return;

    try {
      // Check ADB installation
      await this._checkAdb();

      // Start device watcher
      this._startDeviceWatcher();

      this._initialized = true;
      console.log('Device service initialized');
    } catch (error) {
      console.error('Failed to initialize device service:', error);
      throw error;
    }
  }

  /**
   * Cleanup service
   */
  async cleanup() {
    if (this.deviceWatcher) {
      clearInterval(this.deviceWatcher);
      this.deviceWatcher = null;
    }

    if (this.currentDevice) {
      await this.disconnect();
    }

    this._initialized = false;
  }

  /**
   * Find ADB path
   */
  _findAdbPath() {
    // Check common locations or use system PATH
    if (process.platform === 'win32') {
      return 'adb.exe';
    } else if (process.platform === 'darwin') {
      // macOS - homebrew installation path
      const fs = require('fs');
      const homebrewPath = '/opt/homebrew/bin/adb';
      const usrLocalPath = '/usr/local/bin/adb';

      if (fs.existsSync(homebrewPath)) {
        return homebrewPath;
      } else if (fs.existsSync(usrLocalPath)) {
        return usrLocalPath;
      }
    }
    return 'adb';
  }

  /**
   * Check if ADB is installed
   */
  async _checkAdb() {
    try {
      const { stdout } = await execAsync(`${this.adbPath} version`);
      const match = stdout.match(/Android Debug Bridge version ([\d.]+)/);

      if (match) {
        console.log(`ADB version: ${match[1]}`);
        return match[1];
      }

      throw new Error('ADB version not found');
    } catch (error) {
      throw new Error('ADB is not installed or not in PATH');
    }
  }

  /**
   * Start watching for device changes
   */
  _startDeviceWatcher() {
    // Poll for device changes every 2 seconds
    this.deviceWatcher = setInterval(async () => {
      try {
        const devices = await this.listDevices();
        this.emit('list-changed', devices);

        // Check if current device is still connected
        if (this.currentDevice) {
          const stillConnected = devices.some(d => d.id === this.currentDevice);
          if (!stillConnected) {
            this.currentDevice = null;
            this.emit('disconnected', this.currentDevice);
          }
        }
      } catch (error) {
        console.error('Device watcher error:', error);
      }
    }, 2000);
  }

  /**
   * Execute ADB command
   */
  async _execAdb(command, deviceId = null) {
    const fullCommand = deviceId
      ? `${this.adbPath} -s ${deviceId} ${command}`
      : `${this.adbPath} ${command}`;

    try {
      const { stdout, stderr } = await execAsync(fullCommand);

      if (stderr && !stderr.includes('Warning')) {
        console.warn(`ADB stderr: ${stderr}`);
      }

      return stdout.trim();
    } catch (error) {
      throw new Error(`ADB command failed: ${error.message}`);
    }
  }

  /**
   * List connected devices
   */
  async listDevices() {
    try {
      const output = await this._execAdb('devices -l');
      const lines = output.split('\n').slice(1); // Skip header
      const devices = [];

      for (const line of lines) {
        if (!line.trim()) continue;

        const parts = line.split(/\s+/);
        const id = parts[0];
        const status = parts[1];

        if (status === 'device') {
          // Parse device properties
          const model = line.match(/model:([^\s]+)/)?.[1] || 'Unknown';
          const device = line.match(/device:([^\s]+)/)?.[1] || 'Unknown';
          const transport = line.match(/transport_id:(\d+)/)?.[1] || null;

          devices.push({
            id,
            model,
            device,
            transportId: transport,
            status: 'device'  // Keep actual ADB status for heartbeat check
          });
        } else if (status === 'unauthorized') {
          devices.push({
            id,
            model: 'Unauthorized',
            device: 'Unknown',
            status: 'unauthorized'
          });
        } else if (status === 'offline') {
          // Device is offline (e.g., powered off, rebooting)
          devices.push({
            id,
            model: 'Offline',
            device: 'Unknown',
            status: 'offline'
          });
        } else if (status === 'no' || status === 'permissions') {
          // Handle 'no permissions' case
          devices.push({
            id,
            model: 'No permissions',
            device: 'Unknown',
            status: 'no_permissions'
          });
        }
      }

      return devices;
    } catch (error) {
      console.error('Failed to list devices:', error);
      return [];
    }
  }

  /**
   * Select device (alias for connect)
   */
  async selectDevice(deviceId) {
    try {
      // Check if device exists
      const devices = await this.listDevices();
      const device = devices.find(d => d.id === deviceId);

      if (!device) {
        throw new Error('Device not found');
      }

      if (device.status === 'unauthorized') {
        throw new Error('Device is unauthorized. Please allow USB debugging on device.');
      }

      this.currentDevice = deviceId;
      this.emit('connected', device);

      // Try to get device info, but don't fail if it doesn't work
      let info = {};
      try {
        info = await this.getDeviceInfo(deviceId);
      } catch (infoError) {
        console.warn('Failed to get detailed device info:', infoError.message);
        // Return basic info
        info = {
          model: device.model || 'Unknown',
          manufacturer: 'Unknown',
          androidVersion: 'Unknown',
          sdkVersion: 0,
          resolution: 'Unknown',
          battery: 'Unknown'
        };
      }

      return {
        ...device,
        ...info
      };
    } catch (error) {
      console.error('Failed to select device:', error);
      throw error;
    }
  }

  /**
   * Connect to device
   */
  async connect(deviceId) {
    try {
      // Check if device exists
      const devices = await this.listDevices();
      const device = devices.find(d => d.id === deviceId);

      if (!device) {
        throw new Error('Device not found');
      }

      if (device.status === 'unauthorized') {
        throw new Error('Device is unauthorized. Please allow USB debugging on device.');
      }

      this.currentDevice = deviceId;
      this.emit('connected', device);

      return true;
    } catch (error) {
      console.error('Failed to connect to device:', error);
      throw error;
    }
  }

  /**
   * Disconnect from device
   */
  async disconnect() {
    this.currentDevice = null;
    this.emit('disconnected');
    return true;
  }

  /**
   * Check if connected
   */
  async isConnected() {
    if (!this.currentDevice) return false;

    try {
      const devices = await this.listDevices();
      return devices.some(d => d.id === this.currentDevice);
    } catch {
      return false;
    }
  }

  /**
   * Get device information
   */
  async getDeviceInfo(deviceId = null) {
    const id = deviceId || this.currentDevice;

    if (!id) {
      throw new Error('No device specified');
    }

    try {
      const [
        manufacturer,
        model,
        androidVersion,
        sdkVersion,
        screenSize,
        screenDensity,
        battery
      ] = await Promise.all([
        this._execAdb('shell getprop ro.product.manufacturer', id).catch(() => 'Unknown'),
        this._execAdb('shell getprop ro.product.model', id).catch(() => 'Unknown'),
        this._execAdb('shell getprop ro.build.version.release', id).catch(() => 'Unknown'),
        this._execAdb('shell getprop ro.build.version.sdk', id).catch(() => '0'),
        this._execAdb('shell wm size', id).catch(() => ''),
        this._execAdb('shell wm density', id).catch(() => ''),
        this._execAdb('shell dumpsys battery | grep level', id).catch(() => '')
      ]);

      // Parse screen size
      const sizeMatch = screenSize.match(/Physical size: (\d+)x(\d+)/);
      const width = sizeMatch ? parseInt(sizeMatch[1]) : 0;
      const height = sizeMatch ? parseInt(sizeMatch[2]) : 0;

      // Parse density
      const densityMatch = screenDensity.match(/Physical density: (\d+)/);
      const density = densityMatch ? parseInt(densityMatch[1]) : 0;

      // Parse battery level
      const batteryMatch = battery.match(/level: (\d+)/);
      const batteryLevel = batteryMatch ? parseInt(batteryMatch[1]) : null;

      return {
        id,
        manufacturer: manufacturer.trim() || 'Unknown',
        model: model.trim() || 'Unknown',
        androidVersion: androidVersion.trim() || 'Unknown',
        sdkVersion: parseInt(sdkVersion) || 0,
        resolution: width && height ? `${width}x${height}` : 'Unknown',
        battery: batteryLevel || 'Unknown',
        screen: {
          width,
          height,
          density
        }
      };
    } catch (error) {
      console.error('Failed to get device info:', error);
      // Return minimal info
      return {
        id,
        manufacturer: 'Unknown',
        model: 'Unknown',
        androidVersion: 'Unknown',
        sdkVersion: 0,
        resolution: 'Unknown',
        battery: 'Unknown',
        screen: {
          width: 0,
          height: 0,
          density: 0
        }
      };
    }
  }

  /**
   * Enable wireless debugging
   */
  async enableWireless(port = 5555) {
    if (!this.currentDevice) {
      throw new Error('No device connected');
    }

    try {
      // Set TCP/IP mode
      await this._execAdb(`tcpip ${port}`, this.currentDevice);

      // Get device IP
      const ipOutput = await this._execAdb('shell ip route', this.currentDevice);
      const ipMatch = ipOutput.match(/src (\d+\.\d+\.\d+\.\d+)/);

      if (!ipMatch) {
        throw new Error('Could not get device IP address');
      }

      const ip = ipMatch[1];

      // Wait a moment for TCP/IP mode to activate
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Connect via IP
      await this._execAdb(`connect ${ip}:${port}`);

      return {
        ip,
        port
      };
    } catch (error) {
      console.error('Failed to enable wireless debugging:', error);
      throw error;
    }
  }

  /**
   * Disable wireless debugging
   */
  async disableWireless() {
    try {
      await this._execAdb('usb');
      return true;
    } catch (error) {
      console.error('Failed to disable wireless debugging:', error);
      throw error;
    }
  }

  /**
   * Pair wireless device
   */
  async pairWireless(host, port, pairingCode = null) {
    try {
      if (pairingCode) {
        // Android 11+ pairing
        await this._execAdb(`pair ${host}:${port} ${pairingCode}`);
      }

      // Connect to device
      await this._execAdb(`connect ${host}:${port}`);

      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if connected
      const devices = await this.listDevices();
      const connected = devices.some(d => d.id.includes(host));

      return connected;
    } catch (error) {
      console.error('Failed to pair wireless device:', error);
      throw error;
    }
  }

  /**
   * Restart ADB server
   */
  async restartAdbServer() {
    try {
      await this._execAdb('kill-server');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this._execAdb('start-server');

      return true;
    } catch (error) {
      console.error('Failed to restart ADB server:', error);
      throw error;
    }
  }

  /**
   * Install APK
   */
  async installApk(apkPath, deviceId = null) {
    const id = deviceId || this.currentDevice;

    if (!id) {
      throw new Error('No device specified');
    }

    try {
      const result = await this._execAdb(`install -r "${apkPath}"`, id);
      return result.includes('Success');
    } catch (error) {
      console.error('Failed to install APK:', error);
      throw error;
    }
  }

  /**
   * Uninstall app
   */
  async uninstallApp(packageName, deviceId = null) {
    const id = deviceId || this.currentDevice;

    if (!id) {
      throw new Error('No device specified');
    }

    try {
      const result = await this._execAdb(`uninstall ${packageName}`, id);
      return result.includes('Success');
    } catch (error) {
      console.error('Failed to uninstall app:', error);
      throw error;
    }
  }

  /**
   * Get installed apps
   */
  async getInstalledApps(deviceId = null) {
    const id = deviceId || this.currentDevice;

    if (!id) {
      throw new Error('No device specified');
    }

    try {
      const output = await this._execAdb('shell pm list packages', id);
      const packages = output.split('\n')
        .filter(line => line.startsWith('package:'))
        .map(line => line.replace('package:', '').trim());

      return packages;
    } catch (error) {
      console.error('Failed to get installed apps:', error);
      throw error;
    }
  }

  /**
   * Launch app
   */
  async launchApp(packageName, activity = null, deviceId = null) {
    const id = deviceId || this.currentDevice;

    if (!id) {
      throw new Error('No device specified');
    }

    try {
      if (activity) {
        await this._execAdb(
          `shell am start -n ${packageName}/${activity}`,
          id
        );
      } else {
        // Try to launch using monkey
        await this._execAdb(
          `shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`,
          id
        );
      }

      return true;
    } catch (error) {
      console.error('Failed to launch app:', error);
      throw error;
    }
  }

  /**
   * Force stop app
   */
  async forceStopApp(packageName, deviceId = null) {
    const id = deviceId || this.currentDevice;

    if (!id) {
      throw new Error('No device specified');
    }

    try {
      await this._execAdb(`shell am force-stop ${packageName}`, id);
      return true;
    } catch (error) {
      console.error('Failed to force stop app:', error);
      throw error;
    }
  }

  /**
   * Get running apps
   */
  async getRunningApps(deviceId = null) {
    const id = deviceId || this.currentDevice;

    if (!id) {
      throw new Error('No device specified');
    }

    try {
      const output = await this._execAdb('shell dumpsys activity activities | grep mFocusedActivity', id);
      const match = output.match(/\{[^}]+\}/);

      if (match) {
        const activityInfo = match[0];
        const packageMatch = activityInfo.match(/([^\/\s]+)\/([^}\s]+)/);

        if (packageMatch) {
          return {
            package: packageMatch[1],
            activity: packageMatch[2]
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to get running apps:', error);
      return null;
    }
  }

  /**
   * Get state for debugging
   */
  getState() {
    return {
      initialized: this._initialized,
      currentDevice: this.currentDevice,
      adbPath: this.adbPath,
      watcherActive: !!this.deviceWatcher
    };
  }
}

// Export singleton instance
module.exports = new DeviceService();