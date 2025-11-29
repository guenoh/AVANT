/**
 * Device Store - Manages device connection state
 * ES6 Module version
 */

export class DeviceStore {
    constructor() {
        this._state = {
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
        };

        this._listeners = new Set();
    }

    /**
     * Get current state (immutable)
     */
    getState() {
        return { ...this._state };
    }

    /**
     * Get specific state property
     */
    get(key) {
        return this._state[key];
    }

    /**
     * Update state and notify listeners
     */
    setState(updates) {
        const oldState = { ...this._state };
        this._state = { ...this._state, ...updates };

        this._notify({
            type: 'state-change',
            oldState,
            newState: this._state,
            changes: updates
        });
    }

    /**
     * Subscribe to state changes
     * @returns {Function} Unsubscribe function
     */
    subscribe(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    /**
     * Notify all listeners
     */
    _notify(event) {
        this._listeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('Error in store listener:', error);
            }
        });
    }

    /**
     * Set connection type (adb or ccnc)
     */
    setConnectionType(type) {
        if (type !== 'adb' && type !== 'ccnc') {
            console.error('Invalid connection type:', type);
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

    /**
     * Reset store to initial state
     */
    reset() {
        this._state = {
            selectedDevice: null,
            connectionType: 'adb',
            connectionStatus: 'disconnected',
            availableDevices: [],
            isScanning: false,
            ccncHost: 'localhost',
            ccncPort: 20000,
            ccncFps: 30,
            lastError: null
        };

        this._notify({
            type: 'reset',
            newState: this._state
        });
    }

    /**
     * Get debug state info
     */
    getDebugInfo() {
        return {
            state: this._state,
            listenerCount: this._listeners.size
        };
    }
}

// Singleton instance
export const deviceStore = new DeviceStore();

export default DeviceStore;
