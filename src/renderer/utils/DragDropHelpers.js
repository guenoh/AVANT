/**
 * DragDropHelpers - Utility functions for drag-and-drop operations
 * Provides centralized state management, validation, and placeholder handling
 * for action block drag-and-drop functionality.
 */

/**
 * Centralized drag state management
 * Ensures state is always initialized and provides immutable access
 */
export const DragState = {
  _current: {
    isDragging: false,
    draggedActionId: null,
    pairedBlockInfo: null,  // { pairIds: [], indices: [] }
    dropTarget: null,  // { targetActionId, insertAfter }
  },

  /**
   * Initialize drag operation
   * @param {string} actionId - ID of the action being dragged
   * @param {Object} pairedInfo - Paired block information { pairIds, indices }
   */
  startDrag(actionId, pairedInfo) {
    this._current = {
      isDragging: true,
      draggedActionId: actionId,
      pairedBlockInfo: pairedInfo,
      dropTarget: null
    };
  },

  /**
   * Set drop target information
   * @param {string} targetActionId - ID of the target action
   * @param {boolean} insertAfter - Whether to insert after target
   */
  setDropTarget(targetActionId, insertAfter) {
    this._current.dropTarget = { targetActionId, insertAfter };
  },

  /**
   * Clear drag state
   * Called when drag operation completes or is cancelled
   */
  clear() {
    this._current = {
      isDragging: false,
      draggedActionId: null,
      pairedBlockInfo: null,
      dropTarget: null
    };
  },

  /**
   * Get immutable copy of current drag state
   * @returns {Object} Current drag state
   */
  get() {
    return { ...this._current };
  }
};

/**
 * Resolve paired blocks for a given action
 * Paired blocks (loop/end-loop, if/endif) must move together with all nested actions
 *
 * @param {Array} actions - All actions in the sequence
 * @param {string} actionId - ID of the action to resolve
 * @returns {Object} { pairIds: [id1, id2], indices: [start...end] }
 */
export function resolvePairedBlocks(actions, actionId) {
  const actionIndex = actions.findIndex(a => a.id === actionId);
  if (actionIndex === -1) return { pairIds: [], indices: [] };

  const action = actions[actionIndex];

  // Single action (no pair)
  if (!action.pairId) return { pairIds: [], indices: [actionIndex] };

  // Find paired action
  const pairAction = actions.find(a =>
    a.pairId === action.pairId && a.id !== action.id
  );

  // Pair not found (orphaned block)
  if (!pairAction) return { pairIds: [], indices: [actionIndex] };

  // Calculate range from start to end of paired blocks
  const pairIndex = actions.findIndex(a => a.id === pairAction.id);
  const startIdx = Math.min(actionIndex, pairIndex);
  const endIdx = Math.max(actionIndex, pairIndex);

  // Include all actions in the range
  const indices = [];
  for (let i = startIdx; i <= endIdx; i++) {
    indices.push(i);
  }

  return { pairIds: [action.id, pairAction.id], indices };
}

/**
 * Check if a move would result in no position change
 * A move is a no-op if the insert position is within or right after the source range
 *
 * @param {Array<number>} sourceIndices - Indices of blocks being moved
 * @param {number} targetIndex - Index of target action
 * @param {boolean} insertAfter - Whether to insert after target
 * @returns {boolean} True if this would be a no-op move
 */
export function isNoOpMove(sourceIndices, targetIndex, insertAfter) {
  const rangeStart = sourceIndices[0];
  const rangeEnd = sourceIndices[sourceIndices.length - 1];

  let insertIndex = targetIndex;
  if (insertAfter) insertIndex++;

  // No-op if inserting within or right after the current range
  return insertIndex > rangeStart && insertIndex <= rangeEnd + 1;
}

/**
 * Calculate adjusted insert index after removing source blocks
 * Accounts for how removal of source blocks shifts indices
 *
 * @param {Array<number>} removedIndices - Indices that will be removed
 * @param {number} targetIndex - Target index before removal
 * @param {boolean} insertAfter - Whether to insert after target
 * @returns {number} Adjusted insert index
 */
export function calculateInsertIndex(removedIndices, targetIndex, insertAfter) {
  let adjustedIndex = targetIndex;

  // Count how many removed indices are before the target
  const removedBefore = removedIndices.filter(i => i < targetIndex).length;
  adjustedIndex -= removedBefore;

  if (insertAfter) adjustedIndex++;

  return Math.max(0, adjustedIndex);
}

/**
 * Placeholder management for drag feedback
 * Handles lifecycle and event listeners to prevent memory leaks
 */
export const PlaceholderManager = {
  _placeholder: null,
  _handlers: new Map(),

  /**
   * Show placeholder at target position
   * Automatically removes any existing placeholder first
   *
   * @param {HTMLElement} targetElement - Element to insert placeholder near
   * @param {boolean} insertAfter - Whether to insert after target
   * @returns {HTMLElement} Created placeholder element
   */
  show(targetElement, insertAfter) {
    this.remove();

    const placeholder = document.createElement('div');
    placeholder.className = 'drag-placeholder';
    placeholder.style.cssText = `
      height: 80px;
      margin: 12px 0;
      border: 3px dashed #3b82f6;
      border-radius: 10px;
      background: rgba(59, 130, 246, 0.08);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
      animation: placeholderPulse 1.5s ease-in-out infinite;
    `;

    if (insertAfter) {
      targetElement.insertAdjacentElement('afterend', placeholder);
    } else {
      targetElement.insertAdjacentElement('beforebegin', placeholder);
    }

    this._placeholder = placeholder;
    return placeholder;
  },

  /**
   * Remove placeholder and clean up event listeners
   * Prevents memory leaks by properly disposing of listeners
   */
  remove() {
    if (this._placeholder) {
      this._handlers.forEach((handler, event) => {
        this._placeholder.removeEventListener(event, handler);
      });
      this._handlers.clear();
      this._placeholder.remove();
      this._placeholder = null;
    }
  },

  /**
   * Add event listener to placeholder
   * Tracks listeners for proper cleanup
   *
   * @param {string} event - Event type (e.g., 'dragover', 'drop')
   * @param {Function} handler - Event handler function
   */
  addEventListener(event, handler) {
    if (!this._placeholder) return;

    const bound = handler.bind(this);
    this._handlers.set(event, bound);
    this._placeholder.addEventListener(event, bound);
  }
};
