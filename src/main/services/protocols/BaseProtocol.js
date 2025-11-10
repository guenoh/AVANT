/**
 * BaseProtocol
 * Abstract base class for device communication protocols
 * Defines the standard interface that all protocol adapters must implement
 */

class BaseProtocol {
    constructor(config = {}) {
        this.config = config;
        this.connected = false;
        this.deviceInfo = null;

        // Protocol capabilities (to be overridden by subclasses)
        this.capabilities = {
            // Device management
            canListDevices: false,
            canGetDeviceInfo: false,
            canInstallApp: false,
            canUninstallApp: false,
            canLaunchApp: false,
            canManageWireless: false,

            // Input actions
            canTap: false,
            canLongPress: false,
            canSwipe: false,
            canDrag: false,
            canMultiTouch: false,
            canFastTouch: false,
            canScroll: false,
            canInputText: false,
            canPressKey: false,

            // Screen capture
            canCaptureScreen: false,
            supportedImageFormats: [], // ['png', 'jpeg', 'bmp', 'raw']
            canCaptureRegion: false,
            canStreamScreen: false,
            supportsMultiMonitor: false,

            // Advanced features
            canExecuteShellCommand: false,
            canGetSystemProperties: false,
            canManageFiles: false
        };
    }

    /**
     * Get protocol name
     */
    getName() {
        throw new Error('getName() must be implemented by subclass');
    }

    /**
     * Get protocol capabilities
     */
    getCapabilities() {
        return { ...this.capabilities };
    }

    /**
     * Check if protocol supports a specific capability
     */
    hasCapability(capability) {
        return this.capabilities[capability] === true;
    }

    /**
     * Validate that protocol supports required capability
     */
    _requireCapability(capability, operation) {
        if (!this.hasCapability(capability)) {
            throw new Error(
                `Protocol ${this.getName()} does not support ${operation} (capability: ${capability})`
            );
        }
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.connected;
    }

    // ===== Device Management Methods =====

    /**
     * List available devices
     * @returns {Promise<Array>} Array of device objects
     */
    async listDevices() {
        this._requireCapability('canListDevices', 'listDevices');
        throw new Error('listDevices() must be implemented by subclass');
    }

    /**
     * Connect to a device
     * @param {string} deviceId - Device identifier
     * @returns {Promise<Object>} Device information
     */
    async connect(deviceId) {
        throw new Error('connect() must be implemented by subclass');
    }

    /**
     * Disconnect from device
     * @returns {Promise<void>}
     */
    async disconnect() {
        throw new Error('disconnect() must be implemented by subclass');
    }

    /**
     * Get device information
     * @returns {Promise<Object>} Device info (model, brand, OS version, etc.)
     */
    async getDeviceInfo() {
        this._requireCapability('canGetDeviceInfo', 'getDeviceInfo');
        throw new Error('getDeviceInfo() must be implemented by subclass');
    }

    /**
     * Get screen resolution
     * @returns {Promise<Object>} {width, height}
     */
    async getScreenResolution() {
        throw new Error('getScreenResolution() must be implemented by subclass');
    }

    // ===== Input Action Methods =====

    /**
     * Tap at coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Promise<void>}
     */
    async tap(x, y) {
        this._requireCapability('canTap', 'tap');
        throw new Error('tap() must be implemented by subclass');
    }

    /**
     * Long press at coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} duration - Press duration in milliseconds
     * @returns {Promise<void>}
     */
    async longPress(x, y, duration = 1000) {
        this._requireCapability('canLongPress', 'longPress');
        throw new Error('longPress() must be implemented by subclass');
    }

    /**
     * Swipe from one point to another
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} x2 - End X
     * @param {number} y2 - End Y
     * @param {number} duration - Swipe duration in milliseconds
     * @returns {Promise<void>}
     */
    async swipe(x1, y1, x2, y2, duration = 300) {
        this._requireCapability('canSwipe', 'swipe');
        throw new Error('swipe() must be implemented by subclass');
    }

    /**
     * Drag from one point to another
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} x2 - End X
     * @param {number} y2 - End Y
     * @param {number} duration - Drag duration in milliseconds
     * @returns {Promise<void>}
     */
    async drag(x1, y1, x2, y2, duration = 300) {
        this._requireCapability('canDrag', 'drag');
        // Default implementation uses swipe
        return this.swipe(x1, y1, x2, y2, duration);
    }

    /**
     * Scroll in direction
     * @param {string} direction - 'up', 'down', 'left', 'right'
     * @param {number} amount - Scroll amount (0-1)
     * @returns {Promise<void>}
     */
    async scroll(direction, amount = 0.5) {
        this._requireCapability('canScroll', 'scroll');
        throw new Error('scroll() must be implemented by subclass');
    }

    /**
     * Input text
     * @param {string} text - Text to input
     * @returns {Promise<void>}
     */
    async inputText(text) {
        this._requireCapability('canInputText', 'inputText');
        throw new Error('inputText() must be implemented by subclass');
    }

    /**
     * Press a key
     * @param {string} keyCode - Key code (BACK, HOME, MENU, etc.)
     * @returns {Promise<void>}
     */
    async pressKey(keyCode) {
        this._requireCapability('canPressKey', 'pressKey');
        throw new Error('pressKey() must be implemented by subclass');
    }

    // ===== Screen Capture Methods =====

    /**
     * Capture screenshot
     * @param {Object} options - Capture options {format, quality, region}
     * @returns {Promise<Buffer>} Image data
     */
    async captureScreen(options = {}) {
        this._requireCapability('canCaptureScreen', 'captureScreen');
        throw new Error('captureScreen() must be implemented by subclass');
    }

    /**
     * Start screen streaming
     * @param {Function} callback - Called with each frame
     * @param {Object} options - Stream options
     * @returns {Promise<Function>} Stop function
     */
    async startScreenStream(callback, options = {}) {
        this._requireCapability('canStreamScreen', 'startScreenStream');
        throw new Error('startScreenStream() must be implemented by subclass');
    }

    /**
     * Stop screen streaming
     * @returns {Promise<void>}
     */
    async stopScreenStream() {
        this._requireCapability('canStreamScreen', 'stopScreenStream');
        throw new Error('stopScreenStream() must be implemented by subclass');
    }

    // ===== App Management Methods =====

    /**
     * Install an app
     * @param {string} apkPath - Path to APK file
     * @returns {Promise<void>}
     */
    async installApp(apkPath) {
        this._requireCapability('canInstallApp', 'installApp');
        throw new Error('installApp() must be implemented by subclass');
    }

    /**
     * Uninstall an app
     * @param {string} packageName - Package name
     * @returns {Promise<void>}
     */
    async uninstallApp(packageName) {
        this._requireCapability('canUninstallApp', 'uninstallApp');
        throw new Error('uninstallApp() must be implemented by subclass');
    }

    /**
     * Launch an app
     * @param {string} packageName - Package name
     * @param {string} activityName - Activity name (optional)
     * @returns {Promise<void>}
     */
    async launchApp(packageName, activityName = null) {
        this._requireCapability('canLaunchApp', 'launchApp');
        throw new Error('launchApp() must be implemented by subclass');
    }

    // ===== Advanced Methods =====

    /**
     * Execute shell command
     * @param {string} command - Shell command
     * @returns {Promise<string>} Command output
     */
    async executeShellCommand(command) {
        this._requireCapability('canExecuteShellCommand', 'executeShellCommand');
        throw new Error('executeShellCommand() must be implemented by subclass');
    }

    /**
     * Get system property
     * @param {string} key - Property key
     * @returns {Promise<string>} Property value
     */
    async getSystemProperty(key) {
        this._requireCapability('canGetSystemProperties', 'getSystemProperty');
        throw new Error('getSystemProperty() must be implemented by subclass');
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        if (this.connected) {
            await this.disconnect();
        }
    }

    /**
     * Get protocol status information
     */
    getStatus() {
        return {
            name: this.getName(),
            connected: this.connected,
            deviceInfo: this.deviceInfo,
            capabilities: this.getCapabilities()
        };
    }
}

module.exports = BaseProtocol;
