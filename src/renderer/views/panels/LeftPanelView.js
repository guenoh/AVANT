/**
 * LeftPanelView - Container for left panel views
 * Manages switching between ScenarioListView and ActionEditorView
 * Handles header and toolbar updates based on active view
 */
class LeftPanelView extends BaseView {
    constructor(options = {}) {
        super(options);

        this.viewManager = options.viewManager || window.viewManager;
        this.app = options.app || window.macroApp;

        // Current view state
        this.state = {
            currentView: 'scenario-list',  // 'scenario-list' | 'action-editor'
            isDeviceConnected: false
        };

        // Child views
        this.scenarioListView = null;
        this.actionEditorView = null;
    }

    // ============================================
    // Lifecycle
    // ============================================

    onBeforeMount() {
        // Create child views
        this.scenarioListView = new ScenarioListView({
            eventBus: this.eventBus,
            app: this.app
        });

        this.actionEditorView = new ActionEditorView({
            eventBus: this.eventBus,
            app: this.app
        });
    }

    onMounted() {
        // Subscribe to events
        this.subscribe('scenario:edit-requested', this.onEditScenario);
        this.subscribe('view:back-to-list', this.onBackToList);
        this.subscribe('device:status-changed', this.onDeviceStatusChanged);
        this.subscribe('scenario:saved', this.onScenarioSaved);

        // Show initial view
        this.showScenarioList();

        // Setup toolbar button events
        this.setupToolbarEvents();
    }

    onUnmounted() {
        // Unmount child views
        if (this.scenarioListView) {
            this.scenarioListView.unmount();
        }
        if (this.actionEditorView) {
            this.actionEditorView.unmount();
        }
    }

    // ============================================
    // Template
    // ============================================

    template() {
        const { currentView } = this.state;

        return `
            <!-- Panel Header -->
            <div class="panel-header" id="left-panel-header">
                ${currentView === 'scenario-list' ? this.listHeaderTemplate() : this.editorHeaderTemplate()}
            </div>

            <!-- Panel Toolbar -->
            <div class="panel-toolbar" id="left-panel-toolbar">
                ${currentView === 'scenario-list' ? this.listToolbarTemplate() : this.editorToolbarTemplate()}
            </div>

            <!-- Panel Content -->
            <div class="panel-content" id="left-panel-content">
                <!-- Content will be mounted by child views -->
            </div>
        `;
    }

    listHeaderTemplate() {
        return `
            <div>
                <h2 class="panel-title">Scenario List</h2>
                <p class="panel-subtitle">Select a scenario to edit or run</p>
            </div>
        `;
    }

    editorHeaderTemplate() {
        return `
            <div>
                <h2 class="panel-title">Scenario Editor</h2>
                <p class="panel-subtitle">Add actions to build your scenario</p>
            </div>
        `;
    }

    listToolbarTemplate() {
        const { isDeviceConnected } = this.state;
        const disabledAttr = isDeviceConnected ? '' : 'disabled';

        return `
            <div class="flex items-center gap-2">
                <button class="btn-outline btn-sm" id="btn-new-scenario">
                    <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                    New Scenario
                </button>
                <button class="btn-outline btn-sm" id="btn-select-all">
                    Select All
                </button>
            </div>

            <div class="flex items-center gap-2">
                <button class="btn-primary btn-sm" id="btn-run-selected" ${disabledAttr}>
                    <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Run Selected
                </button>
                <button class="btn-danger btn-sm" id="btn-delete-selected">
                    Delete Selected
                </button>
            </div>
        `;
    }

    editorToolbarTemplate() {
        return `
            <div class="flex items-center gap-2">
                <button class="btn-outline btn-sm" id="btn-back-to-list">
                    <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                    </svg>
                    Back to List
                </button>
            </div>

            <div class="flex items-center gap-2">
                <button class="btn-outline btn-sm" id="btn-save-macro">
                    <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
                    </svg>
                    Save
                </button>

                <label class="toolbar-label">Delay:</label>
                <select id="toolbar-delay-select" class="btn-outline btn-sm" style="min-width: 90px;">
                    <option value="0">None</option>
                    <option value="100">100ms</option>
                    <option value="300" selected>300ms</option>
                    <option value="500">500ms</option>
                    <option value="1000">1s</option>
                </select>

                <button class="btn-primary btn-sm" id="btn-run-macro">
                    <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Run
                </button>
            </div>
        `;
    }

    // ============================================
    // View Switching
    // ============================================

    showScenarioList(skipUnsavedCheck = false) {
        // Check for unsaved changes
        if (!skipUnsavedCheck && this.actionEditorView && this.actionEditorView.hasChanges()) {
            const confirmed = confirm('You have unsaved changes. Discard them?');
            if (!confirmed) return false;
        }

        this.setState({ currentView: 'scenario-list' });

        // Mount scenario list view
        const contentContainer = this.$('#left-panel-content');
        if (contentContainer) {
            if (this.actionEditorView.isMounted()) {
                this.actionEditorView.unmount();
            }
            this.scenarioListView.mount(contentContainer);
        }

        // Update action panel visibility
        this.toggleActionPanel(false);

        return true;
    }

    showActionEditor(scenarioKey = null) {
        this.setState({ currentView: 'action-editor' });

        // Mount action editor view
        const contentContainer = this.$('#left-panel-content');
        if (contentContainer) {
            if (this.scenarioListView.isMounted()) {
                this.scenarioListView.unmount();
            }

            // Load scenario if key provided
            if (scenarioKey) {
                this.actionEditorView.loadScenario(scenarioKey);
            } else {
                this.actionEditorView.createNew();
            }

            this.actionEditorView.mount(contentContainer);
        }

        // Show action panel
        this.toggleActionPanel(true);
    }

    toggleActionPanel(show) {
        const actionPanel = document.getElementById('action-panel');
        if (actionPanel) {
            if (show) {
                actionPanel.classList.remove('hidden');
            } else {
                actionPanel.classList.add('hidden');
            }
        }
    }

    // ============================================
    // Event Binding
    // ============================================

    bindEvents() {
        // Delegate toolbar button clicks
        this.delegate('#btn-new-scenario', 'click', this.onNewScenario);
        // Note: btn-back-to-list is handled by macro-builder-app.js to avoid duplicate unsaved check
        this.delegate('#btn-select-all', 'click', this.onSelectAll);
        this.delegate('#btn-run-selected', 'click', this.onRunSelected);
        this.delegate('#btn-delete-selected', 'click', this.onDeleteSelected);
        this.delegate('#btn-run-macro', 'click', this.onRunMacro);
        this.delegate('#btn-save-macro', 'click', this.onSaveMacro);
    }

    setupToolbarEvents() {
        // Additional toolbar setup if needed
    }

    // ============================================
    // Event Handlers
    // ============================================

    onNewScenario(e) {
        e.stopPropagation();
        this.showActionEditor(null);
        this.emit('scenario:new-created');
    }

    onBackToListClick(e) {
        e.stopPropagation();
        this.showScenarioList();
    }

    onBackToList(data) {
        this.showScenarioList(data?.skipUnsavedCheck);
    }

    onEditScenario(data) {
        if (data.key) {
            this.showActionEditor(data.key);
        }
    }

    onSelectAll(e) {
        e.stopPropagation();
        if (this.scenarioListView) {
            this.scenarioListView.toggleSelectAll();
        }
    }

    onRunSelected(e) {
        e.stopPropagation();
        if (this.scenarioListView) {
            const selectedKeys = this.scenarioListView.getSelectedKeys();
            if (selectedKeys.length > 0) {
                this.emit('scenario:run-multiple-requested', { keys: selectedKeys });

                // Call app method for backward compatibility
                if (this.app && this.app.runSelectedScenarios) {
                    this.app.runSelectedScenarios();
                }
            }
        }
    }

    onDeleteSelected(e) {
        e.stopPropagation();
        if (this.scenarioListView) {
            const selectedScenarios = this.scenarioListView.getSelectedScenarios();
            if (selectedScenarios.length > 0) {
                const confirmed = confirm(`Delete ${selectedScenarios.length} scenario(s)?`);
                if (confirmed) {
                    this.emit('scenario:delete-multiple-requested', {
                        scenarios: selectedScenarios
                    });

                    // Call app method for backward compatibility
                    if (this.app && this.app.deleteSelectedScenarios) {
                        this.app.deleteSelectedScenarios();
                    }
                }
            }
        }
    }

    onRunMacro(e) {
        e.stopPropagation();
        if (this.actionEditorView) {
            const actions = this.actionEditorView.getActions();
            this.emit('macro:run-requested', { actions });

            // Call app method for backward compatibility
            if (this.app && this.app.runMacro) {
                this.app.runMacro();
            }
        }
    }

    onDeviceStatusChanged(data) {
        this.setState({ isDeviceConnected: data.connected });
    }

    onScenarioSaved(data) {
        if (this.actionEditorView) {
            this.actionEditorView.markSaved();
        }
    }

    onSaveMacro(e) {
        e.stopPropagation();
        if (this.actionEditorView) {
            const scenarioData = this.actionEditorView.getCurrentScenario();
            this.emit('scenario:save-requested', scenarioData);

            // Call app method for backward compatibility
            if (this.app && this.app.saveMacro) {
                this.app.saveMacro();
            }
        }
    }

    // ============================================
    // Public Methods
    // ============================================

    getCurrentView() {
        return this.state.currentView;
    }

    getScenarioListView() {
        return this.scenarioListView;
    }

    getActionEditorView() {
        return this.actionEditorView;
    }

    refresh() {
        if (this.state.currentView === 'scenario-list' && this.scenarioListView) {
            this.scenarioListView.refresh();
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LeftPanelView;
}

if (typeof window !== 'undefined') {
    window.LeftPanelView = LeftPanelView;
}
