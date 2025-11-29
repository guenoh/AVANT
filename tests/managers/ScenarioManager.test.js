/**
 * ScenarioManager Unit Tests
 */

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: jest.fn(key => store[key] || null),
        setItem: jest.fn((key, value) => { store[key] = value; }),
        removeItem: jest.fn(key => { delete store[key]; }),
        clear: jest.fn(() => { store = {}; })
    };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock app object
const createMockApp = () => ({
    actions: [],
    macroName: '',
    macroDescription: '',
    currentFilePath: null,
    currentScenarioId: null,
    currentScenarioKey: null,
    logger: {
        info: jest.fn(),
        success: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    },
    checkUnsavedChanges: jest.fn(() => true),
    renderActionSequence: jest.fn(),
    markAsSaved: jest.fn(),
    markAsUnsaved: jest.fn(),
    updateToolbarButtons: jest.fn(),
    updateFilenamePreview: jest.fn(),
    renderActionList: jest.fn(),
    renderScenarioListInPanel: jest.fn()
});

// Import ScenarioManager (simulated since we don't have ES6 modules)
class ScenarioManager {
    constructor(app) {
        this.app = app;
        this.currentFilePath = null;
        this.currentScenarioId = null;
        this.currentScenarioKey = null;
    }

    getRegistry() {
        return JSON.parse(localStorage.getItem('scenario_registry') || '{}');
    }

    saveRegistry(registry) {
        localStorage.setItem('scenario_registry', JSON.stringify(registry));
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

describe('ScenarioManager', () => {
    let manager;
    let mockApp;

    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
        mockApp = createMockApp();
        manager = new ScenarioManager(mockApp);
    });

    describe('sanitizeFilename', () => {
        test('should return unnamed.json for empty input', () => {
            expect(manager.sanitizeFilename('')).toBe('unnamed.json');
            expect(manager.sanitizeFilename(null)).toBe('unnamed.json');
            expect(manager.sanitizeFilename('   ')).toBe('unnamed.json');
        });

        test('should replace spaces with underscores', () => {
            expect(manager.sanitizeFilename('my scenario')).toBe('my_scenario.json');
            expect(manager.sanitizeFilename('my  scenario')).toBe('my_scenario.json');
        });

        test('should remove invalid characters', () => {
            expect(manager.sanitizeFilename('test<>:"/\\|?*name')).toBe('testname.json');
        });

        test('should truncate long names', () => {
            const longName = 'a'.repeat(100);
            const result = manager.sanitizeFilename(longName);
            expect(result.length).toBeLessThanOrEqual(55); // 50 + '.json'
        });

        test('should handle Korean characters', () => {
            expect(manager.sanitizeFilename('테스트 시나리오')).toBe('테스트_시나리오.json');
        });
    });

    describe('generateUniqueFilename', () => {
        test('should return original filename if not exists', () => {
            expect(manager.generateUniqueFilename('test')).toBe('test.json');
        });

        test('should add counter if filename exists', () => {
            // Setup existing file
            manager.saveScenarioData({
                'scenarios/test.json': { name: 'test', scenarios: [] }
            });

            expect(manager.generateUniqueFilename('test')).toBe('test_1.json');
        });

        test('should increment counter for multiple duplicates', () => {
            manager.saveScenarioData({
                'scenarios/test.json': { name: 'test', scenarios: [] },
                'scenarios/test_1.json': { name: 'test', scenarios: [] }
            });

            expect(manager.generateUniqueFilename('test')).toBe('test_2.json');
        });
    });

    describe('Registry operations', () => {
        test('should get empty registry initially', () => {
            expect(manager.getRegistry()).toEqual({});
        });

        test('should save and retrieve registry', () => {
            const registry = { 'test-key': { name: 'Test', filename: 'test.json' } };
            manager.saveRegistry(registry);
            expect(manager.getRegistry()).toEqual(registry);
        });
    });

    describe('Scenario data operations', () => {
        test('should get empty data initially', () => {
            expect(manager.getScenarioData()).toEqual({});
        });

        test('should save and retrieve scenario data', () => {
            const data = {
                'scenarios/test.json': {
                    name: 'Test',
                    scenarios: [{ id: 'sc1', name: 'Scenario 1', actions: [] }]
                }
            };
            manager.saveScenarioData(data);
            expect(manager.getScenarioData()).toEqual(data);
        });
    });

    describe('Status helpers', () => {
        test('getStatusIcon should return correct icons', () => {
            expect(manager.getStatusIcon('pass')).toBe('✓');
            expect(manager.getStatusIcon('fail')).toBe('✗');
            expect(manager.getStatusIcon('running')).toBe('◉');
            expect(manager.getStatusIcon('unknown')).toBe('○');
        });

        test('getStatusColor should return correct colors', () => {
            expect(manager.getStatusColor('pass')).toContain('green');
            expect(manager.getStatusColor('fail')).toContain('red');
            expect(manager.getStatusColor('unknown')).toContain('slate');
        });

        test('getStatusText should return correct text', () => {
            expect(manager.getStatusText('pass')).toBe('PASS');
            expect(manager.getStatusText('fail')).toBe('FAIL');
            expect(manager.getStatusText('never_run')).toBe('미실행');
            expect(manager.getStatusText('unknown')).toBe('미실행');
        });
    });
});
