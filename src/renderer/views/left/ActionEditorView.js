/**
 * ActionEditorView - Displays and edits scenario actions
 * Shows action sequence with drag-and-drop support
 */
class ActionEditorView extends BaseView {
    constructor(options = {}) {
        super(options);

        // View-specific state
        this.state = {
            scenarioKey: null,
            scenarioName: '',
            scenarioDescription: '',
            actions: [],
            selectedActionId: null,
            expandedActionId: null,
            expandedConditionId: null,
            isRunning: false,
            hasUnsavedChanges: false
        };

        // Reference to app for callbacks and services
        this.app = options.app || window.macroApp;

        // Drag state
        this.draggedActionId = null;
        this.draggedCondition = null;
    }

    // ============================================
    // Data Management
    // ============================================

    /**
     * Load scenario for editing
     * @param {string} key - Scenario key
     */
    loadScenario(key) {
        const registry = JSON.parse(localStorage.getItem('scenario_registry') || '{}');
        const scenarioData = registry[key];

        if (!scenarioData) {
            console.error(`Scenario not found: ${key}`);
            return false;
        }

        // Load scenario data from localStorage
        const scenarioContent = localStorage.getItem(`scenario_${key}`);
        let actions = [];

        if (scenarioContent) {
            try {
                const parsed = JSON.parse(scenarioContent);
                actions = parsed.actions || [];
            } catch (e) {
                console.error('Failed to parse scenario:', e);
            }
        }

        this.setState({
            scenarioKey: key,
            scenarioName: scenarioData.name || scenarioData.filename,
            scenarioDescription: scenarioData.description || '',
            actions: actions,
            hasUnsavedChanges: false
        });

        return true;
    }

    /**
     * Create new scenario
     */
    createNew(name = 'New Scenario') {
        this.setState({
            scenarioKey: null,
            scenarioName: name,
            scenarioDescription: '',
            actions: [],
            selectedActionId: null,
            expandedActionId: null,
            hasUnsavedChanges: false
        });
    }

    /**
     * Calculate action depths for nested display
     */
    calculateDepths() {
        const actions = this.state.actions;
        let depth = 0;
        const result = [];

        for (const action of actions) {
            // Decrease depth for end blocks
            if (['end-if', 'end-loop', 'end-while', 'else'].includes(action.type)) {
                depth = Math.max(0, depth - 1);
            }

            result.push({ ...action, depth });

            // Increase depth after if/loop/while, reset for else
            if (['if', 'loop', 'while'].includes(action.type)) {
                depth++;
            } else if (action.type === 'else') {
                depth++;
            }
        }

        return result;
    }

    // ============================================
    // Action Operations
    // ============================================

    addAction(action) {
        const actions = [...this.state.actions, action];
        this.setState({ actions, hasUnsavedChanges: true });
        this.emit('action:added', { action });
    }

    updateAction(actionId, updates) {
        const actions = this.state.actions.map(a =>
            a.id === actionId ? { ...a, ...updates } : a
        );
        this.setState({ actions, hasUnsavedChanges: true });
        this.emit('action:updated', { actionId, updates });
    }

    deleteAction(actionId) {
        const actions = this.state.actions.filter(a => a.id !== actionId);
        const updates = { actions, hasUnsavedChanges: true };

        // Clear selection if deleted action was selected
        if (this.state.selectedActionId === actionId) {
            updates.selectedActionId = null;
        }
        if (this.state.expandedActionId === actionId) {
            updates.expandedActionId = null;
        }

        this.setState(updates);
        this.emit('action:deleted', { actionId });
    }

    moveAction(actionId, direction) {
        const actions = [...this.state.actions];
        const index = actions.findIndex(a => a.id === actionId);

        if (index === -1) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= actions.length) return;

        // Swap actions
        [actions[index], actions[newIndex]] = [actions[newIndex], actions[index]];
        this.setState({ actions, hasUnsavedChanges: true });
        this.emit('action:moved', { actionId, direction });
    }

    selectAction(actionId) {
        this.setState({ selectedActionId: actionId }, false);
        this.emit('action:selected', { actionId });

        // Update UI without full re-render
        this.$$('.action-block').forEach(block => {
            const id = block.closest('[data-action-id]')?.dataset.actionId;
            block.classList.toggle('selected', id === actionId);
        });
    }

    toggleActionSettings(actionId) {
        const newExpandedId = this.state.expandedActionId === actionId ? null : actionId;
        this.setState({ expandedActionId: newExpandedId });
    }

    // ============================================
    // Lifecycle Hooks
    // ============================================

    onMounted() {
        // Subscribe to events
        this.subscribe('action:add-requested', this.onAddActionRequested);
        this.subscribe('execution:start', this.onExecutionStart);
        this.subscribe('execution:complete', this.onExecutionComplete);
    }

    onActivate() {
        // Emit event for toolbar/header updates
        this.emit('view:action-editor-activated', {
            scenarioKey: this.state.scenarioKey,
            scenarioName: this.state.scenarioName
        });
    }

    onDeactivate() {
        // Check for unsaved changes
        if (this.state.hasUnsavedChanges) {
            this.emit('view:unsaved-changes', {
                scenarioKey: this.state.scenarioKey
            });
        }
    }

    // ============================================
    // Template
    // ============================================

    template() {
        const { actions, scenarioName, scenarioDescription } = this.state;

        return `
            <!-- Scenario Info -->
            <div class="scenario-info-container" style="padding-bottom: 20px; border-bottom: 1px solid var(--color-border); margin-bottom: 20px;">
                <h3 class="scenario-title" style="font-size: 1.25rem; font-weight: 600; color: var(--slate-900); margin-bottom: 16px;">
                    ${this.escapeHtml(scenarioName)}
                </h3>

                <div class="scenario-fields">
                    <label class="setting-label" style="display: block; margin-bottom: 8px;">Scenario Name</label>
                    <input type="text"
                           class="scenario-name-input w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                           placeholder="Scenario name"
                           value="${this.escapeHtml(scenarioName)}">

                    <label class="setting-label" style="display: block; margin-top: 12px; margin-bottom: 8px;">Description (optional)</label>
                    <input type="text"
                           class="scenario-description-input w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                           placeholder="Scenario description"
                           value="${this.escapeHtml(scenarioDescription)}">
                </div>
            </div>

            <!-- Save Buttons -->
            <div class="save-buttons-row" style="padding-bottom: 16px; border-bottom: 1px solid var(--color-border); margin-bottom: 16px;">
                <div class="flex gap-2">
                    <button class="btn-primary btn-sm flex-1 btn-save" ${!this.state.hasUnsavedChanges ? 'disabled' : ''}>
                        <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
                        </svg>
                        Save
                    </button>
                    <button class="btn-outline btn-sm flex-1 btn-save-as">
                        <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                        </svg>
                        Save As
                    </button>
                </div>
            </div>

            <!-- Action Sequence -->
            <div class="action-sequence-container"
                 ondragover="event.preventDefault()"
                 ondrop="this.closest('.action-editor-view')?.dispatchEvent(new CustomEvent('container-drop', { detail: event }))"
                 style="min-height: 100px;">
                ${actions.length === 0 ? this.emptyTemplate() : this.actionsTemplate()}
            </div>
        `;
    }

    emptyTemplate() {
        return `
            <div class="empty-state" style="display: flex;">
                <svg class="empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                <p class="empty-title">Scenario is empty</p>
                <p class="empty-description">Select an action from the right panel to begin</p>
            </div>
        `;
    }

    actionsTemplate() {
        const actionsWithDepth = this.calculateDepths();
        return `
            <div class="action-list space-y-2">
                ${actionsWithDepth.map((action, index) =>
                    this.actionBlockTemplate(action, index, actionsWithDepth.length)
                ).join('')}
            </div>
        `;
    }

    actionBlockTemplate(action, index, total) {
        const config = this.getActionConfig(action.type);
        const { selectedActionId, expandedActionId, isRunning } = this.state;

        const isSelected = selectedActionId === action.id;
        const isExpanded = expandedActionId === action.id;
        const isFirst = index === 0;
        const isLast = index === total - 1;
        const depth = action.depth || 0;

        const description = this.getActionDescription(action);
        const borderClass = isSelected ? config.borderClass : 'border-slate-200 hover:border-slate-300';
        const ringClass = isRunning && isSelected ? 'ring-4 ring-blue-400 ring-opacity-50 animate-pulse' : '';

        return `
            <div class="action-wrapper"
                 style="margin-left: ${depth * 24}px; position: relative;"
                 data-action-id="${action.id}">

                ${depth > 0 ? '<div class="depth-indicator" style="position: absolute; left: -12px; top: 0; bottom: 0; width: 2px; background-color: var(--slate-300);"></div>' : ''}
                ${!isLast ? `<div class="action-connector" style="left: ${24 + depth * 24}px;"></div>` : ''}

                <div class="action-block ${config.bgClass} border-2 ${borderClass} ${ringClass} ${isSelected ? 'shadow-lg' : ''} ${isExpanded ? 'expanded' : ''}"
                     style="border-radius: var(--radius); cursor: pointer; transition: all 0.2s; position: relative;">

                    <div class="action-header p-4">
                        <div class="flex items-center gap-3">
                            <!-- Drag Handle -->
                            <div class="drag-handle flex-shrink-0"
                                 draggable="true"
                                 data-action-id="${action.id}"
                                 style="cursor: grab; padding: 0.25rem; opacity: 0.3; transition: opacity 0.2s;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <circle cx="9" cy="5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="9" cy="19" r="2"/>
                                    <circle cx="15" cy="5" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="15" cy="19" r="2"/>
                                </svg>
                            </div>

                            <!-- Index Badge -->
                            <div class="index-badge flex-shrink-0 w-8 h-8 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center text-sm text-slate-700">
                                ${index + 1}
                            </div>

                            <!-- Icon -->
                            <div class="action-icon ${config.color} p-2 rounded-lg text-white flex-shrink-0 flex items-center justify-center" style="width: 2.5rem; height: 2.5rem;">
                                <div style="width: 1.25rem; height: 1.25rem;">${config.icon}</div>
                            </div>

                            <!-- Content -->
                            <div class="action-content flex-1 min-w-0">
                                <h3 class="action-type-label text-slate-900 mb-1">${config.label}</h3>
                                ${description ? `<p class="action-description text-sm text-slate-600 truncate">${description}</p>` : ''}
                            </div>

                            <!-- Action Buttons -->
                            <div class="action-buttons flex gap-1 flex-shrink-0">
                                ${this.actionButtonsTemplate(action, isFirst, isLast)}
                            </div>
                        </div>
                    </div>

                    <!-- Expandable Settings -->
                    ${isExpanded ? this.settingsPanelTemplate(action) : ''}
                </div>
            </div>
        `;
    }

    actionButtonsTemplate(action, isFirst, isLast) {
        const hasSettings = !['end-if', 'end-loop', 'end-while', 'else'].includes(action.type);

        return `
            ${hasSettings ? `
                <button class="btn-ghost h-8 w-8 p-0 btn-settings" data-action-id="${action.id}">
                    <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                </button>
            ` : ''}
            <button class="btn-ghost h-8 w-8 p-0 btn-move-up" data-action-id="${action.id}" ${isFirst ? 'disabled' : ''}>
                <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                </svg>
            </button>
            <button class="btn-ghost h-8 w-8 p-0 btn-move-down" data-action-id="${action.id}" ${isLast ? 'disabled' : ''}>
                <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            </button>
            <button class="btn-ghost h-8 w-8 p-0 btn-delete text-red-500 hover:text-red-600 hover:bg-red-50" data-action-id="${action.id}">
                <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
            </button>
        `;
    }

    settingsPanelTemplate(action) {
        // Delegate to ActionSettingsBuilder if available
        if (this.app && this.app.getSettingsHTML) {
            return `
                <div class="settings-panel border-t border-slate-200 bg-white px-8 py-5"
                     style="border-bottom-left-radius: var(--radius); border-bottom-right-radius: var(--radius); overflow: hidden;">
                    ${this.app.getSettingsHTML(action)}
                </div>
            `;
        }

        return `
            <div class="settings-panel border-t border-slate-200 bg-white px-8 py-5">
                <p class="text-sm text-slate-500">Settings panel</p>
            </div>
        `;
    }

    // ============================================
    // Event Binding
    // ============================================

    bindEvents() {
        // Scenario name input
        this.addEvent(this.$('.scenario-name-input'), 'input', this.onNameInput);
        this.addEvent(this.$('.scenario-description-input'), 'input', this.onDescriptionInput);

        // Save buttons
        this.delegate('.btn-save', 'click', this.onSaveClick);
        this.delegate('.btn-save-as', 'click', this.onSaveAsClick);

        // Action block clicks
        this.delegate('.action-block', 'click', this.onActionBlockClick);

        // Action buttons
        this.delegate('.btn-settings', 'click', this.onSettingsClick);
        this.delegate('.btn-move-up', 'click', this.onMoveUpClick);
        this.delegate('.btn-move-down', 'click', this.onMoveDownClick);
        this.delegate('.btn-delete', 'click', this.onDeleteClick);

        // Drag and drop
        this.delegate('.drag-handle', 'dragstart', this.onDragStart);
        this.delegate('.drag-handle', 'dragend', this.onDragEnd);
        this.delegate('.action-wrapper', 'dragover', this.onDragOver);
        this.delegate('.action-wrapper', 'drop', this.onDrop);
    }

    // ============================================
    // Event Handlers
    // ============================================

    onNameInput(e) {
        this.setState({
            scenarioName: e.target.value,
            hasUnsavedChanges: true
        }, false);
    }

    onDescriptionInput(e) {
        this.setState({
            scenarioDescription: e.target.value,
            hasUnsavedChanges: true
        }, false);
    }

    onSaveClick(e, target) {
        e.stopPropagation();
        this.emit('scenario:save-requested', {
            key: this.state.scenarioKey,
            name: this.state.scenarioName,
            description: this.state.scenarioDescription,
            actions: this.state.actions
        });

        // Also call app method for backward compatibility
        if (this.app && this.app.saveMacro) {
            this.app.saveMacro();
        }
    }

    onSaveAsClick(e, target) {
        e.stopPropagation();
        this.emit('scenario:save-as-requested', {
            name: this.state.scenarioName,
            description: this.state.scenarioDescription,
            actions: this.state.actions
        });
    }

    onActionBlockClick(e, target) {
        const actionId = target.closest('[data-action-id]')?.dataset.actionId;
        if (actionId) {
            this.selectAction(actionId);
        }
    }

    onSettingsClick(e, target) {
        e.stopPropagation();
        const actionId = target.dataset.actionId;
        if (actionId) {
            this.toggleActionSettings(actionId);
        }
    }

    onMoveUpClick(e, target) {
        e.stopPropagation();
        const actionId = target.dataset.actionId;
        if (actionId) {
            this.moveAction(actionId, 'up');
        }
    }

    onMoveDownClick(e, target) {
        e.stopPropagation();
        const actionId = target.dataset.actionId;
        if (actionId) {
            this.moveAction(actionId, 'down');
        }
    }

    onDeleteClick(e, target) {
        e.stopPropagation();
        const actionId = target.dataset.actionId;
        if (actionId) {
            this.deleteAction(actionId);
        }
    }

    onDragStart(e, target) {
        const actionId = target.dataset.actionId;
        if (actionId) {
            this.draggedActionId = actionId;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', actionId);
            target.closest('.action-wrapper')?.classList.add('dragging');
        }
    }

    onDragEnd(e, target) {
        this.draggedActionId = null;
        this.$$('.dragging').forEach(el => el.classList.remove('dragging'));
        this.$$('.drag-over').forEach(el => el.classList.remove('drag-over'));
    }

    onDragOver(e, target) {
        e.preventDefault();
        if (!this.draggedActionId) return;

        target.classList.add('drag-over');
    }

    onDrop(e, target) {
        e.preventDefault();
        const targetId = target.dataset.actionId;
        if (!this.draggedActionId || !targetId || this.draggedActionId === targetId) return;

        // Reorder actions
        const actions = [...this.state.actions];
        const draggedIndex = actions.findIndex(a => a.id === this.draggedActionId);
        const targetIndex = actions.findIndex(a => a.id === targetId);

        if (draggedIndex !== -1 && targetIndex !== -1) {
            const [draggedAction] = actions.splice(draggedIndex, 1);
            actions.splice(targetIndex, 0, draggedAction);
            this.setState({ actions, hasUnsavedChanges: true });
        }

        this.draggedActionId = null;
        target.classList.remove('drag-over');
    }

    // EventBus Handlers
    onAddActionRequested(data) {
        if (data.action) {
            this.addAction(data.action);
        }
    }

    onExecutionStart(data) {
        this.setState({ isRunning: true }, false);
    }

    onExecutionComplete(data) {
        this.setState({ isRunning: false });
    }

    // ============================================
    // Helper Methods
    // ============================================

    getActionConfig(type) {
        // Try to get from ActionConfigProvider first
        if (window.ActionConfigProvider) {
            return window.ActionConfigProvider.getConfig(type);
        }

        // Fallback to app's config
        if (this.app && this.app.getActionConfig) {
            return this.app.getActionConfig(type);
        }

        // Default fallback
        return {
            label: type,
            icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>',
            color: 'bg-gray-500',
            bgClass: 'bg-gray-50',
            borderClass: 'border-gray-500'
        };
    }

    getActionDescription(action) {
        if (this.app && this.app.getActionDescription) {
            return this.app.getActionDescription(action);
        }

        // Simple fallback
        if (action.type === 'tap' || action.type === 'long-press') {
            return `(${action.x}, ${action.y})`;
        }
        if (action.type === 'wait') {
            return `${action.duration || 1000}ms`;
        }
        return '';
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================
    // Public Methods
    // ============================================

    getActions() {
        return [...this.state.actions];
    }

    hasChanges() {
        return this.state.hasUnsavedChanges;
    }

    markSaved() {
        this.setState({ hasUnsavedChanges: false }, false);
        const saveBtn = this.$('.btn-save');
        if (saveBtn) saveBtn.disabled = true;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ActionEditorView;
}

if (typeof window !== 'undefined') {
    window.ActionEditorView = ActionEditorView;
}
