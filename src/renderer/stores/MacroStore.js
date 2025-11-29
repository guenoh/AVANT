/**
 * Macro Store - Manages macro list and execution state
 */

class MacroStore {
  constructor() {
    this._state = {
      // Macro list
      macros: [],
      selectedMacro: null,

      // Execution state
      isRunning: false,
      runningMacroId: null,
      currentActionIndex: -1,

      // Edit mode
      isEditMode: false,
      editingMacroId: null
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
   * Set macro list
   */
  setMacros(macros) {
    this.setState({ macros });
  }

  /**
   * Add macro to list
   */
  addMacro(macro) {
    const macros = [...this._state.macros, macro];
    this.setState({ macros });
  }

  /**
   * Update macro in list
   */
  updateMacro(macroId, updates) {
    const macros = this._state.macros.map(m =>
      m.id === macroId ? { ...m, ...updates } : m
    );
    this.setState({ macros });
  }

  /**
   * Remove macro from list
   */
  removeMacro(macroId) {
    const macros = this._state.macros.filter(m => m.id !== macroId);
    this.setState({ macros });
  }

  /**
   * Select macro
   */
  selectMacro(macroId) {
    const macro = this._state.macros.find(m => m.id === macroId);
    this.setState({ selectedMacro: macro });
  }

  /**
   * Clear selected macro
   */
  clearSelection() {
    this.setState({ selectedMacro: null });
  }

  /**
   * Set running state
   */
  setRunning(isRunning, macroId = null) {
    this.setState({
      isRunning,
      runningMacroId: isRunning ? macroId : null,
      currentActionIndex: isRunning ? 0 : -1
    });
  }

  /**
   * Set current action index during execution
   */
  setCurrentActionIndex(index) {
    this.setState({ currentActionIndex: index });
  }

  /**
   * Set edit mode
   */
  setEditMode(isEditMode, macroId = null) {
    this.setState({
      isEditMode,
      editingMacroId: isEditMode ? macroId : null
    });
  }

  /**
   * Get macro by ID
   */
  getMacroById(macroId) {
    return this._state.macros.find(m => m.id === macroId);
  }

  /**
   * Reset store to initial state
   */
  reset() {
    this._state = {
      macros: [],
      selectedMacro: null,
      isRunning: false,
      runningMacroId: null,
      currentActionIndex: -1,
      isEditMode: false,
      editingMacroId: null
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

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MacroStore;
}

// Create and expose singleton instance globally in browser
if (typeof window !== 'undefined') {
  window.MacroStore = new MacroStore();
}
