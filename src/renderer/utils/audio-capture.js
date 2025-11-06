/**
 * Audio Capture Utility for Renderer Process
 * Handles actual microphone access and decibel calculation
 */

class AudioCapture {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.stream = null;
        this.dataArray = null;
        this.isCapturing = false;
        this.calibrationOffset = 0;
    }

    /**
     * Initialize audio capture with microphone
     */
    async init() {
        try {
            // Request microphone permission
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 48000
                }
            });

            // Create Web Audio API context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.3;

            // Connect microphone to analyser
            this.microphone = this.audioContext.createMediaStreamSource(this.stream);
            this.microphone.connect(this.analyser);

            // Create data array for frequency data
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);

            this.isCapturing = true;
            console.log('[AudioCapture] Initialized successfully');

            return true;
        } catch (error) {
            console.error('[AudioCapture] Failed to initialize:', error);

            // Handle specific errors
            if (error.name === 'NotAllowedError') {
                throw new Error('Microphone access denied. Please allow microphone access to use sound check.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No microphone found. Please connect a microphone.');
            } else {
                throw error;
            }
        }
    }

    /**
     * Calculate current decibel level
     * @returns {number} Decibel value
     */
    getDecibel() {
        if (!this.isCapturing || !this.analyser) {
            return 0;
        }

        // Get time domain data
        this.analyser.getByteTimeDomainData(this.dataArray);

        // Calculate RMS (Root Mean Square)
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            const normalized = (this.dataArray[i] - 128) / 128;
            sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / this.dataArray.length);

        // Convert to decibels
        // Use a reference value and apply logarithmic scale
        const db = 20 * Math.log10(rms);

        // Normalize to 0-100 range (approximately)
        // -60dB (very quiet) to 0dB (very loud) -> 0 to 100
        const normalized = Math.max(0, Math.min(100, (db + 60) * 1.67));

        return normalized + this.calibrationOffset;
    }

    /**
     * Get frequency spectrum data
     * @returns {Array} Frequency data
     */
    getFrequencyData() {
        if (!this.isCapturing || !this.analyser) {
            return [];
        }

        const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(frequencyData);

        // Convert to percentage values
        return Array.from(frequencyData).map(value => (value / 255) * 100);
    }

    /**
     * Start continuous monitoring
     * @param {Function} callback - Called with decibel value
     * @param {number} interval - Update interval in ms
     */
    startMonitoring(callback, interval = 100) {
        if (!this.isCapturing) {
            console.error('[AudioCapture] Not initialized');
            return null;
        }

        const monitor = setInterval(() => {
            if (!this.isCapturing) {
                clearInterval(monitor);
                return;
            }

            const db = this.getDecibel();
            const frequency = this.getFrequencyData();

            callback({
                decibel: db,
                frequency: frequency,
                timestamp: Date.now()
            });
        }, interval);

        return monitor;
    }

    /**
     * Calibrate for ambient noise
     * @param {number} duration - Calibration duration in ms
     */
    async calibrate(duration = 3000) {
        console.log('[AudioCapture] Starting calibration...');

        const samples = [];
        const startTime = Date.now();

        return new Promise((resolve) => {
            const collectSample = () => {
                if (Date.now() - startTime >= duration) {
                    // Calculate average ambient noise
                    const average = samples.reduce((a, b) => a + b, 0) / samples.length;

                    // Set offset to normalize ambient to ~30dB
                    this.calibrationOffset = 30 - average;

                    console.log(`[AudioCapture] Calibration complete. Ambient: ${average.toFixed(1)}dB, Offset: ${this.calibrationOffset.toFixed(1)}dB`);

                    resolve({
                        ambientNoise: average,
                        offset: this.calibrationOffset,
                        samples: samples.length
                    });
                    return;
                }

                samples.push(this.getDecibel());
                setTimeout(collectSample, 100);
            };

            collectSample();
        });
    }

    /**
     * Stop monitoring
     * @param {number} monitorId - Monitor interval ID
     */
    stopMonitoring(monitorId) {
        if (monitorId) {
            clearInterval(monitorId);
        }
    }

    /**
     * Cleanup and release resources
     */
    cleanup() {
        this.isCapturing = false;

        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }

        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        this.dataArray = null;

        console.log('[AudioCapture] Cleaned up');
    }

    /**
     * Check if audio capture is available
     */
    static isAvailable() {
        return !!(
            navigator.mediaDevices &&
            navigator.mediaDevices.getUserMedia &&
            (window.AudioContext || window.webkitAudioContext)
        );
    }

    /**
     * Request microphone permission
     */
    static async requestPermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            console.error('[AudioCapture] Permission denied:', error);
            return false;
        }
    }
}

// Export for use in renderer process
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioCapture;
}

// Also expose to window for browser usage
if (typeof window !== 'undefined') {
    window.AudioCapture = AudioCapture;
}