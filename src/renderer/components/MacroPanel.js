/**
 * Macro Panel Component - Handles macro management UI
 */

class MacroPanel {
  constructor(api, macroStore, actionStore) {
    this.api = api;
    this.macroStore = macroStore;
    this.actionStore = actionStore;
    this.unsubscribe = null;
  }

  /**
   * Initialize component
   */
  init() {
    this._subscribeToStore();
    this.loadMacros();
  }

  /**
   * Subscribe to store changes
   */
  _subscribeToStore() {
    this.unsubscribe = this.macroStore.subscribe((event) => {
      this._handleStateChange(event);
    });
  }

  /**
   * Handle state changes
   */
  _handleStateChange(event) {
    const { changes } = event;

    if ('macros' in changes) {
      this._renderMacroList();
    }

    if ('isRunning' in changes) {
      this._updateRunningUI(changes.isRunning);
    }

    if ('isEditMode' in changes) {
      this._updateEditModeUI(changes.isEditMode);
    }
  }

  /**
   * Load macros from storage
   */
  async loadMacros() {
    try {
      const result = await this.api.macro.list();

      if (result.success && result.macros) {
        this.macroStore.setMacros(result.macros);
        this._emitEvent('macros-loaded', { count: result.macros.length });
      }
    } catch (error) {
      console.error('Failed to load macros:', error);
      this._emitEvent('macros-load-error', { error: error.message });
    }
  }

  /**
   * Save current actions as macro
   */
  async saveMacro(name = null) {
    try {
      const actions = this.actionStore.get('actions');

      if (actions.length === 0) {
        this._emitEvent('save-error', { error: '저장할 액션이 없습니다' });
        return { success: false, error: 'No actions to save' };
      }

      const macroName = name || `Macro ${Date.now()}`;

      const macro = {
        id: `macro_${Date.now()}`,
        name: macroName,
        actions: actions,
        createdAt: new Date().toISOString()
      };

      const result = await this.api.macro.save(macro);

      if (result.success) {
        this.macroStore.addMacro(macro);
        this._emitEvent('macro-saved', { macro });
        return { success: true, macro };
      } else {
        throw new Error(result.error || 'Save failed');
      }
    } catch (error) {
      console.error('Failed to save macro:', error);
      this._emitEvent('save-error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Run macro by ID
   */
  async runMacro(macroId) {
    try {
      const macro = this.macroStore.getMacroById(macroId);

      if (!macro) {
        throw new Error('Macro not found');
      }

      this.macroStore.setRunning(true, macroId);
      this._emitEvent('macro-run-start', { macroId, name: macro.name });

      const result = await this.api.macro.run(macroId);

      this.macroStore.setRunning(false);

      if (result.success) {
        this._emitEvent('macro-run-success', { macroId, results: result.results });
        return { success: true };
      } else {
        throw new Error(result.error || 'Run failed');
      }
    } catch (error) {
      console.error('Failed to run macro:', error);
      this.macroStore.setRunning(false);
      this._emitEvent('macro-run-error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete macro by ID
   */
  async deleteMacro(macroId) {
    try {
      const result = await this.api.macro.delete(macroId);

      if (result.success) {
        this.macroStore.removeMacro(macroId);
        this._emitEvent('macro-deleted', { macroId });
        return { success: true };
      } else {
        throw new Error(result.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Failed to delete macro:', error);
      this._emitEvent('delete-error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Edit macro - load its actions into action list
   */
  editMacro(macroId) {
    try {
      const macro = this.macroStore.getMacroById(macroId);

      if (!macro) {
        throw new Error('Macro not found');
      }

      // Set edit mode
      this.macroStore.setEditMode(true, macroId);

      // Load macro actions into action store
      this.actionStore.setActions(macro.actions);

      this._emitEvent('macro-edit-start', { macroId, name: macro.name });
    } catch (error) {
      console.error('Failed to edit macro:', error);
      this._emitEvent('edit-error', { error: error.message });
    }
  }

  /**
   * Exit edit mode
   */
  exitEditMode() {
    this.macroStore.setEditMode(false);
    this._emitEvent('macro-edit-end');
  }

  /**
   * Render macro list in UI
   */
  _renderMacroList() {
    const macroListEl = document.getElementById('macro-list');
    if (!macroListEl) return;

    const macros = this.macroStore.get('macros');

    if (macros.length === 0) {
      macroListEl.innerHTML = '<div class="empty-state">저장된 매크로가 없습니다</div>';
      return;
    }

    macroListEl.innerHTML = macros.map(macro => `
      <div class="macro-item" data-macro-id="${macro.id}">
        <div class="macro-header">
          <input type="checkbox" class="macro-checkbox" data-macro-id="${macro.id}">
          <span class="macro-name">${macro.name}</span>
          <span class="macro-action-count">${macro.actions.length} 액션</span>
        </div>
        <div class="macro-actions">
          <button class="btn btn-xs btn-primary" onclick="ui.runMacroById('${macro.id}')">실행</button>
          <button class="btn btn-xs btn-secondary" onclick="ui.editMacroById('${macro.id}')">편집</button>
          <button class="btn btn-xs btn-danger" onclick="ui.deleteMacroById('${macro.id}')">삭제</button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Update UI when running state changes
   */
  _updateRunningUI(isRunning) {
    const runningMacroId = this.macroStore.get('runningMacroId');

    // Add running indicator to active macro
    if (isRunning && runningMacroId) {
      const macroItem = document.querySelector(`[data-macro-id="${runningMacroId}"]`);
      if (macroItem) {
        macroItem.classList.add('running');
      }
    } else {
      // Remove running indicator from all macros
      document.querySelectorAll('.macro-item.running').forEach(el => {
        el.classList.remove('running');
      });
    }
  }

  /**
   * Update UI when edit mode changes
   */
  _updateEditModeUI(isEditMode) {
    const indicator = document.getElementById('edit-mode-indicator');
    if (indicator) {
      if (isEditMode) {
        indicator.classList.remove('hidden');
      } else {
        indicator.classList.add('hidden');
      }
    }
  }

  /**
   * Get selected macros (for batch operations)
   */
  getSelectedMacros() {
    const checkboxes = document.querySelectorAll('.macro-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.dataset.macroId);
  }

  /**
   * Run selected macros
   */
  async runSelectedMacros() {
    const selectedIds = this.getSelectedMacros();

    if (selectedIds.length === 0) {
      this._emitEvent('selection-error', { error: '선택된 매크로가 없습니다' });
      return;
    }

    for (const macroId of selectedIds) {
      await this.runMacro(macroId);
    }
  }

  /**
   * Delete selected macros
   */
  async deleteSelectedMacros() {
    const selectedIds = this.getSelectedMacros();

    if (selectedIds.length === 0) {
      this._emitEvent('selection-error', { error: '선택된 매크로가 없습니다' });
      return;
    }

    for (const macroId of selectedIds) {
      await this.deleteMacro(macroId);
    }
  }

  /**
   * Toggle select all macros
   */
  toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('select-all-macros');
    const checkboxes = document.querySelectorAll('.macro-checkbox');

    if (selectAllCheckbox) {
      const isChecked = selectAllCheckbox.checked;
      checkboxes.forEach(cb => {
        cb.checked = isChecked;
      });
    }
  }

  /**
   * Emit custom event
   */
  _emitEvent(eventName, detail = {}) {
    const event = new CustomEvent(`macro-panel:${eventName}`, { detail });
    document.dispatchEvent(event);
  }

  /**
   * Cleanup component
   */
  cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

// Expose class globally
window.MacroPanel = MacroPanel;
