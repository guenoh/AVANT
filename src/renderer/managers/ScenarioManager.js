/**
 * ScenarioManager - Handles scenario CRUD operations and persistence
 * Extracted from macro-builder-app.js for better modularity
 */

class ScenarioManager {
    constructor(app) {
        this.app = app;

        // Scenario state
        this.currentFilePath = null;
        this.currentScenarioId = null;
        this.currentScenarioKey = null;

        // Registry cache
        this._registryCache = null;
        this._dataCacheTime = 0;
    }

    // ==================== Registry Operations ====================

    /**
     * Get scenario registry from localStorage
     */
    getRegistry() {
        return JSON.parse(localStorage.getItem('scenario_registry') || '{}');
    }

    /**
     * Save scenario registry to localStorage
     */
    saveRegistry(registry) {
        localStorage.setItem('scenario_registry', JSON.stringify(registry));
        this._registryCache = null; // Invalidate cache
    }

    /**
     * Get scenario data storage
     */
    getScenarioData() {
        return JSON.parse(localStorage.getItem('scenario_data') || '{}');
    }

    /**
     * Save scenario data to localStorage
     */
    saveScenarioData(data) {
        localStorage.setItem('scenario_data', JSON.stringify(data));
    }

    /**
     * Get scenario index (maps scenarioId -> filePath)
     */
    getScenarioIndex() {
        return JSON.parse(localStorage.getItem('scenario_index') || '{}');
    }

    /**
     * Save scenario index
     */
    saveScenarioIndex(index) {
        localStorage.setItem('scenario_index', JSON.stringify(index));
    }

    /**
     * Get execution results
     */
    getExecutionResults() {
        return JSON.parse(localStorage.getItem('scenario_execution_results') || '{}');
    }

    /**
     * Save execution result for a scenario
     */
    saveExecutionResult(scenarioId, result) {
        const results = this.getExecutionResults();
        results[scenarioId] = {
            status: result.status,
            message: result.message || '',
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('scenario_execution_results', JSON.stringify(results));
    }

    // ==================== Filename Operations ====================

    /**
     * Sanitize scenario name into valid filename
     */
    sanitizeFilename(scenarioName) {
        if (!scenarioName || scenarioName.trim() === '') {
            return 'unnamed.json';
        }

        // Replace spaces with underscores
        let sanitized = scenarioName.replace(/\s+/g, '_');

        // Remove invalid filename characters
        sanitized = sanitized.replace(/[<>:"/\\|?*]/g, '');

        // Remove leading/trailing dots and spaces
        sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');

        // Limit length
        if (sanitized.length > 50) {
            sanitized = sanitized.substring(0, 50);
        }

        if (sanitized === '') {
            return 'unnamed.json';
        }

        return sanitized + '.json';
    }

    /**
     * Check if filename already exists
     */
    isFilenameExists(filename) {
        const scenarioData = this.getScenarioData();
        return Object.keys(scenarioData).some(filePath => {
            const existingFilename = filePath.split('/').pop();
            return existingFilename === filename;
        });
    }

    /**
     * Generate unique filename
     */
    generateUniqueFilename(baseName) {
        const sanitized = this.sanitizeFilename(baseName).replace('.json', '');
        let filename = `${sanitized}.json`;

        if (!this.isFilenameExists(filename)) {
            return filename;
        }

        let counter = 1;
        while (this.isFilenameExists(`${sanitized}_${counter}.json`)) {
            counter++;
        }

        return `${sanitized}_${counter}.json`;
    }

    // ==================== CRUD Operations ====================

    /**
     * Create new scenario
     */
    createNewScenario() {
        // Check for unsaved changes
        if (!this.app.checkUnsavedChanges()) {
            return;
        }

        // Reset state
        this.app.actions = [];
        this.app.macroName = '';
        this.app.macroDescription = '';
        this.currentFilePath = null;
        this.currentScenarioId = null;
        this.currentScenarioKey = null;

        // Update UI
        const macroNameInput = document.getElementById('macro-name-input');
        if (macroNameInput) {
            macroNameInput.value = '';
        }
        const macroDescriptionInput = document.getElementById('macro-description-input');
        if (macroDescriptionInput) {
            macroDescriptionInput.value = '';
        }

        // Switch to action sequence view
        this.app.renderActionSequence();
        this.app.markAsSaved();
        this.app.updateToolbarButtons(true);

        // Focus on name input
        setTimeout(() => {
            if (macroNameInput) {
                macroNameInput.focus();
            }
        }, 100);

        this.app.logger.info('New scenario created');
    }

    /**
     * Load scenario by scenarioId
     */
    loadScenarioFromRegistry(scenarioId) {
        console.log('[ScenarioManager] Loading scenario:', scenarioId);

        const index = this.getScenarioIndex();
        const indexEntry = index[scenarioId];

        if (!indexEntry) {
            console.error('[ScenarioManager] Scenario not found in index:', scenarioId);
            return null;
        }

        const { filePath } = indexEntry;
        const scenarioData = this.getScenarioData();
        const fileData = scenarioData[filePath];

        if (!fileData) {
            console.error('[ScenarioManager] File not found:', filePath);
            return null;
        }

        const scenario = fileData.scenarios.find(s => s.id === scenarioId);

        if (!scenario) {
            console.error('[ScenarioManager] Scenario not found in file:', scenarioId);
            return null;
        }

        return {
            ...scenario,
            filePath: filePath
        };
    }

    /**
     * Load scenario by filePath
     */
    loadScenarioByFilePath(filePath) {
        console.log('[ScenarioManager] Loading from file:', filePath);

        const scenarioData = this.getScenarioData();
        const fileData = scenarioData[filePath];

        if (!fileData || !fileData.scenarios || fileData.scenarios.length === 0) {
            console.error('[ScenarioManager] File not found or empty:', filePath);
            return null;
        }

        const scenario = fileData.scenarios[0];
        return {
            ...scenario,
            filePath: filePath
        };
    }

    /**
     * Edit scenario (load into editor)
     */
    editScenario(keyOrId) {
        console.log('[ScenarioManager] Editing scenario:', keyOrId);

        if (!this.app.checkUnsavedChanges()) {
            return;
        }

        // Try loading as scenarioId first, then as filePath
        let scenarioData = this.loadScenarioFromRegistry(keyOrId);
        if (!scenarioData) {
            scenarioData = this.loadScenarioByFilePath(keyOrId);
        }

        if (!scenarioData) {
            console.error('[ScenarioManager] Scenario not found:', keyOrId);
            return;
        }

        // Load into editor
        this.app.actions = scenarioData.actions || [];
        this.app.macroName = scenarioData.name || '';
        this.app.macroDescription = scenarioData.description || '';

        this.currentFilePath = scenarioData.filePath;
        this.currentScenarioId = scenarioData.id;
        this.currentScenarioKey = scenarioData.id;

        // Sync with app
        this.app.currentFilePath = this.currentFilePath;
        this.app.currentScenarioId = this.currentScenarioId;
        this.app.currentScenarioKey = this.currentScenarioKey;

        // Update UI
        const macroNameInput = document.getElementById('macro-name-input');
        if (macroNameInput) {
            macroNameInput.value = this.app.macroName;
        }
        const macroDescriptionInput = document.getElementById('macro-description-input');
        if (macroDescriptionInput) {
            macroDescriptionInput.value = this.app.macroDescription;
        }

        this.app.updateFilenamePreview();
        this.app.renderActionSequence();
        this.app.markAsSaved();
        this.app.updateToolbarButtons(true);

        setTimeout(() => {
            this.app.renderActionList();
        }, 100);

        this.app.logger.info(`Loaded scenario: ${this.app.macroName}`);
    }

    /**
     * Save current scenario
     */
    saveScenario() {
        if (!this.app.macroName || this.app.macroName.trim() === '') {
            alert('시나리오 이름을 입력해주세요.');
            return false;
        }

        const scenarioId = this.currentScenarioId || `scenario_${Date.now()}`;
        const filename = this.generateUniqueFilename(this.app.macroName);
        const filePath = this.currentFilePath || `scenarios/${filename}`;

        const scenarioData = {
            id: scenarioId,
            name: this.app.macroName,
            description: this.app.macroDescription || '',
            actions: this.app.actions,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Save to data storage
        const allData = this.getScenarioData();
        if (!allData[filePath]) {
            allData[filePath] = {
                name: this.app.macroName,
                scenarios: []
            };
        }

        // Update or add scenario
        const existingIndex = allData[filePath].scenarios.findIndex(s => s.id === scenarioId);
        if (existingIndex >= 0) {
            allData[filePath].scenarios[existingIndex] = scenarioData;
        } else {
            allData[filePath].scenarios.push(scenarioData);
        }
        this.saveScenarioData(allData);

        // Update index
        const index = this.getScenarioIndex();
        index[scenarioId] = { filePath, name: this.app.macroName };
        this.saveScenarioIndex(index);

        // Update registry
        const registry = this.getRegistry();
        registry[filePath] = {
            name: this.app.macroName,
            filename: filename,
            timestamp: new Date().toISOString(),
            actionsCount: this.app.actions.length
        };
        this.saveRegistry(registry);

        // Update current state
        this.currentFilePath = filePath;
        this.currentScenarioId = scenarioId;
        this.currentScenarioKey = scenarioId;

        // Sync with app
        this.app.currentFilePath = this.currentFilePath;
        this.app.currentScenarioId = this.currentScenarioId;
        this.app.currentScenarioKey = this.currentScenarioKey;

        this.app.markAsSaved();
        this.app.logger.success(`Scenario saved: ${this.app.macroName}`);

        return true;
    }

    /**
     * Delete scenario
     */
    deleteScenario(keyOrId, filename) {
        console.log('[ScenarioManager] Deleting scenario:', keyOrId);

        const confirmDelete = confirm(`시나리오 "${filename || keyOrId}"을(를) 삭제하시겠습니까?`);
        if (!confirmDelete) {
            return false;
        }

        try {
            // Try to find by scenarioId first
            const index = this.getScenarioIndex();
            const indexEntry = index[keyOrId];

            let filePath = keyOrId;
            let scenarioId = keyOrId;

            if (indexEntry) {
                filePath = indexEntry.filePath;
                scenarioId = keyOrId;
            }

            // Remove from data
            const data = this.getScenarioData();
            if (data[filePath]) {
                data[filePath].scenarios = data[filePath].scenarios.filter(s => s.id !== scenarioId);
                if (data[filePath].scenarios.length === 0) {
                    delete data[filePath];
                }
                this.saveScenarioData(data);
            }

            // Remove from index
            delete index[scenarioId];
            this.saveScenarioIndex(index);

            // Remove from registry if file is empty
            const registry = this.getRegistry();
            if (!data[filePath]) {
                delete registry[filePath];
                this.saveRegistry(registry);
            }

            // Remove execution results
            const results = this.getExecutionResults();
            delete results[scenarioId];
            localStorage.setItem('scenario_execution_results', JSON.stringify(results));

            this.app.logger.info(`Deleted scenario: ${filename || keyOrId}`);
            return true;

        } catch (error) {
            console.error('[ScenarioManager] Delete error:', error);
            this.app.logger.error(`Failed to delete scenario: ${error.message}`);
            return false;
        }
    }

    // ==================== List Operations ====================

    /**
     * Get all scenarios as flat list
     */
    getAllScenarios() {
        const data = this.getScenarioData();
        const results = this.getExecutionResults();
        const scenarios = [];

        for (const [filePath, fileData] of Object.entries(data)) {
            for (const scenario of (fileData.scenarios || [])) {
                scenarios.push({
                    id: scenario.id,
                    name: scenario.name,
                    description: scenario.description,
                    filePath: filePath,
                    fileName: fileData.name,
                    actionsCount: scenario.actions?.length || 0,
                    status: results[scenario.id]?.status || 'never_run',
                    timestamp: scenario.updatedAt || scenario.createdAt
                });
            }
        }

        return scenarios.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * Get scenarios grouped by file
     */
    getScenariosGroupedByFile() {
        const data = this.getScenarioData();
        const registry = this.getRegistry();
        const results = this.getExecutionResults();

        return Object.entries(data).map(([filePath, fileData]) => {
            const fileRegistry = registry[filePath] || {};
            const scenarios = (fileData.scenarios || []).map(scenario => ({
                id: scenario.id,
                name: scenario.name,
                actionsCount: scenario.actions?.length || 0,
                status: results[scenario.id]?.status || 'never_run',
                message: results[scenario.id]?.message || '',
                timestamp: scenario.updatedAt || scenario.createdAt
            }));

            return {
                filePath,
                fileName: fileData.name,
                scenarios,
                timestamp: fileRegistry.timestamp || Date.now()
            };
        }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    // ==================== Migration ====================

    /**
     * Migrate existing scenarios to new format
     */
    migrateExistingScenarios() {
        console.log('[ScenarioManager] Running migration...');

        const oldRegistry = this.getRegistry();
        const oldData = this.getScenarioData();

        // Check if already migrated
        if (Object.keys(oldData).length > 0) {
            const firstFile = Object.values(oldData)[0];
            if (firstFile && firstFile.scenarios) {
                console.log('[ScenarioManager] Already migrated');
                return;
            }
        }

        // Migrate old format to new format
        const newData = {};
        const newIndex = {};

        for (const [key, registryEntry] of Object.entries(oldRegistry)) {
            const scenario = oldData[key];
            if (!scenario) continue;

            const filePath = `scenarios/${registryEntry.filename || key}.json`;
            const scenarioId = `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            if (!newData[filePath]) {
                newData[filePath] = {
                    name: registryEntry.name,
                    scenarios: []
                };
            }

            newData[filePath].scenarios.push({
                id: scenarioId,
                name: registryEntry.name,
                description: scenario.description || '',
                actions: scenario.actions || [],
                createdAt: registryEntry.savedAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            newIndex[scenarioId] = { filePath, name: registryEntry.name };
        }

        this.saveScenarioData(newData);
        this.saveScenarioIndex(newIndex);

        console.log('[ScenarioManager] Migration complete');
    }

    /**
     * Add filename field to existing registry entries
     */
    addFilenameToRegistry() {
        const registry = this.getRegistry();
        let updated = false;

        for (const [key, entry] of Object.entries(registry)) {
            if (!entry.filename) {
                entry.filename = this.sanitizeFilename(entry.name);
                updated = true;
            }
        }

        if (updated) {
            this.saveRegistry(registry);
        }
    }

    // ==================== Helpers ====================

    /**
     * Check if currently viewing scenario list
     */
    isScenarioListVisible() {
        const header = document.getElementById('scenario-list-header');
        return header && header.style.display !== 'none';
    }

    /**
     * Get status icon for display
     */
    getStatusIcon(status) {
        const icons = {
            'pass': '✓',
            'fail': '✗',
            'skip': '⊘',
            'stopped': '■',
            'never_run': '○',
            'completed': '✓',
            'running': '◉'
        };
        return icons[status] || '○';
    }

    /**
     * Get status color class
     */
    getStatusColor(status) {
        const colors = {
            'pass': 'bg-green-100 text-green-800',
            'fail': 'bg-red-100 text-red-800',
            'skip': 'bg-yellow-100 text-yellow-800',
            'stopped': 'bg-slate-100 text-slate-800',
            'never_run': 'bg-blue-100 text-blue-800',
            'completed': 'bg-green-100 text-green-800',
            'running': 'bg-blue-100 text-blue-800'
        };
        return colors[status] || 'bg-slate-100 text-slate-600';
    }

    /**
     * Get status text for display
     */
    getStatusText(status) {
        const texts = {
            'pass': 'PASS',
            'fail': 'FAIL',
            'skip': 'SKIP',
            'stopped': '중단됨',
            'never_run': '미실행',
            'completed': '완료',
            'running': '실행중'
        };
        return texts[status] || '미실행';
    }
}

// Export for use
window.ScenarioManager = ScenarioManager;
