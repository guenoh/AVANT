/**
 * Macro Store - Manages macro list and execution state
 * Extends BaseStore for reactive state management
 */

class MacroStore extends BaseStore {
  constructor() {
    super({
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
    const macros = [...this.get('macros'), macro];
    this.setState({ macros });
  }

  /**
   * Update macro in list
   */
  updateMacro(macroId, updates) {
    const macros = this.get('macros').map(m =>
      m.id === macroId ? { ...m, ...updates } : m
    );
    this.setState({ macros });
  }

  /**
   * Remove macro from list
   */
  removeMacro(macroId) {
    const macros = this.get('macros').filter(m => m.id !== macroId);
    this.setState({ macros });
  }

  /**
   * Select macro
   */
  selectMacro(macroId) {
    const macro = this.get('macros').find(m => m.id === macroId);
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
    return this.get('macros').find(m => m.id === macroId);
  }
}

// Create and expose singleton instance globally
window.MacroStore = new MacroStore();
