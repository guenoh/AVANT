/**
 * Application Constants
 * Centralized configuration values
 */

export const TIMING = {
    DEVICE_INIT_DELAY: 500,
    DEFAULT_ACTION_DELAY: 300,
    DEBOUNCE_DELAY: 300,
    ANIMATION_DURATION: 200
};

export const LIMITS = {
    MAX_LOOP_ITERATIONS: 1000,
    MAX_LOGS: 1000
};

export const THRESHOLDS = {
    MIN: 50,
    MAX: 100,
    DEFAULT: 75
};

export const SIZES = {
    ICON_LG: '64px',
    ICON_MD: '24px',
    ICON_SM: '16px',
    MARKER_SIZE: 20,
    REGION_MIN_SIZE: 10
};

export const COLORS = {
    PRIMARY: '#2563eb',
    SUCCESS: '#16a34a',
    WARNING: '#ca8a04',
    ERROR: '#dc2626',
    SECONDARY: '#64748b'
};

export const STORAGE_KEYS = {
    SCENARIO_REGISTRY: 'scenario_registry',
    EXECUTION_RESULTS: 'scenario_execution_results',
    SETTINGS: 'app_settings'
};

export const ACTION_TYPES = {
    CLICK: 'click',
    LONG_PRESS: 'long-press',
    DRAG: 'drag',
    WAIT: 'wait',
    INPUT: 'input',
    KEY_EVENT: 'key-event',
    IMAGE_MATCH: 'image-match',
    AUDIO_MATCH: 'audio-match',
    LOOP: 'loop',
    IF: 'if'
};

export const SCREEN_DEFAULTS = {
    WIDTH: 1080,
    HEIGHT: 2400,
    DENSITY: 160
};
