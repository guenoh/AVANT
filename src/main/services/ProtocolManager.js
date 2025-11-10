/**
 * ProtocolManager
 * Manages device communication protocols and provides unified interface
 * Handles protocol selection, lifecycle, and capability-based routing
 */

const EventEmitter = require('events');

class ProtocolManager extends EventEmitter {
    constructor() {
        super();

        // Registered protocol adapters
        this.protocols = new Map();

        // Active protocol
        this.activeProtocol = null;
        this.activeDeviceId = null;

        // Protocol preferences (priority order)
        this.protocolPriority = [];
    }

    /**
     * Register a protocol adapter
     * @param {string} name - Protocol name
     * @param {BaseProtocol} protocolClass - Protocol class (not instance)
     * @param {Object} config - Protocol configuration
     */
    registerProtocol(name, protocolClass, config = {}) {
        if (this.protocols.has(name)) {
            throw new Error(`Protocol ${name} is already registered`);
        }

        this.protocols.set(name, {
            name,
            class: protocolClass,
            config,
            instance: null
        });

        console.log(`[ProtocolManager] Registered protocol: ${name}`);
    }

    /**
     * Set protocol priority order
     * @param {Array<string>} priorities - Protocol names in priority order
     */
    setProtocolPriority(priorities) {
        this.protocolPriority = priorities.filter(name =>
            this.protocols.has(name)
        );

        console.log(`[ProtocolManager] Protocol priority set:`, this.protocolPriority);
    }

    /**
     * Get protocol instance (lazy initialization)
     * @param {string} name - Protocol name
     * @returns {BaseProtocol} Protocol instance
     */
    getProtocol(name) {
        const protocol = this.protocols.get(name);
        if (!protocol) {
            throw new Error(`Protocol ${name} is not registered`);
        }

        // Lazy initialization
        if (!protocol.instance) {
            protocol.instance = new protocol.class(protocol.config);
        }

        return protocol.instance;
    }

    /**
     * List all registered protocols
     * @returns {Array<Object>} Protocol information
     */
    listProtocols() {
        return Array.from(this.protocols.values()).map(p => ({
            name: p.name,
            capabilities: p.instance ? p.instance.getCapabilities() : null,
            connected: p.instance ? p.instance.isConnected() : false
        }));
    }

    /**
     * Find best protocol for required capabilities
     * @param {Array<string>} requiredCapabilities - Required capability names
     * @returns {string|null} Protocol name or null
     */
    findProtocolForCapabilities(requiredCapabilities) {
        // Try protocols in priority order
        for (const protocolName of this.protocolPriority) {
            const protocol = this.getProtocol(protocolName);
            const capabilities = protocol.getCapabilities();

            const hasAll = requiredCapabilities.every(cap =>
                capabilities[cap] === true
            );

            if (hasAll) {
                return protocolName;
            }
        }

        // Try all registered protocols
        for (const [name, protocolData] of this.protocols) {
            if (this.protocolPriority.includes(name)) {
                continue; // Already checked
            }

            const protocol = this.getProtocol(name);
            const capabilities = protocol.getCapabilities();

            const hasAll = requiredCapabilities.every(cap =>
                capabilities[cap] === true
            );

            if (hasAll) {
                return name;
            }
        }

        return null;
    }

    /**
     * Connect to device using specified or auto-selected protocol
     * @param {string} deviceId - Device identifier
     * @param {string} protocolName - Protocol name (optional, auto-select if not provided)
     * @returns {Promise<Object>} Connection result
     */
    async connect(deviceId, protocolName = null) {
        // If protocol specified, use it
        if (protocolName) {
            return await this._connectWithProtocol(deviceId, protocolName);
        }

        // Auto-select protocol based on priority
        for (const name of this.protocolPriority) {
            try {
                const result = await this._connectWithProtocol(deviceId, name);
                return result;
            } catch (error) {
                console.warn(`[ProtocolManager] Failed to connect with ${name}:`, error.message);
                // Try next protocol
            }
        }

        throw new Error(`Failed to connect to device ${deviceId} with any protocol`);
    }

    /**
     * Connect using specific protocol
     * @private
     */
    async _connectWithProtocol(deviceId, protocolName) {
        const protocol = this.getProtocol(protocolName);

        console.log(`[ProtocolManager] Connecting to ${deviceId} via ${protocolName}...`);

        const deviceInfo = await protocol.connect(deviceId);

        // Disconnect previous protocol if any
        if (this.activeProtocol && this.activeProtocol !== protocol) {
            await this.activeProtocol.disconnect();
        }

        this.activeProtocol = protocol;
        this.activeDeviceId = deviceId;

        this.emit('connected', {
            deviceId,
            protocolName,
            deviceInfo
        });

        console.log(`[ProtocolManager] Connected to ${deviceId} via ${protocolName}`);

        return {
            success: true,
            protocol: protocolName,
            deviceInfo
        };
    }

    /**
     * Disconnect from current device
     */
    async disconnect() {
        if (!this.activeProtocol) {
            return;
        }

        const protocolName = this.activeProtocol.getName();
        const deviceId = this.activeDeviceId;

        await this.activeProtocol.disconnect();

        this.activeProtocol = null;
        this.activeDeviceId = null;

        this.emit('disconnected', {
            deviceId,
            protocolName
        });

        console.log(`[ProtocolManager] Disconnected from ${deviceId}`);
    }

    /**
     * Get active protocol
     * @returns {BaseProtocol|null}
     */
    getActiveProtocol() {
        return this.activeProtocol;
    }

    /**
     * Get active device ID
     * @returns {string|null}
     */
    getActiveDeviceId() {
        return this.activeDeviceId;
    }

    /**
     * Check if connected
     * @returns {boolean}
     */
    isConnected() {
        return this.activeProtocol && this.activeProtocol.isConnected();
    }

    /**
     * Execute operation with active protocol
     * @param {Function} operation - Operation function (receives protocol as arg)
     * @returns {Promise<any>} Operation result
     */
    async execute(operation) {
        if (!this.activeProtocol) {
            throw new Error('No active protocol connection');
        }

        return await operation(this.activeProtocol);
    }

    /**
     * Execute operation with capability check
     * @param {string} capability - Required capability
     * @param {Function} operation - Operation function
     * @returns {Promise<any>} Operation result
     */
    async executeWithCapability(capability, operation) {
        if (!this.activeProtocol) {
            throw new Error('No active protocol connection');
        }

        if (!this.activeProtocol.hasCapability(capability)) {
            throw new Error(
                `Active protocol ${this.activeProtocol.getName()} does not support ${capability}`
            );
        }

        return await operation(this.activeProtocol);
    }

    // ===== Convenience Methods (delegate to active protocol) =====

    async tap(x, y) {
        return await this.executeWithCapability('canTap',
            protocol => protocol.tap(x, y)
        );
    }

    async longPress(x, y, duration) {
        return await this.executeWithCapability('canLongPress',
            protocol => protocol.longPress(x, y, duration)
        );
    }

    async swipe(x1, y1, x2, y2, duration) {
        return await this.executeWithCapability('canSwipe',
            protocol => protocol.swipe(x1, y1, x2, y2, duration)
        );
    }

    async drag(x1, y1, x2, y2, duration) {
        return await this.executeWithCapability('canDrag',
            protocol => protocol.drag(x1, y1, x2, y2, duration)
        );
    }

    async scroll(direction, amount) {
        return await this.executeWithCapability('canScroll',
            protocol => protocol.scroll(direction, amount)
        );
    }

    async inputText(text) {
        return await this.executeWithCapability('canInputText',
            protocol => protocol.inputText(text)
        );
    }

    async pressKey(keyCode) {
        return await this.executeWithCapability('canPressKey',
            protocol => protocol.pressKey(keyCode)
        );
    }

    async captureScreen(options) {
        return await this.executeWithCapability('canCaptureScreen',
            protocol => protocol.captureScreen(options)
        );
    }

    async getScreenResolution() {
        return await this.execute(
            protocol => protocol.getScreenResolution()
        );
    }

    async getDeviceInfo() {
        return await this.executeWithCapability('canGetDeviceInfo',
            protocol => protocol.getDeviceInfo()
        );
    }

    async installApp(apkPath) {
        return await this.executeWithCapability('canInstallApp',
            protocol => protocol.installApp(apkPath)
        );
    }

    async uninstallApp(packageName) {
        return await this.executeWithCapability('canUninstallApp',
            protocol => protocol.uninstallApp(packageName)
        );
    }

    async launchApp(packageName, activityName) {
        return await this.executeWithCapability('canLaunchApp',
            protocol => protocol.launchApp(packageName, activityName)
        );
    }

    async executeShellCommand(command) {
        return await this.executeWithCapability('canExecuteShellCommand',
            protocol => protocol.executeShellCommand(command)
        );
    }

    /**
     * Get manager status
     */
    getStatus() {
        return {
            connected: this.isConnected(),
            activeProtocol: this.activeProtocol ? this.activeProtocol.getName() : null,
            activeDeviceId: this.activeDeviceId,
            registeredProtocols: Array.from(this.protocols.keys()),
            protocolPriority: this.protocolPriority
        };
    }

    /**
     * Cleanup all protocols
     */
    async cleanup() {
        // Disconnect active protocol
        if (this.activeProtocol) {
            await this.disconnect();
        }

        // Cleanup all protocol instances
        for (const [name, protocolData] of this.protocols) {
            if (protocolData.instance) {
                await protocolData.instance.cleanup();
                protocolData.instance = null;
            }
        }

        console.log('[ProtocolManager] Cleanup completed');
    }
}

module.exports = ProtocolManager;
