/**
 * Jest Setup File
 * Runs before each test suite
 */

// Mock window object for Electron renderer environment
global.window = global.window || {};

// Mock CustomEvent for event-driven architecture
global.CustomEvent = class CustomEvent extends Event {
  constructor(event, params = { bubbles: false, cancelable: false, detail: undefined }) {
    super(event, params);
    this.detail = params.detail;
  }
};

// Mock document.dispatchEvent
global.document = global.document || {};
global.document.dispatchEvent = jest.fn();
global.document.addEventListener = jest.fn();
global.document.removeEventListener = jest.fn();
global.document.querySelector = jest.fn();
global.document.querySelectorAll = jest.fn(() => []);
global.document.getElementById = jest.fn();

// Mock Image for canvas operations
global.Image = class Image {
  constructor() {
    this.src = '';
    this.onload = null;
    this.onerror = null;
  }
};

// Suppress console errors in tests (optional)
// global.console.error = jest.fn();
// global.console.warn = jest.fn();
