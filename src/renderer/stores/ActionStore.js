/**
 * Action Store - Manages action list and execution state
 */

class ActionStore {
  constructor() {
    this._state = {
      // Action list
      actions: [],

      // Recording state
      isRecording: false,

      // Execution state
      isExecuting: false,
      executingActionIndex: -1,

      // Click mode
      isClickMode: false,
      clickModeType: null,
      clickModePoints: []
    };

    this._listeners = new Set();
  }

  /**
   * Get current state (immutable)
   */
  getState() {
    return { ...this._state };
  }

  /**
   * Get specific state property
   */
  get(key) {
    return this._state[key];
  }

  /**
   * Update state and notify listeners
   */
  setState(updates) {
    const oldState = { ...this._state };
    this._state = { ...this._state, ...updates };

    this._notify({
      type: 'state-change',
      oldState,
      newState: this._state,
      changes: updates
    });
  }

  /**
   * Subscribe to state changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  _notify(event) {
    this._listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in store listener:', error);
      }
    });
  }

  /**
   * Set action list
   */
  setActions(actions) {
    this.setState({ actions });
  }

  /**
   * Add action to list
   */
  addAction(action) {
    const actions = [...this._state.actions, action];
    this.setState({ actions });
  }

  /**
   * Update action in list
   */
  updateAction(index, updates) {
    const actions = this._state.actions.map((a, i) =>
      i === index ? { ...a, ...updates } : a
    );
    this.setState({ actions });
  }

  /**
   * Remove action from list
   */
  removeAction(index) {
    const actions = this._state.actions.filter((_, i) => i !== index);
    this.setState({ actions });
  }

  /**
   * Clear all actions
   */
  clearActions() {
    this.setState({ actions: [] });
  }

  /**
   * Set recording state
   */
  setRecording(isRecording) {
    this.setState({ isRecording });
  }

  /**
   * Set execution state
   */
  setExecuting(isExecuting, index = -1) {
    this.setState({
      isExecuting,
      executingActionIndex: index
    });
  }

  /**
   * Set executing action index
   */
  setExecutingActionIndex(index) {
    this.setState({ executingActionIndex: index });
  }

  /**
   * Set click mode
   */
  setClickMode(isClickMode, type = null) {
    this.setState({
      isClickMode,
      clickModeType: isClickMode ? type : null,
      clickModePoints: isClickMode ? [] : this._state.clickModePoints
    });
  }

  /**
   * Add click mode point
   */
  addClickModePoint(point) {
    const points = [...this._state.clickModePoints, point];
    this.setState({ clickModePoints: points });
  }

  /**
   * Clear click mode points
   */
  clearClickModePoints() {
    this.setState({ clickModePoints: [] });
  }

  /**
   * Get action by index
   */
  getAction(index) {
    return this._state.actions[index];
  }

  /**
   * Reset store to initial state
   */
  reset() {
    this._state = {
      actions: [],
      isRecording: false,
      isExecuting: false,
      executingActionIndex: -1,
      isClickMode: false,
      clickModeType: null,
      clickModePoints: []
    };

    this._notify({
      type: 'reset',
      newState: this._state
    });
  }

  /**
   * Get debug state info
   */
  getDebugInfo() {
    return {
      state: this._state,
      listenerCount: this._listeners.size
    };
  }
}

// Create and expose singleton instance globally
window.ActionStore = new ActionStore();
