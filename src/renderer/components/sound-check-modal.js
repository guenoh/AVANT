/**
 * Sound Check Modal Component
 * UI for configuring and monitoring sound check actions
 */

class SoundCheckModal {
    constructor() {
        this.audioCapture = null;
        this.monitorInterval = null;
        this.isMonitoring = false;
        this.currentAction = null;
    }

    /**
     * Show the sound check configuration modal
     * @param {Object} action - Current action object
     * @param {Function} onSave - Callback when saving
     * @param {Function} onCancel - Callback when cancelling
     */
    show(action = {}, onSave, onCancel) {
        this.currentAction = action;

        // Create modal HTML
        const modal = document.createElement('div');
        modal.className = 'modal modal-active';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3 class="modal-title">
                        <svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z">
                            </path>
                        </svg>
                        사운드 체크 설정
                    </h3>
                    <button class="modal-close" id="modal-close">&times;</button>
                </div>

                <div class="modal-body">
                    <!-- 측정 설정 -->
                    <div class="form-section">
                        <h4 class="form-section-title">측정 설정</h4>

                        <div class="form-group">
                            <label>측정 시간 (초)</label>
                            <input type="number" id="sound-duration" class="form-input"
                                value="${action.duration || 5}" min="1" max="30" step="0.5">
                            <small class="form-help">사운드를 측정할 시간 (1-30초)</small>
                        </div>

                        <div class="form-group">
                            <label>검증 타입</label>
                            <select id="sound-expectation" class="form-select">
                                <option value="present" ${action.expectation === 'present' ? 'selected' : ''}>
                                    소리 있음 (Sound Present)
                                </option>
                                <option value="silent" ${action.expectation === 'silent' ? 'selected' : ''}>
                                    무음 확인 (Silent)
                                </option>
                                <option value="level" ${action.expectation === 'level' ? 'selected' : ''}>
                                    특정 레벨 (Specific Level)
                                </option>
                            </select>
                        </div>

                        <div class="form-row" id="threshold-settings">
                            <div class="form-group">
                                <label>최소 데시벨</label>
                                <input type="number" id="sound-min-db" class="form-input"
                                    value="${action.minDb || 30}" min="0" max="100">
                                <small class="form-help">최소 임계값 (dB)</small>
                            </div>
                            <div class="form-group">
                                <label>최대 데시벨</label>
                                <input type="number" id="sound-max-db" class="form-input"
                                    value="${action.maxDb || 80}" min="0" max="100">
                                <small class="form-help">최대 임계값 (dB)</small>
                            </div>
                        </div>
                    </div>

                    <!-- 실시간 모니터링 -->
                    <div class="form-section">
                        <h4 class="form-section-title">실시간 모니터링</h4>

                        <div class="sound-monitor-container">
                            <!-- 데시벨 미터 -->
                            <div class="db-meter-container">
                                <div class="db-meter">
                                    <div class="db-meter-bar" id="db-meter-bar"></div>
                                    <div class="db-meter-marks">
                                        <span style="bottom: 0">0</span>
                                        <span style="bottom: 25%">25</span>
                                        <span style="bottom: 50%">50</span>
                                        <span style="bottom: 75%">75</span>
                                        <span style="bottom: 100%">100</span>
                                    </div>
                                </div>
                                <div class="db-value" id="db-value">-- dB</div>
                            </div>

                            <!-- 파형 그래프 -->
                            <div class="waveform-container">
                                <canvas id="waveform-canvas" width="400" height="100"></canvas>
                            </div>

                            <!-- 통계 정보 -->
                            <div class="sound-stats">
                                <div class="stat-item">
                                    <label>현재:</label>
                                    <span id="stat-current">-- dB</span>
                                </div>
                                <div class="stat-item">
                                    <label>평균:</label>
                                    <span id="stat-average">-- dB</span>
                                </div>
                                <div class="stat-item">
                                    <label>최대:</label>
                                    <span id="stat-max">-- dB</span>
                                </div>
                                <div class="stat-item">
                                    <label>최소:</label>
                                    <span id="stat-min">-- dB</span>
                                </div>
                            </div>

                            <!-- 모니터링 컨트롤 -->
                            <div class="monitor-controls">
                                <button id="start-monitor" class="btn btn-secondary">
                                    <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                    모니터링 시작
                                </button>
                                <button id="calibrate" class="btn btn-ghost">
                                    <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>
                                    </svg>
                                    보정
                                </button>
                            </div>
                        </div>

                        <div class="alert alert-info mt-4" id="permission-warning" style="display: none;">
                            <svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            마이크 권한이 필요합니다. 브라우저에서 마이크 접근을 허용해주세요.
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn btn-ghost" id="modal-cancel">취소</button>
                    <button class="btn btn-primary" id="modal-save">저장</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Initialize event handlers
        this.initEventHandlers(modal, onSave, onCancel);

        // Initialize waveform canvas
        this.initWaveform();

        // Update threshold settings visibility
        this.updateThresholdSettings();

        // Request microphone permission on load
        this.requestMicrophonePermission();
    }

    /**
     * Initialize event handlers
     */
    initEventHandlers(modal, onSave, onCancel) {
        // Close button
        modal.querySelector('#modal-close').addEventListener('click', () => {
            this.close();
            if (onCancel) onCancel();
        });

        // Cancel button
        modal.querySelector('#modal-cancel').addEventListener('click', () => {
            this.close();
            if (onCancel) onCancel();
        });

        // Save button
        modal.querySelector('#modal-save').addEventListener('click', () => {
            const config = this.getConfiguration();
            this.close();
            if (onSave) onSave(config);
        });

        // Expectation type change
        modal.querySelector('#sound-expectation').addEventListener('change', () => {
            this.updateThresholdSettings();
        });

        // Start/Stop monitoring
        modal.querySelector('#start-monitor').addEventListener('click', () => {
            this.toggleMonitoring();
        });

        // Calibrate
        modal.querySelector('#calibrate').addEventListener('click', () => {
            this.calibrate();
        });

        // Backdrop click
        modal.querySelector('.modal-backdrop').addEventListener('click', () => {
            this.close();
            if (onCancel) onCancel();
        });
    }

    /**
     * Initialize waveform canvas
     */
    initWaveform() {
        this.waveformCanvas = document.getElementById('waveform-canvas');
        this.waveformCtx = this.waveformCanvas.getContext('2d');
        this.waveformData = new Array(50).fill(0);

        this.drawWaveform();
    }

    /**
     * Draw waveform
     */
    drawWaveform() {
        const ctx = this.waveformCtx;
        const width = this.waveformCanvas.width;
        const height = this.waveformCanvas.height;

        // Clear canvas
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Draw waveform
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const barWidth = width / this.waveformData.length;
        for (let i = 0; i < this.waveformData.length; i++) {
            const x = i * barWidth;
            const y = height - (this.waveformData[i] / 100) * height;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();
    }

    /**
     * Update threshold settings visibility
     */
    updateThresholdSettings() {
        const expectation = document.getElementById('sound-expectation').value;
        const thresholdSettings = document.getElementById('threshold-settings');

        if (expectation === 'level') {
            thresholdSettings.style.display = 'flex';
        } else if (expectation === 'present') {
            thresholdSettings.style.display = 'flex';
            document.getElementById('sound-max-db').parentElement.style.display = 'none';
        } else if (expectation === 'silent') {
            thresholdSettings.style.display = 'flex';
            document.getElementById('sound-min-db').parentElement.style.display = 'none';
        }
    }

    /**
     * Request microphone permission
     */
    async requestMicrophonePermission() {
        const AudioCapture = require('./utils/audio-capture');

        if (!AudioCapture.isAvailable()) {
            document.getElementById('permission-warning').style.display = 'block';
            document.getElementById('permission-warning').textContent =
                '이 브라우저는 오디오 캡처를 지원하지 않습니다.';
            return;
        }

        const hasPermission = await AudioCapture.requestPermission();
        if (!hasPermission) {
            document.getElementById('permission-warning').style.display = 'block';
        }
    }

    /**
     * Toggle monitoring
     */
    async toggleMonitoring() {
        if (this.isMonitoring) {
            this.stopMonitoring();
        } else {
            await this.startMonitoring();
        }
    }

    /**
     * Start monitoring
     */
    async startMonitoring() {
        const AudioCapture = require('./utils/audio-capture');

        try {
            // Initialize audio capture
            this.audioCapture = new AudioCapture();
            await this.audioCapture.init();

            // Start monitoring
            this.monitorInterval = this.audioCapture.startMonitoring((data) => {
                this.updateMonitorDisplay(data);
            }, 100);

            this.isMonitoring = true;

            // Update button
            const btn = document.getElementById('start-monitor');
            btn.textContent = '모니터링 중지';
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-danger');

        } catch (error) {
            console.error('Failed to start monitoring:', error);
            alert('마이크 모니터링을 시작할 수 없습니다: ' + error.message);
        }
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.audioCapture) {
            this.audioCapture.stopMonitoring(this.monitorInterval);
            this.audioCapture.cleanup();
            this.audioCapture = null;
        }

        this.isMonitoring = false;

        // Update button
        const btn = document.getElementById('start-monitor');
        btn.innerHTML = `
            <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            모니터링 시작
        `;
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-secondary');
    }

    /**
     * Update monitor display
     */
    updateMonitorDisplay(data) {
        const db = data.decibel;

        // Update meter bar
        const meterBar = document.getElementById('db-meter-bar');
        meterBar.style.height = `${Math.min(100, db)}%`;

        // Update color based on level
        if (db < 30) {
            meterBar.style.background = '#10b981'; // Green
        } else if (db < 60) {
            meterBar.style.background = '#f59e0b'; // Yellow
        } else {
            meterBar.style.background = '#ef4444'; // Red
        }

        // Update value display
        document.getElementById('db-value').textContent = `${db.toFixed(1)} dB`;
        document.getElementById('stat-current').textContent = `${db.toFixed(1)} dB`;

        // Update waveform
        this.waveformData.shift();
        this.waveformData.push(db);
        this.drawWaveform();

        // Update statistics (simplified for now)
        const avg = this.waveformData.reduce((a, b) => a + b) / this.waveformData.length;
        const max = Math.max(...this.waveformData);
        const min = Math.min(...this.waveformData.filter(v => v > 0));

        document.getElementById('stat-average').textContent = `${avg.toFixed(1)} dB`;
        document.getElementById('stat-max').textContent = `${max.toFixed(1)} dB`;
        document.getElementById('stat-min').textContent = `${min.toFixed(1)} dB`;
    }

    /**
     * Calibrate audio capture
     */
    async calibrate() {
        if (!this.audioCapture) {
            alert('먼저 모니터링을 시작해주세요.');
            return;
        }

        const btn = document.getElementById('calibrate');
        btn.disabled = true;
        btn.textContent = '보정 중...';

        try {
            const result = await this.audioCapture.calibrate(3000);
            alert(`보정 완료!\n주변 소음: ${result.ambientNoise.toFixed(1)}dB\n오프셋: ${result.offset.toFixed(1)}dB`);
        } catch (error) {
            alert('보정 실패: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = `
                <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>
                </svg>
                보정
            `;
        }
    }

    /**
     * Get configuration from form
     */
    getConfiguration() {
        const expectation = document.getElementById('sound-expectation').value;
        const config = {
            type: 'sound-check',
            duration: parseFloat(document.getElementById('sound-duration').value) * 1000,
            expectation: expectation,
            threshold: {}
        };

        if (expectation === 'present') {
            config.threshold.min = parseFloat(document.getElementById('sound-min-db').value);
        } else if (expectation === 'silent') {
            config.threshold.max = parseFloat(document.getElementById('sound-max-db').value);
        } else if (expectation === 'level') {
            config.threshold.min = parseFloat(document.getElementById('sound-min-db').value);
            config.threshold.max = parseFloat(document.getElementById('sound-max-db').value);
        }

        return config;
    }

    /**
     * Close modal
     */
    close() {
        // Stop monitoring if active
        if (this.isMonitoring) {
            this.stopMonitoring();
        }

        // Remove modal
        const modal = document.querySelector('.modal');
        if (modal) {
            modal.remove();
        }
    }
}

// Export for use in other components
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoundCheckModal;
}