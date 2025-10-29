# ccNC Protocol Specification

## Overview
ccNC (TestAutomation Daemon) uses a custom binary protocol over TCP for device automation.
This document provides the complete specification extracted from automation_client.py.

## Connection

### Server
- Default host: `localhost`
- Default port: `20000`
- Protocol: TCP
- Socket timeout: Configurable (default 5 seconds for responses)

### Connection Flow
1. Connect to server via TCP socket
2. Receive welcome banner packet (CMD_NOTI_CONNECTED 0x5E)
3. Verify CRC of banner packet
4. Connection ready for commands

## Packet Structure

All packets use the following binary structure:

```
+--------+--------+------+-----+
| START  | LENGTH | BODY | CRC | END |
+--------+--------+------+-----+
| 2 bytes| 4 bytes| N    | 2   | 2   |
| 61 61  | BE Int | ...  | BE  | 6F 6F |
+--------+--------+------+-----+
```

### Fields

- **START**: Fixed 2 bytes `0x61 0x61`
- **LENGTH**: 4 bytes big-endian integer, length of BODY
- **BODY**: Variable length, structure:
  ```
  CMD (1 byte) + SUB_CMD (1 byte) + RESP (1 byte) + DATA (variable)
  ```
- **CRC**: 2 bytes big-endian, CRC-16 of BODY
- **END**: Fixed 2 bytes `0x6F 0x6F`

### BODY Structure
- **CMD**: Command code (1 byte)
- **SUB_CMD**: Sub-command code (1 byte, 0x00 if not used)
- **RESP**: Response flag (1 byte)
  - `0x00`: Request response (wait for reply)
  - `0xFE`: Fire-and-forget (no response expected)
- **DATA**: Command-specific data (variable length)

## CRC-16 Algorithm

Custom CRC-16 algorithm (NOT standard CRC-16-CCITT or CRC-16-IBM):

```javascript
Polynomial: 0xC659
Initial value: 0xFFFF
Process for each byte:
  1. temp = (crc & 0xFF) ^ byte
  2. For each of 8 bits:
     - lsb = temp & 1
     - temp >>= 1
     - if lsb: temp ^= polynomial
  3. crc = temp ^ (crc >> 8)
Result: crc & 0xFFFF
```

**Critical**: This is a custom polynomial. Standard CRC libraries will NOT work.

## Command Codes

### Core Commands

| Command | Code | Description |
|---------|------|-------------|
| CMD_NOTI_CONNECTED | 0x5E | Welcome banner notification |
| CMD_GETVERSION | 0xA0 | Get version information |
| CMD_GETUILAYERINFO | 0xA7 | Get UI layer information |
| CMD_LCDTOUCHEXT | 0xB0 | Extended touch (press/release/move) |
| CMD_LCDTOUCH_DRAG | 0xD6 | Drag/swipe operation |
| CMD_LCDTOUCH_FAST | 0xD7 | Fast repeated touches |
| CMD_GETUICINFO | 0xE5 | Get UIC information |
| CMD_GETIMG | 0x6A | Screen capture |
| CMD_APP_LAUNCH | 0xF4 | Launch application |
| CMD_GET_DCUDATA | 0xF9 | Get DCU data |

## Commands for Vision Auto

### 1. Touch (CMD_LCDTOUCHEXT 0xB0)

**Purpose**: Fine-grained touch control with press/release/move actions

**Data Structure** (8 bytes):
```
Offset | Size | Type  | Field       | Description
-------|------|-------|-------------|------------------
0      | 1    | uint8 | finger_num  | Number of fingers (1=single)
1      | 1    | uint8 | finger_idx  | Finger index (0=first)
2-3    | 2    | BE16  | x           | X coordinate
4-5    | 2    | BE16  | y           | Y coordinate
6      | 1    | uint8 | action      | Touch action (see below)
7      | 1    | uint8 | monitor     | Monitor ID (see below)
```

**Touch Actions**:
- `0x42`: TOUCH_PRESS (finger down)
- `0x41`: TOUCH_RELEASE (finger up)
- `0x45`: TOUCH_MOVE (finger move)

**Example**: Simple tap at (500, 300)
```javascript
// PRESS
data = [0x01, 0x00, 0x01, 0xF4, 0x01, 0x2C, 0x42, 0x00]
// RELEASE after delay
data = [0x01, 0x00, 0x01, 0xF4, 0x01, 0x2C, 0x41, 0x00]
```

### 2. Fast Touch (CMD_LCDTOUCH_FAST 0xD7)

**Purpose**: Repeated touches (auto press+release)

**Data Structure** (9 bytes):
```
Offset | Size | Type  | Field       | Description
-------|------|-------|-------------|------------------
0-1    | 2    | BE16  | x           | X coordinate
2-3    | 2    | BE16  | y           | Y coordinate
4-5    | 2    | BE16  | repeat      | Repeat count
6-7    | 2    | BE16  | delay       | Delay between repeats (ms)
8      | 1    | uint8 | monitor     | Monitor ID
```

**Example**: 5 rapid taps at (500, 300) with 100ms delay
```javascript
data = [0x01, 0xF4, 0x01, 0x2C, 0x00, 0x05, 0x00, 0x64, 0x00]
//      x=500         y=300         repeat=5      delay=100ms  monitor=0
```

### 3. Drag (CMD_LCDTOUCH_DRAG 0xD6)

**Purpose**: Drag/swipe operation

**Data Structure** (13 bytes):
```
Offset | Size | Type  | Field       | Description
-------|------|-------|-------------|------------------
0-1    | 2    | BE16  | start_x     | Start X coordinate
2-3    | 2    | BE16  | start_y     | Start Y coordinate
4-5    | 2    | BE16  | end_x       | End X coordinate
6-7    | 2    | BE16  | end_y       | End Y coordinate
8      | 1    | uint8 | monitor     | Monitor ID
9-12   | 4    | BE32  | drag_time   | Duration in milliseconds
```

**Example**: Swipe from (100, 100) to (500, 500) in 1 second
```javascript
data = [0x00, 0x64, 0x00, 0x64, 0x01, 0xF4, 0x01, 0xF4, 0x00, 0x00, 0x00, 0x03, 0xE8]
//      start_x=100   start_y=100   end_x=500     end_y=500    mon   drag_time=1000ms
```

### 4. Screen Capture (CMD_GETIMG 0x6A)

**Purpose**: Capture screen region

**Sub-Commands** (image format):
- `0x42`: IMG_FORMAT_PNG
- `0x43`: IMG_FORMAT_BITMAP
- `0x44`: IMG_FORMAT_JPEG

**Data Structure** (9 bytes):
```
Offset | Size | Type  | Field       | Description
-------|------|-------|-------------|------------------
0-1    | 2    | BE16  | left        | Left coordinate
2-3    | 2    | BE16  | top         | Top coordinate
4-5    | 2    | BE16  | right       | Right coordinate
6-7    | 2    | BE16  | bottom      | Bottom coordinate
8      | 1    | uint8 | monitor     | Monitor ID
```

**Response**: RESP=0x21 (success) with image data in DATA field

**Example**: Capture full screen 1920x1080 as PNG
```javascript
CMD = 0x6A
SUB_CMD = 0x42  // PNG format
RESP = 0x00     // Request response
data = [0x00, 0x00, 0x00, 0x00, 0x07, 0x80, 0x04, 0x38, 0x00]
//      left=0        top=0         right=1920    bottom=1080   monitor=0
```

### 5. Get Version (CMD_GETVERSION 0xA0)

**Purpose**: Get daemon version

**Data**: Empty (no data)

**Response**: RESP=0x21 with version string in DATA

**Example**:
```javascript
CMD = 0xA0
SUB_CMD = 0x00
RESP = 0x00
data = []
```

## Monitor IDs

| ID   | Name | Description |
|------|------|-------------|
| 0x00 | FRONT | Front display / Common |
| 0x01 | REAR_LEFT | Rear left display |
| 0x02 | REAR_RIGHT | Rear right display |
| 0x03 | CLUSTER | Instrument cluster |
| 0x04 | HUD | Head-up display |

## Response Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 0x21 | SUCCESS | Command executed successfully |
| 0x20 | FAILURE | Command failed, check DATA for error code |

## Response Parsing

Response packet structure is identical to request:
```
START + LENGTH + BODY(CMD + SUB_CMD + RESP + DATA) + CRC + END
```

**Success Response**:
- RESP = 0x21
- DATA contains result (if any)

**Error Response**:
- RESP = 0x20
- DATA contains error code or message

**Image Response** (CMD_GETIMG):
- RESP = 0x21
- DATA contains raw image bytes (PNG/JPEG/Bitmap)

## Implementation Notes

### Fire-and-Forget Mode
Commands can use RESP=0xFE to skip waiting for response:
- Faster execution (no network round-trip)
- No confirmation of success/failure
- Useful for rapid touch sequences
- Default mode for simple operations in Python client

### Request-Response Mode
Commands use RESP=0x00 to wait for response:
- Confirmation of command execution
- Access to return data (version, images, etc.)
- Required for capture and query commands
- Slower due to network round-trip

### Socket Timeout
- Default: 5 seconds for response wait
- Configurable based on command type
- Screen capture may need longer timeout

### Persistent Connection Benefits
- Single TCP session for all commands
- No connection overhead per command
- Faster command execution
- Lower resource usage
- Consistent state management

## Error Handling

### CRC Mismatch
If received CRC doesn't match calculated:
- Log the error
- Close connection
- Reconnect and retry

### Timeout
If no response within timeout period:
- Log timeout error
- Consider command failed
- Connection may still be alive (fire-and-forget)

### Connection Lost
If socket errors occur:
- Close current connection
- Attempt reconnection
- Queue pending commands

## Testing Commands

### Simple Touch Test
```bash
python3 automation_client.py localhost 20000 --cmd touch-sim --x 500 --y 300
```

### Drag Test
```bash
python3 automation_client.py localhost 20000 --cmd drag --start-x 100 --start-y 100 --end-x 500 --end-y 500 --drag-time 1000
```

### Capture Test
```bash
python3 automation_client.py localhost 20000 --cmd capture --left 0 --top 0 --right 1920 --bottom 1080 --format png
```

## Vision Auto Integration

### Required Commands
1. **Touch** (tap action): Use touch-sim or touch with press+release
2. **Swipe** (swipe action): Use drag command
3. **Screen Capture** (screen streaming): Use capture command repeatedly
4. **Version** (connection validation): Use getversion command

### NOT Supported
- Text input: No keyboard input command
- Key press: No HOME/BACK/RECENT buttons
- Long press: Must implement with touch press + delay + release
- Multi-touch: Supported via finger_num parameter but not tested

## References

- Source: `/Users/groro/Workspace/iSAP/automation_client.py`
- Protocol discovered via reverse engineering
- CRC algorithm reverse-engineered from binary behavior
