/**
 * DeviceStore Unit Tests
 */

const DeviceStore = require('../../src/renderer/stores/DeviceStore');

describe('DeviceStore', () => {
  let store;

  beforeEach(() => {
    store = new DeviceStore();
  });

  describe('Initialization', () => {
    test('should initialize with default state', () => {
      const state = store.getState();
      expect(state).toEqual({
        selectedDevice: null,
        connectionType: 'adb',
        connectionStatus: 'disconnected',
        availableDevices: [],
        isScanning: false,
        ccncHost: 'localhost',
        ccncPort: 20000,
        ccncFps: 30,
        lastError: null
      });
    });

    test('should have empty listener set', () => {
      const debugInfo = store.getDebugInfo();
      expect(debugInfo.listenerCount).toBe(0);
    });
  });

  describe('State Management', () => {
    test('should get specific state property', () => {
      expect(store.get('connectionType')).toBe('adb');
      expect(store.get('connectionStatus')).toBe('disconnected');
    });

    test('should update state immutably', () => {
      const oldState = store.getState();
      store.setState({ connectionStatus: 'connecting' });
      const newState = store.getState();

      expect(newState).not.toBe(oldState);
      expect(newState.connectionStatus).toBe('connecting');
      expect(oldState.connectionStatus).toBe('disconnected');
    });

    test('should notify listeners on state change', () => {
      const listener = jest.fn();
      store.subscribe(listener);

      store.setState({ connectionStatus: 'connected' });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'state-change',
          changes: { connectionStatus: 'connected' }
        })
      );
    });
  });

  describe('Subscription', () => {
    test('should add listener', () => {
      const listener = jest.fn();
      store.subscribe(listener);

      expect(store.getDebugInfo().listenerCount).toBe(1);
    });

    test('should return unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe = store.subscribe(listener);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
      expect(store.getDebugInfo().listenerCount).toBe(0);
    });

    test('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = jest.fn();

      console.error = jest.fn();

      store.subscribe(errorListener);
      store.subscribe(normalListener);

      store.setState({ isScanning: true });

      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Connection Type', () => {
    test('should set connection type to adb', () => {
      store.setConnectionType('adb');
      expect(store.get('connectionType')).toBe('adb');
    });

    test('should set connection type to ccnc', () => {
      store.setConnectionType('ccnc');
      expect(store.get('connectionType')).toBe('ccnc');
    });

    test('should reject invalid connection type', () => {
      console.error = jest.fn();
      store.setConnectionType('invalid');

      expect(store.get('connectionType')).toBe('adb');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Connection Status', () => {
    test('should set connection status', () => {
      store.setConnectionStatus('connecting');
      expect(store.get('connectionStatus')).toBe('connecting');
    });

    test('should set connection status with error', () => {
      const error = 'Connection timeout';
      store.setConnectionStatus('failed', error);

      expect(store.get('connectionStatus')).toBe('failed');
      expect(store.get('lastError')).toBe(error);
    });
  });

  describe('Device Management', () => {
    test('should set selected device', () => {
      const device = { id: 'device-1', name: 'Test Device' };
      store.setSelectedDevice(device);

      expect(store.get('selectedDevice')).toEqual(device);
    });

    test('should set available devices list', () => {
      const devices = [
        { id: 'device-1', name: 'Device 1' },
        { id: 'device-2', name: 'Device 2' }
      ];
      store.setAvailableDevices(devices);

      expect(store.get('availableDevices')).toEqual(devices);
    });

    test('should clear device connection', () => {
      store.setSelectedDevice({ id: 'device-1' });
      store.setConnectionStatus('connected');
      store.clearDevice();

      expect(store.get('selectedDevice')).toBeNull();
      expect(store.get('connectionStatus')).toBe('disconnected');
      expect(store.get('lastError')).toBeNull();
    });
  });

  describe('Scanning State', () => {
    test('should set scanning state', () => {
      store.setScanning(true);
      expect(store.get('isScanning')).toBe(true);

      store.setScanning(false);
      expect(store.get('isScanning')).toBe(false);
    });
  });

  describe('CCNC Parameters', () => {
    test('should set CCNC connection parameters', () => {
      store.setCCNCParams('192.168.1.100', 30000, 60);

      expect(store.get('ccncHost')).toBe('192.168.1.100');
      expect(store.get('ccncPort')).toBe(30000);
      expect(store.get('ccncFps')).toBe(60);
    });
  });

  describe('Error Handling', () => {
    test('should set error and update status to failed', () => {
      const error = 'Device not found';
      store.setError(error);

      expect(store.get('lastError')).toBe(error);
      expect(store.get('connectionStatus')).toBe('failed');
    });
  });

  describe('Reset', () => {
    test('should reset to initial state', () => {
      store.setSelectedDevice({ id: 'device-1' });
      store.setConnectionType('ccnc');
      store.setConnectionStatus('connected');
      store.setCCNCParams('10.0.0.1', 25000, 45);

      store.reset();

      const state = store.getState();
      expect(state).toEqual({
        selectedDevice: null,
        connectionType: 'adb',
        connectionStatus: 'disconnected',
        availableDevices: [],
        isScanning: false,
        ccncHost: 'localhost',
        ccncPort: 20000,
        ccncFps: 30,
        lastError: null
      });
    });

    test('should notify listeners on reset', () => {
      const listener = jest.fn();
      store.subscribe(listener);

      store.reset();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'reset'
        })
      );
    });
  });

  describe('Debug Info', () => {
    test('should return debug information', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      store.subscribe(listener1);
      store.subscribe(listener2);

      const debugInfo = store.getDebugInfo();

      expect(debugInfo).toHaveProperty('state');
      expect(debugInfo).toHaveProperty('listenerCount');
      expect(debugInfo.listenerCount).toBe(2);
    });
  });
});
