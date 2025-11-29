/**
 * ScenarioManager - Handles scenario CRUD operations and persistence
 * ES6 Module version
 */

export class ScenarioManager {
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

    getRegistry() {
        return JSON.parse(localStorage.getItem('scenario_registry') || '{}');
    }

    saveRegistry(registry) {
        localStorage.setItem('scenario_registry', JSON.stringify(registry));
        this._registryCache = null;
    }

    getScenarioData() {
        return JSON.parse(localStorage.getItem('scenario_data') || '{}');
    }

    saveScenarioData(data) {
        localStorage.setItem('scenario_data', JSON.stringify(data));
    }

    getScenarioIndex() {
        return JSON.parse(localStorage.getItem('scenario_index') || '{}');
    }

    saveScenarioIndex(index) {
        localStorage.setItem('scenario_index', JSON.stringify(index));
    }

    getExecutionResults() {
        return JSON.parse(localStorage.getItem('scenario_execution_results') || '{}');
    }

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

    sanitizeFilename(scenarioName) {
        if (!scenarioName || scenarioName.trim() === '') {
            return 'unnamed.json';
        }

        let sanitized = scenarioName.replace(/\s+/g, '_');
        sanitized = sanitized.replace(/[<>:"/\\|?*]/g, '');
        sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');

        if (sanitized.length > 50) {
            sanitized = sanitized.substring(0, 50);
        }

        if (sanitized === '') {
            return 'unnamed.json';
        }

        return sanitized + '.json';
    }

    isFilenameExists(filename) {
        const scenarioData = this.getScenarioData();
        return Object.keys(scenarioData).some(filePath => {
            const existingFilename = filePath.split('/').pop();
            return existingFilename === filename;
        });
    }

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

    createNewScenario() {
        if (!this.app.checkUnsavedChanges()) {
            return;
        }

        this.app.actions = [];
        this.app.macroName = '';
        this.app.macroDescription = '';
        this.currentFilePath = null;
        this.currentScenarioId = null;
        this.currentScenarioKey = null;

        const macroNameInput = document.getElementById('macro-name-input');
        if (macroNameInput) {
            macroNameInput.value = '';
        }
        const macroDescriptionInput = document.getElementById('macro-description-input');
        if (macroDescriptionInput) {
            macroDescriptionInput.value = '';
        }

        this.app.renderActionSequence();
        this.app.markAsSaved();
        this.app.updateToolbarButtons(true);

        setTimeout(() => {
            if (macroNameInput) {
                macroNameInput.focus();
            }
        }, 100);

        this.app.logger.info('New scenario created');
    }

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

        return { ...scenario, filePath };
    }

    loadScenarioByFilePath(filePath) {
        console.log('[ScenarioManager] Loading from file:', filePath);

        const scenarioData = this.getScenarioData();
        const fileData = scenarioData[filePath];

        if (!fileData || !fileData.scenarios || fileData.scenarios.length === 0) {
            console.error('[ScenarioManager] File not found or empty:', filePath);
            return null;
        }

        const scenario = fileData.scenarios[0];
        return { ...scenario, filePath };
    }

    editScenario(keyOrId) {
        console.log('[ScenarioManager] Editing scenario:', keyOrId);

        if (!this.app.checkUnsavedChanges()) {
            return;
        }

        let scenarioData = this.loadScenarioFromRegistry(keyOrId);
        if (!scenarioData) {
            scenarioData = this.loadScenarioByFilePath(keyOrId);
        }

        if (!scenarioData) {
            console.error('[ScenarioManager] Scenario not found:', keyOrId);
            return;
        }

        this.app.actions = scenarioData.actions || [];
        this.app.macroName = scenarioData.name || '';
        this.app.macroDescription = scenarioData.description || '';

        this.currentFilePath = scenarioData.filePath;
        this.currentScenarioId = scenarioData.id;
        this.currentScenarioKey = scenarioData.id;

        this.app.currentFilePath = this.currentFilePath;
        this.app.currentScenarioId = this.currentScenarioId;
        this.app.currentScenarioKey = this.currentScenarioKey;

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

        const allData = this.getScenarioData();
        if (!allData[filePath]) {
            allData[filePath] = { name: this.app.macroName, scenarios: [] };
        }

        const existingIndex = allData[filePath].scenarios.findIndex(s => s.id === scenarioId);
        if (existingIndex >= 0) {
            allData[filePath].scenarios[existingIndex] = scenarioData;
        } else {
            allData[filePath].scenarios.push(scenarioData);
        }
        this.saveScenarioData(allData);

        const index = this.getScenarioIndex();
        index[scenarioId] = { filePath, name: this.app.macroName };
        this.saveScenarioIndex(index);

        const registry = this.getRegistry();
        registry[filePath] = {
            name: this.app.macroName,
            filename: filename,
            timestamp: new Date().toISOString(),
            actionsCount: this.app.actions.length
        };
        this.saveRegistry(registry);

        this.currentFilePath = filePath;
        this.currentScenarioId = scenarioId;
        this.currentScenarioKey = scenarioId;

        this.app.currentFilePath = this.currentFilePath;
        this.app.currentScenarioId = this.currentScenarioId;
        this.app.currentScenarioKey = this.currentScenarioKey;

        this.app.markAsSaved();
        this.app.logger.success(`Scenario saved: ${this.app.macroName}`);

        return true;
    }

    deleteScenario(keyOrId, filename) {
        console.log('[ScenarioManager] Deleting scenario:', keyOrId);

        const confirmDelete = confirm(`시나리오 "${filename || keyOrId}"을(를) 삭제하시겠습니까?`);
        if (!confirmDelete) {
            return false;
        }

        try {
            const index = this.getScenarioIndex();
            const indexEntry = index[keyOrId];

            let filePath = keyOrId;
            let scenarioId = keyOrId;

            if (indexEntry) {
                filePath = indexEntry.filePath;
                scenarioId = keyOrId;
            }

            const data = this.getScenarioData();
            if (data[filePath]) {
                data[filePath].scenarios = data[filePath].scenarios.filter(s => s.id !== scenarioId);
                if (data[filePath].scenarios.length === 0) {
                    delete data[filePath];
                }
                this.saveScenarioData(data);
            }

            delete index[scenarioId];
            this.saveScenarioIndex(index);

            const registry = this.getRegistry();
            if (!data[filePath]) {
                delete registry[filePath];
                this.saveRegistry(registry);
            }

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

    // ==================== Helpers ====================

    isScenarioListVisible() {
        const header = document.getElementById('scenario-list-header');
        return header && header.style.display !== 'none';
    }

    getStatusIcon(status) {
        const icons = {
            'pass': '✓', 'fail': '✗', 'skip': '⊘', 'stopped': '■',
            'never_run': '○', 'completed': '✓', 'running': '◉'
        };
        return icons[status] || '○';
    }

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

    getStatusText(status) {
        const texts = {
            'pass': 'PASS', 'fail': 'FAIL', 'skip': 'SKIP', 'stopped': '중단됨',
            'never_run': '미실행', 'completed': '완료', 'running': '실행중'
        };
        return texts[status] || '미실행';
    }
}

export default ScenarioManager;
