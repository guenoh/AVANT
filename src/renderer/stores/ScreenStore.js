/**
 * Screen Store - Manages screen capture and streaming state
 */

class ScreenStore {
  constructor() {
    this._state = {
      // Streaming state
      isStreaming: false,
      streamFps: 30,
      lastFrame: null,

      // Recording state
      isRecording: false,
      recordingStartTime: null,
      recordingDuration: 0,

      // Canvas state
      canvasWidth: 0,
      canvasHeight: 0,

      // Stream statistics
      streamStats: {
        fps: 0,
        latency: 0,
        frameCount: 0,
        lastFrameTime: null
      }
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
   * Set streaming state
   */
  setStreaming(isStreaming) {
    this.setState({ isStreaming });
  }

  /**
   * Set stream FPS
   */
  setStreamFps(fps) {
    this.setState({ streamFps: fps });
  }

  /**
   * Update last frame
   */
  setLastFrame(frame) {
    this.setState({ lastFrame: frame });
  }

  /**
   * Set recording state
   */
  setRecording(isRecording) {
    const updates = { isRecording };

    if (isRecording) {
      updates.recordingStartTime = Date.now();
      updates.recordingDuration = 0;
    } else {
      updates.recordingStartTime = null;
    }

    this.setState(updates);
  }

  /**
   * Update recording duration
   */
  updateRecordingDuration() {
    if (this._state.isRecording && this._state.recordingStartTime) {
      const duration = Math.floor((Date.now() - this._state.recordingStartTime) / 1000);
      this.setState({ recordingDuration: duration });
    }
  }

  /**
   * Set canvas dimensions
   */
  setCanvasDimensions(width, height) {
    this.setState({
      canvasWidth: width,
      canvasHeight: height
    });
  }

  /**
   * Update stream statistics
   */
  updateStreamStats(stats) {
    this.setState({
      streamStats: {
        ...this._state.streamStats,
        ...stats
      }
    });
  }

  /**
   * Increment frame count
   */
  incrementFrameCount() {
    this.setState({
      streamStats: {
        ...this._state.streamStats,
        frameCount: this._state.streamStats.frameCount + 1,
        lastFrameTime: Date.now()
      }
    });
  }

  /**
   * Reset stream statistics
   */
  resetStreamStats() {
    this.setState({
      streamStats: {
        fps: 0,
        latency: 0,
        frameCount: 0,
        lastFrameTime: null
      }
    });
  }

  /**
   * Reset store to initial state
   */
  reset() {
    this._state = {
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

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScreenStore;
}

// Create and expose singleton instance globally in browser
if (typeof window !== 'undefined') {
  window.ScreenStore = new ScreenStore();
}
