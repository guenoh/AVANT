/**
 * IsapProtocol
 * iOS Screen Automation Protocol adapter
 * Example implementation showing how easily new protocols can be added
 */

const BaseProtocol = require('./BaseProtocol');

class IsapProtocol extends BaseProtocol {
    constructor(config = {}) {
        super(config);

        this.serverUrl = config.serverUrl || 'http://localhost:8100';
        this.deviceId = null;
        this.sessionId = null;

        // Set ISAP capabilities
        this.capabilities = {
            // Device management
            canListDevices: true,
            canGetDeviceInfo: true,
            canInstallApp: true,
            canUninstallApp: true,
            canLaunchApp: true,
            canManageWireless: false,

            // Input actions
            canTap: true,
            canLongPress: true,
            canSwipe: true,
            canDrag: true,
            canMultiTouch: true,
            canFastTouch: true,
            canScroll: true,
            canInputText: true,
            canPressKey: true,

            // Screen capture
            canCaptureScreen: true,
            supportedImageFormats: ['png', 'jpeg'],
            canCaptureRegion: true,
            canStreamScreen: true,
            supportsMultiMonitor: false,

            // Advanced features
            canExecuteShellCommand: false,
            canGetSystemProperties: true,
            canManageFiles: false
        };
    }

    getName() {
        return 'isap';
    }

    /**
     * Make HTTP request to ISAP server
     * @private
     */
    async _request(method, endpoint, data = null) {
        const https = require('https');
        const http = require('http');

        return new Promise((resolve, reject) => {
            const url = new URL(`${this.serverUrl}${endpoint}`);
            const protocol = url.protocol === 'https:' ? https : http;

            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            if (this.sessionId) {
                options.headers['X-Session-Id'] = this.sessionId;
            }

            const req = protocol.request(options, (res) => {
                let body = '';

                res.on('data', (chunk) => {
                    body += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(body);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(response);
                        } else {
                            reject(new Error(response.error || `HTTP ${res.statusCode}`));
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    // ===== Device Management =====

    async listDevices() {
        const response = await this._request('GET', '/api/devices');
        return response.devices.map(device => ({
            id: device.udid,
            name: device.name,
            model: device.modelName,
            osVersion: device.osVersion,
            state: device.state
        }));
    }

    async connect(deviceId) {
        this.deviceId = deviceId;

        // Create session
        const response = await this._request('POST', '/api/session', {
            deviceId: deviceId
        });

        this.sessionId = response.sessionId;
        this.connected = true;

        // Get device info
        this.deviceInfo = await this.getDeviceInfo();

        return this.deviceInfo;
    }

    async disconnect() {
        if (this.sessionId) {
            try {
                await this._request('DELETE', `/api/session/${this.sessionId}`);
            } catch (error) {
                console.warn('Failed to close ISAP session:', error.message);
            }
        }

        this.connected = false;
        this.deviceId = null;
        this.sessionId = null;
        this.deviceInfo = null;
    }

    async getDeviceInfo() {
        const response = await this._request('GET', `/api/device/${this.deviceId}/info`);
        return {
            model: response.modelName,
            brand: 'Apple',
            osVersion: response.osVersion,
            name: response.name,
            protocol: 'isap'
        };
    }

    async getScreenResolution() {
        const response = await this._request('GET', `/api/device/${this.deviceId}/screen`);
        return {
            width: response.width,
            height: response.height
        };
    }

    // ===== Input Actions =====

    async tap(x, y) {
        await this._request('POST', `/api/session/${this.sessionId}/tap`, {
            x, y
        });
    }

    async longPress(x, y, duration = 1000) {
        await this._request('POST', `/api/session/${this.sessionId}/longpress`, {
            x, y, duration
        });
    }

    async swipe(x1, y1, x2, y2, duration = 300) {
        await this._request('POST', `/api/session/${this.sessionId}/swipe`, {
            startX: x1,
            startY: y1,
            endX: x2,
            endY: y2,
            duration
        });
    }

    async drag(x1, y1, x2, y2, duration = 300) {
        await this._request('POST', `/api/session/${this.sessionId}/drag`, {
            startX: x1,
            startY: y1,
            endX: x2,
            endY: y2,
            duration
        });
    }

    async scroll(direction, amount = 0.5) {
        await this._request('POST', `/api/session/${this.sessionId}/scroll`, {
            direction,
            amount
        });
    }

    async inputText(text) {
        await this._request('POST', `/api/session/${this.sessionId}/input`, {
            text
        });
    }

    async pressKey(keyCode) {
        const keyMap = {
            'HOME': 'home',
            'BACK': 'back',
            'POWER': 'power',
            'VOLUME_UP': 'volumeUp',
            'VOLUME_DOWN': 'volumeDown'
        };

        const key = keyMap[keyCode] || keyCode;

        await this._request('POST', `/api/session/${this.sessionId}/pressKey`, {
            key
        });
    }

    // ===== Screen Capture =====

    async captureScreen(options = {}) {
        const format = options.format || 'png';
        const quality = options.quality || 80;

        const response = await this._request('POST', `/api/session/${this.sessionId}/screenshot`, {
            format,
            quality,
            region: options.region || null
        });

        // Response contains base64 image data
        if (options.returnBuffer) {
            return Buffer.from(response.imageData, 'base64');
        }

        return response.imageData;
    }

    async startScreenStream(callback, options = {}) {
        // ISAP supports WebSocket streaming
        const WebSocket = require('ws');

        const ws = new WebSocket(`${this.serverUrl.replace('http', 'ws')}/api/session/${this.sessionId}/stream`);

        ws.on('message', (data) => {
            // Data is JPEG frame
            callback(data);
        });

        ws.on('error', (error) => {
            console.error('ISAP stream error:', error);
        });

        // Return stop function
        return () => {
            ws.close();
        };
    }

    async stopScreenStream() {
        // Handled by closing WebSocket in startScreenStream
    }

    // ===== App Management =====

    async installApp(ipaPath) {
        const fs = require('fs').promises;
        const fileData = await fs.readFile(ipaPath);
        const base64Data = fileData.toString('base64');

        await this._request('POST', `/api/device/${this.deviceId}/install`, {
            appData: base64Data
        });
    }

    async uninstallApp(bundleId) {
        await this._request('DELETE', `/api/device/${this.deviceId}/app/${bundleId}`);
    }

    async launchApp(bundleId, activityName = null) {
        await this._request('POST', `/api/device/${this.deviceId}/launch`, {
            bundleId
        });
    }

    // ===== Advanced Features =====

    async getSystemProperty(key) {
        const response = await this._request('GET', `/api/device/${this.deviceId}/property/${key}`);
        return response.value;
    }

    /**
     * Multi-touch operation
     * ISAP-specific advanced feature
     */
    async multiTouch(touches) {
        this._requireCapability('canMultiTouch', 'multiTouch');

        await this._request('POST', `/api/session/${this.sessionId}/multitouch`, {
            touches
        });
    }

    /**
     * Fast touch (fire-and-forget)
     * ISAP-specific performance feature
     */
    async fastTouch(x, y) {
        this._requireCapability('canFastTouch', 'fastTouch');

        await this._request('POST', `/api/session/${this.sessionId}/fasttouch`, {
            x, y
        });
    }
}

module.exports = IsapProtocol;
