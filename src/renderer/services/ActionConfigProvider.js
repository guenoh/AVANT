/**
 * ActionConfigProvider
 * Provides action type configurations, metadata, and validation rules
 */

class ActionConfigProvider {
    /**
     * Get standard comparison operators for condition actions
     * Single source of truth for all operator definitions
     */
    static getComparisonOperators() {
        return [
            { value: '>=', label: '이상' },
            { value: '>', label: '초과' },
            { value: '==', label: '같음' },
            { value: '<', label: '미만' },
            { value: '<=', label: '이하' },
            { value: '!=', label: '다름' }
        ];
    }

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
                name: '클릭',
                category: 'basic',
                description: '지정 좌표 탭',
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
                name: '롱프레스',
                category: 'basic',
                description: '지정 좌표 길게 누르기',
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
                name: '드래그',
                category: 'basic',
                description: '시작점에서 끝점으로 스와이프',
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
                name: '텍스트 입력',
                category: 'basic',
                description: '포커스된 필드에 텍스트 입력',
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
                name: '대기',
                category: 'timing',
                description: '지정된 시간 동안 대기',
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
                name: '뒤로가기',
                category: 'navigation',
                description: '뒤로가기 버튼 누르기',
                icon: '◀️',
                color: '#64748b',
                requiresCoordinates: false,
                fields: [],
                defaultParams: {},
                executionTime: 100
            },

            'home': {
                id: 'home',
                name: '홈 버튼',
                category: 'navigation',
                description: '홈 버튼 누르기',
                icon: '🏠',
                color: '#64748b',
                requiresCoordinates: false,
                fields: [],
                defaultParams: {},
                executionTime: 100
            },

            'recent': {
                id: 'recent',
                name: '최근 앱',
                category: 'navigation',
                description: '최근 앱 목록 열기',
                icon: '📱',
                color: '#64748b',
                requiresCoordinates: false,
                fields: [],
                defaultParams: {},
                executionTime: 100
            },

            'image-match': {
                id: 'image-match',
                name: '이미지 찾기',
                category: 'vision',
                description: '이미지 찾기 및 클릭',
                icon: '🔍',
                color: '#ea580c',
                requiresCoordinates: false,
                fields: [
                    { name: 'imagePath', type: 'file', label: 'Template Image', required: true, accept: 'image/*' },
                    { name: 'threshold', type: 'number', label: 'Match Threshold', required: true, min: 0, max: 1, step: 0.01, default: 0.8 },
                    { name: 'action', type: 'select', label: 'Action on Match', required: true, options: ['click', 'long-press', 'none'], default: 'click' },
                    { name: 'timeout', type: 'number', label: 'Timeout (ms)', required: true, min: 1000, max: 60000, default: 10000 }
                ],
                defaultParams: {
                    imagePath: '',
                    threshold: 0.8,
                    region: null,
                    action: 'click',
                    timeout: 10000,
                    comparison: { operator: '>=', value: 0.95 }
                },
                executionTime: null, // Variable

                // Condition block metadata
                isConditionStart: true, // This block starts a condition (like if)
                canBeCondition: true,
                conditionReturnType: 'number', // Returns match confidence (0-1)
                comparisonOperators: ActionConfigProvider.getComparisonOperators(),
                defaultComparison: { operator: '>=', value: 0.95 }
            },

            'tap-matched-image': {
                id: 'tap-matched-image',
                name: '이미지 찾아서 클릭',
                category: 'basic',
                description: '이미지를 찾아서 해당 위치를 클릭',
                icon: '🎯',
                color: '#2563eb',
                requiresCoordinates: false,
                fields: [
                    { name: 'imagePath', type: 'file', label: 'Template Image', required: true, accept: 'image/*' },
                    { name: 'threshold', type: 'number', label: 'Match Threshold', required: true, min: 0, max: 1, step: 0.01, default: 0.95 },
                    { name: 'timeout', type: 'number', label: 'Timeout (ms)', required: true, min: 1000, max: 60000, default: 10000 }
                ],
                defaultParams: {
                    imagePath: '',
                    regionImage: '',
                    threshold: 0.95,
                    timeout: 10000
                },
                executionTime: null // Variable
            },

            'sound-check': {
                id: 'sound-check',
                name: '소리 감지',
                category: 'sensor',
                description: '소리 유무 또는 레벨 확인',
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
                executionTime: null, // Variable

                // Condition metadata
                canBeCondition: true,
                conditionReturnType: 'number', // Returns decibel level (dB)
                comparisonOperators: ActionConfigProvider.getComparisonOperators(),
                defaultComparison: { operator: '>=', value: 50 }
            },

            'if': {
                id: 'if',
                name: '조건 분기',
                category: 'control',
                description: '복수 조건에 따른 분기',
                icon: '❓',
                color: '#0891b2',
                requiresCoordinates: false,
                fields: [
                    { name: 'condition', type: 'condition', label: 'Condition', required: true }
                ],
                defaultParams: { conditions: [], conditionOperator: 'AND' },
                executionTime: null, // Variable
                isConditionStart: true // This block starts a condition
            },

            'while': {
                id: 'while',
                name: '조건 반복',
                category: 'control',
                description: '조건이 참인 동안 반복',
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
                name: '반복',
                category: 'control',
                description: 'N번 반복 실행 (고정 숫자 또는 변수 참조)',
                icon: '🔁',
                color: '#0891b2',
                requiresCoordinates: false,
                fields: [
                    {
                        name: 'countType',
                        type: 'select',
                        label: 'Count Type',
                        required: true,
                        options: [
                            { value: 'constant', label: 'Fixed Number' },
                            { value: 'variable', label: 'Variable' }
                        ],
                        default: 'constant'
                    },
                    { name: 'count', type: 'number', label: 'Repeat Count', required: false, min: 1, max: 1000, default: 1 },
                    { name: 'variableName', type: 'text', label: 'Variable Name', required: false, placeholder: 'e.g., volume' }
                ],
                defaultParams: { countType: 'constant', count: 1, variableName: '', actions: [] },
                executionTime: null, // Variable
                isControl: true
            },

            'skip': {
                id: 'skip',
                name: '스킵',
                category: 'testing',
                description: '이 액션 건너뛰기',
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
                name: '실패',
                category: 'testing',
                description: '메시지와 함께 실패 처리',
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
                name: '테스트',
                category: 'testing',
                description: '테스트 검증',
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
            },

            'get-volume': {
                id: 'get-volume',
                name: '볼륨 확인',
                category: 'system',
                description: '현재 디바이스 볼륨 레벨 확인',
                icon: '🔊',
                color: '#8b5cf6',
                requiresCoordinates: false,
                protocols: ['adb'],
                fields: [
                    {
                        name: 'streamType',
                        type: 'select',
                        label: 'Stream Type',
                        required: true,
                        options: [
                            { value: 'music', label: 'Music/Media' },
                            { value: 'ring', label: 'Ringtone' },
                            { value: 'alarm', label: 'Alarm' },
                            { value: 'notification', label: 'Notification' }
                        ],
                        default: 'music'
                    },
                    {
                        name: 'saveToVariable',
                        type: 'text',
                        label: 'Save to Variable (optional)',
                        required: false,
                        placeholder: 'e.g., currentVolume'
                    }
                ],
                defaultParams: {
                    streamType: 'music',
                    saveToVariable: '',
                    comparison: { operator: '>=', value: 50 }
                },
                executionTime: 500,
                isSystemInfo: true,

                // Condition block metadata
                isConditionStart: true, // This block starts a condition (like if)
                canBeCondition: true,
                conditionReturnType: 'number', // Returns volume level (0-100)
                comparisonOperators: ActionConfigProvider.getComparisonOperators(),
                defaultComparison: { operator: '>=', value: 50 }
            },

            'set-variable': {
                id: 'set-variable',
                name: '변수 설정',
                category: 'variables',
                description: '이전 액션의 결과값이나 상수를 변수에 저장합니다. 저장된 변수는 나중에 연산이나 루프에서 사용할 수 있습니다.',
                icon: '📦',
                color: '#10b981',
                requiresCoordinates: false,
                fields: [
                    {
                        name: 'variableName',
                        type: 'text',
                        label: 'Variable Name',
                        required: true,
                        placeholder: 'e.g., myVolume'
                    },
                    {
                        name: 'source',
                        type: 'select',
                        label: 'Value Source',
                        required: true,
                        options: [
                            { value: 'previous', label: 'Previous Action Result' },
                            { value: 'constant', label: 'Constant Value' }
                        ],
                        default: 'previous'
                    },
                    {
                        name: 'value',
                        type: 'number',
                        label: 'Constant Value',
                        required: false,
                        placeholder: '0'
                    }
                ],
                defaultParams: {
                    variableName: '',
                    source: 'previous',
                    value: 0
                },
                executionTime: 10
            },

            'calc-variable': {
                id: 'calc-variable',
                name: '변수 연산',
                category: 'variables',
                description: '두 개의 값(변수 또는 상수)으로 산술 연산을 수행하고 결과를 변수에 저장합니다. 예: volume / 10 = loopCount',
                icon: '🔢',
                color: '#10b981',
                requiresCoordinates: false,
                fields: [
                    {
                        name: 'targetVariable',
                        type: 'text',
                        label: 'Target Variable',
                        required: true,
                        placeholder: 'e.g., loopCount'
                    },
                    {
                        name: 'operand1Type',
                        type: 'select',
                        label: 'First Operand Type',
                        required: true,
                        options: [
                            { value: 'variable', label: 'Variable' },
                            { value: 'constant', label: 'Constant' }
                        ],
                        default: 'variable'
                    },
                    {
                        name: 'operand1Variable',
                        type: 'text',
                        label: 'First Variable Name',
                        required: false,
                        placeholder: 'e.g., volume'
                    },
                    {
                        name: 'operand1Value',
                        type: 'number',
                        label: 'First Constant Value',
                        required: false,
                        placeholder: '0'
                    },
                    {
                        name: 'operation',
                        type: 'select',
                        label: 'Operation',
                        required: true,
                        options: [
                            { value: '+', label: '+  (Add)' },
                            { value: '-', label: '-  (Subtract)' },
                            { value: '*', label: '*  (Multiply)' },
                            { value: '/', label: '/  (Divide)' }
                        ],
                        default: '+'
                    },
                    {
                        name: 'operand2Type',
                        type: 'select',
                        label: 'Second Operand Type',
                        required: true,
                        options: [
                            { value: 'variable', label: 'Variable' },
                            { value: 'constant', label: 'Constant' }
                        ],
                        default: 'constant'
                    },
                    {
                        name: 'operand2Variable',
                        type: 'text',
                        label: 'Second Variable Name',
                        required: false,
                        placeholder: 'e.g., divisor'
                    },
                    {
                        name: 'operand2Value',
                        type: 'number',
                        label: 'Second Constant Value',
                        required: false,
                        placeholder: '0'
                    }
                ],
                defaultParams: {
                    targetVariable: '',
                    operand1Type: 'variable',
                    operand1Variable: '',
                    operand1Value: 0,
                    operation: '+',
                    operand2Type: 'constant',
                    operand2Variable: '',
                    operand2Value: 0
                },
                executionTime: 10
            },

            // Condition flow blocks
            'else': {
                id: 'else',
                name: '아니면',
                category: 'control',
                description: '이전 조건이 거짓일 때 실행',
                icon: '↪️',
                color: '#f97316',
                requiresCoordinates: false,
                fields: [],
                defaultParams: {},
                executionTime: 0,
                isConditionElse: true // Marks else branch
            },

            'endif': {
                id: 'endif',
                name: '조건 끝',
                category: 'control',
                description: '조건 블록 종료',
                icon: '🔚',
                color: '#64748b',
                requiresCoordinates: false,
                fields: [],
                defaultParams: {},
                executionTime: 0,
                isConditionEnd: true // Marks end of condition block
            },

            // Exit actions
            'success': {
                id: 'success',
                name: '성공',
                category: 'result',
                description: '매크로 성공 종료',
                icon: '✅',
                color: '#0ea5e9',
                requiresCoordinates: false,
                fields: [
                    { name: 'message', type: 'text', label: '메시지', required: false }
                ],
                defaultParams: { message: '' },
                executionTime: 0,
                isExit: true
            },

            // Log action
            'log': {
                id: 'log',
                name: '로그',
                category: 'flow',
                description: '로그 메시지 출력',
                icon: '📝',
                color: '#14b8a6',
                requiresCoordinates: false,
                fields: [
                    { name: 'message', type: 'text', label: '메시지', required: true }
                ],
                defaultParams: { message: '' },
                executionTime: 0
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
            },
            system: {
                id: 'system',
                name: 'System Info (ADB)',
                description: 'Device system information (ADB only)',
                icon: '📊',
                color: '#8b5cf6',
                protocols: ['adb']
            },
            variables: {
                id: 'variables',
                name: 'Variables',
                description: 'Variable storage and manipulation',
                icon: '📦',
                color: '#10b981'
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

    /**
     * Check if action is supported by protocol
     */
    isSupportedByProtocol(typeId, protocol) {
        const actionType = this.actionTypes[typeId];
        if (!actionType) return false;

        // If no protocol constraint, support all protocols
        if (!actionType.protocols) return true;

        // If protocol constraint exists, only support specified protocols
        return actionType.protocols.includes(protocol);
    }

    /**
     * Get actions by protocol
     */
    getActionsByProtocol(protocol) {
        return Object.values(this.actionTypes).filter(action =>
            !action.protocols || action.protocols.includes(protocol)
        );
    }

    /**
     * Get category info with protocol support
     */
    getCategoryWithProtocolInfo(categoryId, currentProtocol) {
        const category = this.actionCategories[categoryId];
        if (!category) return null;

        const isSupported = !category.protocols ||
                           category.protocols.includes(currentProtocol);

        return {
            ...category,
            isSupported,
            protocolHint: category.protocols ?
                `(${category.protocols.join(', ')} only)` : ''
        };
    }

    /**
     * Check if action is system info type
     */
    isSystemInfo(typeId) {
        const actionType = this.actionTypes[typeId];
        return actionType ? actionType.isSystemInfo === true : false;
    }

    /**
     * Check if action can be used as a condition
     */
    canBeCondition(typeId) {
        const actionType = this.actionTypes[typeId];
        return actionType ? actionType.canBeCondition === true : false;
    }

    /**
     * Get condition metadata for an action type
     */
    getConditionMetadata(typeId) {
        const actionType = this.actionTypes[typeId];
        if (!actionType || !actionType.canBeCondition) {
            return null;
        }

        return {
            returnType: actionType.conditionReturnType,
            operators: actionType.comparisonOperators,
            defaultComparison: actionType.defaultComparison
        };
    }

    /**
     * Get all action types that can be used as conditions
     */
    getConditionCapableActions() {
        return Object.values(this.actionTypes).filter(action => action.canBeCondition === true);
    }

    /**
     * Get comparison operators for a specific action type
     */
    getComparisonOperators(typeId) {
        const actionType = this.actionTypes[typeId];
        return actionType?.comparisonOperators || [];
    }

    /**
     * Get default comparison for an action type
     */
    getDefaultComparison(typeId) {
        const actionType = this.actionTypes[typeId];
        return actionType?.defaultComparison || { operator: '>=', value: 0 };
    }

    /**
     * Get UI configuration for action type (Tailwind classes, labels, icons)
     * This is the single source of truth for all action type UI configurations
     * @param {string} typeId - Action type ID
     * @param {Function} getIconSVG - Function to get SVG icon by name
     * @returns {Object} UI configuration object
     */
    getUIConfig(typeId, getIconSVG) {
        // Mapping from hex colors to Tailwind classes
        const colorMapping = {
            '#2563eb': { color: 'bg-blue-500', borderClass: 'border-blue-500', bgClass: 'bg-blue-50' },
            '#ca8a04': { color: 'bg-yellow-600', borderClass: 'border-yellow-600', bgClass: 'bg-yellow-50' },
            '#7c3aed': { color: 'bg-purple-500', borderClass: 'border-purple-500', bgClass: 'bg-purple-50' },
            '#16a34a': { color: 'bg-green-500', borderClass: 'border-green-500', bgClass: 'bg-green-50' },
            '#dc2626': { color: 'bg-red-500', borderClass: 'border-red-500', bgClass: 'bg-red-50' },
            '#64748b': { color: 'bg-slate-500', borderClass: 'border-slate-500', bgClass: 'bg-slate-50' },
            '#0891b2': { color: 'bg-cyan-600', borderClass: 'border-cyan-600', bgClass: 'bg-cyan-50' },
            '#4f46e5': { color: 'bg-indigo-500', borderClass: 'border-indigo-500', bgClass: 'bg-indigo-50' },
            '#be185d': { color: 'bg-pink-700', borderClass: 'border-pink-700', bgClass: 'bg-pink-50' },
            '#f97316': { color: 'bg-orange-500', borderClass: 'border-orange-500', bgClass: 'bg-orange-50' },
            '#8b5cf6': { color: 'bg-violet-500', borderClass: 'border-violet-500', bgClass: 'bg-violet-50' },
            '#06b6d4': { color: 'bg-cyan-500', borderClass: 'border-cyan-500', bgClass: 'bg-cyan-50' },
            '#ec4899': { color: 'bg-pink-500', borderClass: 'border-pink-500', bgClass: 'bg-pink-50' },
            '#10b981': { color: 'bg-emerald-500', borderClass: 'border-emerald-500', bgClass: 'bg-emerald-50' },
            '#f59e0b': { color: 'bg-amber-500', borderClass: 'border-amber-500', bgClass: 'bg-amber-50' },
            '#ef4444': { color: 'bg-red-500', borderClass: 'border-red-500', bgClass: 'bg-red-50' },
            '#d946ef': { color: 'bg-fuchsia-500', borderClass: 'border-fuchsia-500', bgClass: 'bg-fuchsia-50' },
            '#6366f1': { color: 'bg-indigo-600', borderClass: 'border-indigo-600', bgClass: 'bg-indigo-50' },
            '#9333ea': { color: 'bg-purple-600', borderClass: 'border-purple-600', bgClass: 'bg-purple-50' }
        };

        // Icon mapping from action type to SVG icon name
        const iconMapping = {
            'click': 'click',
            'long-press': 'hand',
            'drag': 'move',
            'input': 'keyboard',
            'keyboard': 'keyboard',
            'wait': 'clock',
            'home': 'home',
            'back': 'arrow-left',
            'screenshot': 'camera',
            'image-match': 'image',
            'tap-matched-image': 'target',
            'if': 'git-branch',
            'else-if': 'code',
            'else': 'corner-down-right',
            'endif': 'corner-down-left',
            'log': 'file-text',
            'loop': 'repeat',
            'while': 'rotate-cw',
            'end-if': 'x',
            'end-loop': 'x',
            'end-while': 'x',
            'success': 'check-circle',
            'skip': 'skip-forward',
            'fail': 'x-circle',
            'test': 'settings',
            'sound-check': 'mic',
            'get-volume': 'volume',
            'set-variable': 'package',
            'calc-variable': 'calculator'
        };

        // Korean labels for action types
        const labelMapping = {
            'click': '클릭',
            'long-press': '롱프레스',
            'drag': '드래그',
            'input': '텍스트 입력',
            'keyboard': '키보드 입력',
            'wait': '대기',
            'home': '홈 버튼',
            'back': '뒤로가기',
            'screenshot': '스크린샷',
            'image-match': '이미지 찾기',
            'tap-matched-image': '찾은 영역 클릭',
            'if': '조건 분기',
            'else-if': '아니면 조건',
            'else': '아니면',
            'endif': '조건 끝',
            'log': '로그',
            'loop': '반복',
            'while': '조건 반복',
            'end-if': '조건 끝',
            'end-loop': '반복 끝',
            'end-while': '조건 반복 끝',
            'success': '성공',
            'skip': '스킵',
            'fail': '실패',
            'test': '테스트',
            'sound-check': '소리 감지',
            'get-volume': '볼륨 확인',
            'set-variable': '변수 설정',
            'calc-variable': '변수 연산'
        };

        // Explicit Tailwind color mapping for each action type
        // Color-blind safe palette (Deuteranopia/Protanopia friendly)
        // Avoids red-green confusion by using Blue, Orange, Teal, and distinct tones
        const tailwindColorMapping = {
            // 1. Actions (Blue tones) - Direct device commands
            // Blue is safe for all color vision types
            'click': { color: 'bg-blue-500', borderClass: 'border-blue-500', bgClass: 'bg-blue-50' },
            'long-press': { color: 'bg-blue-600', borderClass: 'border-blue-600', bgClass: 'bg-blue-50' },
            'drag': { color: 'bg-blue-700', borderClass: 'border-blue-700', bgClass: 'bg-blue-50' },
            'input': { color: 'bg-sky-600', borderClass: 'border-sky-600', bgClass: 'bg-sky-50' },
            'tap-matched-image': { color: 'bg-blue-400', borderClass: 'border-blue-400', bgClass: 'bg-blue-50' },
            'keyboard': { color: 'bg-sky-600', borderClass: 'border-sky-600', bgClass: 'bg-sky-50' },

            // 2. Conditions (Orange/Amber tones) - Condition starters
            // Orange is distinguishable from blue for color-blind users
            'image-match': { color: 'bg-orange-500', borderClass: 'border-orange-500', bgClass: 'bg-orange-50' },
            'sound-check': { color: 'bg-amber-500', borderClass: 'border-amber-500', bgClass: 'bg-amber-50' },
            'get-volume': { color: 'bg-orange-600', borderClass: 'border-orange-600', bgClass: 'bg-orange-50' },
            'set-variable': { color: 'bg-emerald-500', borderClass: 'border-emerald-500', bgClass: 'bg-emerald-50' },
            'calc-variable': { color: 'bg-emerald-600', borderClass: 'border-emerald-600', bgClass: 'bg-emerald-50' },
            'if': { color: 'bg-amber-600', borderClass: 'border-amber-600', bgClass: 'bg-amber-50' },

            // 3. Flow Control (Teal/Cyan tones) - Execution flow
            // Teal provides good contrast with both blue and orange
            'wait': { color: 'bg-teal-500', borderClass: 'border-teal-500', bgClass: 'bg-teal-50' },
            'loop': { color: 'bg-cyan-600', borderClass: 'border-cyan-600', bgClass: 'bg-cyan-50' },
            'log': { color: 'bg-teal-600', borderClass: 'border-teal-600', bgClass: 'bg-teal-50' },

            // 4. Exit (Color-blind safe exit states)
            // Using blue, orange, fuchsia instead of traffic light colors
            'success': { color: 'bg-sky-500', borderClass: 'border-sky-500', bgClass: 'bg-sky-50' },
            'skip': { color: 'bg-amber-400', borderClass: 'border-amber-400', bgClass: 'bg-amber-50' },
            'fail': { color: 'bg-fuchsia-500', borderClass: 'border-fuchsia-500', bgClass: 'bg-fuchsia-50' },

            // Auto-generated blocks (inherit from parent, fallback colors)
            'endif': { color: 'bg-orange-400', borderClass: 'border-orange-400', bgClass: 'bg-orange-50' },
            'else': { color: 'bg-orange-400', borderClass: 'border-orange-400', bgClass: 'bg-orange-50' },
            'else-if': { color: 'bg-orange-400', borderClass: 'border-orange-400', bgClass: 'bg-orange-50' },
            'end-if': { color: 'bg-orange-400', borderClass: 'border-orange-400', bgClass: 'bg-orange-50' },
            'end-loop': { color: 'bg-cyan-400', borderClass: 'border-cyan-400', bgClass: 'bg-cyan-50' },
            'end-while': { color: 'bg-cyan-400', borderClass: 'border-cyan-400', bgClass: 'bg-cyan-50' },
            'while': { color: 'bg-cyan-700', borderClass: 'border-cyan-700', bgClass: 'bg-cyan-50' },

            // Hidden from palette (system/dev)
            'home': { color: 'bg-slate-400', borderClass: 'border-slate-400', bgClass: 'bg-slate-50' },
            'back': { color: 'bg-slate-400', borderClass: 'border-slate-400', bgClass: 'bg-slate-50' },
            'screenshot': { color: 'bg-slate-400', borderClass: 'border-slate-400', bgClass: 'bg-slate-50' },
            'test': { color: 'bg-zinc-500', borderClass: 'border-zinc-500', bgClass: 'bg-zinc-50' }
        };

        const actionType = this.actionTypes[typeId];

        // Default config for unknown types
        const defaultConfig = {
            label: typeId,
            color: 'bg-slate-500',
            borderClass: 'border-slate-500',
            bgClass: 'bg-slate-50',
            icon: getIconSVG ? getIconSVG('help-circle') : ''
        };

        // Use explicit tailwind mapping first (single source of truth for UI colors)
        const colorConfig = tailwindColorMapping[typeId] || {
            color: 'bg-slate-500',
            borderClass: 'border-slate-500',
            bgClass: 'bg-slate-50'
        };

        if (!actionType) {
            // Even for unknown action types, try to use explicit mapping
            if (tailwindColorMapping[typeId]) {
                return {
                    ...defaultConfig,
                    ...colorConfig
                };
            }
            return defaultConfig;
        }

        // Get icon
        const iconName = iconMapping[typeId];
        let icon = '';
        if (getIconSVG && iconName) {
            icon = getIconSVG(iconName);
        } else if (typeId === 'get-volume') {
            // Special case for get-volume with inline SVG
            icon = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.414a2 2 0 002.828 0L16 8V5l-3 3-8.586 8.586z"></path></svg>';
        }

        return {
            label: labelMapping[typeId] || actionType.name || typeId,
            ...colorConfig,
            icon
        };
    }

    /**
     * Static method to get action config (for backwards compatibility)
     */
    static getActionConfig(typeId) {
        // Create singleton instance if needed
        if (!ActionConfigProvider._instance) {
            ActionConfigProvider._instance = new ActionConfigProvider();
        }
        return ActionConfigProvider._instance.getActionType(typeId);
    }

    /**
     * Get action palette structure for UI rendering
     * This is the single source of truth for action palette categories and items
     * New 4-category system:
     * - actions: Direct device commands (blue tones)
     * - conditions: Condition starters with auto-endif (purple/indigo tones)
     * - flow: Execution flow control (slate/pink tones)
     * - exit: Scenario termination (traffic light colors)
     * @param {Function} getIconSVG - Function to get SVG icon by name
     * @returns {Object} Action palette structure with categories
     */
    getActionPaletteData(getIconSVG) {
        // Description mapping for palette display
        const descriptionMapping = {
            // Actions - 디바이스를 직접 조작하는 액션들
            'click': '지정한 좌표를 한 번 터치합니다',
            'long-press': '지정한 좌표를 길게 눌러 컨텍스트 메뉴를 엽니다',
            'drag': '시작점에서 끝점까지 손가락을 드래그합니다',
            'input': '포커스된 입력 필드에 텍스트를 입력합니다',
            'tap-matched-image': '화면에서 이미지를 찾아 해당 위치를 자동으로 클릭합니다',
            // Conditions - 조건을 확인하고 분기하는 액션들
            'image-match': '화면에서 이미지를 찾아 매칭 여부를 확인합니다',
            'sound-check': '마이크로 소리를 감지하고 데시벨을 측정합니다',
            'get-volume': '디바이스의 현재 볼륨 레벨을 가져옵니다',
            'if': '여러 조건을 조합하여 복잡한 분기를 만듭니다',
            // Flow - 실행 흐름을 제어하는 액션들
            'wait': '지정한 시간(밀리초) 동안 대기합니다',
            'loop': '지정한 횟수만큼 내부 액션들을 반복합니다',
            'log': '디버깅용 메시지를 콘솔에 출력합니다',
            // Exit - 매크로 실행을 종료하는 액션들
            'success': '매크로를 성공으로 표시하고 종료합니다',
            'skip': '현재 액션을 건너뛰고 다음으로 진행합니다',
            'fail': '매크로를 실패로 표시하고 즉시 중단합니다'
        };

        // New 4-category palette structure
        // Hidden items: endif, else, else-if, end-loop, end-while, while, home, back, screenshot, test, if
        const paletteCategories = {
            actions: ['click', 'long-press', 'drag', 'input', 'tap-matched-image'],
            conditions: ['image-match', 'sound-check', 'get-volume'],
            flow: ['wait', 'loop', 'log', 'set-variable', 'calc-variable'],
            exit: ['success', 'skip', 'fail']
        };

        const result = {};

        for (const [category, types] of Object.entries(paletteCategories)) {
            result[category] = types.map(typeId => {
                const uiConfig = this.getUIConfig(typeId, getIconSVG);
                return {
                    type: typeId,
                    icon: uiConfig.icon,
                    label: uiConfig.label,
                    description: descriptionMapping[typeId] || '',
                    color: uiConfig.color
                };
            });
        }

        return result;
    }
}

// Export for use in renderer process
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ActionConfigProvider;
}

if (typeof window !== 'undefined') {
    window.ActionConfigProvider = ActionConfigProvider;
}
