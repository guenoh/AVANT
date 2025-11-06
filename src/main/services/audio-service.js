/**
 * Audio Service for sound level detection and analysis
 * Captures audio from microphone and analyzes decibel levels
 */

class AudioService {
    constructor() {
        this.isRecording = false;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.scriptProcessor = null;
        this.stream = null;
        this.samples = [];
        this.calibrationOffset = 0; // Calibration for environment noise
    }

    /**
     * Initialize audio service
     */
    async init() {
        console.log('[AudioService] Initializing...');
        // Calibration will be done on first use
        this.initialized = true;
        console.log('[AudioService] Initialized');
    }

    /**
     * Start recording audio and measuring decibels
     * @param {number} duration - Recording duration in milliseconds
     * @param {Object} options - Recording options
     * @returns {Promise<Object>} Analysis results
     */
    async startRecording(duration = 5000, options = {}) {
        if (this.isRecording) {
            throw new Error('Already recording');
        }

        const {
            sampleRate = 10, // Samples per second
            expectation = 'present', // 'present', 'silent', 'level'
            threshold = { min: 30, max: 80 },
            realTimeCallback = null
        } = options;

        this.isRecording = true;
        this.samples = [];

        try {
            // Get microphone access
            await this.setupAudioContext();

            // Start collecting samples
            const sampleInterval = 1000 / sampleRate;
            const totalSamples = Math.floor(duration / sampleInterval);

            return new Promise((resolve, reject) => {
                let sampleCount = 0;

                const collectSample = () => {
                    if (!this.isRecording || sampleCount >= totalSamples) {
                        this.stopRecording();
                        const analysis = this.analyzeResults(this.samples, expectation, threshold);
                        resolve(analysis);
                        return;
                    }

                    const decibel = this.getCurrentDecibel();
                    this.samples.push({
                        db: decibel,
                        timestamp: Date.now(),
                        index: sampleCount
                    });

                    // Real-time callback for UI updates
                    if (realTimeCallback) {
                        realTimeCallback({
                            current: decibel,
                            average: this.getRunningAverage(),
                            max: Math.max(...this.samples.map(s => s.db)),
                            min: Math.min(...this.samples.map(s => s.db)),
                            progress: (sampleCount / totalSamples) * 100
                        });
                    }

                    sampleCount++;
                    setTimeout(collectSample, sampleInterval);
                };

                // Start collecting
                collectSample();

                // Safety timeout
                setTimeout(() => {
                    if (this.isRecording) {
                        this.stopRecording();
                        reject(new Error('Recording timeout'));
                    }
                }, duration + 1000);
            });
        } catch (error) {
            this.isRecording = false;
            throw error;
        }
    }

    /**
     * Setup Web Audio API context
     */
    async setupAudioContext() {
        // In Electron main process, we need to use a different approach
        // We'll use IPC to request audio from renderer process
        const { ipcMain } = require('electron');

        return new Promise((resolve, reject) => {
            // Request renderer to setup audio
            const mainWindow = global.mainWindow;
            if (!mainWindow) {
                reject(new Error('Main window not available'));
                return;
            }

            // Send request to renderer
            mainWindow.webContents.send('audio:setup-request');

            // Wait for setup confirmation
            ipcMain.once('audio:setup-complete', (event, success) => {
                if (success) {
                    resolve();
                } else {
                    reject(new Error('Failed to setup audio'));
                }
            });

            // Timeout after 3 seconds
            setTimeout(() => {
                reject(new Error('Audio setup timeout'));
            }, 3000);
        });
    }

    /**
     * Get current decibel level
     */
    getCurrentDecibel() {
        // This will be called from renderer process
        // For now, return simulated value
        const baseNoise = 30; // Base noise level
        const variation = Math.random() * 10 - 5; // ±5 dB variation
        return Math.max(0, baseNoise + variation + this.calibrationOffset);
    }

    /**
     * Get running average of samples
     */
    getRunningAverage() {
        if (this.samples.length === 0) return 0;
        const sum = this.samples.reduce((acc, sample) => acc + sample.db, 0);
        return sum / this.samples.length;
    }

    /**
     * Stop recording
     */
    stopRecording() {
        this.isRecording = false;

        // Clean up audio resources
        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
            this.scriptProcessor = null;
        }
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        // Notify renderer to cleanup
        if (global.mainWindow) {
            global.mainWindow.webContents.send('audio:cleanup');
        }
    }

    /**
     * Analyze recording results
     */
    analyzeResults(samples, expectation, threshold) {
        if (samples.length === 0) {
            return {
                success: false,
                error: 'No samples collected',
                samples: []
            };
        }

        const dbValues = samples.map(s => s.db);
        const average = dbValues.reduce((a, b) => a + b, 0) / dbValues.length;
        const max = Math.max(...dbValues);
        const min = Math.min(...dbValues);
        const variance = this.calculateVariance(dbValues);
        const peaks = this.findPeaks(dbValues);

        // Determine pass/fail based on expectation
        let passed = false;
        let message = '';

        switch (expectation) {
            case 'present':
                passed = average >= threshold.min;
                message = passed
                    ? `Sound detected: ${average.toFixed(1)}dB (threshold: ${threshold.min}dB)`
                    : `No sound detected: ${average.toFixed(1)}dB (threshold: ${threshold.min}dB)`;
                break;

            case 'silent':
                passed = average <= threshold.max;
                message = passed
                    ? `Silence confirmed: ${average.toFixed(1)}dB (threshold: ${threshold.max}dB)`
                    : `Unexpected sound: ${average.toFixed(1)}dB (threshold: ${threshold.max}dB)`;
                break;

            case 'level':
                passed = average >= threshold.min && average <= threshold.max;
                message = passed
                    ? `Level in range: ${average.toFixed(1)}dB (${threshold.min}-${threshold.max}dB)`
                    : `Level out of range: ${average.toFixed(1)}dB (expected: ${threshold.min}-${threshold.max}dB)`;
                break;
        }

        return {
            success: passed,
            message,
            stats: {
                average: parseFloat(average.toFixed(1)),
                max: parseFloat(max.toFixed(1)),
                min: parseFloat(min.toFixed(1)),
                variance: parseFloat(variance.toFixed(2)),
                peakCount: peaks.length,
                duration: samples[samples.length - 1].timestamp - samples[0].timestamp
            },
            samples: samples,
            peaks: peaks,
            expectation: expectation,
            threshold: threshold
        };
    }

    /**
     * Calculate variance of samples
     */
    calculateVariance(values) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squareDiffs = values.map(value => Math.pow(value - mean, 2));
        return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
    }

    /**
     * Find peaks in the samples
     */
    findPeaks(values, minHeight = 10) {
        const peaks = [];
        const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
        const threshold = avgValue + minHeight;

        for (let i = 1; i < values.length - 1; i++) {
            if (values[i] > threshold &&
                values[i] > values[i - 1] &&
                values[i] > values[i + 1]) {
                peaks.push({
                    index: i,
                    value: values[i],
                    prominence: values[i] - avgValue
                });
            }
        }

        return peaks;
    }

    /**
     * Calibrate for ambient noise
     */
    async calibrate(duration = 3000) {
        console.log('[AudioService] Starting calibration...');

        // Record ambient noise
        const result = await this.startRecording(duration, {
            expectation: 'silent',
            threshold: { max: 100 }
        });

        // Set calibration offset
        this.calibrationOffset = -result.stats.average + 30; // Target 30dB for silence

        console.log(`[AudioService] Calibration complete. Offset: ${this.calibrationOffset.toFixed(1)}dB`);
        return {
            ambientNoise: result.stats.average,
            offset: this.calibrationOffset
        };
    }

    /**
     * Cleanup service
     */
    async cleanup() {
        if (this.isRecording) {
            this.stopRecording();
        }
        this.initialized = false;
        console.log('[AudioService] Cleaned up');
    }
}

module.exports = AudioService;