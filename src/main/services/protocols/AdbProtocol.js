/**
 * AdbProtocol
 * Android Debug Bridge protocol adapter
 * Wraps ADB functionality into standard protocol interface
 */

const BaseProtocol = require('./BaseProtocol');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class AdbProtocol extends BaseProtocol {
    constructor(config = {}) {
        super(config);

        this.adbPath = config.adbPath || 'adb';
        this.deviceId = null;

        // Set ADB capabilities
        this.capabilities = {
            // Device management
            canListDevices: true,
            canGetDeviceInfo: true,
            canInstallApp: true,
            canUninstallApp: true,
            canLaunchApp: true,
            canManageWireless: true,

            // Input actions
            canTap: true,
            canLongPress: true,
            canSwipe: true,
            canDrag: true,
            canMultiTouch: false,
            canFastTouch: false,
            canScroll: true,
            canInputText: true,
            canPressKey: true,

            // Screen capture
            canCaptureScreen: true,
            supportedImageFormats: ['png'],
            canCaptureRegion: false,
            canStreamScreen: false,
            supportsMultiMonitor: false,

            // Advanced features
            canExecuteShellCommand: true,
            canGetSystemProperties: true,
            canManageFiles: true
        };
    }

    getName() {
        return 'adb';
    }

    /**
     * Execute ADB command
     * @private
     */
    async _execAdb(command, useDeviceId = true) {
        const devicePrefix = useDeviceId && this.deviceId
            ? `-s ${this.deviceId}`
            : '';

        const fullCommand = `${this.adbPath} ${devicePrefix} ${command}`.trim();

        try {
            const { stdout, stderr } = await execAsync(fullCommand);
            return stdout.trim();
        } catch (error) {
            throw new Error(`ADB command failed: ${error.message}`);
        }
    }

    /**
     * Execute ADB shell command
     * @private
     */
    async _execShell(command) {
        return await this._execAdb(`shell "${command}"`);
    }

    // ===== Device Management =====

    async listDevices() {
        const output = await this._execAdb('devices -l', false);
        const lines = output.split('\n').slice(1); // Skip header

        const devices = [];
        for (const line of lines) {
            if (!line.trim()) continue;

            const parts = line.trim().split(/\s+/);
            if (parts.length < 2) continue;

            const deviceId = parts[0];
            const state = parts[1];

            if (state !== 'device') continue;

            // Parse device info
            const info = {};
            for (let i = 2; i < parts.length; i++) {
                const [key, value] = parts[i].split(':');
                if (key && value) {
                    info[key] = value;
                }
            }

            devices.push({
                id: deviceId,
                name: info.model || deviceId,
                model: info.model,
                product: info.product,
                device: info.device,
                transport: info.transport_id,
                state
            });
        }

        return devices;
    }

    async connect(deviceId) {
        this.deviceId = deviceId;

        // Verify device is accessible
        try {
            await this._execShell('echo test');
            this.connected = true;

            // Get device info
            this.deviceInfo = await this.getDeviceInfo();

            return this.deviceInfo;
        } catch (error) {
            this.connected = false;
            this.deviceId = null;
            throw new Error(`Failed to connect to device ${deviceId}: ${error.message}`);
        }
    }

    async disconnect() {
        this.connected = false;
        this.deviceId = null;
        this.deviceInfo = null;
    }

    async getDeviceInfo() {
        const [model, brand, androidVersion, sdk] = await Promise.all([
            this.getSystemProperty('ro.product.model'),
            this.getSystemProperty('ro.product.brand'),
            this.getSystemProperty('ro.build.version.release'),
            this.getSystemProperty('ro.build.version.sdk')
        ]);

        return {
            model,
            brand,
            androidVersion,
            sdk: parseInt(sdk),
            protocol: 'adb'
        };
    }

    async getScreenResolution() {
        const output = await this._execShell('wm size');
        const match = output.match(/Physical size: (\d+)x(\d+)/);

        if (!match) {
            // Try alternative method
            const dumpsys = await this._execShell('dumpsys window displays');
            const altMatch = dumpsys.match(/init=(\d+)x(\d+)/);

            if (altMatch) {
                return {
                    width: parseInt(altMatch[1]),
                    height: parseInt(altMatch[2])
                };
            }

            throw new Error('Failed to get screen resolution');
        }

        return {
            width: parseInt(match[1]),
            height: parseInt(match[2])
        };
    }

    // ===== Input Actions =====

    async tap(x, y) {
        await this._execShell(`input tap ${x} ${y}`);
    }

    async longPress(x, y, duration = 1000) {
        await this._execShell(`input swipe ${x} ${y} ${x} ${y} ${duration}`);
    }

    async swipe(x1, y1, x2, y2, duration = 300) {
        await this._execShell(`input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`);
    }

    async drag(x1, y1, x2, y2, duration = 300) {
        // ADB drag is the same as swipe
        return this.swipe(x1, y1, x2, y2, duration);
    }

    async scroll(direction, amount = 0.5) {
        // Get screen resolution for scroll calculation
        const resolution = await this.getScreenResolution();
        const { width, height } = resolution;

        const centerX = Math.floor(width / 2);
        const centerY = Math.floor(height / 2);
        const distance = Math.floor(height * amount);

        let x1 = centerX, y1 = centerY;
        let x2 = centerX, y2 = centerY;

        switch (direction) {
            case 'up':
                y1 = height - 100;
                y2 = 100;
                break;
            case 'down':
                y1 = 100;
                y2 = height - 100;
                break;
            case 'left':
                x1 = width - 100;
                x2 = 100;
                break;
            case 'right':
                x1 = 100;
                x2 = width - 100;
                break;
            default:
                throw new Error(`Invalid scroll direction: ${direction}`);
        }

        await this.swipe(x1, y1, x2, y2, 300);
    }

    async inputText(text) {
        // Escape special characters
        const escaped = text.replace(/(["\s'&|;<>()$`\\])/g, '\\$1');
        await this._execShell(`input text "${escaped}"`);
    }

    async pressKey(keyCode) {
        // Map common key names to ADB key codes
        const keyMap = {
            'BACK': 'KEYCODE_BACK',
            'HOME': 'KEYCODE_HOME',
            'MENU': 'KEYCODE_MENU',
            'RECENT': 'KEYCODE_APP_SWITCH',
            'POWER': 'KEYCODE_POWER',
            'VOLUME_UP': 'KEYCODE_VOLUME_UP',
            'VOLUME_DOWN': 'KEYCODE_VOLUME_DOWN',
            'ENTER': 'KEYCODE_ENTER',
            'DELETE': 'KEYCODE_DEL'
        };

        const adbKeyCode = keyMap[keyCode] || keyCode;
        await this._execShell(`input keyevent ${adbKeyCode}`);
    }

    // ===== Screen Capture =====

    async captureScreen(options = {}) {
        const format = options.format || 'png';

        if (!this.capabilities.supportedImageFormats.includes(format)) {
            throw new Error(`ADB does not support ${format} format`);
        }

        // Capture to device temp file
        const tempPath = '/sdcard/screencap.png';
        await this._execShell(`screencap -p ${tempPath}`);

        // Pull file
        const localPath = options.localPath || './temp_screen.png';
        await this._execAdb(`pull ${tempPath} ${localPath}`);

        // Clean up device file
        await this._execShell(`rm ${tempPath}`);

        // Read file if needed
        if (options.returnBuffer) {
            const fs = require('fs').promises;
            const buffer = await fs.readFile(localPath);

            if (!options.localPath) {
                // Clean up temp file
                await fs.unlink(localPath);
            }

            return buffer;
        }

        return localPath;
    }

    // ===== App Management =====

    async installApp(apkPath) {
        await this._execAdb(`install -r "${apkPath}"`);
    }

    async uninstallApp(packageName) {
        await this._execAdb(`uninstall ${packageName}`);
    }

    async launchApp(packageName, activityName = null) {
        if (activityName) {
            await this._execShell(`am start -n ${packageName}/${activityName}`);
        } else {
            await this._execShell(`monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`);
        }
    }

    // ===== Advanced Features =====

    async executeShellCommand(command) {
        return await this._execShell(command);
    }

    async getSystemProperty(key) {
        return await this._execShell(`getprop ${key}`);
    }

    /**
     * Push file to device
     */
    async pushFile(localPath, remotePath) {
        await this._execAdb(`push "${localPath}" "${remotePath}"`);
    }

    /**
     * Pull file from device
     */
    async pullFile(remotePath, localPath) {
        await this._execAdb(`pull "${remotePath}" "${localPath}"`);
    }

    /**
     * Connect to device wirelessly
     */
    async connectWireless(ipAddress, port = 5555) {
        const result = await this._execAdb(`connect ${ipAddress}:${port}`, false);
        return result.includes('connected');
    }

    /**
     * Disconnect wireless device
     */
    async disconnectWireless(ipAddress, port = 5555) {
        await this._execAdb(`disconnect ${ipAddress}:${port}`, false);
    }
}

module.exports = AdbProtocol;
