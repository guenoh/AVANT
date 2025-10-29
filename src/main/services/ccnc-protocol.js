/**
 * ccNC Protocol Utilities
 *
 * Provides CRC-16 calculation, packet building, and packet parsing
 * for the custom ccNC binary protocol.
 *
 * See CCNC_PROTOCOL.md for complete specification.
 */

const PACKET_START = Buffer.from([0x61, 0x61]);
const PACKET_END = Buffer.from([0x6F, 0x6F]);

// Command codes
const CMD = {
  NOTI_CONNECTED: 0x5E,
  GETVERSION: 0xA0,
  LCDTOUCHEXT: 0xB0,
  LCDTOUCH_DRAG: 0xD6,
  LCDTOUCH_FAST: 0xD7,
  GETIMG: 0x6A,
};

// Touch actions
const TOUCH_ACTION = {
  PRESS: 0x42,
  RELEASE: 0x41,
  MOVE: 0x45,
};

// Image formats
const IMG_FORMAT = {
  PNG: 0x42,
  BITMAP: 0x43,
  JPEG: 0x44,
};

// Response codes
const RESP = {
  REQUEST: 0x00,        // Wait for response
  NO_RESPONSE: 0xFE,    // Fire-and-forget
  SUCCESS: 0x21,        // Command succeeded
  FAILURE: 0x20,        // Command failed
};

// Monitor IDs
const MONITOR = {
  FRONT: 0x00,
  REAR_LEFT: 0x01,
  REAR_RIGHT: 0x02,
  CLUSTER: 0x03,
  HUD: 0x04,
};

/**
 * Custom CRC-16 algorithm
 * Polynomial: 0xC659, Initial: 0xFFFF
 */
class CRC16 {
  constructor() {
    this.poly = 0xC659;
    this.init = 0xFFFF;
  }

  /**
   * Calculate CRC-16 for data buffer
   * @param {Buffer} data - Data to calculate CRC for
   * @returns {number} CRC-16 value
   */
  calculate(data) {
    let crc = this.init;

    for (const byte of data) {
      let temp = (crc & 0xFF) ^ byte;

      for (let i = 0; i < 8; i++) {
        const lsb = temp & 1;
        temp >>= 1;
        if (lsb) {
          temp ^= this.poly;
        }
        temp &= 0xFFFF;
      }

      crc = temp ^ (crc >> 8);
      crc &= 0xFFFF;
    }

    return crc;
  }
}

/**
 * Build a ccNC protocol packet
 * @param {number} cmd - Command code
 * @param {number} subCmd - Sub-command code
 * @param {number} resp - Response flag (0x00 or 0xFE)
 * @param {Buffer} data - Command data
 * @returns {Buffer} Complete packet
 */
function buildPacket(cmd, subCmd, resp, data = Buffer.alloc(0)) {
  const crc = new CRC16();

  // Build body: CMD + SUB_CMD + RESP + DATA
  const body = Buffer.concat([
    Buffer.from([cmd, subCmd, resp]),
    data
  ]);

  // Calculate CRC of body
  const crcValue = crc.calculate(body);

  // Build packet: START + LENGTH + BODY + CRC + END
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length, 0);

  const crcBuffer = Buffer.alloc(2);
  crcBuffer.writeUInt16BE(crcValue, 0);

  return Buffer.concat([
    PACKET_START,
    length,
    body,
    crcBuffer,
    PACKET_END
  ]);
}

/**
 * Parse a ccNC protocol packet
 * @param {Buffer} packet - Packet to parse
 * @returns {Object|null} Parsed packet or null if invalid
 */
function parsePacket(packet) {
  // Minimum packet size: START(2) + LENGTH(4) + BODY(3) + CRC(2) + END(2) = 13 bytes
  if (packet.length < 13) {
    return null;
  }

  // Verify START marker
  if (!packet.subarray(0, 2).equals(PACKET_START)) {
    return null;
  }

  // Verify END marker
  if (!packet.subarray(-2).equals(PACKET_END)) {
    return null;
  }

  // Extract length
  const length = packet.readUInt32BE(2);
  const bodyStart = 6;
  const bodyEnd = bodyStart + length;

  // Validate body size
  if (bodyEnd + 2 > packet.length - 2) {
    return null;
  }

  // Extract body and CRC
  const body = packet.subarray(bodyStart, bodyEnd);
  const crcReceived = packet.readUInt16BE(bodyEnd);

  // Calculate and verify CRC
  const crc = new CRC16();
  const crcCalculated = crc.calculate(body);
  const crcOk = crcReceived === crcCalculated;

  // Parse body
  const cmd = body[0];
  const subCmd = body.length > 1 ? body[1] : 0;
  const resp = body.length > 2 ? body[2] : 0;
  const data = body.length > 3 ? body.subarray(3) : Buffer.alloc(0);

  return {
    cmd,
    subCmd,
    resp,
    data,
    crcReceived,
    crcCalculated,
    crcOk,
  };
}

/**
 * Build touch command data
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} action - Touch action (PRESS/RELEASE/MOVE)
 * @param {number} monitor - Monitor ID
 * @param {number} fingerNum - Number of fingers
 * @param {number} fingerIdx - Finger index
 * @returns {Buffer} Touch command data (8 bytes)
 */
function buildTouchData(x, y, action, monitor = MONITOR.FRONT, fingerNum = 1, fingerIdx = 0) {
  const data = Buffer.alloc(8);
  data.writeUInt8(fingerNum, 0);
  data.writeUInt8(fingerIdx, 1);
  data.writeUInt16BE(x, 2);
  data.writeUInt16BE(y, 4);
  data.writeUInt8(action, 6);
  data.writeUInt8(monitor, 7);
  return data;
}

/**
 * Build drag command data
 * @param {number} startX - Start X coordinate
 * @param {number} startY - Start Y coordinate
 * @param {number} endX - End X coordinate
 * @param {number} endY - End Y coordinate
 * @param {number} dragTime - Duration in milliseconds
 * @param {number} monitor - Monitor ID
 * @returns {Buffer} Drag command data (13 bytes)
 */
function buildDragData(startX, startY, endX, endY, dragTime, monitor = MONITOR.FRONT) {
  const data = Buffer.alloc(13);
  data.writeUInt16BE(startX, 0);
  data.writeUInt16BE(startY, 2);
  data.writeUInt16BE(endX, 4);
  data.writeUInt16BE(endY, 6);
  data.writeUInt8(monitor, 8);
  data.writeUInt32BE(dragTime, 9);
  return data;
}

/**
 * Build fast touch command data
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} repeat - Repeat count
 * @param {number} delay - Delay between repeats (ms)
 * @param {number} monitor - Monitor ID
 * @returns {Buffer} Fast touch command data (9 bytes)
 */
function buildFastTouchData(x, y, repeat, delay, monitor = MONITOR.FRONT) {
  const data = Buffer.alloc(9);
  data.writeUInt16BE(x, 0);
  data.writeUInt16BE(y, 2);
  data.writeUInt16BE(repeat, 4);
  data.writeUInt16BE(delay, 6);
  data.writeUInt8(monitor, 8);
  return data;
}

/**
 * Build capture command data
 * @param {number} left - Left coordinate
 * @param {number} top - Top coordinate
 * @param {number} right - Right coordinate
 * @param {number} bottom - Bottom coordinate
 * @param {number} monitor - Monitor ID
 * @returns {Buffer} Capture command data (9 bytes)
 */
function buildCaptureData(left, top, right, bottom, monitor = MONITOR.FRONT) {
  const data = Buffer.alloc(9);
  data.writeUInt16BE(left, 0);
  data.writeUInt16BE(top, 2);
  data.writeUInt16BE(right, 4);
  data.writeUInt16BE(bottom, 6);
  data.writeUInt8(monitor, 8);
  return data;
}

module.exports = {
  CMD,
  TOUCH_ACTION,
  IMG_FORMAT,
  RESP,
  MONITOR,
  CRC16,
  buildPacket,
  parsePacket,
  buildTouchData,
  buildDragData,
  buildFastTouchData,
  buildCaptureData,
};
