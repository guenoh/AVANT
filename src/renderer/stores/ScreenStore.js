/**
 * Screen Store - Manages screen capture and streaming state
 * Extends BaseStore for reactive state management
 */

class ScreenStore extends BaseStore {
  constructor() {
    super({
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
    if (this.get('isRecording') && this.get('recordingStartTime')) {
      const duration = Math.floor((Date.now() - this.get('recordingStartTime')) / 1000);
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
        ...this.get('streamStats'),
        ...stats
      }
    });
  }

  /**
   * Increment frame count
   */
  incrementFrameCount() {
    const streamStats = this.get('streamStats');
    this.setState({
      streamStats: {
        ...streamStats,
        frameCount: streamStats.frameCount + 1,
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
}

// Create and expose singleton instance globally
window.ScreenStore = new ScreenStore();
