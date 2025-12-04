/**
 * MacroBuilderController
 * Thin coordinator layer between UI and services
 * Manages service lifecycle and coordinates service interactions
 */

class MacroBuilderController {
    constructor() {
        // Service instances
        this.services = {
            eventBus: null,
            ipc: null,
            logger: null,
            actionService: null,
            coordinateService: null,
            macroExecutor: null,
            markerRenderer: null,
            screenInteraction: null,
            actionConfig: null
        };

        // UI state
        this.state = {
            macroName: '새 매크로',
            currentFilePath: null,
            selectedActionId: null,
            expandedActionId: null,
            isRunning: false,
            shouldStop: false,
            isDeviceConnected: false,
            deviceType: null,
            deviceName: null,
            deviceId: null,
            screenWidth: 1080,
            screenHeight: 2400,
            fps: 0
        };

        // UI elements cache
        this.elements = {};

        this.initialized = false;
    }

    /**
     * Initialize controller and all services
     */
    async init() {
        if (this.initialized) {
            console.warn('Controller already initialized');
            return;
        }

        console.log('Initializing MacroBuilderController...');

        try {
            // Initialize core services
            await this._initializeServices();

            // Cache DOM elements
            this._cacheElements();

            // Setup event listeners
            this._setupEventListeners();

            // Setup service event subscriptions
            this._setupServiceSubscriptions();

            // Initial render
            this._renderInitialUI();

            this.initialized = true;

            this.services.logger.success('MacroBuilderController initialized successfully');
        } catch (error) {
            console.error('Failed to initialize controller:', error);
            throw error;
        }
    }

    /**
     * Initialize all services
     */
    async _initializeServices() {
        // EventBus (already exists globally)
        this.services.eventBus = window.eventBus || new EventBus();

        // IPC Service (already exists globally)
        this.services.ipc = window.ipcService;

        // Logger Service
        this.services.logger = new LoggerService({
            maxLogs: 1000,
            levels: ['info', 'success', 'warning', 'error', 'debug']
        });

        // Action Config Provider
        this.services.actionConfig = new ActionConfigProvider();

        // Coordinate System
        const coordinateSystem = new CoordinateSystem();
        coordinateSystem.init(this.state.screenWidth, this.state.screenHeight, 0);

        // Coordinate Service
        this.services.coordinateService = new CoordinateService(coordinateSystem);

        // Action Service
        this.services.actionService = new ActionService(
            null, // actionStore will be added later
            this.services.ipc
        );

        // Macro Executor
        this.services.macroExecutor = new MacroExecutor(
            this.services.actionService,
            this.services.eventBus,
            { stopOnFailure: false }
        );

        // Canvas for marker rendering
        const canvas = document.getElementById('marker-canvas');
        const imgElement = document.getElementById('screen-image');

        if (canvas) {
            // Marker Renderer
            this.services.markerRenderer = new MarkerRenderer(
                canvas,
                this.services.coordinateService
            );

            // Screen Interaction Handler
            this.services.screenInteraction = new ScreenInteractionHandler(
                canvas,
                this.services.coordinateService,
                this.services.markerRenderer,
                this.services.eventBus
            );

            this.services.screenInteraction.setImageElement(imgElement);
        }

        console.log('All services initialized');
    }

    /**
     * Cache frequently used DOM elements
     */
    _cacheElements() {
        this.elements = {
            // Macro controls
            macroNameInput: document.getElementById('macro-name-input'),
            btnRunMacro: document.getElementById('btn-run-macro'),
            btnSaveMacro: document.getElementById('btn-save-macro'),
            btnSaveAsMacro: document.getElementById('btn-save-as-macro'),
            btnImportMacro: document.getElementById('btn-import-macro'),
            importInput: document.getElementById('import-input-seq'),

            // Device connection
            btnConnectAdb: document.getElementById('btn-connect-adb'),
            btnConnectIsap: document.getElementById('btn-connect-isap'),
            deviceStatus: document.getElementById('device-status'),

            // Screen
            screenImage: document.getElementById('screen-image'),
            markerCanvas: document.getElementById('marker-canvas'),

            // Action sequence
            actionSequenceList: document.getElementById('action-sequence-list'),

            // Log output
            logOutput: document.getElementById('log-output')
        };
    }

    /**
     * Setup UI event listeners
     */
    _setupEventListeners() {
        // Macro name input
        if (this.elements.macroNameInput) {
            this.elements.macroNameInput.addEventListener('input', (e) => {
                this.state.macroName = e.target.value;
            });
        }

        // Run/Stop macro button
        if (this.elements.btnRunMacro) {
            this.elements.btnRunMacro.addEventListener('click', () => {
                if (this.state.isRunning) {
                    this.stopMacro();
                } else {
                    this.runMacro();
                }
            });
        }

        // Save buttons
        if (this.elements.btnSaveMacro) {
            this.elements.btnSaveMacro.addEventListener('click', () => {
                this.saveMacro();
            });
        }

        if (this.elements.btnSaveAsMacro) {
            this.elements.btnSaveAsMacro.addEventListener('click', () => {
                this.saveAsMacro();
            });
        }

        // Import button
        if (this.elements.btnImportMacro) {
            this.elements.btnImportMacro.addEventListener('click', () => {
                this.elements.importInput?.click();
            });
        }

        if (this.elements.importInput) {
            this.elements.importInput.addEventListener('change', (e) => {
                this.importMacro(e);
            });
        }

        // Device connection buttons
        if (this.elements.btnConnectAdb) {
            this.elements.btnConnectAdb.addEventListener('click', () => {
                this.connectDevice('adb');
            });
        }

        if (this.elements.btnConnectIsap) {
            this.elements.btnConnectIsap.addEventListener('click', () => {
                this.connectDevice('isap');
            });
        }
    }

    /**
     * Setup service event subscriptions
     */
    _setupServiceSubscriptions() {
        // Logger subscriptions
        this.services.logger.subscribe((entry) => {
            this._handleLogEntry(entry);
        });

        // Macro execution subscriptions
        this.services.eventBus.on('execution:start', (data) => {
            this._handleExecutionStart(data);
        });

        this.services.eventBus.on('execution:complete', (data) => {
            this._handleExecutionComplete(data);
        });

        this.services.eventBus.on('execution:error', (data) => {
            this._handleExecutionError(data);
        });

        this.services.eventBus.on('execution:action-start', (data) => {
            this._handleActionStart(data);
        });

        this.services.eventBus.on('execution:action-complete', (data) => {
            this._handleActionComplete(data);
        });

        this.services.eventBus.on('execution:action-failed', (data) => {
            this._handleActionFailed(data);
        });

        // Screen interaction subscriptions
        this.services.eventBus.on('interaction:click', (data) => {
            this._handleInteractionClick(data);
        });

        this.services.eventBus.on('interaction:drag', (data) => {
            this._handleInteractionDrag(data);
        });

        this.services.eventBus.on('interaction:region', (data) => {
            this._handleInteractionRegion(data);
        });

        this.services.eventBus.on('interaction:cursor-position', (data) => {
            this._handleCursorPosition(data);
        });
    }

    /**
     * Render initial UI
     */
    _renderInitialUI() {
        // Initial renders will be delegated to view components
        this.services.eventBus.emit('ui:render-requested', {
            type: 'initial'
        });
    }

    /**
     * Handle log entry
     */
    _handleLogEntry(entry) {
        // Emit for UI components to handle
        this.services.eventBus.emit('log:entry', entry);
    }

    /**
     * Handle execution start
     */
    _handleExecutionStart(data) {
        this.state.isRunning = true;
        this.state.shouldStop = false;

        this.services.logger.info('Macro execution started', {
            totalActions: data.totalActions
        });

        // Update UI
        if (this.elements.btnRunMacro) {
            this.elements.btnRunMacro.textContent = '중지';
            this.elements.btnRunMacro.classList.remove('btn-primary');
            this.elements.btnRunMacro.classList.add('btn-danger');
        }
    }

    /**
     * Handle execution complete
     */
    _handleExecutionComplete(data) {
        this.state.isRunning = false;

        this.services.logger.success('Macro execution completed', {
            completed: data.completedActions,
            failed: data.failedActions,
            duration: data.duration
        });

        // Update UI
        if (this.elements.btnRunMacro) {
            this.elements.btnRunMacro.textContent = '실행';
            this.elements.btnRunMacro.classList.remove('btn-danger');
            this.elements.btnRunMacro.classList.add('btn-primary');
        }
    }

    /**
     * Handle execution error
     */
    _handleExecutionError(data) {
        this.state.isRunning = false;

        this.services.logger.error('Macro execution error', {
            error: data.error.message
        });

        // Update UI
        if (this.elements.btnRunMacro) {
            this.elements.btnRunMacro.textContent = '실행';
            this.elements.btnRunMacro.classList.remove('btn-danger');
            this.elements.btnRunMacro.classList.add('btn-primary');
        }
    }

    /**
     * Handle action start
     */
    _handleActionStart(data) {
        this.services.logger.debug(`Action ${data.index + 1} started`, {
            action: data.action.type,
            progress: data.progress + '%'
        });

        // Highlight action in UI
        this.services.eventBus.emit('ui:action-highlight', {
            actionId: data.action.id,
            status: 'running'
        });
    }

    /**
     * Handle action complete
     */
    _handleActionComplete(data) {
        this.services.logger.success(`Action ${data.index + 1} completed`, {
            action: data.action.type
        });

        // Update action status in UI
        this.services.eventBus.emit('ui:action-highlight', {
            actionId: data.action.id,
            status: 'completed'
        });
    }

    /**
     * Handle action failed
     */
    _handleActionFailed(data) {
        this.services.logger.error(`Action ${data.index + 1} failed`, {
            action: data.action.type,
            error: data.error
        });

        // Update action status in UI
        this.services.eventBus.emit('ui:action-highlight', {
            actionId: data.action.id,
            status: 'failed'
        });
    }

    /**
     * Handle interaction click
     */
    _handleInteractionClick(data) {
        this.services.logger.debug('Screen clicked', {
            devicePos: data.devicePos
        });

        // Emit for action creation
        this.services.eventBus.emit('action:create-from-click', data);
    }

    /**
     * Handle interaction drag
     */
    _handleInteractionDrag(data) {
        this.services.logger.debug('Screen drag detected', {
            start: data.startDevice,
            end: data.endDevice,
            distance: data.distance
        });

        // Emit for action creation
        this.services.eventBus.emit('action:create-from-drag', data);
    }

    /**
     * Handle interaction region
     */
    _handleInteractionRegion(data) {
        this.services.logger.debug('Region selected', {
            region: data.deviceRegion
        });

        // Emit for action configuration
        this.services.eventBus.emit('action:region-selected', data);
    }

    /**
     * Handle cursor position
     */
    _handleCursorPosition(data) {
        // Emit for coordinate display
        this.services.eventBus.emit('ui:cursor-position-update', data);
    }

    /**
     * Run macro
     */
    async runMacro() {
        if (!this.state.isDeviceConnected) {
            this.services.logger.warning('No device connected');
            return;
        }

        // Get actions from action store or current action list
        const actions = window.macroBuilderApp?.actions || [];

        if (actions.length === 0) {
            this.services.logger.warning('No actions to execute');
            return;
        }

        try {
            // Read global action delay from toolbar
            const delaySelect = document.getElementById('toolbar-delay-select');
            const actionDelay = delaySelect ? parseInt(delaySelect.value) : 0;

            console.log('[MacroBuilderController] Global delay setting:', {
                element: delaySelect,
                value: delaySelect?.value,
                parsedDelay: actionDelay
            });

            // Update MacroExecutor options with current delay setting
            this.services.macroExecutor.options.actionDelay = actionDelay;

            const context = {
                deviceId: this.state.deviceId,
                imageMatcher: window.imageMatcher,
                AudioCapture: window.AudioCapture,
                coordinateService: this.services.coordinateService
            };

            await this.services.macroExecutor.execute(actions, context);
        } catch (error) {
            this.services.logger.error('Failed to run macro', { error: error.message });
        }
    }

    /**
     * Stop macro execution
     */
    stopMacro() {
        this.services.macroExecutor.stop();
        this.services.logger.info('Stop requested');
    }

    /**
     * Save macro
     */
    async saveMacro() {
        // Implementation delegated to macro save handler
        this.services.eventBus.emit('macro:save-requested', {
            filePath: this.state.currentFilePath,
            macroName: this.state.macroName
        });
    }

    /**
     * Save macro as new file
     */
    async saveAsMacro() {
        // Implementation delegated to macro save handler
        this.services.eventBus.emit('macro:save-as-requested', {
            macroName: this.state.macroName
        });
    }

    /**
     * Import macro
     */
    async importMacro(event) {
        // Implementation delegated to macro import handler
        this.services.eventBus.emit('macro:import-requested', {
            event
        });
    }

    /**
     * Connect device
     */
    async connectDevice(type) {
        this.services.logger.info(`Connecting to ${type.toUpperCase()} device...`);

        try {
            // Emit connection request
            this.services.eventBus.emit('device:connect-requested', { type });
        } catch (error) {
            this.services.logger.error('Failed to connect device', {
                error: error.message
            });
        }
    }

    /**
     * Update device status
     */
    updateDeviceStatus(connected, deviceType, deviceName, deviceId) {
        // Check if status actually changed to avoid duplicate logs
        const wasConnected = this.state.isDeviceConnected;
        const statusChanged = wasConnected !== connected;

        this.state.isDeviceConnected = connected;
        this.state.deviceType = deviceType;
        this.state.deviceName = deviceName;
        this.state.deviceId = deviceId;

        // Only log when status actually changes
        if (statusChanged) {
            if (connected) {
                this.services.logger.success(`Device connected: ${deviceName}`);
            } else {
                this.services.logger.info('Device disconnected');
            }
        }

        // Emit for UI update
        this.services.eventBus.emit('device:status-changed', {
            connected,
            deviceType,
            deviceName,
            deviceId
        });
    }

    /**
     * Update screen dimensions
     */
    updateScreenDimensions(width, height) {
        this.state.screenWidth = width;
        this.state.screenHeight = height;

        // Update coordinate system
        this.services.coordinateService.updateSystem(
            width,
            height,
            this.elements.screenImage?.naturalWidth || width,
            this.elements.screenImage?.naturalHeight || height
        );

        // Debug log removed to avoid unnecessary UI log entries
    }

    /**
     * Set interaction mode
     */
    setInteractionMode(mode) {
        if (this.services.screenInteraction) {
            this.services.screenInteraction.setMode(mode);
            this.services.logger.debug(`Interaction mode changed to: ${mode}`);
        }
    }

    /**
     * Get service instance
     */
    getService(serviceName) {
        return this.services[serviceName] || null;
    }

    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Cleanup
     */
    cleanup() {
        if (this.services.screenInteraction) {
            this.services.screenInteraction.cleanup();
        }

        if (this.services.markerRenderer) {
            this.services.markerRenderer.clear();
        }

        this.services.logger.info('Controller cleanup completed');
    }
}

// Export for use in renderer process
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MacroBuilderController;
}

if (typeof window !== 'undefined') {
    window.MacroBuilderController = MacroBuilderController;
}
