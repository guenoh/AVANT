/**
 * ScreenStore Unit Tests
 */

const ScreenStore = require('../../src/renderer/stores/ScreenStore');

describe('ScreenStore', () => {
  let store;

  beforeEach(() => {
    store = new ScreenStore();
  });

  describe('Initialization', () => {
    test('should initialize with default state', () => {
      const state = store.getState();
      expect(state).toEqual({
        isStreaming: false,
        streamFps: 30,
        lastFrame: null,
        isRecording: false,
        recordingStartTime: null,
        recordingDuration: 0,
        canvasWidth: 0,
        canvasHeight: 0,
        streamStats: {
          fps: 0,
          latency: 0,
          frameCount: 0,
          lastFrameTime: null
        }
      });
    });

    test('should have empty listener set', () => {
      const debugInfo = store.getDebugInfo();
      expect(debugInfo.listenerCount).toBe(0);
    });
  });

  describe('State Management', () => {
    test('should get specific state property', () => {
      expect(store.get('isStreaming')).toBe(false);
      expect(store.get('streamFps')).toBe(30);
    });

    test('should update state immutably', () => {
      const oldState = store.getState();
      store.setState({ isStreaming: true });
      const newState = store.getState();

      expect(newState).not.toBe(oldState);
      expect(newState.isStreaming).toBe(true);
      expect(oldState.isStreaming).toBe(false);
    });

    test('should notify listeners on state change', () => {
      const listener = jest.fn();
      store.subscribe(listener);

      store.setState({ isStreaming: true });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'state-change',
          changes: { isStreaming: true }
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

      store.setState({ isStreaming: true });

      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('Streaming State', () => {
    test('should set streaming state', () => {
      store.setStreaming(true);
      expect(store.get('isStreaming')).toBe(true);

      store.setStreaming(false);
      expect(store.get('isStreaming')).toBe(false);
    });

    test('should set stream FPS', () => {
      store.setStreamFps(60);
      expect(store.get('streamFps')).toBe(60);
    });

    test('should set last frame', () => {
      const frame = { data: 'base64...', timestamp: Date.now() };
      store.setLastFrame(frame);

      expect(store.get('lastFrame')).toEqual(frame);
    });
  });

  describe('Recording State', () => {
    test('should start recording', () => {
      const beforeTime = Date.now();
      store.setRecording(true);

      expect(store.get('isRecording')).toBe(true);
      expect(store.get('recordingStartTime')).toBeGreaterThanOrEqual(beforeTime);
      expect(store.get('recordingDuration')).toBe(0);
    });

    test('should stop recording', () => {
      store.setRecording(true);
      store.setRecording(false);

      expect(store.get('isRecording')).toBe(false);
      expect(store.get('recordingStartTime')).toBeNull();
    });

    test('should update recording duration', () => {
      jest.useFakeTimers();

      store.setRecording(true);
      jest.advanceTimersByTime(5000);
      store.updateRecordingDuration();

      expect(store.get('recordingDuration')).toBe(5);

      jest.useRealTimers();
    });

    test('should not update duration when not recording', () => {
      store.updateRecordingDuration();
      expect(store.get('recordingDuration')).toBe(0);
    });
  });

  describe('Canvas Dimensions', () => {
    test('should set canvas dimensions', () => {
      store.setCanvasDimensions(1920, 1080);

      expect(store.get('canvasWidth')).toBe(1920);
      expect(store.get('canvasHeight')).toBe(1080);
    });
  });

  describe('Stream Statistics', () => {
    test('should update stream stats', () => {
      store.updateStreamStats({ fps: 30, latency: 50 });

      const stats = store.get('streamStats');
      expect(stats.fps).toBe(30);
      expect(stats.latency).toBe(50);
    });

    test('should merge stream stats with existing values', () => {
      store.updateStreamStats({ fps: 30 });
      store.updateStreamStats({ latency: 100 });

      const stats = store.get('streamStats');
      expect(stats.fps).toBe(30);
      expect(stats.latency).toBe(100);
    });

    test('should increment frame count', () => {
      store.incrementFrameCount();
      store.incrementFrameCount();
      store.incrementFrameCount();

      const stats = store.get('streamStats');
      expect(stats.frameCount).toBe(3);
      expect(stats.lastFrameTime).toBeDefined();
    });

    test('should reset stream stats', () => {
      store.updateStreamStats({ fps: 60, latency: 30 });
      store.incrementFrameCount();

      store.resetStreamStats();

      const stats = store.get('streamStats');
      expect(stats).toEqual({
        fps: 0,
        latency: 0,
        frameCount: 0,
        lastFrameTime: null
      });
    });
  });

  describe('Reset', () => {
    test('should reset to initial state', () => {
      store.setStreaming(true);
      store.setRecording(true);
      store.setCanvasDimensions(1920, 1080);
      store.updateStreamStats({ fps: 60, latency: 20 });

      store.reset();

      const state = store.getState();
      expect(state).toEqual({
        isStreaming: false,
        streamFps: 30,
        lastFrame: null,
        isRecording: false,
        recordingStartTime: null,
        recordingDuration: 0,
        canvasWidth: 0,
        canvasHeight: 0,
        streamStats: {
          fps: 0,
          latency: 0,
          frameCount: 0,
          lastFrameTime: null
        }
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
