/**
 * ScreenAlertOverlay - Unified alert overlay component for screen panel
 *
 * Provides consistent alert display for various states:
 * - not_connected: Device not connected (initial state)
 * - disconnected: Device connection lost
 * - reconnecting: Attempting to reconnect
 * - loading: Device loading/stabilizing
 * - error: Error state
 * - info: General information
 */

/**
 * Alert type configurations
 */
const ALERT_CONFIGS = {
    not_connected: {
        icon: 'device',
        iconColor: '#64748b', // slate-500
        title: '장치 미연결',
        defaultStatus: 'ADB 또는 ISAP 장치를 연결하세요',
        showSpinner: false
    },
    disconnected: {
        icon: 'warning',
        iconColor: '#ef4444', // red-500
        title: '장치 연결 끊김',
        defaultStatus: '재연결을 시도하거나 장치를 확인하세요',
        showSpinner: false
    },
    reconnecting: {
        icon: 'sync',
        iconColor: '#f59e0b', // amber-500
        title: '재연결 중',
        defaultStatus: '재연결 시도 중...',
        showSpinner: true
    },
    loading: {
        icon: 'loading',
        iconColor: '#3b82f6', // blue-500
        title: '장치 로딩 중',
        defaultStatus: '안정적인 장치 로딩을 기다리는 중...',
        showSpinner: true
    },
    error: {
        icon: 'error',
        iconColor: '#dc2626', // red-600
        title: '오류 발생',
        defaultStatus: '오류가 발생했습니다',
        showSpinner: false
    },
    info: {
        icon: 'info',
        iconColor: '#0ea5e9', // sky-500
        title: '알림',
        defaultStatus: '',
        showSpinner: false
    }
};

/**
 * SVG icon templates
 */
const ICONS = {
    device: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>`,
    warning: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>`,
    sync: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>`,
    loading: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>`,
    error: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>`,
    info: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>`
};

class ScreenAlertOverlay {
    /**
     * @param {HTMLElement} container - Parent element to mount overlay
     */
    constructor(container) {
        this.container = container;
        this.overlay = null;
        this.currentType = null;
        this.isVisible = false;

        this._createOverlay();
    }

    /**
     * Create the overlay DOM structure
     */
    _createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'screen-alert-overlay';
        this.overlay.className = 'screen-alert-overlay';
        this.overlay.style.display = 'none';

        this.overlay.innerHTML = `
            <div class="screen-alert-content">
                <div class="screen-alert-icon-wrapper">
                    <svg class="screen-alert-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    </svg>
                    <div class="screen-alert-spinner" style="display: none;"></div>
                </div>
                <p class="screen-alert-title"></p>
                <p class="screen-alert-status"></p>
            </div>
        `;

        this.container.appendChild(this.overlay);

        // Cache element references
        this.elements = {
            icon: this.overlay.querySelector('.screen-alert-icon'),
            iconWrapper: this.overlay.querySelector('.screen-alert-icon-wrapper'),
            spinner: this.overlay.querySelector('.screen-alert-spinner'),
            title: this.overlay.querySelector('.screen-alert-title'),
            status: this.overlay.querySelector('.screen-alert-status')
        };
    }

    /**
     * Show alert with specified type
     * @param {string} type - Alert type (not_connected, disconnected, reconnecting, loading, error, info)
     * @param {Object} options - Optional overrides
     * @param {string} options.title - Custom title
     * @param {string} options.status - Custom status message
     * @param {string} options.icon - Custom icon key
     * @param {string} options.iconColor - Custom icon color
     */
    show(type, options = {}) {
        const config = ALERT_CONFIGS[type];
        if (!config) {
            console.warn(`[ScreenAlertOverlay] Unknown alert type: ${type}`);
            return;
        }

        this.currentType = type;
        const iconKey = options.icon || config.icon;
        const iconPath = ICONS[iconKey] || ICONS.info;
        const iconColor = options.iconColor || config.iconColor;

        // Update icon
        this.elements.icon.innerHTML = iconPath;
        this.elements.icon.style.color = iconColor;

        // Update spinner visibility
        if (config.showSpinner) {
            this.elements.spinner.style.display = 'block';
            this.elements.icon.classList.add('with-spinner');
        } else {
            this.elements.spinner.style.display = 'none';
            this.elements.icon.classList.remove('with-spinner');
        }

        // Update title
        this.elements.title.textContent = options.title || config.title;

        // Update status
        this.elements.status.textContent = options.status || config.defaultStatus;

        // Show overlay with animation
        this.overlay.style.display = 'flex';
        this.overlay.classList.remove('hidden');
        this.overlay.classList.add('visible');
        this.isVisible = true;
    }

    /**
     * Update status message without changing type
     * @param {string} message - New status message
     */
    updateStatus(message) {
        if (this.elements.status) {
            this.elements.status.textContent = message;
        }
    }

    /**
     * Update title without changing type
     * @param {string} title - New title
     */
    updateTitle(title) {
        if (this.elements.title) {
            this.elements.title.textContent = title;
        }
    }

    /**
     * Hide the overlay
     */
    hide() {
        if (this.overlay) {
            this.overlay.classList.remove('visible');
            this.overlay.classList.add('hidden');
            this.overlay.style.display = 'none';
            this.isVisible = false;
            this.currentType = null;
        }
    }

    /**
     * Check if overlay is currently visible
     * @returns {boolean}
     */
    isShowing() {
        return this.isVisible;
    }

    /**
     * Get current alert type
     * @returns {string|null}
     */
    getType() {
        return this.currentType;
    }

    /**
     * Destroy the overlay and cleanup
     */
    destroy() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        this.overlay = null;
        this.elements = null;
        this.isVisible = false;
        this.currentType = null;
    }
}

// Also provide backward compatibility by keeping disconnect-overlay ID
// for existing code that references it
ScreenAlertOverlay.TYPES = {
    NOT_CONNECTED: 'not_connected',
    DISCONNECTED: 'disconnected',
    RECONNECTING: 'reconnecting',
    LOADING: 'loading',
    ERROR: 'error',
    INFO: 'info'
};

// Export for use in renderer process
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScreenAlertOverlay;
}

if (typeof window !== 'undefined') {
    window.ScreenAlertOverlay = ScreenAlertOverlay;
}
