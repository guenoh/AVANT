/**
 * Shared Utility Functions
 *
 * Common utility functions used across main and renderer processes.
 */

/**
 * Generate unique ID with prefix
 * Uses timestamp + random suffix for uniqueness
 * @param {string} prefix - ID prefix (e.g., 'action', 'macro', 'session')
 * @returns {string} Unique ID in format: prefix_timestamp_randomsuffix
 */
function generateId(prefix = 'id') {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substr(2, 9);
  return `${prefix}_${timestamp}_${randomSuffix}`;
}

/**
 * Generate simple unique ID (timestamp + random)
 * Shorter format for inline use
 * @returns {string} Unique ID in format: timestamp-randomsuffix
 */
function generateSimpleId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate timestamped filename
 * @param {string} prefix - Filename prefix
 * @param {string} extension - File extension (without dot)
 * @returns {string} Filename in format: prefix_timestamp.extension
 */
function generateTimestampedFilename(prefix, extension) {
  return `${prefix}_${Date.now()}.${extension}`;
}

/**
 * Delay execution for specified milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Safe JSON parse with fallback
 * @param {string} jsonString - JSON string to parse
 * @param {*} fallback - Fallback value if parsing fails
 * @returns {*} Parsed object or fallback
 */
function safeJsonParse(jsonString, fallback = null) {
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function execution
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum time between calls in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Export all utilities
module.exports = {
  generateId,
  generateSimpleId,
  generateTimestampedFilename,
  delay,
  clamp,
  safeJsonParse,
  debounce,
  throttle
};
