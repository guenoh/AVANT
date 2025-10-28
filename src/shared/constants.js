/**
 * Application Constants
 */

// IPC Channels
const IPC = {
  // Device Management
  DEVICE_LIST: 'device:list',
  DEVICE_SELECT: 'device:select',
  DEVICE_STATUS: 'device:status',

  // Screen Operations
  SCREEN_CAPTURE: 'screen:capture',
  SCREEN_STREAM_START: 'screen:stream:start',
  SCREEN_STREAM_STOP: 'screen:stream:stop',
  SCREEN_STREAM_DATA: 'screen:stream:data',

  // Action Operations
  ACTION_TAP: 'action:tap',
  ACTION_SWIPE: 'action:swipe',
  ACTION_INPUT: 'action:input',
  ACTION_KEY: 'action:key',

  // Macro Operations
  MACRO_LIST: 'macro:list',
  MACRO_LOAD: 'macro:load',
  MACRO_SAVE: 'macro:save',
  MACRO_DELETE: 'macro:delete',
  MACRO_RUN: 'macro:run',
  MACRO_STOP: 'macro:stop',
  MACRO_STATUS: 'macro:status',

  // Image Matching
  IMAGE_MATCH: 'image:match',
  IMAGE_CROP: 'image:crop',

  // System
  LOG: 'system:log',
  ERROR: 'system:error',
  READY: 'system:ready'
};

// Action Types
const ACTION_TYPES = {
  TAP: 'tap',
  SWIPE: 'swipe',
  INPUT: 'input',
  KEY: 'key',
  WAIT: 'wait',
  IMAGE_MATCH: 'image_match',
  CONDITION: 'condition',
  LOOP: 'loop',
  SMART_WAIT: 'smart_wait',
  SCREENSHOT: 'screenshot',
  LOG_CLEAR: 'log_clear',
  LOG_SAVE: 'log_save'
};

// Device States
const DEVICE_STATE = {
  DISCONNECTED: 'disconnected',
  CONNECTED: 'connected',
  CONNECTING: 'connecting',
  ERROR: 'error'
};

// Macro States
const MACRO_STATE = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  STOPPED: 'stopped',
  ERROR: 'error'
};

// Log Levels
const LOG_LEVEL = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  SUCCESS: 'success'
};

// Application Settings
const SETTINGS = {
  THEME: 'theme',
  LANGUAGE: 'language',
  AUTO_SAVE: 'auto_save',
  DEBUG_MODE: 'debug_mode',
  PERFORMANCE_MODE: 'performance_mode'
};

// File Paths
const PATHS = {
  MACROS: 'macros',
  SCREENSHOTS: 'screenshots',
  LOGS: 'logs',
  TEMPLATES: 'templates',
  SETTINGS: 'settings.json'
};

// Timing
const TIMING = {
  DEFAULT_WAIT: 250,
  DEFAULT_TIMEOUT: 10000,
  SCREENSHOT_INTERVAL: 100,
  STREAM_FPS: 30,
  AUTO_SAVE_INTERVAL: 30000 // 30 seconds
};

// UI
const UI = {
  ANIMATION_DURATION: 200,
  NOTIFICATION_DURATION: 3000,
  DEBOUNCE_DELAY: 300,
  MAX_LOG_ENTRIES: 1000
};

// Export all constants
module.exports = {
  IPC,
  ACTION_TYPES,
  DEVICE_STATE,
  MACRO_STATE,
  LOG_LEVEL,
  SETTINGS,
  PATHS,
  TIMING,
  UI
};