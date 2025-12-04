/**
 * ccNC Connection Service
 *
 * Manages persistent TCP connection to ccNC (TestAutomation Daemon) server.
 * Provides high-level API for device automation commands.
 *
 * Features:
 * - Persistent TCP connection (no reconnect per command)
 * - Command queuing for sequential execution
 * - Automatic reconnection on connection loss
 * - Response handling with timeout
 * - Fire-and-forget mode for fast commands
 */

const net = require('net');
const EventEmitter = require('events');
const {
  CMD,
  TOUCH_ACTION,
  IMG_FORMAT,
  RESP,
  MONITOR,
  buildPacket,
  parsePacket,
  buildTouchData,
  buildDragData,
  buildFastTouchData,
  buildCaptureData,
} = require('./ccnc-protocol');
const { SCREEN } = require('../../shared/constants');

/**
 * Connection states
 */
const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
};

/**
 * ccNC Connection Service
 * @extends EventEmitter
 * @fires CCNCConnectionService#connected
 * @fires CCNCConnectionService#disconnected
 * @fires CCNCConnectionService#error
 */
class CCNCConnectionService extends EventEmitter {
  constructor() {
    super();

    this.host = 'localhost';
    this.port = 20000;
    this.responseTimeout = 5000; // 5 seconds default timeout

    this.socket = null;
    this.state = ConnectionState.DISCONNECTED;
    this.receiveBuffer = Buffer.alloc(0);

    // Command queue for sequential execution
    this.commandQueue = [];
    this.processingCommand = false;

    // Pending response handlers
    this.pendingResponse = null;
    this.responseTimer = null;
  }

  /**
   * Connect to ccNC server
   * @param {string} host - Server host
   * @param {number} port - Server port
   * @returns {Promise<void>}
   */
  async connect(host = 'localhost', port = 20000) {
    if (this.state === ConnectionState.CONNECTED) {
      throw new Error('Already connected');
    }

    if (this.state === ConnectionState.CONNECTING) {
      throw new Error('Connection in progress');
    }

    this.host = host;
    this.port = port;
    this.state = ConnectionState.CONNECTING;

    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.setTimeout(this.responseTimeout);

      // Connection established
      this.socket.on('connect', () => {
        console.log(`[ccNC] Connected to ${this.host}:${this.port}`);
      });

      // Receive data
      this.socket.on('data', (data) => {
        this._handleData(data);
      });

      // Connection closed
      this.socket.on('close', () => {
        console.log('[ccNC] Connection closed');
        this._handleDisconnect();
      });

      // Socket error
      this.socket.on('error', (error) => {
        console.error('[ccNC] Socket error:', error.message);
        this.state = ConnectionState.ERROR;
        this.emit('error', error);

        if (this.state === ConnectionState.CONNECTING) {
          reject(error);
        }
      });

      // Socket timeout (for response wait)
      this.socket.on('timeout', () => {
        console.warn('[ccNC] Socket timeout');
        // Don't close connection on timeout, just handle response timeout
        if (this.pendingResponse) {
          this._handleResponseTimeout();
        }
      });

      // Handle welcome banner
      const bannerHandler = (data) => {
        const parsed = parsePacket(data);
        if (!parsed) {
          const error = new Error('Invalid welcome banner format');
          this.socket.destroy();
          reject(error);
          return;
        }

        if (!parsed.crcOk) {
          const error = new Error('Welcome banner CRC verification failed');
          this.socket.destroy();
          reject(error);
          return;
        }

        if (parsed.cmd !== CMD.NOTI_CONNECTED) {
          console.warn(`[ccNC] Unexpected banner command: ${parsed.cmd.toString(16)}`);
        }

        console.log('[ccNC] Welcome banner received and verified');
        this.state = ConnectionState.CONNECTED;
        this.emit('connected', { host: this.host, port: this.port });

        // Remove banner handler, switch to normal data handler
        this.socket.removeListener('data', bannerHandler);
        resolve();
      };

      // Wait for welcome banner
      this.socket.once('data', bannerHandler);

      // Connect to server
      this.socket.connect(port, host);
    });
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this._handleDisconnect();
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isConnected() {
    return this.state === ConnectionState.CONNECTED && this.socket && !this.socket.destroyed;
  }

  /**
   * Get current connection state
   * @returns {string}
   */
  getState() {
    return this.state;
  }

  /**
   * Get version information
   * @returns {Promise<string>}
   */
  async getVersion() {
    const packet = buildPacket(CMD.GETVERSION, 0x00, RESP.REQUEST);
    const response = await this._sendAndWait(packet);

    if (response.resp !== RESP.SUCCESS) {
      throw new Error('GetVersion failed');
    }

    return response.data.toString('ascii');
  }

  /**
   * Send touch command (press/release/move)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {string} action - 'press'|'release'|'move'
   * @param {Object} options - Options
   * @param {number} options.monitor - Monitor ID
   * @param {boolean} options.waitResponse - Wait for response
   * @returns {Promise<void>}
   */
  async touch(x, y, action = 'press', options = {}) {
    const { monitor = MONITOR.FRONT, waitResponse = false } = options;

    // Map action string to code
    const actionCode = {
      press: TOUCH_ACTION.PRESS,
      release: TOUCH_ACTION.RELEASE,
      move: TOUCH_ACTION.MOVE,
    }[action];

    if (!actionCode) {
      throw new Error(`Invalid touch action: ${action}`);
    }

    const data = buildTouchData(x, y, actionCode, monitor);
    const respFlag = waitResponse ? RESP.REQUEST : RESP.NO_RESPONSE;
    const packet = buildPacket(CMD.LCDTOUCHEXT, 0x00, respFlag, data);

    if (waitResponse) {
      const response = await this._sendAndWait(packet);
      if (response.resp !== RESP.SUCCESS) {
        throw new Error('Touch command failed');
      }
    } else {
      await this._send(packet);
    }
  }

  /**
   * Simulate tap (press + release)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} options - Options
   * @param {number} options.monitor - Monitor ID
   * @param {number} options.delay - Delay between press and release (ms)
   * @param {boolean} options.waitResponse - Wait for response
   * @returns {Promise<void>}
   */
  async tap(x, y, options = {}) {
    const { monitor = MONITOR.FRONT, delay = 100, waitResponse = false } = options;

    await this.touch(x, y, 'press', { monitor, waitResponse });

    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    await this.touch(x, y, 'release', { monitor, waitResponse });
  }

  /**
   * Send drag/swipe command
   * @param {number} startX - Start X coordinate
   * @param {number} startY - Start Y coordinate
   * @param {number} endX - End X coordinate
   * @param {number} endY - End Y coordinate
   * @param {Object} options - Options
   * @param {number} options.duration - Drag duration (ms)
   * @param {number} options.monitor - Monitor ID
   * @param {boolean} options.waitResponse - Wait for response
   * @returns {Promise<void>}
   */
  async drag(startX, startY, endX, endY, options = {}) {
    const { duration = 1000, monitor = MONITOR.FRONT, waitResponse = false } = options;

    const data = buildDragData(startX, startY, endX, endY, duration, monitor);
    const respFlag = waitResponse ? RESP.REQUEST : RESP.NO_RESPONSE;
    const packet = buildPacket(CMD.LCDTOUCH_DRAG, 0x00, respFlag, data);

    if (waitResponse) {
      const response = await this._sendAndWait(packet);
      if (response.resp !== RESP.SUCCESS) {
        throw new Error('Drag command failed');
      }
    } else {
      await this._send(packet);
    }
  }

  /**
   * Send fast touch command (repeated taps)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} options - Options
   * @param {number} options.repeat - Repeat count
   * @param {number} options.delay - Delay between repeats (ms)
   * @param {number} options.monitor - Monitor ID
   * @param {boolean} options.waitResponse - Wait for response
   * @returns {Promise<void>}
   */
  async fastTouch(x, y, options = {}) {
    const { repeat = 1, delay = 100, monitor = MONITOR.FRONT, waitResponse = false } = options;

    const data = buildFastTouchData(x, y, repeat, delay, monitor);
    const respFlag = waitResponse ? RESP.REQUEST : RESP.NO_RESPONSE;
    const packet = buildPacket(CMD.LCDTOUCH_FAST, 0x00, respFlag, data);

    if (waitResponse) {
      const response = await this._sendAndWait(packet);
      if (response.resp !== RESP.SUCCESS) {
        throw new Error('Fast touch command failed');
      }
    } else {
      await this._send(packet);
    }
  }

  /**
   * Scroll screen in specified direction
   * @param {string} direction - 'up'|'down'|'left'|'right'
   * @param {Object} options - Options
   * @param {number} options.distance - Scroll distance in pixels
   * @param {number} options.duration - Scroll duration in ms
   * @param {number} options.monitor - Monitor ID
   * @param {boolean} options.waitResponse - Wait for response
   * @returns {Promise<void>}
   */
  async scroll(direction, options = {}) {
    const { distance = 400, duration = 300, monitor = MONITOR.FRONT, waitResponse = false } = options;

    // Screen center using ccNC resolution constants
    const centerX = SCREEN.CCNC_WIDTH / 2;
    const centerY = SCREEN.CCNC_HEIGHT / 2;

    let startX, startY, endX, endY;

    switch (direction) {
      case 'up':
        startX = centerX;
        startY = centerY + distance / 2;
        endX = centerX;
        endY = centerY - distance / 2;
        break;
      case 'down':
        startX = centerX;
        startY = centerY - distance / 2;
        endX = centerX;
        endY = centerY + distance / 2;
        break;
      case 'left':
        startX = centerX + distance / 2;
        startY = centerY;
        endX = centerX - distance / 2;
        endY = centerY;
        break;
      case 'right':
        startX = centerX - distance / 2;
        startY = centerY;
        endX = centerX + distance / 2;
        endY = centerY;
        break;
      default:
        throw new Error(`Invalid scroll direction: ${direction}`);
    }

    // Use drag command for scrolling
    await this.drag(startX, startY, endX, endY, { duration, monitor, waitResponse });
  }

  /**
   * Capture screen region
   * @param {number} left - Left coordinate
   * @param {number} top - Top coordinate
   * @param {number} right - Right coordinate
   * @param {number} bottom - Bottom coordinate
   * @param {Object} options - Options
   * @param {string} options.format - 'png'|'jpeg'|'bitmap'
   * @param {number} options.monitor - Monitor ID
   * @returns {Promise<Buffer>} Image data
   */
  async capture(left, top, right, bottom, options = {}) {
    const { format = 'png', monitor = MONITOR.FRONT } = options;

    // Map format string to code
    const formatCode = {
      png: IMG_FORMAT.PNG,
      jpeg: IMG_FORMAT.JPEG,
      bitmap: IMG_FORMAT.BITMAP,
    }[format];

    if (!formatCode) {
      throw new Error(`Invalid image format: ${format}`);
    }

    const data = buildCaptureData(left, top, right, bottom, monitor);
    const packet = buildPacket(CMD.GETIMG, formatCode, RESP.REQUEST, data);

    const response = await this._sendAndWait(packet, 15000); // 15s timeout for image (increased for slow/heated devices)

    if (response.resp !== RESP.SUCCESS) {
      throw new Error('Capture command failed');
    }

    return response.data;
  }

  /**
   * Send packet without waiting for response
   * @private
   */
  _send(packet) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.write(packet, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Send packet and wait for response
   * @private
   */
  _sendAndWait(packet, timeout = this.responseTimeout) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error('Not connected'));
        return;
      }

      // Set up response handler
      this.pendingResponse = { resolve, reject };

      // Set up timeout
      this.responseTimer = setTimeout(() => {
        this._handleResponseTimeout();
      }, timeout);

      // Send packet
      this.socket.write(packet, (error) => {
        if (error) {
          this._clearPendingResponse();
          reject(error);
        }
      });
    });
  }

  /**
   * Handle incoming data
   * @private
   */
  _handleData(data) {
    // Append to receive buffer
    this.receiveBuffer = Buffer.concat([this.receiveBuffer, data]);

    // Try to parse packets from buffer
    while (this.receiveBuffer.length >= 13) { // Minimum packet size
      // Find START marker
      const startIdx = this.receiveBuffer.indexOf(Buffer.from([0x61, 0x61]));
      if (startIdx === -1) {
        // No START marker, clear buffer
        this.receiveBuffer = Buffer.alloc(0);
        break;
      }

      if (startIdx > 0) {
        // Discard data before START marker
        this.receiveBuffer = this.receiveBuffer.subarray(startIdx);
      }

      // Check if we have enough data for length field
      if (this.receiveBuffer.length < 6) {
        break;
      }

      // Read packet length
      const length = this.receiveBuffer.readUInt32BE(2);
      const packetSize = 6 + length + 2 + 2; // START + LENGTH + BODY + CRC + END

      // Check if we have complete packet
      if (this.receiveBuffer.length < packetSize) {
        break;
      }

      // Extract packet
      const packet = this.receiveBuffer.subarray(0, packetSize);
      this.receiveBuffer = this.receiveBuffer.subarray(packetSize);

      // Parse packet
      const parsed = parsePacket(packet);
      if (parsed) {
        this._handleResponse(parsed);
      } else {
        console.error('[ccNC] Failed to parse packet');
      }
    }
  }

  /**
   * Handle parsed response
   * @private
   */
  _handleResponse(parsed) {
    if (!parsed.crcOk) {
      console.error('[ccNC] CRC mismatch in response');
      if (this.pendingResponse) {
        const { reject } = this.pendingResponse;
        this._clearPendingResponse();
        reject(new Error('CRC mismatch in response'));
      }
      return;
    }

    // Resolve pending response
    if (this.pendingResponse) {
      const { resolve } = this.pendingResponse;
      this._clearPendingResponse();
      resolve(parsed);
    }
  }

  /**
   * Handle response timeout
   * @private
   */
  _handleResponseTimeout() {
    if (this.pendingResponse) {
      const { reject } = this.pendingResponse;
      this._clearPendingResponse();
      reject(new Error('Response timeout'));
    }
  }

  /**
   * Clear pending response and timer
   * @private
   */
  _clearPendingResponse() {
    if (this.responseTimer) {
      clearTimeout(this.responseTimer);
      this.responseTimer = null;
    }
    this.pendingResponse = null;
  }

  /**
   * Handle disconnection
   * @private
   */
  _handleDisconnect() {
    this.state = ConnectionState.DISCONNECTED;
    this.receiveBuffer = Buffer.alloc(0);

    // Clear pending response
    if (this.pendingResponse) {
      this._clearPendingResponse();
      this.pendingResponse.reject(new Error('Connection closed'));
    }

    this.emit('disconnected');
  }
}

module.exports = {
  CCNCConnectionService,
  ConnectionState,
  MONITOR,
};
