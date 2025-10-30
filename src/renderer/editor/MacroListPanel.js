/**
 * Macro List Panel
 * 좌측 매크로 목록 패널
 */

class MacroListPanel {
  constructor(macroStore, editor) {
    this.macroStore = macroStore;
    this.editor = editor;

    this.container = null;
    this.searchQuery = '';
    this.sortBy = 'recent'; // recent, name, actions
    this.selectedMacroId = null;
  }

  /**
   * Initialize panel
   */
  init() {
    this.container = document.getElementById('macro-list-items');
    console.log('[MacroListPanel] Initialized');
  }

  /**
   * Load macros from store
   */
  async loadMacros() {
    try {
      // Use existing MacroPanel to load via IPC
      await this.editor.macroPanel.loadMacros();

      // Get macros from store
      const macros = this.macroStore.get('macros');
      console.log('[MacroListPanel] Loaded', macros.length, 'macros');

      // Render list
      this.render();
    } catch (error) {
      console.error('[MacroListPanel] Error loading macros:', error);
    }
  }

  /**
   * Render macro list
   */
  render() {
    const macros = this._getFilteredMacros();

    if (macros.length === 0) {
      this.container.innerHTML = `
        <div class="editor-empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-title">매크로가 없습니다</div>
          <div class="empty-description">새 매크로를 만들어 시작하세요</div>
        </div>
      `;
      return;
    }

    this.container.innerHTML = macros.map(macro => this._renderMacroItem(macro)).join('');

    // Add event listeners
    this._attachEventListeners();
  }

  /**
   * Render a single macro item
   */
  _renderMacroItem(macro) {
    const isSelected = this.selectedMacroId === macro.id;
    const actionCount = macro.actions ? macro.actions.length : 0;
    const createdDate = macro.createdAt ? new Date(macro.createdAt).toLocaleDateString() : '';

    return `
      <div class="macro-item ${isSelected ? 'selected' : ''}" data-macro-id="${macro.id}">
        <div class="macro-item-header">
          <div class="macro-item-icon">📋</div>
          <div class="macro-item-info">
            <div class="macro-item-name">${this._escapeHtml(macro.name)}</div>
            <div class="macro-item-meta">
              <span class="macro-item-count">${actionCount}개 액션</span>
              ${createdDate ? `<span class="macro-item-date">${createdDate}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="macro-item-actions">
          <button class="macro-action-btn" data-action="run" title="실행">
            <span>▶</span>
          </button>
          <button class="macro-action-btn" data-action="edit" title="편집">
            <span>✏️</span>
          </button>
          <button class="macro-action-btn" data-action="duplicate" title="복제">
            <span>📋</span>
          </button>
          <button class="macro-action-btn btn-danger" data-action="delete" title="삭제">
            <span>🗑️</span>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Get filtered macros based on search query
   */
  _getFilteredMacros() {
    let macros = [...this.macroStore.get('macros')];

    // Filter by search query
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      macros = macros.filter(m => m.name.toLowerCase().includes(query));
    }

    // Sort macros
    switch (this.sortBy) {
      case 'name':
        macros.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'actions':
        macros.sort((a, b) => (b.actions?.length || 0) - (a.actions?.length || 0));
        break;
      case 'recent':
      default:
        macros.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        break;
    }

    return macros;
  }

  /**
   * Attach event listeners to macro items
   */
  _attachEventListeners() {
    // Click on macro item (select)
    this.container.querySelectorAll('.macro-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.macro-action-btn')) return; // Ignore button clicks

        const macroId = item.dataset.macroId;
        this.selectMacro(macroId);
      });
    });

    // Action buttons
    this.container.querySelectorAll('.macro-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();

        const macroId = btn.closest('.macro-item').dataset.macroId;
        const action = btn.dataset.action;

        switch (action) {
          case 'run':
            this.runMacro(macroId);
            break;
          case 'edit':
            this.editMacro(macroId);
            break;
          case 'duplicate':
            this.duplicateMacro(macroId);
            break;
          case 'delete':
            this.deleteMacro(macroId);
            break;
        }
      });
    });
  }

  /**
   * Select a macro
   */
  selectMacro(macroId) {
    this.selectedMacroId = macroId;
    const macro = this.macroStore.getMacroById(macroId);

    if (macro) {
      console.log('[MacroListPanel] Selected macro:', macro.name);

      // Dispatch event
      document.dispatchEvent(new CustomEvent('macro-selected', {
        detail: { macro }
      }));

      // Re-render to update selection
      this.render();
    }
  }

  /**
   * Run a macro
   */
  async runMacro(macroId) {
    console.log('[MacroListPanel] Running macro:', macroId);

    // Dispatch event
    document.dispatchEvent(new CustomEvent('macro-list:macro-run', {
      detail: { macroId }
    }));
  }

  /**
   * Edit a macro
   */
  editMacro(macroId) {
    console.log('[MacroListPanel] Editing macro:', macroId);

    const macro = this.macroStore.getMacroById(macroId);
    if (!macro) return;

    // Select the macro
    this.selectMacro(macroId);

    // Enable edit mode
    this.macroStore.setEditMode(true, macroId);
  }

  /**
   * Duplicate a macro
   */
  async duplicateMacro(macroId) {
    const macro = this.macroStore.getMacroById(macroId);
    if (!macro) return;

    const newName = prompt('새 매크로 이름:', `${macro.name} (사본)`);
    if (!newName) return;

    try {
      // Create new macro with same actions
      const newMacro = {
        id: `macro_${Date.now()}`,
        name: newName,
        actions: [...macro.actions],
        createdAt: new Date().toISOString()
      };

      // Save via IPC
      const result = await this.editor.api.macro.save(newMacro);

      if (result.success) {
        console.log('[MacroListPanel] Macro duplicated:', newName);
        this.macroStore.addMacro(newMacro);
        this.render();
      } else {
        alert('매크로 복제 실패: ' + result.error);
      }
    } catch (error) {
      console.error('[MacroListPanel] Error duplicating macro:', error);
      alert('매크로 복제 중 오류가 발생했습니다.');
    }
  }

  /**
   * Delete a macro
   */
  async deleteMacro(macroId) {
    const macro = this.macroStore.getMacroById(macroId);
    if (!macro) return;

    if (!confirm(`"${macro.name}" 매크로를 삭제하시겠습니까?`)) return;

    try {
      // Delete via IPC
      const result = await this.editor.api.macro.delete(macroId);

      if (result.success) {
        console.log('[MacroListPanel] Macro deleted:', macro.name);
        this.macroStore.removeMacro(macroId);

        // Clear selection if deleted macro was selected
        if (this.selectedMacroId === macroId) {
          this.selectedMacroId = null;
          this.editor.actionStore.clearActions();
        }

        this.render();
      } else {
        alert('매크로 삭제 실패: ' + result.error);
      }
    } catch (error) {
      console.error('[MacroListPanel] Error deleting macro:', error);
      alert('매크로 삭제 중 오류가 발생했습니다.');
    }
  }

  /**
   * Create a new macro
   */
  createNewMacro() {
    const name = prompt('새 매크로 이름:');
    if (!name) return;

    console.log('[MacroListPanel] Creating new macro:', name);

    // Clear current actions
    this.editor.actionStore.clearActions();

    // Create temporary macro in store
    const newMacro = {
      id: `macro_${Date.now()}`,
      name,
      actions: [],
      createdAt: new Date().toISOString()
    };

    // Select the new macro
    this.selectedMacroId = newMacro.id;
    this.editor.currentMacro = newMacro;

    // Add to store (temporarily, will be saved when user clicks save)
    this.macroStore.addMacro(newMacro);
    this.render();

    alert(`"${name}" 매크로가 생성되었습니다.\n액션을 추가하고 저장 버튼을 눌러주세요.`);
  }

  /**
   * Search macros
   */
  search(query) {
    this.searchQuery = query.trim();
    this.render();
  }

  /**
   * Refresh macro list
   */
  async refresh() {
    console.log('[MacroListPanel] Refreshing...');
    await this.loadMacros();
  }

  /**
   * Escape HTML to prevent XSS
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Styling for macro items (add to CSS)
const style = document.createElement('style');
style.textContent = `
  .macro-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    margin-bottom: 8px;
    background: var(--editor-bg-tertiary);
    border: 1px solid var(--editor-border);
    border-radius: 6px;
    cursor: pointer;
    transition: var(--editor-transition);
  }

  .macro-item:hover {
    background: var(--editor-bg-hover);
    border-color: var(--editor-border-light);
  }

  .macro-item.selected {
    background: rgba(37, 99, 235, 0.15);
    border-color: var(--editor-accent-blue);
    box-shadow: 0 0 0 1px var(--editor-accent-blue);
  }

  .macro-item-header {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .macro-item-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .macro-item-info {
    flex: 1;
    min-width: 0;
  }

  .macro-item-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--editor-text-primary);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .macro-item-meta {
    display: flex;
    gap: 8px;
    font-size: 11px;
    color: var(--editor-text-tertiary);
  }

  .macro-item-count {
    padding: 2px 6px;
    background: var(--editor-bg-secondary);
    border-radius: 3px;
  }

  .macro-item-actions {
    display: flex;
    gap: 4px;
    padding-top: 4px;
    border-top: 1px solid var(--editor-border);
  }

  .macro-action-btn {
    flex: 1;
    padding: 6px;
    font-size: 14px;
    background: var(--editor-bg-secondary);
    border: 1px solid var(--editor-border);
    border-radius: 4px;
    color: var(--editor-text-tertiary);
    cursor: pointer;
    transition: var(--editor-transition);
  }

  .macro-action-btn:hover {
    background: var(--editor-bg-hover);
    color: var(--editor-text-primary);
    border-color: var(--editor-border-light);
  }

  .macro-action-btn.btn-danger:hover {
    background: var(--editor-accent-red);
    color: white;
    border-color: var(--editor-accent-red);
  }
`;
document.head.appendChild(style);

// Expose globally
window.MacroListPanel = MacroListPanel;
