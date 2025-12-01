/**
 * BaseStore - Base class for all stores
 * Provides reactive state management with subscription pattern
 *
 * Usage:
 *   class MyStore extends BaseStore {
 *     constructor() {
 *       super({
 *         myProperty: 'initial value',
 *         anotherProperty: 123
 *       });
 *     }
 *
 *     // Domain-specific methods
 *     setMyProperty(value) {
 *       this.setState({ myProperty: value });
 *     }
 *   }
 */

class BaseStore {
  /**
   * @param {Object} initialState - Initial state object
   */
  constructor(initialState = {}) {
    this._initialState = { ...initialState };
    this._state = { ...initialState };
    this._listeners = new Set();
  }

  /**
   * Get current state (immutable copy)
   * @returns {Object} Copy of current state
   */
  getState() {
    return { ...this._state };
  }

  /**
   * Get specific state property
   * @param {string} key - Property name
   * @returns {*} Property value
   */
  get(key) {
    return this._state[key];
  }

  /**
   * Update state and notify listeners
   * @param {Object} updates - State updates to apply
   */
  setState(updates) {
    const oldState = { ...this._state };
    this._state = { ...this._state, ...updates };

    this._notify({
      type: 'state-change',
      oldState,
      newState: { ...this._state },
      changes: updates
    });
  }

  /**
   * Subscribe to state changes
   * @param {Function} listener - Callback function for state changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   * @param {Object} event - Event object with type, oldState, newState, changes
   */
  _notify(event) {
    this._listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[BaseStore] Error in listener:', error);
      }
    });
  }

  /**
   * Reset store to initial state
   */
  reset() {
    this._state = { ...this._initialState };
    this._notify({
      type: 'reset',
      newState: { ...this._state }
    });
  }

  /**
   * Check if state has changed from initial
   * @returns {boolean}
   */
  isDirty() {
    return JSON.stringify(this._state) !== JSON.stringify(this._initialState);
  }

  /**
   * Get debug information
   * @returns {Object} Debug info with state and listener count
   */
  getDebugInfo() {
    return {
      state: { ...this._state },
      listenerCount: this._listeners.size,
      isDirty: this.isDirty()
    };
  }

  /**
   * Batch multiple state updates into one notification
   * @param {Function} updateFn - Function that calls setState multiple times
   */
  batch(updateFn) {
    const oldListeners = this._listeners;
    const updates = {};

    // Temporarily replace listeners to collect updates
    this._listeners = new Set();

    const originalSetState = this.setState.bind(this);
    this.setState = (partialUpdates) => {
      Object.assign(updates, partialUpdates);
      this._state = { ...this._state, ...partialUpdates };
    };

    try {
      updateFn();
    } finally {
      // Restore original setState and listeners
      this.setState = originalSetState;
      this._listeners = oldListeners;

      // Notify once with all updates
      if (Object.keys(updates).length > 0) {
        this._notify({
          type: 'state-change',
          oldState: { ...this._state, ...updates },
          newState: { ...this._state },
          changes: updates
        });
      }
    }
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseStore;
}

// Also expose globally for browser environment
if (typeof window !== 'undefined') {
  window.BaseStore = BaseStore;
}
