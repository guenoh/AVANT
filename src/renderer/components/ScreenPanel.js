/**
 * Screen Panel Component - Handles screen capture, streaming, and recording
 */

class ScreenPanel {
  constructor(api, screenStore, canvas) {
    this.api = api;
    this.screenStore = screenStore;
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.unsubscribe = null;
    this.recordingTimer = null;
  }

  /**
   * Initialize component
   */
  init() {
    this._subscribeToStore();
    this._setupIPCListeners();
  }

  /**
   * Subscribe to store changes
   */
  _subscribeToStore() {
    this.unsubscribe = this.screenStore.subscribe((event) => {
      this._handleStateChange(event);
    });
  }

  /**
   * Handle state changes
   */
  _handleStateChange(event) {
    const { changes } = event;

    // Update recording UI
    if ('isRecording' in changes) {
      this._updateRecordingUI(changes.isRecording);
    }

    // Update streaming UI
    if ('isStreaming' in changes) {
      this._updateStreamingUI(changes.isStreaming);
    }

    // Update stream stats display
    if ('streamStats' in changes) {
      this._updateStreamStatsDisplay(changes.streamStats);
    }
  }

  /**
   * Setup IPC listeners for stream data
   */
  _setupIPCListeners() {
    // Listen for stream data from main process
    this.api.screen.onStreamData((data) => {
      this._handleStreamFrame(data);
    });
  }

  /**
   * Handle incoming stream frame
   */
  _handleStreamFrame(data) {
    if (!this.ctx || !this.canvas) return;

    const { dataUrl, width, height, timestamp } = data;

    // Update canvas size if needed
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.screenStore.setCanvasDimensions(width, height);
    }

    // Draw frame
    const img = new Image();
    img.onload = () => {
      this.ctx.drawImage(img, 0, 0, width, height);

      // Update statistics
      this.screenStore.incrementFrameCount();
      this.screenStore.setLastFrame({ dataUrl, width, height, timestamp });

      // Emit frame event
      this._emitEvent('frame-drawn', { width, height, timestamp });
    };
    img.src = dataUrl;
  }

  /**
   * Take screenshot
   */
  async takeScreenshot() {
    try {
      this._emitEvent('screenshot-start');

      const result = await this.api.screen.capture();

      if (result.success) {
        // Display screenshot on canvas
        if (this.ctx && this.canvas && result.screenshot) {
          const img = new Image();
          img.onload = () => {
            this.canvas.width = img.width;
            this.canvas.height = img.height;
            this.ctx.drawImage(img, 0, 0);

            this.screenStore.setCanvasDimensions(img.width, img.height);
            this._emitEvent('screenshot-success', { width: img.width, height: img.height });
          };
          img.src = result.screenshot;
        }

        return { success: true };
      } else {
        throw new Error(result.error || 'Screenshot failed');
      }
    } catch (error) {
      console.error('Screenshot error:', error);
      this._emitEvent('screenshot-error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Toggle streaming
   */
  async toggleStream() {
    const isStreaming = this.screenStore.get('isStreaming');

    if (isStreaming) {
      await this.stopStream();
    } else {
      await this.startStream();
    }
  }

  /**
   * Start streaming
   */
  async startStream(fps = null) {
    try {
      const targetFps = fps || this.screenStore.get('streamFps');

      this._emitEvent('stream-start-request', { fps: targetFps });

      const result = await this.api.screen.startStream(targetFps);

      if (result.success) {
        this.screenStore.setStreaming(true);
        this.screenStore.setStreamFps(targetFps);
        this.screenStore.resetStreamStats();

        this._emitEvent('stream-started', { fps: targetFps });
        return { success: true };
      } else {
        throw new Error(result.error || 'Stream start failed');
      }
    } catch (error) {
      console.error('Stream start error:', error);
      this._emitEvent('stream-error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop streaming
   */
  async stopStream() {
    try {
      this._emitEvent('stream-stop-request');

      const result = await this.api.screen.stopStream();

      this.screenStore.setStreaming(false);
      this.screenStore.resetStreamStats();

      this._emitEvent('stream-stopped');
      return { success: true };
    } catch (error) {
      console.error('Stream stop error:', error);
      this._emitEvent('stream-error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Toggle recording
   */
  async toggleRecord() {
    const isRecording = this.screenStore.get('isRecording');

    if (isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  /**
   * Start recording
   */
  async startRecording(options = {}) {
    try {
      this._emitEvent('recording-start-request');

      const result = await this.api.screen.startRecording(options);

      if (result.success) {
        this.screenStore.setRecording(true);

        // Start timer to update duration
        this._startRecordingTimer();

        this._emitEvent('recording-started');
        return { success: true };
      } else {
        throw new Error(result.error || 'Recording start failed');
      }
    } catch (error) {
      console.error('Recording start error:', error);
      this._emitEvent('recording-error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop recording
   */
  async stopRecording() {
    try {
      this._emitEvent('recording-stop-request');

      const result = await this.api.screen.stopRecording();

      this.screenStore.setRecording(false);

      // Stop timer
      this._stopRecordingTimer();

      if (result.path) {
        this._emitEvent('recording-stopped', { path: result.path, duration: result.duration });
        return { success: true, path: result.path };
      } else {
        throw new Error('Recording file not found');
      }
    } catch (error) {
      console.error('Recording stop error:', error);
      this._emitEvent('recording-error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Start recording duration timer
   */
  _startRecordingTimer() {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
    }

    this.recordingTimer = setInterval(() => {
      this.screenStore.updateRecordingDuration();
    }, 1000);
  }

  /**
   * Stop recording duration timer
   */
  _stopRecordingTimer() {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  }

  /**
   * Update recording UI elements
   */
  _updateRecordingUI(isRecording) {
    const recordBtn = document.getElementById('record-btn');
    if (recordBtn) {
      recordBtn.textContent = isRecording ? '녹화 중지' : '녹화 시작';
      recordBtn.classList.toggle('recording', isRecording);
    }
  }

  /**
   * Update streaming UI elements
   */
  _updateStreamingUI(isStreaming) {
    const streamBtn = document.getElementById('stream-btn');
    if (streamBtn) {
      streamBtn.textContent = isStreaming ? '스트리밍 중지' : '스트리밍 시작';
      streamBtn.classList.toggle('streaming', isStreaming);
    }
  }

  /**
   * Update stream statistics display
   */
  _updateStreamStatsDisplay(stats) {
    // FPS display
    const fpsEl = document.getElementById('stream-fps');
    if (fpsEl && stats.fps !== undefined) {
      fpsEl.textContent = `${Math.round(stats.fps)} FPS`;
    }

    // Latency display
    const latencyEl = document.getElementById('stream-latency');
    if (latencyEl && stats.latency !== undefined) {
      latencyEl.textContent = `${Math.round(stats.latency)}ms`;
    }
  }

  /**
   * Get current frame as data URL
   */
  getCurrentFrame() {
    if (!this.canvas) return null;
    return this.canvas.toDataURL('image/png');
  }

  /**
   * Clear canvas
   */
  clearCanvas() {
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Emit custom event
   */
  _emitEvent(eventName, detail = {}) {
    const event = new CustomEvent(`screen-panel:${eventName}`, { detail });
    document.dispatchEvent(event);
  }

  /**
   * Cleanup component
   */
  cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    this._stopRecordingTimer();

    // Stop streaming if active
    if (this.screenStore.get('isStreaming')) {
      this.stopStream();
    }

    // Stop recording if active
    if (this.screenStore.get('isRecording')) {
      this.stopRecording();
    }
  }
}

// Expose class globally
window.ScreenPanel = ScreenPanel;
