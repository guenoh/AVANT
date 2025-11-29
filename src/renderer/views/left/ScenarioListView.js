/**
 * ScenarioListView - Displays list of saved scenarios
 * Extends BaseView for lifecycle management
 */
class ScenarioListView extends BaseView {
    constructor(options = {}) {
        super(options);

        // View-specific state
        this.state = {
            scenarios: [],
            selectedKeys: new Set(),
            runningScenarios: new Map(),  // key -> { status, progress }
            isDeviceConnected: false,
            isAllSelected: false
        };

        // Reference to app for callbacks
        this.app = options.app || window.macroApp;
    }

    // ============================================
    // Data Loading
    // ============================================

    /**
     * Load scenarios from localStorage
     */
    loadScenarios() {
        const registry = JSON.parse(localStorage.getItem('scenario_registry') || '{}');
        const results = JSON.parse(localStorage.getItem('scenario_execution_results') || '{}');

        const scenarios = Object.entries(registry).map(([key, registryData]) => {
            const executionResult = results[key];
            return {
                key,
                name: registryData.name,
                filename: registryData.filename,
                description: registryData.description || '',
                savedAt: registryData.savedAt,
                actionsCount: registryData.actionsCount,
                status: executionResult ? executionResult.status : 'never_run',
                message: executionResult ? executionResult.message : 'Not executed',
                timestamp: executionResult ? executionResult.timestamp : registryData.savedAt
            };
        });

        // Sort by timestamp (newest first)
        scenarios.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return scenarios;
    }

    /**
     * Refresh scenario list
     */
    refresh() {
        const scenarios = this.loadScenarios();
        this.setState({ scenarios });
    }

    // ============================================
    // Lifecycle Hooks
    // ============================================

    onBeforeMount() {
        // Load scenarios before mounting
        const scenarios = this.loadScenarios();
        this.state.scenarios = scenarios;

        // Get device connection status from app
        if (this.app) {
            this.state.isDeviceConnected = this.app.isDeviceConnected;
            this.state.runningScenarios = this.app.runningScenarios || new Map();
        }
    }

    onMounted() {
        // Subscribe to events
        this.subscribe('device:status-changed', this.onDeviceStatusChanged);
        this.subscribe('scenario:execution-progress', this.onExecutionProgress);
        this.subscribe('scenario:execution-complete', this.onExecutionComplete);
    }

    onActivate() {
        // Refresh data when view becomes active
        this.refresh();

        // Emit event for toolbar/header updates
        this.emit('view:scenario-list-activated');
    }

    // ============================================
    // Template
    // ============================================

    template() {
        const { scenarios, isDeviceConnected } = this.state;

        if (scenarios.length === 0) {
            return this.emptyTemplate();
        }

        return `
            <div class="scenario-list-container px-6 py-4">
                ${scenarios.map(scenario => this.scenarioCardTemplate(scenario)).join('')}
            </div>
        `;
    }

    emptyTemplate() {
        return `
            <div class="empty-state" style="display: flex;">
                <svg class="empty-icon" style="width: 64px; height: 64px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
                    </path>
                </svg>
                <p class="empty-title">No saved scenarios</p>
                <p class="empty-description">Saved scenarios will appear here</p>
            </div>
        `;
    }

    scenarioCardTemplate(scenario) {
        const { isDeviceConnected, runningScenarios, selectedKeys } = this.state;

        const runningState = runningScenarios.get(scenario.key);
        const isRunning = runningState && runningState.status === 'running';
        const isSelected = selectedKeys.has(scenario.key);

        const statusDisplay = this.getStatusDisplay(scenario.status);
        const progressHTML = isRunning ? this.progressTemplate(runningState) : '';
        const disabledAttr = isDeviceConnected ? '' : 'disabled';

        return `
            <div class="action-card scenario-card ${isSelected ? 'selected' : ''}"
                 data-key="${scenario.key}"
                 style="margin-bottom: 12px; padding: 16px;">

                <!-- Title Row -->
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <input type="checkbox"
                           class="scenario-checkbox"
                           data-key="${scenario.key}"
                           data-filename="${scenario.filename}"
                           style="width: 16px; height: 16px; flex-shrink: 0;"
                           ${isRunning ? 'disabled' : ''}
                           ${isSelected ? 'checked' : ''}>

                    <div class="scenario-name-clickable"
                         data-key="${scenario.key}"
                         style="font-weight: 600; font-size: 15px; color: #1e293b; cursor: pointer; transition: all 0.2s; display: inline-block;">
                        ${this.escapeHtml(scenario.filename)}
                    </div>
                    <div style="flex: 1;"></div>
                </div>

                ${progressHTML}

                <!-- Action Row with Description -->
                <div style="display: flex; align-items: center; gap: 8px; padding-left: 28px;">
                    <div style="flex: 1; font-size: 14px; color: #64748b;">
                        ${this.escapeHtml(scenario.description)}
                    </div>
                    ${isRunning ? this.runningButtonTemplate(scenario) : this.actionButtonTemplate(scenario, statusDisplay, disabledAttr)}
                </div>
            </div>
        `;
    }

    progressTemplate(runningState) {
        if (!runningState.progress) return '';

        const { current, total } = runningState.progress;
        const progressText = total !== null
            ? `${current} / ${total}`
            : `${current} actions executed`;

        const progressBarHTML = total !== null
            ? `<div style="width: ${Math.round((current / total) * 100)}%; height: 100%; background: #2563eb; transition: width 0.3s;"></div>`
            : `<div style="width: 100%; height: 100%; background: linear-gradient(90deg, #2563eb 0%, #3b82f6 50%, #2563eb 100%); animation: progress-indeterminate 1.5s ease-in-out infinite;"></div>`;

        return `
            <div style="padding-left: 28px; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span style="font-size: 12px; color: #2563eb; font-weight: 500;">Running...</span>
                    <span style="font-size: 12px; color: #64748b;">${progressText}</span>
                </div>
                <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                    ${progressBarHTML}
                </div>
            </div>
        `;
    }

    runningButtonTemplate(scenario) {
        return `
            <button class="btn btn-sm btn-cancel-scenario"
                    data-key="${scenario.key}"
                    style="background: #dc2626; color: white; padding: 6px 12px;">
                Cancel
            </button>
        `;
    }

    actionButtonTemplate(scenario, statusDisplay, disabledAttr) {
        const buttonText = statusDisplay.color === '#16a34a' ? 'Run Again'
            : statusDisplay.color === '#dc2626' ? 'Retry'
            : 'Run';

        return `
            <button class="btn btn-sm btn-run-scenario"
                    data-key="${scenario.key}"
                    style="background: ${statusDisplay.color}; color: white; padding: 6px 12px;"
                    ${disabledAttr}>
                ${statusDisplay.icon} ${statusDisplay.text} - ${buttonText}
            </button>
        `;
    }

    // ============================================
    // Event Binding
    // ============================================

    bindEvents() {
        // Checkbox change
        this.delegate('.scenario-checkbox', 'change', this.onCheckboxChange);

        // Scenario name click (edit)
        this.delegate('.scenario-name-clickable', 'click', this.onScenarioNameClick);

        // Card click (toggle checkbox)
        this.delegate('.scenario-card', 'click', this.onCardClick);

        // Run button click
        this.delegate('.btn-run-scenario', 'click', this.onRunClick);

        // Cancel button click
        this.delegate('.btn-cancel-scenario', 'click', this.onCancelClick);
    }

    // ============================================
    // Event Handlers
    // ============================================

    onCheckboxChange(e, target) {
        const key = target.dataset.key;
        const selectedKeys = new Set(this.state.selectedKeys);

        if (target.checked) {
            selectedKeys.add(key);
        } else {
            selectedKeys.delete(key);
        }

        this.setState({ selectedKeys }, false);  // Don't re-render, just update state
        this.updateSelectAllState();
        this.emit('scenario:selection-changed', { selectedKeys: Array.from(selectedKeys) });
    }

    onScenarioNameClick(e, target) {
        e.stopPropagation();
        const key = target.dataset.key;
        if (key) {
            this.emit('scenario:edit-requested', { key });

            // Also call app method for backward compatibility
            if (this.app && this.app.editScenario) {
                this.app.editScenario(key);
            }
        }
    }

    onCardClick(e, target) {
        // Don't trigger if clicking on interactive elements
        if (e.target.tagName === 'BUTTON' ||
            e.target.tagName === 'INPUT' ||
            e.target.closest('button') ||
            e.target.closest('.scenario-name-clickable')) {
            return;
        }

        // Toggle checkbox
        const checkbox = target.querySelector('.scenario-checkbox');
        if (checkbox && !checkbox.disabled) {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    onRunClick(e, target) {
        e.stopPropagation();
        const key = target.dataset.key;
        if (key) {
            this.emit('scenario:run-requested', { key });

            // Also call app method for backward compatibility
            if (this.app && this.app.runSingleScenario) {
                this.app.runSingleScenario(key);
            }
        }
    }

    onCancelClick(e, target) {
        e.stopPropagation();
        const key = target.dataset.key;
        if (key) {
            this.emit('scenario:cancel-requested', { key });

            // Also call app method for backward compatibility
            if (this.app && this.app.cancelScenario) {
                this.app.cancelScenario(key);
            }
        }
    }

    // ============================================
    // EventBus Handlers
    // ============================================

    onDeviceStatusChanged(data) {
        this.setState({ isDeviceConnected: data.connected });
    }

    onExecutionProgress(data) {
        const runningScenarios = new Map(this.state.runningScenarios);
        runningScenarios.set(data.key, {
            status: 'running',
            progress: data.progress
        });
        this.setState({ runningScenarios });
    }

    onExecutionComplete(data) {
        const runningScenarios = new Map(this.state.runningScenarios);
        runningScenarios.delete(data.key);
        this.setState({ runningScenarios });

        // Refresh to show updated status
        this.refresh();
    }

    // ============================================
    // Selection Methods
    // ============================================

    selectAll() {
        const selectedKeys = new Set(this.state.scenarios.map(s => s.key));
        this.setState({ selectedKeys, isAllSelected: true });
        this.emit('scenario:selection-changed', { selectedKeys: Array.from(selectedKeys) });
    }

    deselectAll() {
        this.setState({ selectedKeys: new Set(), isAllSelected: false });
        this.emit('scenario:selection-changed', { selectedKeys: [] });
    }

    toggleSelectAll() {
        if (this.state.isAllSelected) {
            this.deselectAll();
        } else {
            this.selectAll();
        }
    }

    updateSelectAllState() {
        const { scenarios, selectedKeys } = this.state;
        const isAllSelected = scenarios.length > 0 && selectedKeys.size === scenarios.length;
        this.state.isAllSelected = isAllSelected;
    }

    getSelectedKeys() {
        return Array.from(this.state.selectedKeys);
    }

    getSelectedScenarios() {
        const { scenarios, selectedKeys } = this.state;
        return scenarios.filter(s => selectedKeys.has(s.key));
    }

    // ============================================
    // Helper Methods
    // ============================================

    getStatusDisplay(status) {
        const displays = {
            'pass': { icon: 'O', text: 'Passed', color: '#16a34a' },
            'skip': { icon: '-', text: 'Skipped', color: '#ca8a04' },
            'fail': { icon: 'X', text: 'Failed', color: '#dc2626' },
            'never_run': { icon: '-', text: 'Not run', color: '#64748b' }
        };
        return displays[status] || displays['never_run'];
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScenarioListView;
}

if (typeof window !== 'undefined') {
    window.ScenarioListView = ScenarioListView;
}
