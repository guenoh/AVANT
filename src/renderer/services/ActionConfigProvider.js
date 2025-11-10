/**
 * ActionConfigProvider
 * Provides action type configurations, metadata, and validation rules
 */

class ActionConfigProvider {
    constructor() {
        this.actionTypes = this._initializeActionTypes();
        this.actionCategories = this._initializeActionCategories();
    }

    /**
     * Initialize action type configurations
     */
    _initializeActionTypes() {
        return {
            'click': {
                id: 'click',
                name: 'Click',
                category: 'basic',
                description: 'Tap at specific coordinates',
                icon: '👆',
                color: '#2563eb',
                requiresCoordinates: true,
                fields: [
                    { name: 'x', type: 'number', label: 'X Coordinate', required: true, min: 0 },
                    { name: 'y', type: 'number', label: 'Y Coordinate', required: true, min: 0 }
                ],
                defaultParams: { x: 0, y: 0 },
                executionTime: 100
            },

            'long-press': {
                id: 'long-press',
                name: 'Long Press',
                category: 'basic',
                description: 'Long press at specific coordinates',
                icon: '👇',
                color: '#ca8a04',
                requiresCoordinates: true,
                fields: [
                    { name: 'x', type: 'number', label: 'X Coordinate', required: true, min: 0 },
                    { name: 'y', type: 'number', label: 'Y Coordinate', required: true, min: 0 },
                    { name: 'duration', type: 'number', label: 'Duration (ms)', required: true, min: 100, max: 10000, default: 1000 }
                ],
                defaultParams: { x: 0, y: 0, duration: 1000 },
                executionTime: 1100
            },

            'drag': {
                id: 'drag',
                name: 'Drag',
                category: 'basic',
                description: 'Swipe from start to end position',
                icon: '✋',
                color: '#7c3aed',
                requiresCoordinates: true,
                fields: [
                    { name: 'x', type: 'number', label: 'Start X', required: true, min: 0 },
                    { name: 'y', type: 'number', label: 'Start Y', required: true, min: 0 },
                    { name: 'endX', type: 'number', label: 'End X', required: true, min: 0 },
                    { name: 'endY', type: 'number', label: 'End Y', required: true, min: 0 },
                    { name: 'duration', type: 'number', label: 'Duration (ms)', required: true, min: 100, max: 5000, default: 300 }
                ],
                defaultParams: { x: 0, y: 0, endX: 0, endY: 0, duration: 300 },
                executionTime: 400
            },

            'input': {
                id: 'input',
                name: 'Input Text',
                category: 'basic',
                description: 'Enter text into focused field',
                icon: '⌨️',
                color: '#16a34a',
                requiresCoordinates: false,
                fields: [
                    { name: 'text', type: 'text', label: 'Text', required: true }
                ],
                defaultParams: { text: '' },
                executionTime: 200
            },

            'wait': {
                id: 'wait',
                name: 'Wait',
                category: 'timing',
                description: 'Wait for specified duration',
                icon: '⏱️',
                color: '#64748b',
                requiresCoordinates: false,
                fields: [
                    { name: 'duration', type: 'number', label: 'Duration (ms)', required: true, min: 100, max: 60000, default: 1000 }
                ],
                defaultParams: { duration: 1000 },
                executionTime: null // Variable
            },

            'back': {
                id: 'back',
                name: 'Back',
                category: 'navigation',
                description: 'Press back button',
                icon: '◀️',
                color: '#64748b',
                requiresCoordinates: false,
                fields: [],
                defaultParams: {},
                executionTime: 100
            },

            'home': {
                id: 'home',
                name: 'Home',
                category: 'navigation',
                description: 'Press home button',
                icon: '🏠',
                color: '#64748b',
                requiresCoordinates: false,
                fields: [],
                defaultParams: {},
                executionTime: 100
            },

            'recent': {
                id: 'recent',
                name: 'Recent Apps',
                category: 'navigation',
                description: 'Open recent apps',
                icon: '📱',
                color: '#64748b',
                requiresCoordinates: false,
                fields: [],
                defaultParams: {},
                executionTime: 100
            },

            'image-match': {
                id: 'image-match',
                name: 'Image Match',
                category: 'vision',
                description: 'Find and click on image',
                icon: '🔍',
                color: '#ea580c',
                requiresCoordinates: false,
                fields: [
                    { name: 'imagePath', type: 'file', label: 'Template Image', required: true, accept: 'image/*' },
                    { name: 'threshold', type: 'number', label: 'Match Threshold', required: true, min: 0, max: 1, step: 0.01, default: 0.8 },
                    { name: 'action', type: 'select', label: 'Action on Match', required: true, options: ['click', 'long-press', 'none'], default: 'click' },
                    { name: 'timeout', type: 'number', label: 'Timeout (ms)', required: true, min: 1000, max: 60000, default: 10000 }
                ],
                defaultParams: { imagePath: '', threshold: 0.8, region: null, action: 'click', timeout: 10000 },
                executionTime: null // Variable
            },

            'sound-check': {
                id: 'sound-check',
                name: 'Sound Check',
                category: 'sensor',
                description: 'Check for sound presence or level',
                icon: '🔊',
                color: '#ec4899',
                requiresCoordinates: false,
                fields: [
                    { name: 'duration', type: 'number', label: 'Duration (ms)', required: true, min: 1000, max: 30000, default: 5000 },
                    { name: 'expectation', type: 'select', label: 'Expectation', required: true, options: ['present', 'silent', 'level'], default: 'present' },
                    { name: 'threshold.min', type: 'number', label: 'Min Threshold (dB)', required: false, min: 0, max: 100, default: 40 },
                    { name: 'threshold.max', type: 'number', label: 'Max Threshold (dB)', required: false, min: 0, max: 100, default: 80 }
                ],
                defaultParams: { duration: 5000, expectation: 'present', threshold: { min: 40, max: 80 }, audioDeviceId: null },
                executionTime: null // Variable
            },

            'if': {
                id: 'if',
                name: 'If Condition',
                category: 'control',
                description: 'Conditional branching',
                icon: '❓',
                color: '#0891b2',
                requiresCoordinates: false,
                fields: [
                    { name: 'condition', type: 'condition', label: 'Condition', required: true }
                ],
                defaultParams: { condition: null, thenActions: [], elseActions: [] },
                executionTime: null, // Variable
                isControl: true
            },

            'while': {
                id: 'while',
                name: 'While Loop',
                category: 'control',
                description: 'Loop while condition is true',
                icon: '🔄',
                color: '#0891b2',
                requiresCoordinates: false,
                fields: [
                    { name: 'condition', type: 'condition', label: 'Condition', required: true },
                    { name: 'maxIterations', type: 'number', label: 'Max Iterations', required: true, min: 1, max: 1000, default: 100 }
                ],
                defaultParams: { condition: null, actions: [], maxIterations: 100 },
                executionTime: null, // Variable
                isControl: true
            },

            'loop': {
                id: 'loop',
                name: 'Loop',
                category: 'control',
                description: 'Repeat actions N times',
                icon: '🔁',
                color: '#0891b2',
                requiresCoordinates: false,
                fields: [
                    { name: 'count', type: 'number', label: 'Repeat Count', required: true, min: 1, max: 1000, default: 1 }
                ],
                defaultParams: { count: 1, actions: [] },
                executionTime: null, // Variable
                isControl: true
            },

            'skip': {
                id: 'skip',
                name: 'Skip',
                category: 'testing',
                description: 'Skip this action',
                icon: '⏭️',
                color: '#64748b',
                requiresCoordinates: false,
                fields: [],
                defaultParams: {},
                executionTime: 0,
                isTesting: true
            },

            'fail': {
                id: 'fail',
                name: 'Fail',
                category: 'testing',
                description: 'Fail test with message',
                icon: '❌',
                color: '#dc2626',
                requiresCoordinates: false,
                fields: [
                    { name: 'message', type: 'text', label: 'Failure Message', required: false }
                ],
                defaultParams: { message: '' },
                executionTime: 0,
                isTesting: true
            },

            'test': {
                id: 'test',
                name: 'Test',
                category: 'testing',
                description: 'Test assertion',
                icon: '✅',
                color: '#16a34a',
                requiresCoordinates: false,
                fields: [
                    { name: 'name', type: 'text', label: 'Test Name', required: true },
                    { name: 'expectedResult', type: 'text', label: 'Expected Result', required: false }
                ],
                defaultParams: { name: '', expectedResult: '' },
                executionTime: 100,
                isTesting: true
            }
        };
    }

    /**
     * Initialize action categories
     */
    _initializeActionCategories() {
        return {
            basic: {
                id: 'basic',
                name: 'Basic Actions',
                description: 'Click, drag, and input actions',
                icon: '👆',
                color: '#2563eb'
            },
            navigation: {
                id: 'navigation',
                name: 'Navigation',
                description: 'Device navigation buttons',
                icon: '🧭',
                color: '#64748b'
            },
            timing: {
                id: 'timing',
                name: 'Timing',
                description: 'Wait and delay actions',
                icon: '⏱️',
                color: '#64748b'
            },
            vision: {
                id: 'vision',
                name: 'Vision',
                description: 'Image matching actions',
                icon: '🔍',
                color: '#ea580c'
            },
            sensor: {
                id: 'sensor',
                name: 'Sensor',
                description: 'Sound and sensor checks',
                icon: '🔊',
                color: '#ec4899'
            },
            control: {
                id: 'control',
                name: 'Control Flow',
                description: 'Conditional and loop structures',
                icon: '🔀',
                color: '#0891b2'
            },
            testing: {
                id: 'testing',
                name: 'Testing',
                description: 'Test assertions and utilities',
                icon: '✅',
                color: '#16a34a'
            }
        };
    }

    /**
     * Get action type configuration
     */
    getActionType(typeId) {
        return this.actionTypes[typeId] || null;
    }

    /**
     * Get all action types
     */
    getAllActionTypes() {
        return Object.values(this.actionTypes);
    }

    /**
     * Get action types by category
     */
    getActionTypesByCategory(categoryId) {
        return Object.values(this.actionTypes).filter(
            action => action.category === categoryId
        );
    }

    /**
     * Get action category
     */
    getCategory(categoryId) {
        return this.actionCategories[categoryId] || null;
    }

    /**
     * Get all categories
     */
    getAllCategories() {
        return Object.values(this.actionCategories);
    }

    /**
     * Get default parameters for action type
     */
    getDefaultParams(typeId) {
        const actionType = this.actionTypes[typeId];
        return actionType ? { ...actionType.defaultParams } : {};
    }

    /**
     * Get field configuration for action type
     */
    getFields(typeId) {
        const actionType = this.actionTypes[typeId];
        return actionType ? [...actionType.fields] : [];
    }

    /**
     * Validate action data against type schema
     */
    validateAction(action) {
        const actionType = this.actionTypes[action.type];

        if (!actionType) {
            return {
                valid: false,
                errors: [`Unknown action type: ${action.type}`]
            };
        }

        const errors = [];

        // Validate required fields
        actionType.fields.forEach(field => {
            if (field.required) {
                const value = this._getNestedValue(action, field.name);

                if (value === undefined || value === null || value === '') {
                    errors.push(`${field.label} is required`);
                }
            }
        });

        // Validate field constraints
        actionType.fields.forEach(field => {
            const value = this._getNestedValue(action, field.name);

            if (value === undefined || value === null) return;

            if (field.type === 'number') {
                if (typeof value !== 'number') {
                    errors.push(`${field.label} must be a number`);
                } else {
                    if (field.min !== undefined && value < field.min) {
                        errors.push(`${field.label} must be at least ${field.min}`);
                    }
                    if (field.max !== undefined && value > field.max) {
                        errors.push(`${field.label} must be at most ${field.max}`);
                    }
                }
            }
        });

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get nested value from object
     */
    _getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * Get action display name
     */
    getDisplayName(action) {
        const actionType = this.actionTypes[action.type];
        if (!actionType) return action.type;

        let name = actionType.name;

        // Add coordinates for coordinate-based actions
        if (actionType.requiresCoordinates && action.x !== undefined && action.y !== undefined) {
            name += ` (${action.x}, ${action.y})`;
        }

        // Add text for input actions
        if (action.type === 'input' && action.text) {
            name += `: ${action.text.substring(0, 20)}${action.text.length > 20 ? '...' : ''}`;
        }

        // Add duration for wait actions
        if (action.type === 'wait' && action.duration) {
            name += `: ${action.duration}ms`;
        }

        return name;
    }

    /**
     * Get action description
     */
    getActionDescription(action) {
        const actionType = this.actionTypes[action.type];
        if (!actionType) return '';

        return actionType.description;
    }

    /**
     * Get estimated execution time
     */
    getEstimatedExecutionTime(action) {
        const actionType = this.actionTypes[action.type];
        if (!actionType) return 0;

        if (actionType.executionTime === null) {
            // Variable execution time based on action parameters
            if (action.type === 'wait') {
                return action.duration || 1000;
            }
            if (action.type === 'image-match') {
                return action.timeout || 10000;
            }
            if (action.type === 'sound-check') {
                return action.duration || 5000;
            }
        }

        return actionType.executionTime || 0;
    }

    /**
     * Get action icon
     */
    getActionIcon(typeId) {
        const actionType = this.actionTypes[typeId];
        return actionType ? actionType.icon : '❓';
    }

    /**
     * Get action color
     */
    getActionColor(typeId) {
        const actionType = this.actionTypes[typeId];
        return actionType ? actionType.color : '#64748b';
    }

    /**
     * Check if action requires coordinates
     */
    requiresCoordinates(typeId) {
        const actionType = this.actionTypes[typeId];
        return actionType ? actionType.requiresCoordinates : false;
    }

    /**
     * Check if action is control flow type
     */
    isControlFlow(typeId) {
        const actionType = this.actionTypes[typeId];
        return actionType ? actionType.isControl === true : false;
    }

    /**
     * Check if action is testing type
     */
    isTestingAction(typeId) {
        const actionType = this.actionTypes[typeId];
        return actionType ? actionType.isTesting === true : false;
    }

    /**
     * Get actions filtered by feature
     */
    getBasicActions() {
        return this.getActionTypesByCategory('basic');
    }

    getNavigationActions() {
        return this.getActionTypesByCategory('navigation');
    }

    getVisionActions() {
        return this.getActionTypesByCategory('vision');
    }

    getControlActions() {
        return this.getActionTypesByCategory('control');
    }

    getTestingActions() {
        return this.getActionTypesByCategory('testing');
    }
}

// Export for use in renderer process
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ActionConfigProvider;
}

if (typeof window !== 'undefined') {
    window.ActionConfigProvider = ActionConfigProvider;
}
