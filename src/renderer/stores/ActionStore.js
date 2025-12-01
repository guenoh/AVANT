/**
 * Action Store - Manages action list and execution state
 * Extends BaseStore for reactive state management
 */

class ActionStore extends BaseStore {
  constructor() {
    super({
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
    const actions = [...this.get('actions'), action];
    this.setState({ actions });
  }

  /**
   * Update action in list
   */
  updateAction(index, updates) {
    const actions = this.get('actions').map((a, i) =>
      i === index ? { ...a, ...updates } : a
    );
    this.setState({ actions });
  }

  /**
   * Remove action from list
   */
  removeAction(index) {
    const actions = this.get('actions').filter((_, i) => i !== index);
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
      clickModePoints: isClickMode ? [] : this.get('clickModePoints')
    });
  }

  /**
   * Add click mode point
   */
  addClickModePoint(point) {
    const points = [...this.get('clickModePoints'), point];
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
    return this.get('actions')[index];
  }
}

// Create and expose singleton instance globally
window.ActionStore = new ActionStore();
