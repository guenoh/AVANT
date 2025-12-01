/**
 * Macro Builder App - Main Application
 * React design implementation with vanilla JavaScript
 */

class MacroBuilderApp {
    constructor() {
        // Initialize controller
        this.controller = new MacroBuilderController();

        // Initialize builders (Phase 2 Refactoring)
        this.actionSettingsBuilder = new ActionSettingsBuilder();
        this.actionConfigProvider = new ActionConfigProvider();

        // Actions and UI state
        this.actions = [];
        this.selectedActionId = null;
        this.expandedActionId = null;
        this.expandedConditionId = null;
        this.selectedCondition = null; // { actionId, conditionId }
        this.scenarioResult = null; // { status: 'pass'|'skip'|'fail', message: string }

        // Scenario blocks for multi-scenario workflow
        this.scenarioBlocks = []; // Array of scenario blocks
        this.expandedBlockId = null; // ID of currently expanded block (only one can be expanded)

        // Coordinate picking mode
        this.isPickingCoordinate = false;
        this.pendingActionType = null;
        this.dragStartPoint = null; // For drag action: stores first click point

        // Action types that require image region selection
        this.IMAGE_ACTION_TYPES = ['image-match', 'tap-matched-image'];

        // Region selection for image actions
        this.isSelectingRegion = false;
        this.selectionStart = null;
        this.selectionEnd = null;

        // Image matching result storage
        this.lastMatchedCoordinate = null; // Store last image-match result {x, y}

        // Variable system for dynamic scenarios
        this.variables = {}; // Runtime variable storage { variableName: value }
        this.lastActionResult = null; // Store result from last executed action

        // ADB device list
        this.adbDevices = null;

        // Track changes for save button state
        this.savedState = null; // JSON snapshot of actions when saved/loaded
        this.hasUnsavedChanges = false;

        // Track running scenarios for progress display
        this.runningScenarios = new Map(); // key -> { status: 'running', progress: { current: 0, total: 0 }, cancelFn: null }
        this.scenarioCancelFlag = false; // Flag to cancel current scenario execution

        // Multi-scenario file support
        this.currentFilePath = null; // Current file being edited (filesystem-safe filename)
        this.currentScenarioId = null; // Current scenario ID within the file

        this.init();
    }

    async init() {
        console.log('Initializing Macro Builder App...');

        // Initialize controller and services
        await this.controller.init();

        // Get service references for convenience
        this.logger = this.controller.getService('logger');
        this.actionConfig = this.controller.getService('actionConfig');
        this.coordinateService = this.controller.getService('coordinateService');
        this.markerRenderer = this.controller.getService('markerRenderer');
        this.screenInteraction = this.controller.getService('screenInteraction');
        this.macroExecutor = this.controller.getService('macroExecutor');
        this.eventBus = this.controller.getService('eventBus');

        // Backward compatibility - keep coordinateSystem reference
        this.coordinateSystem = this.coordinateService.system;

        // Migrate existing scenarios if needed (run once)
        const migrationFlag = localStorage.getItem('scenario_migration_v2_done');
        if (!migrationFlag) {
            console.log('[Init] Running first-time migration...');
            this.migrateExistingScenarios();
            localStorage.setItem('scenario_migration_v2_done', 'true');
        }

        // Add filename field to existing registry entries (run once)
        const filenameMigrationFlag = localStorage.getItem('scenario_filename_migration_done');
        if (!filenameMigrationFlag) {
            console.log('[Init] Adding filename field to registry...');
            this.addFilenameToRegistry();
            localStorage.setItem('scenario_filename_migration_done', 'true');
        }

        // Setup event listeners
        this.setupEventListeners();
        this.setupServiceEventListeners();

        // Render initial UI
        this.renderScreenPreview();
        this.renderDeviceStatus();

        // Check initial device connection state
        this.checkInitialDeviceState();

        this.renderActionList();

        // Show scenario list by default (don't render action sequence on init)
        this.renderScenarioListInPanel();

        // Initialize UI state (no scenario loaded initially)
        this.updateToolbarButtons(false);

        this.logger.success('Macro Builder App initialized');
    }

    checkInitialDeviceState() {
        // Check if device is already connected on startup
        console.log('[DEBUG] Checking initial device state...');

        // Use a short delay to allow Main process to update device state
        setTimeout(() => {
            const connected = this.isDeviceConnected;
            const hasScreenDimensions = this.controller.state.screenWidth > 0 && this.controller.state.screenHeight > 0;

            console.log('[DEBUG] isDeviceConnected:', connected);
            console.log('[DEBUG] Screen dimensions:', this.controller.state.screenWidth, 'x', this.controller.state.screenHeight);

            // If screen dimensions exist but isDeviceConnected is false, we need to re-render
            if (hasScreenDimensions && !connected) {
                console.log('[DEBUG] Device connected but state not updated, forcing re-render...');
                // The device is actually connected, force a re-render
                this.renderActionList();
            } else if (connected) {
                console.log('[DEBUG] Device already connected on startup');
            } else {
                console.log('[DEBUG] No device connected on startup');
            }
        }, 500); // Wait 500ms for device to initialize
    }

    setupServiceEventListeners() {
        // Listen to IPC events from Main process
        if (window.api && window.api.device) {
            window.api.device.onStatus((status) => {
                console.log('[DEBUG] device:status IPC event received:', status);

                // Update controller state
                this.controller.updateDeviceStatus(
                    status.connected,
                    status.device?.type || null,
                    status.device?.model || status.device?.device || null,
                    status.device?.id || null
                );
            });
        }

        // Listen to controller events
        this.eventBus.on('log:entry', (entry) => {
            this.addLogEntry(entry);
        });

        this.eventBus.on('action:create-from-click', (data) => {
            if (this.isPickingCoordinate && this.pendingActionType) {
                this.createActionFromClick(data.devicePos);
            }
        });

        this.eventBus.on('action:create-from-drag', (data) => {
            if (this.isPickingCoordinate && this.pendingActionType === 'drag') {
                this.createActionFromDrag(data.startDevice, data.endDevice);
            }
        });

        this.eventBus.on('device:status-changed', (data) => {
            console.log('[DEBUG] device:status-changed event received:', data);

            // Update device connection state
            this.isDeviceConnected = data.connected;
            this.deviceType = data.deviceType;

            console.log('[DEBUG] isDeviceConnected updated to:', this.isDeviceConnected);

            // Re-render action list to update disabled state
            this.renderActionList();
        });
    }

    // Delegate properties to controller state
    get macroName() { return this.controller.state.macroName; }
    set macroName(value) { this.controller.state.macroName = value; }

    get currentFilePath() { return this.controller.state.currentFilePath; }
    set currentFilePath(value) { this.controller.state.currentFilePath = value; }

    get isRunning() { return this.controller.state.isRunning; }
    set isRunning(value) { this.controller.state.isRunning = value; }

    get shouldStop() { return this.controller.state.shouldStop; }
    set shouldStop(value) { this.controller.state.shouldStop = value; }

    get isDeviceConnected() { return this.controller.state.isDeviceConnected; }
    set isDeviceConnected(value) { this.controller.state.isDeviceConnected = value; }

    get deviceType() { return this.controller.state.deviceType; }
    set deviceType(value) { this.controller.state.deviceType = value; }

    get deviceName() { return this.controller.state.deviceName; }
    set deviceName(value) { this.controller.state.deviceName = value; }

    get screenWidth() { return this.controller.state.screenWidth; }
    set screenWidth(value) {
        this.controller.state.screenWidth = value;
        this.controller.updateScreenDimensions(value, this.screenHeight);
    }

    get screenHeight() { return this.controller.state.screenHeight; }
    set screenHeight(value) {
        this.controller.state.screenHeight = value;
        this.controller.updateScreenDimensions(this.screenWidth, value);
    }

    get fps() { return this.controller.state.fps; }
    set fps(value) { this.controller.state.fps = value; }

    // Helper methods for backward compatibility
    get logs() {
        return this.logger ? this.logger.logs : [];
    }

    setupEventListeners() {
        // Store original values for cancellation
        this.originalMacroName = '';
        this.originalMacroDescription = '';

        // Macro name input
        const macroNameInput = document.getElementById('macro-name-input');
        if (macroNameInput) {
            macroNameInput.addEventListener('focus', () => {
                this.originalMacroName = this.macroName;
            });

            macroNameInput.addEventListener('input', (e) => {
                this.macroName = e.target.value;
                this.hasUnsavedChanges = true;
                this.updateToolbarButtons(true);
                this.updateFilenamePreview(); // Update filename preview in real-time
            });

            macroNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur(); // Unfocus the input
                    this.saveMetadata('name');
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.cancelMetadataEdit('name');
                    e.target.blur();
                }
            });
        }

        // Macro description input
        const macroDescriptionInput = document.getElementById('macro-description-input');
        if (macroDescriptionInput) {
            macroDescriptionInput.addEventListener('focus', () => {
                this.originalMacroDescription = this.macroDescription || '';
            });

            macroDescriptionInput.addEventListener('input', (e) => {
                this.macroDescription = e.target.value;
                this.hasUnsavedChanges = true;
                this.updateToolbarButtons(true);
            });

            macroDescriptionInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur(); // Unfocus the input
                    this.saveMetadata('description');
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.cancelMetadataEdit('description');
                    e.target.blur();
                }
            });
        }

        // Buttons
        document.getElementById('btn-run-macro')?.addEventListener('click', () => {
            if (this.isRunning) {
                this.stopMacro();
            } else {
                this.runMacro();
            }
        });
        document.getElementById('btn-save-macro')?.addEventListener('click', () => this.saveMacro());
        document.getElementById('btn-save-as-macro')?.addEventListener('click', () => this.saveAsMacro());
        document.getElementById('btn-save-macro-inline')?.addEventListener('click', () => this.saveMacro());
        document.getElementById('btn-save-as-macro-inline')?.addEventListener('click', () => this.saveAsMacro());
        document.getElementById('btn-back-to-list')?.addEventListener('click', () => this.renderScenarioListInPanel());

        // Screen markers toggle
        const showMarkersToggle = document.getElementById('option-show-markers');
        if (showMarkersToggle) {
            showMarkersToggle.addEventListener('change', (e) => {
                this.toggleScreenMarkers(e.target.checked);
            });
        }

        // Screen pause toggle
        const pauseScreenBtn = document.getElementById('btn-pause-screen');
        if (pauseScreenBtn) {
            pauseScreenBtn.addEventListener('click', () => {
                this.toggleScreenPause();
            });
        }

        // Handle multiple "new scenario" buttons (there are 2 in the UI)
        document.querySelectorAll('#btn-new-scenario').forEach(btn => {
            btn.addEventListener('click', () => this.createNewScenario());
        });

        document.getElementById('btn-select-all')?.addEventListener('click', () => this.toggleSelectAll());
        document.getElementById('btn-run-selected')?.addEventListener('click', () => this.runSelectedScenarios());
        document.getElementById('btn-delete-selected')?.addEventListener('click', () => this.deleteSelectedScenarios());
        document.getElementById('btn-add-selected-scenarios')?.addEventListener('click', () => this.addSelectedScenariosAsBlocks());
        document.getElementById('btn-run-all-blocks')?.addEventListener('click', () => this.runAllScenarioBlocks());
        document.getElementById('btn-close-scenario-modal')?.addEventListener('click', () => this.closeScenarioModal());

        // Device connection buttons
        document.getElementById('btn-connect-adb')?.addEventListener('click', () => this.connectDevice('adb'));
        document.getElementById('btn-connect-isap')?.addEventListener('click', () => this.connectDevice('isap'));

        // Device card click to restore collapsed cards
        document.querySelector('.device-connection-methods')?.addEventListener('click', (e) => {
            const card = e.target.closest('.device-method-card');
            if (card && card.classList.contains('collapsed')) {
                this.restoreDeviceCards();
            }
        });

        // ESC key to deselect action or cancel coordinate picking
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Priority 1: Cancel coordinate picking if active
                if (this.isPickingCoordinate) {
                    this.cancelCoordinatePicking();
                    this.clearScreenMarkers(); // Remove any markers from screen
                    return;
                }

                // Priority 2: Deselect condition if one is selected
                if (this.selectedCondition || this.expandedConditionId) {
                    this.selectedCondition = null;
                    this.expandedConditionId = null;
                    this.renderActionSequence();
                    this.clearScreenMarkers(); // Remove markers from screen
                    return;
                }

                // Priority 3: Deselect action if one is selected
                if (this.selectedActionId) {
                    this.selectedActionId = null;
                    this.renderActionSequence();
                    this.clearScreenMarkers(); // Remove markers from screen
                }
            }
        });

        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // Action list - use event delegation
        this.isDraggingAction = false;
        document.getElementById('action-list-container')?.addEventListener('click', (e) => {
            // Ignore click if drag just happened
            if (this.isDraggingAction) {
                this.isDraggingAction = false;
                return;
            }

            const actionCard = e.target.closest('.action-card');
            if (actionCard) {
                const actionType = actionCard.dataset.actionType;
                if (actionType) {
                    this.addAction(actionType);
                }
            }
        });

        // ESC key to cancel coordinate picking
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isPickingCoordinate) {
                this.cancelCoordinatePicking();
            }
        });

        // Screen preview click handling - removed, now handled in renderScreenPreview once

        // Mouse move for tooltip
        document.addEventListener('mousemove', (e) => {
            if (this.isPickingCoordinate) {
                this.updatePickingTooltip(e);
            }
        });

        // Window resize - update markers when window size changes
        window.addEventListener('resize', () => {
            if (this.selectedActionId) {
                const selectedAction = this.actions.find(a => a.id === this.selectedActionId);
                if (selectedAction) {
                    this.updateSelectedActionMarker(selectedAction);
                }
            }
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab[data-tab="${tabName}"]`)?.classList.add('active');

        // Update tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            if (content.dataset.tab === tabName) {
                content.classList.remove('hidden');
                content.classList.add('active');
            } else {
                content.classList.add('hidden');
                content.classList.remove('active');
            }
        });
    }

    /**
     * Determine device orientation based on screen dimensions
     * @returns {string} 'portrait' | 'landscape' | 'square'
     */
    getDeviceOrientation() {
        const aspectRatio = this.screenWidth / this.screenHeight;

        if (aspectRatio < 0.9) {
            return 'portrait'; // Height is significantly larger than width
        } else if (aspectRatio > 1.1) {
            return 'landscape'; // Width is significantly larger than height
        } else {
            return 'square'; // Nearly equal dimensions
        }
    }

    renderScreenPreview() {
        // Don't render preview if device not connected
        if (!this.isDeviceConnected) {
            return;
        }

        const container = document.getElementById('screen-preview-container');
        if (!container) return;

        // Determine device orientation for adaptive container
        const orientation = this.getDeviceOrientation();
        console.log(`Device orientation: ${orientation} (${this.screenWidth}x${this.screenHeight})`);

        container.innerHTML = `
            <div class="screen-preview-with-log">
                <!-- Screen Preview Display (80%) -->
                <div class="screen-preview-display">
                    <div class="screen-preview ${orientation}" id="screen-preview-canvas">
                        <img id="screen-stream-image" draggable="false" style="width: 100%; height: 100%; object-fit: contain; background: #1e293b; user-select: none; -webkit-user-drag: none;" />
                    </div>
                </div>

                <!-- Log Output Area (20%) - Separate section -->
                <div class="log-output-container" id="log-output-container">
                    <div class="log-output-header">
                        <p class="log-output-title">실행 로그</p>
                        <button class="btn-ghost" id="btn-clear-logs" style="padding: 0.25rem 0.5rem;">
                            <svg style="width: 0.875rem; height: 0.875rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="log-output-content" id="log-output-content">
                        <div class="log-entry">
                            <span class="log-timestamp">00:00:00</span>
                            <span class="log-level log-level-info">[INFO]</span>
                            <span class="log-message">매크로 빌더 준비 완료</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add mouse event handlers
        const screenCanvas = document.getElementById('screen-preview-canvas');
        if (screenCanvas) {
            screenCanvas.addEventListener('click', (e) => this.handleScreenClick(e));
            screenCanvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            screenCanvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            screenCanvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
            screenCanvas.addEventListener('mouseleave', () => this.handleMouseLeave());
        }

        // Add clear logs button handler
        const clearLogsBtn = document.getElementById('btn-clear-logs');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => this.clearLogs());
        }

        // Add image load handler to update markers when image size changes
        const screenImg = document.getElementById('screen-stream-image');
        if (screenImg) {
            screenImg.addEventListener('load', () => {
                if (this.selectedActionId) {
                    const selectedAction = this.actions.find(a => a.id === this.selectedActionId);
                    if (selectedAction) {
                        this.updateSelectedActionMarker(selectedAction);
                    }
                }
            });
        }

        // Initialize with welcome log
        this.addLog('info', '매크로 빌더 준비 완료');
    }

    handleScreenClick(e) {
        // Use the same coordinate calculation as getScaledCoordinates for consistency
        const coords = this.getScaledCoordinates(e);
        if (!coords) {
            console.warn('[handleScreenClick] Could not get scaled coordinates');
            return;
        }

        // Use the coordinates from getScaledCoordinates which properly handles letterbox
        const x = coords.x;
        const y = coords.y;

        // Get image for debug info
        const img = document.getElementById('screen-stream-image');
        if (!img) return;
        const imgRect = img.getBoundingClientRect();

        // If in coordinate picking mode, create new action
        if (this.isPickingCoordinate) {
            this.handleScreenPreviewClick(e);
            return;
        }

        // Always show debug coordinate info
        const { actualImgWidth, actualImgHeight, offsetX, offsetY } = this.getImageDisplayInfo(img, imgRect);

        // Calculate click position for debug
        const clickX = e.clientX - imgRect.left;
        const clickY = e.clientY - imgRect.top;
        const rawClickX = e.clientX;
        const rawClickY = e.clientY;

        const debugInfo = `[DEBUG] 마우스: (${rawClickX}, ${rawClickY}) → 이미지상대: (${clickX.toFixed(1)}, ${clickY.toFixed(1)}) → 장치: (${x}, ${y})`;
        const detailInfo = `[DEBUG] 이미지영역: ${imgRect.left.toFixed(0)},${imgRect.top.toFixed(0)} 크기: ${imgRect.width.toFixed(0)}×${imgRect.height.toFixed(0)}, 레터박스: (${offsetX.toFixed(0)}, ${offsetY.toFixed(0)})`;

        this.addLog('debug', debugInfo);
        this.addLog('debug', detailInfo);

        // Show click position temporarily as a green dot
        const screenPreview = document.getElementById('screen-preview-canvas');
        if (screenPreview && img) {
            const imgRect = img.getBoundingClientRect();

            // Get display info with letterbox offset
            const { actualImgWidth, actualImgHeight, offsetX, offsetY } = this.getImageDisplayInfo(img, imgRect);

            // Calculate the actual click position relative to the image (accounting for letterbox)
            const clickRelativeToImg = {
                x: e.clientX - imgRect.left,
                y: e.clientY - imgRect.top
            };

            // Adjust for letterbox
            const actualClickX = clickRelativeToImg.x - offsetX;
            const actualClickY = clickRelativeToImg.y - offsetY;

            // Convert back to container coordinates for display
            const clickDotX = offsetX + actualClickX;
            const clickDotY = offsetY + actualClickY;

            const clickDot = document.createElement('div');
            clickDot.style.position = 'absolute';
            clickDot.style.width = '10px';
            clickDot.style.height = '10px';
            clickDot.style.backgroundColor = 'lime';
            clickDot.style.border = '1px solid darkgreen';
            clickDot.style.borderRadius = '50%';
            // transform을 사용해서 정확히 중심에 배치
            clickDot.style.transform = 'translate(-50%, -50%)';
            clickDot.style.left = `${clickDotX}px`;
            clickDot.style.top = `${clickDotY}px`;
            clickDot.style.zIndex = '12';
            clickDot.style.pointerEvents = 'none';
            screenPreview.appendChild(clickDot);

            // Remove after 2 seconds
            setTimeout(() => clickDot.remove(), 2000);

            console.log('Green dot placed at:', {
                mouse: { x: e.clientX, y: e.clientY },
                imgRelative: { x: clickX, y: clickY },
                containerRelative: { x: clickDotX, y: clickDotY }
            });
        }

        // If no action selected, just return after showing coordinates
        if (!this.selectedActionId) {
            return;
        }

        const action = this.actions.find(a => a.id === this.selectedActionId);
        if (!action) return;

        if (action.type === 'click' || action.type === 'long-press') {
            action.x = x;
            action.y = y;
            this.renderActionSequence();
            this.updateSelectedActionMarker(action);
        } else if (action.type === 'drag') {
            if (!action.x || !action.y) {
                action.x = x;
                action.y = y;
            } else {
                action.endX = x;
                action.endY = y;
            }
            this.renderActionSequence();
            this.updateSelectedActionMarker(action);
        }
    }

    handleMouseDown(e) {
        // Check if we're selecting a region for an action
        const selectedAction = this.actions.find(a => a.id === this.selectedActionId);
        const isActionImageMatch = selectedAction && this.IMAGE_ACTION_TYPES.includes(selectedAction.type);

        // Check if we're selecting a region for a condition
        const isConditionImageMatch = this.selectedCondition && (() => {
            const action = this.actions.find(a => a.id === this.selectedCondition.actionId);
            if (!action || !action.conditions) return false;
            const condition = action.conditions.find(c => c.id === this.selectedCondition.conditionId);
            return condition && condition.actionType === 'image-match';
        })();

        if (!isActionImageMatch && !isConditionImageMatch) {
            return;
        }

        // Prevent default drag behavior
        e.preventDefault();

        const coords = this.getScaledCoordinates(e);
        if (!coords) return;

        console.log('[handleMouseDown] Drag start coordinates:', {
            mouse: { x: e.clientX, y: e.clientY },
            device: coords
        });

        // Clear existing region when starting new selection
        if (isActionImageMatch && selectedAction.region) {
            selectedAction.region = undefined;
            this.renderActionSequence();
        } else if (isConditionImageMatch) {
            const action = this.actions.find(a => a.id === this.selectedCondition.actionId);
            const condition = action.conditions.find(c => c.id === this.selectedCondition.conditionId);
            if (condition.params.region) {
                condition.params.region = undefined;
                this.renderActionSequence();
            }
        }

        this.isSelectingRegion = true;
        this.selectionStart = coords;
        this.selectionEnd = coords;
    }

    handleMouseMove(e) {
        const coords = this.getScaledCoordinates(e);
        if (!coords) return;

        // Update current coordinate display
        this.currentCoordinate = coords;

        // Update selection rectangle if selecting region
        if (this.isSelectingRegion && this.selectionStart) {
            e.preventDefault(); // Prevent default drag behavior during selection
            this.selectionEnd = coords;
            this.renderSelectionOverlay();
        }
    }

    handleMouseUp(e) {
        const coords = this.getScaledCoordinates(e);
        if (!coords) return;

        const selectedAction = this.actions.find(a => a.id === this.selectedActionId);

        // Handle action image region selection
        if (selectedAction && this.IMAGE_ACTION_TYPES.includes(selectedAction.type) && this.isSelectingRegion && this.selectionStart) {
            const region = {
                x: Math.min(this.selectionStart.x, coords.x),
                y: Math.min(this.selectionStart.y, coords.y),
                width: Math.abs(coords.x - this.selectionStart.x),
                height: Math.abs(coords.y - this.selectionStart.y),
            };

            // Only update if region is at least 10x10 pixels
            if (region.width >= 10 && region.height >= 10) {
                selectedAction.region = region;

                // Capture the region image immediately
                this.captureRegionImage(selectedAction);

                this.renderActionSequence();
                this.addLog('success', `영역 선택: ${region.width}×${region.height}`);
            }

            this.isSelectingRegion = false;
            this.selectionStart = null;
            this.selectionEnd = null;
            this.renderSelectionOverlay();
        }

        // Handle condition image-match region selection
        if (this.selectedCondition && this.isSelectingRegion && this.selectionStart) {
            const action = this.actions.find(a => a.id === this.selectedCondition.actionId);
            if (action && action.conditions) {
                const condition = action.conditions.find(c => c.id === this.selectedCondition.conditionId);
                if (condition && condition.actionType === 'image-match') {
                    const region = {
                        x: Math.min(this.selectionStart.x, coords.x),
                        y: Math.min(this.selectionStart.y, coords.y),
                        width: Math.abs(coords.x - this.selectionStart.x),
                        height: Math.abs(coords.y - this.selectionStart.y),
                    };

                    // Only update if region is at least 10x10 pixels
                    if (region.width >= 10 && region.height >= 10) {
                        condition.params.region = region;

                        // Capture the region image immediately
                        this.captureConditionRegionImage(action, condition);

                        this.saveMacro();
                        this.renderActionSequence();
                        this.addLog('success', `조건 영역 선택: ${region.width}×${region.height}`);
                    }

                    this.isSelectingRegion = false;
                    this.selectionStart = null;
                    this.selectionEnd = null;
                    this.renderSelectionOverlay();
                }
            }
        }
    }

    handleMouseLeave() {
        this.currentCoordinate = null;
        if (this.isSelectingRegion) {
            this.isSelectingRegion = false;
            this.selectionStart = null;
            this.selectionEnd = null;
            this.renderSelectionOverlay();
        }
    }

    // Helper function to recursively collect all actions including nested ones
    getAllActionsFlattened(actions = this.actions, result = []) {
        for (const action of actions) {
            result.push(action);

            // Process conditions for if/while blocks (they contain actions too)
            if (action.conditions && action.conditions.length > 0) {
                for (const condition of action.conditions) {
                    // Conditions are stored as { actionType, params } format
                    // Create a pseudo-action object for consistency
                    if (condition.actionType === 'image-match') {
                        result.push({
                            id: condition.id,
                            type: 'image-match',
                            isCondition: true, // Mark as condition for index calculation
                            parentActionId: action.id,
                            ...condition.params
                        });
                    }
                }
            }

            // Recursively process children for control flow blocks
            if (action.children && action.children.length > 0) {
                this.getAllActionsFlattened(action.children, result);
            }
        }
        return result;
    }

    // Helper function to get display index (excluding conditions)
    getActionDisplayIndex(actionId) {
        const allActions = this.getAllActionsFlattened();
        // Filter out conditions for display index calculation
        const visibleActions = allActions.filter(a => !a.isCondition);
        const index = visibleActions.findIndex(a => a.id === actionId);
        return index >= 0 ? index + 1 : -1;
    }

    // Helper function to sanitize scenario name into valid filename
    sanitizeFilename(scenarioName) {
        if (!scenarioName || scenarioName.trim() === '') {
            return 'unnamed';
        }

        // Replace spaces with underscores
        let sanitized = scenarioName.replace(/\s+/g, '_');

        // Remove or replace special characters (keep Korean, English, numbers, underscore, hyphen)
        sanitized = sanitized.replace(/[^\w가-힣\-]/g, '_');

        // Replace multiple consecutive underscores with single underscore
        sanitized = sanitized.replace(/_+/g, '_');

        // Remove leading/trailing underscores
        sanitized = sanitized.replace(/^_+|_+$/g, '');

        // Fallback if empty after sanitization
        if (sanitized === '') {
            sanitized = 'unnamed';
        }

        return sanitized;
    }

    // Helper function to update filename preview
    updateFilenamePreview() {
        const previewElement = document.getElementById('filename-preview-text');
        if (previewElement) {
            const sanitized = this.sanitizeFilename(this.macroName);
            previewElement.textContent = `${sanitized}.json`;
        }
    }

    // Helper function to check if filename already exists in localStorage
    isFilenameExists(filename) {
        const scenarioData = JSON.parse(localStorage.getItem('scenario_data') || '{}');
        return Object.keys(scenarioData).some(filePath => {
            const existingFilename = filePath.split('/').pop();
            return existingFilename === filename;
        });
    }

    // Helper function to generate unique filename with auto-numbering
    generateUniqueFilename(baseName) {
        const sanitized = this.sanitizeFilename(baseName);
        let filename = `${sanitized}.json`;

        // If filename doesn't exist, return as-is
        if (!this.isFilenameExists(filename)) {
            return filename;
        }

        // Find unique filename by adding number suffix
        let counter = 1;
        while (this.isFilenameExists(`${sanitized}_${counter}.json`)) {
            counter++;
        }

        return `${sanitized}_${counter}.json`;
    }

    // Helper function to update dialog filename preview with uniqueness check
    updateDialogFilenamePreview(scenarioName) {
        const previewElement = document.getElementById('dialog-filename-preview-text');
        if (previewElement) {
            const uniqueFilename = this.generateUniqueFilename(scenarioName || 'unnamed');
            previewElement.textContent = uniqueFilename;

            // Change color if numbered (indicating duplicate)
            if (uniqueFilename.match(/_\d+\.json$/)) {
                previewElement.style.color = '#f59e0b'; // Orange color for duplicates
            } else {
                previewElement.style.color = '#64748b'; // Normal color
            }
        }
    }

    // Helper function to get all image-match actions before a specific action
    getImageMatchActionsBeforeAction(targetActionId) {
        const allActions = this.getAllActionsFlattened();
        const targetIndex = allActions.findIndex(a => a.id === targetActionId);

        if (targetIndex === -1) return [];

        // Debug: Log the structure
        console.log('[getImageMatchActionsBeforeAction] All actions:', allActions.map((a, i) => `${i}: ${a.type} (${a.id})`));
        console.log('[getImageMatchActionsBeforeAction] Target:', targetActionId, 'at index:', targetIndex);

        // Get all actions before target and filter for image-match type
        const result = allActions
            .slice(0, targetIndex)
            .filter(a => a.type === 'image-match')
            .reverse(); // Most recent first

        console.log('[getImageMatchActionsBeforeAction] Found image-match actions:', result.length);
        return result;
    }

    // Helper function to calculate letterbox offset and actual image dimensions
    getImageDisplayInfo(img, imgRect) {
        // Use the image's natural dimensions as-is (no rotation)
        const imgNaturalWidth = img.naturalWidth || this.screenWidth;
        const imgNaturalHeight = img.naturalHeight || this.screenHeight;

        const imgAspect = imgNaturalWidth / imgNaturalHeight;
        const elementAspect = imgRect.width / imgRect.height;

        let actualImgWidth, actualImgHeight, offsetX, offsetY;

        if (elementAspect > imgAspect) {
            // Element is wider than image - vertical letterboxing on sides
            actualImgHeight = imgRect.height;
            actualImgWidth = imgRect.height * imgAspect;
            offsetX = (imgRect.width - actualImgWidth) / 2;
            offsetY = 0;
        } else {
            // Element is taller than image - horizontal letterboxing on top/bottom
            actualImgWidth = imgRect.width;
            actualImgHeight = imgRect.width / imgAspect;
            offsetX = 0;
            offsetY = (imgRect.height - actualImgHeight) / 2;
        }

        // Round to minimize floating point errors
        actualImgWidth = Math.round(actualImgWidth * 1000) / 1000;
        actualImgHeight = Math.round(actualImgHeight * 1000) / 1000;
        offsetX = Math.round(offsetX * 1000) / 1000;
        offsetY = Math.round(offsetY * 1000) / 1000;

        return { actualImgWidth, actualImgHeight, offsetX, offsetY };
    }

    getScaledCoordinates(e) {
        const img = document.getElementById('screen-stream-image');
        if (!img) return null;

        const imgRect = img.getBoundingClientRect();

        // Use high precision for click coordinates
        const clickX = e.clientX - imgRect.left;
        const clickY = e.clientY - imgRect.top;

        // Check if click is within reasonable bounds
        if (clickX < -50 || clickX > imgRect.width + 50 || clickY < -50 || clickY > imgRect.height + 50) {
            console.log('[getScaledCoordinates] Click way outside element bounds');
            return null;
        }

        // Get display info with letterbox offset
        const { actualImgWidth, actualImgHeight, offsetX, offsetY } = this.getImageDisplayInfo(img, imgRect);

        // Adjust click coordinates to account for letterboxing with high precision
        const actualClickX = clickX - offsetX;
        const actualClickY = clickY - offsetY;

        // Clamp to image bounds
        const clampedX = Math.max(0, Math.min(actualImgWidth - 0.001, actualClickX));
        const clampedY = Math.max(0, Math.min(actualImgHeight - 0.001, actualClickY));

        // Scale to device coordinates with better precision
        // Use round for more accurate coordinate mapping
        const normalizedX = clampedX / actualImgWidth;
        const normalizedY = clampedY / actualImgHeight;

        const x = Math.round(normalizedX * this.screenWidth);
        const y = Math.round(normalizedY * this.screenHeight);

        // Only log on actual click events, not during mouse move
        if (e.type === 'click') {
            console.log('[Click] Coordinate transformation:', {
                click: { x: clickX.toFixed(1), y: clickY.toFixed(1) },
                device: { x, y },
                offset: { x: offsetX.toFixed(1), y: offsetY.toFixed(1) }
            });
        }

        return {
            x: Math.max(0, Math.min(this.screenWidth - 1, x)),
            y: Math.max(0, Math.min(this.screenHeight - 1, y))
        };
    }

    renderSelectionOverlay() {
        // This will be called by updateSelectedActionMarker
        const selectedAction = this.actions.find(a => a.id === this.selectedActionId);
        // Always call updateSelectedActionMarker to render live selection overlay
        // Even if there's no selected action (e.g., when selecting for a condition)
        this.updateSelectedActionMarker(selectedAction || {});
    }

    updateSelectedActionMarker(action) {
        const screenPreview = document.getElementById('screen-preview-canvas');
        const img = document.getElementById('screen-stream-image');

        if (!screenPreview || !img) {
            return;
        }

        // Remove existing markers
        const existingMarkers = screenPreview.querySelectorAll('.action-marker, .action-marker-line, .region-marker');
        existingMarkers.forEach(m => m.remove());

        if (action.x !== undefined && action.y !== undefined) {
            // Get container and image bounds
            const containerRect = screenPreview.getBoundingClientRect();
            const imgRect = img.getBoundingClientRect();

            // Get display info with letterbox offset
            const { actualImgWidth, actualImgHeight, offsetX, offsetY } = this.getImageDisplayInfo(img, imgRect);

            // Reverse the same calculation used in getScaledCoordinates
            // Normalize device coordinates to 0-1
            const normalizedX = action.x / this.screenWidth;
            const normalizedY = action.y / this.screenHeight;

            // Scale to actual image dimensions
            const imgX = normalizedX * actualImgWidth;
            const imgY = normalizedY * actualImgHeight;

            // Convert to position relative to container (accounting for letterbox)
            // Since the marker is added to the same container as the image,
            // we just need the letterbox offset plus the image position
            const markerX = offsetX + imgX;
            const markerY = offsetY + imgY;

            console.log('[updateSelectedActionMarker] Placing marker at center of click:', {
                deviceCoords: { x: action.x, y: action.y },
                screenResolution: { width: this.screenWidth, height: this.screenHeight },
                normalized: { x: normalizedX.toFixed(4), y: normalizedY.toFixed(4) },
                letterbox: { offsetX: offsetX.toFixed(2), offsetY: offsetY.toFixed(2) },
                actualImg: { width: actualImgWidth.toFixed(2), height: actualImgHeight.toFixed(2) },
                imgPosition: { x: imgX.toFixed(2), y: imgY.toFixed(2) },
                containerOffset: {
                    x: (imgRect.left - containerRect.left).toFixed(2),
                    y: (imgRect.top - containerRect.top).toFixed(2)
                },
                finalMarker: { x: markerX.toFixed(2), y: markerY.toFixed(2) },
                markerSize: '24x24px with -12px margins to center'
            });

            const marker = document.createElement('div');
            marker.className = 'action-marker';
            marker.style.left = `${markerX}px`;
            marker.style.top = `${markerY}px`;
            marker.innerHTML = '<div class="action-marker-pulse"></div>';
            screenPreview.appendChild(marker);

            // For drag, show line and end marker
            if (action.type === 'drag' && action.endX !== undefined && action.endY !== undefined) {
                // Calculate end marker position (same as start marker calculation)
                const endImgX = (action.endX / this.screenWidth) * actualImgWidth;
                const endImgY = (action.endY / this.screenHeight) * actualImgHeight;
                const endMarkerX = offsetX + endImgX;
                const endMarkerY = offsetY + endImgY;

                // SVG line
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('class', 'action-marker-line');
                svg.style.position = 'absolute';
                svg.style.inset = '0';
                svg.style.pointerEvents = 'none';
                svg.style.zIndex = '10';
                svg.style.width = '100%';
                svg.style.height = '100%';

                const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                marker.setAttribute('id', 'arrowhead');
                marker.setAttribute('markerWidth', '10');
                marker.setAttribute('markerHeight', '7');
                marker.setAttribute('refX', '9');
                marker.setAttribute('refY', '3.5');
                marker.setAttribute('orient', 'auto');

                const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
                polygon.setAttribute('fill', '#3b82f6');

                marker.appendChild(polygon);
                defs.appendChild(marker);
                svg.appendChild(defs);

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', `${markerX}`);
                line.setAttribute('y1', `${markerY}`);
                line.setAttribute('x2', `${endMarkerX}`);
                line.setAttribute('y2', `${endMarkerY}`);
                line.setAttribute('stroke', '#3b82f6');
                line.setAttribute('stroke-width', '3');
                line.setAttribute('marker-end', 'url(#arrowhead)');

                svg.appendChild(line);
                screenPreview.appendChild(svg);
            }
        }

        // Render image region marker
        if (this.IMAGE_ACTION_TYPES.includes(action.type) && action.region) {
            const containerRect = screenPreview.getBoundingClientRect();
            const imgRect = img.getBoundingClientRect();

            // Get display info with letterbox offset
            const { actualImgWidth, actualImgHeight, offsetX, offsetY } = this.getImageDisplayInfo(img, imgRect);

            // Calculate region position and size (accounting for letterbox)
            const regionX = (action.region.x / this.screenWidth) * actualImgWidth;
            const regionY = (action.region.y / this.screenHeight) * actualImgHeight;
            const regionWidth = (action.region.width / this.screenWidth) * actualImgWidth;
            const regionHeight = (action.region.height / this.screenHeight) * actualImgHeight;

            // Convert to position relative to container (same as green dot calculation)
            const markerX = offsetX + regionX;
            const markerY = offsetY + regionY;

            console.log('[Region Marker] Positioning:', {
                deviceRegion: action.region,
                imgSize: { w: actualImgWidth, h: actualImgHeight },
                imgPosition: { x: regionX.toFixed(2), y: regionY.toFixed(2) },
                letterbox: { x: offsetX.toFixed(2), y: offsetY.toFixed(2) },
                finalMarker: { x: markerX.toFixed(2), y: markerY.toFixed(2) }
            });

            // Create region rectangle
            const regionMarker = document.createElement('div');
            regionMarker.className = 'region-marker';
            regionMarker.style.position = 'absolute';
            regionMarker.style.left = `${markerX}px`;
            regionMarker.style.top = `${markerY}px`;
            regionMarker.style.width = `${regionWidth}px`;
            regionMarker.style.height = `${regionHeight}px`;
            regionMarker.style.border = '2px solid #6366f1';
            regionMarker.style.background = 'rgba(99, 102, 241, 0.2)';
            regionMarker.style.borderRadius = '4px';
            regionMarker.style.pointerEvents = 'none';
            regionMarker.style.zIndex = '10';
            regionMarker.style.boxSizing = 'border-box';

            // Create size label
            const sizeLabel = document.createElement('div');
            sizeLabel.style.position = 'absolute';
            sizeLabel.style.top = '-24px';
            sizeLabel.style.left = '0';
            sizeLabel.style.background = '#6366f1';
            sizeLabel.style.color = 'white';
            sizeLabel.style.fontSize = '11px';
            sizeLabel.style.padding = '2px 8px';
            sizeLabel.style.borderRadius = '4px';
            sizeLabel.style.whiteSpace = 'nowrap';
            sizeLabel.textContent = `${action.region.width} × ${action.region.height}`;

            regionMarker.appendChild(sizeLabel);
            screenPreview.appendChild(regionMarker);
        }

        // Render live selection rectangle while dragging
        if (this.isSelectingRegion && this.selectionStart && this.selectionEnd) {
            const containerRect = screenPreview.getBoundingClientRect();
            const imgRect = img.getBoundingClientRect();

            // Get display info with letterbox offset
            const { actualImgWidth, actualImgHeight, offsetX, offsetY } = this.getImageDisplayInfo(img, imgRect);

            // Calculate selection region
            const selectionRegion = {
                x: Math.min(this.selectionStart.x, this.selectionEnd.x),
                y: Math.min(this.selectionStart.y, this.selectionEnd.y),
                width: Math.abs(this.selectionEnd.x - this.selectionStart.x),
                height: Math.abs(this.selectionEnd.y - this.selectionStart.y),
            };

            // Calculate position and size in pixels (accounting for letterbox)
            const regionX = (selectionRegion.x / this.screenWidth) * actualImgWidth;
            const regionY = (selectionRegion.y / this.screenHeight) * actualImgHeight;
            const regionWidth = (selectionRegion.width / this.screenWidth) * actualImgWidth;
            const regionHeight = (selectionRegion.height / this.screenHeight) * actualImgHeight;

            // Convert to position relative to container (same as green dot calculation)
            const markerX = offsetX + regionX;
            const markerY = offsetY + regionY;

            // Create selection rectangle
            const selectionMarker = document.createElement('div');
            selectionMarker.className = 'region-marker';
            selectionMarker.style.position = 'absolute';
            selectionMarker.style.left = `${markerX}px`;
            selectionMarker.style.top = `${markerY}px`;
            selectionMarker.style.width = `${regionWidth}px`;
            selectionMarker.style.height = `${regionHeight}px`;
            selectionMarker.style.border = '2px solid #6366f1';
            selectionMarker.style.background = 'rgba(99, 102, 241, 0.2)';
            selectionMarker.style.borderRadius = '4px';
            selectionMarker.style.pointerEvents = 'none';
            selectionMarker.style.zIndex = '10';
            selectionMarker.style.boxSizing = 'border-box';

            // Create size label
            const sizeLabel = document.createElement('div');
            sizeLabel.style.position = 'absolute';
            sizeLabel.style.top = '-24px';
            sizeLabel.style.left = '0';
            sizeLabel.style.background = '#6366f1';
            sizeLabel.style.color = 'white';
            sizeLabel.style.fontSize = '11px';
            sizeLabel.style.padding = '2px 8px';
            sizeLabel.style.borderRadius = '4px';
            sizeLabel.style.whiteSpace = 'nowrap';
            sizeLabel.textContent = `${selectionRegion.width} × ${selectionRegion.height}`;

            selectionMarker.appendChild(sizeLabel);
            screenPreview.appendChild(selectionMarker);
        }

        // Update info
        this.updateSelectedActionInfo(action);
    }

    updateSelectedActionInfo(action) {
        const infoContainer = document.getElementById('selected-action-info');
        if (!infoContainer) return;

        let infoText = '';
        if (action.type === 'click') {
            infoText = `클릭: (${action.x || 0}, ${action.y || 0})`;
        } else if (action.type === 'long-press') {
            infoText = `롱프레스: (${action.x || 0}, ${action.y || 0})`;
        } else if (action.type === 'drag') {
            infoText = `드래그: (${action.x || 0}, ${action.y || 0}) → (${action.endX || 0}, ${action.endY || 0})`;
        }

        if (infoText) {
            infoContainer.innerHTML = `
                <div class="text-center text-sm space-y-1">
                    <p class="text-slate-600">현재 선택된 액션</p>
                    <div style="background: var(--blue-50); border: 1px solid var(--blue-200); border-radius: var(--radius); padding: 0.5rem 0.75rem;">
                        <p style="color: #1E3A8A;">${infoText}</p>
                    </div>
                </div>
            `;
        } else {
            infoContainer.innerHTML = '';
        }
    }

    drawCoordinateMarker(x, y, color = '#3b82f6') {
        if (!this.markerRenderer) return;

        const img = document.getElementById('screen-stream-image');
        if (!img) return;

        // Convert device coordinates to display coordinates
        const displayPos = this.coordinateService.deviceToDisplay({ x, y }, img);

        // Add marker using MarkerRenderer service
        this.markerRenderer.addMarker(displayPos, {
            type: 'click',
            color: color,
            label: ''
        });
    }

    drawDragMarker(startX, startY, endX, endY) {
        if (!this.markerRenderer) return;

        const img = document.getElementById('screen-stream-image');
        if (!img) return;

        // Convert device coordinates to display coordinates
        const startDisplay = this.coordinateService.deviceToDisplay({ x: startX, y: startY }, img);
        const endDisplay = this.coordinateService.deviceToDisplay({ x: endX, y: endY }, img);

        // Add markers and drag line using MarkerRenderer service
        this.markerRenderer.addMarker(startDisplay, {
            type: 'drag-start',
            color: '#2563eb',
            label: 'Start'
        });

        this.markerRenderer.addMarker(endDisplay, {
            type: 'drag-end',
            color: '#16a34a',
            label: 'End'
        });

        this.markerRenderer.setDragLine(startDisplay, endDisplay, {
            color: '#2563eb'
        });
    }

    drawRegionMarker(region, color = '#6366f1') {
        if (!this.markerRenderer) return;

        const img = document.getElementById('screen-stream-image');
        if (!img) return;

        // Convert device region to display region
        const displayRegion = this.coordinateService.regionDeviceToDisplay(region, img);

        // Draw region using MarkerRenderer service
        this.markerRenderer.setRegion(displayRegion, {
            color: color,
            label: `${region.width} × ${region.height}`
        });
    }

    renderActionList() {
        // Use ActionConfigProvider as single source of truth for UI configuration
        const actionTypes = this.actionConfigProvider.getActionPaletteData(this.getIconSVG.bind(this));

        // Apply disabled state to entire action panel
        const actionPanel = document.getElementById('action-panel');

        console.log('[DEBUG] renderActionList - isDeviceConnected:', this.isDeviceConnected);

        if (actionPanel) {
            // Remove existing overlay if present
            const existingOverlay = actionPanel.querySelector('.action-panel-disabled-overlay');
            if (existingOverlay) {
                console.log('[DEBUG] Removing existing overlay');
                existingOverlay.remove();
            }

            if (this.isDeviceConnected) {
                // Enable state
                console.log('[DEBUG] Enabling action panel');
                actionPanel.style.filter = 'none';
            } else {
                // Disable state - add overlay to block all interactions
                console.log('[DEBUG] Disabling action panel');
                actionPanel.style.filter = 'grayscale(1) opacity(0.5)';

                const overlay = document.createElement('div');
                overlay.className = 'action-panel-disabled-overlay';
                overlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(255, 255, 255, 0.3);
                    cursor: not-allowed;
                    z-index: 1000;
                `;
                actionPanel.style.position = 'relative';
                actionPanel.appendChild(overlay);
            }
        }

        for (const [category, actions] of Object.entries(actionTypes)) {
            const container = document.getElementById(`${category}-actions`);
            if (!container) continue;

            container.innerHTML = `
                <div class="space-y-2">
                    ${actions.map(action => this.renderActionCard(action)).join('')}
                </div>
            `;
        }
    }

    renderActionCard(action) {
        return `
            <div class="action-card" data-action-type="${action.type}">
                <div class="flex items-center gap-3">
                    <div class="action-card-icon ${action.color}">
                        ${action.icon}
                    </div>
                    <div class="action-card-content">
                        <h3 class="action-card-title">${action.label}</h3>
                        <p class="action-card-description">${action.description}</p>
                    </div>
                </div>
            </div>
        `;
    }

    addAction(type) {
        // If already in coordinate picking mode, cancel it first (ESC effect)
        if (this.isPickingCoordinate) {
            this.cancelCoordinatePicking();
        }

        // Always deselect current action/condition when starting to add new action
        // This ensures only one action is selected at a time (either in macro list or action list)
        this.selectedActionId = null;
        this.selectedCondition = null;
        this.expandedConditionId = null;

        // Clear markers from screen
        const screenPreview = document.getElementById('screen-preview-canvas');
        if (screenPreview) {
            const markers = screenPreview.querySelectorAll('.action-marker, .action-marker-line');
            markers.forEach(m => m.remove());
        }

        // Re-render to update selection state in macro list
        this.renderActionSequence();

        // For click, long-press, and drag, enter coordinate picking mode
        if (type === 'click' || type === 'long-press' || type === 'drag') {
            this.startCoordinatePicking(type);
            // Mark as changed since coordinate picking will eventually add an action
            this.markAsChanged();
            return;
        }

        const newAction = {
            id: `action-${Date.now()}`,
            type,
            ...(type === 'wait' && { duration: 1000 }),
            ...(type === 'keyboard' && { text: '' }),
            ...(type === 'screenshot' && { filename: 'screenshot.png' }),
            ...(type === 'log' && { message: 'Log message' }),
            ...(type === 'if' && { conditions: [] }),
            ...(type === 'else-if' && { conditions: [] }),
            ...(this.IMAGE_ACTION_TYPES.includes(type) && { imagePath: 'image.png', threshold: 0.95 }),
            ...(type === 'loop' && { loopCount: 1 }),
            ...(type === 'while' && { conditions: [] }),
            ...(type === 'sound-check' && {
                duration: 5000,
                expectation: 'present',
                threshold: { min: 40, max: 80 }
            }),
        };

        // Auto-add endif block for condition starters (new flat structure)
        const conditionStartTypes = ['if', 'image-match', 'get-volume', 'sound-check'];
        if (conditionStartTypes.includes(type)) {
            const pairId = `pair-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            newAction.pairId = pairId;

            const endAction = {
                id: `action-${Date.now() + 1}`,
                type: 'endif',
                pairId: pairId
            };

            this.actions.push(newAction);
            this.actions.push(endAction);
        }
        // Auto-add END block for legacy control flow structures (while, loop)
        else if (type === 'while' || type === 'loop') {
            const pairId = `pair-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            newAction.pairId = pairId;

            const endType = type === 'while' ? 'end-while' : 'end-loop';
            const endAction = {
                id: `action-${Date.now() + 1}`,
                type: endType,
                pairId: pairId
            };

            this.actions.push(newAction);
            this.actions.push(endAction);
        } else {
            this.actions.push(newAction);
        }

        // Mark as changed
        this.markAsChanged();

        this.selectedActionId = newAction.id;
        this.renderActionSequence();
    }

    renderActionSequence() {
        const container = document.getElementById('action-sequence-list');
        if (!container) return;

        // Show/hide UI elements for action editing view (MUST be at the top, before any return)
        const btnBackToList = document.getElementById('btn-back-to-list');
        const btnNewScenario = document.getElementById('btn-new-scenario');
        const btnSelectAll = document.getElementById('btn-select-all');
        const btnRunSelected = document.getElementById('btn-run-selected');
        const actionPanel = document.getElementById('action-panel');
        const scenarioListHeader = document.getElementById('scenario-list-header');
        const scenarioEditHeader = document.getElementById('scenario-edit-header');
        const macroNameContainer = document.getElementById('macro-name-container');

        // Switch headers: hide list header, show edit header
        if (scenarioListHeader) {
            scenarioListHeader.style.display = 'none';
        }
        if (scenarioEditHeader) {
            scenarioEditHeader.style.display = '';
        }
        // Show macro name input in content area
        if (macroNameContainer) {
            macroNameContainer.style.display = '';
        }

        // Show "back to list" button, hide "new scenario" button in action editing view
        if (btnBackToList) {
            btnBackToList.style.display = '';
            btnBackToList.style.visibility = 'visible';
        }
        if (btnNewScenario) {
            btnNewScenario.style.setProperty('display', 'none', 'important');
            btnNewScenario.style.visibility = 'hidden';
        }

        // Hide scenario list buttons (select-all, run-selected, delete-selected) in action editing view
        if (btnSelectAll) {
            btnSelectAll.style.display = 'none';
            btnSelectAll.style.visibility = 'hidden';
        }
        if (btnRunSelected) {
            btnRunSelected.style.display = 'none';
            btnRunSelected.style.visibility = 'hidden';
        }
        const btnDeleteSelected = document.getElementById('btn-delete-selected');
        if (btnDeleteSelected) {
            btnDeleteSelected.style.display = 'none';
            btnDeleteSelected.style.visibility = 'hidden';
        }

        // Show delay selector in edit view
        const delaySelectWrapper = document.getElementById('delay-select-wrapper');
        if (delaySelectWrapper) {
            delaySelectWrapper.style.display = '';
        }

        // Show action panel in action editing view (with slide animation)
        if (actionPanel) {
            actionPanel.classList.remove('hidden');
        }

        // Save scroll position
        const scrollTop = container.scrollTop;

        if (this.actions.length === 0) {
            // Check if a scenario has been created/loaded
            const hasScenario = this.macroName && this.macroName.trim().length > 0;
            const emptyTitle = hasScenario
                ? '시나리오가 비어있습니다'
                : '시나리오를 생성하여 시작하세요';
            const emptyDescription = hasScenario
                ? '오른쪽에서 액션을 선택하여 시작하세요'
                : '"목록 보기"를 클릭하여 새 시나리오를 만드세요';

            container.innerHTML = `
                <div id="empty-state" class="empty-state" style="display: flex;">
                    <svg class="empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                    <p class="empty-title">${emptyTitle}</p>
                    <p class="empty-description">${emptyDescription}</p>
                </div>
            `;
            return;
        }

        // Calculate depths
        const actionsWithDepth = this.calculateDepths();

        container.innerHTML = `
            <div id="empty-state" class="empty-state" style="display: none;">
                <svg class="empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                <p class="empty-title">시나리오가 비어있습니다</p>
                <p class="empty-description">오른쪽에서 액션을 선택하여 시작하세요</p>
            </div>
            <div class="space-y-2"
                 ondragover="window.macroApp.handleContainerDragOver(event)"
                 ondrop="window.macroApp.handleContainerDrop(event)"
                 style="min-height: 100px;">
                ${actionsWithDepth.map((action, index) => this.renderActionBlock(action, index, actionsWithDepth.length)).join('')}
            </div>
        `;

        // Add event listeners
        this.actions.forEach((action, index) => {
            const block = container.querySelector(`[data-action-id="${action.id}"]`);
            if (block) {
                block.addEventListener('click', (e) => {
                    // Ignore click if dragging or clicked on drag handle
                    if (this.isDraggingAction || e.target.closest('.drag-handle')) {
                        return;
                    }
                    this.selectAction(action.id);
                });

                const deleteBtn = block.querySelector('.btn-delete');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.deleteAction(action.id);
                    });
                }

                const upBtn = block.querySelector('.btn-move-up');
                if (upBtn) {
                    upBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.moveAction(action.id, 'up');
                    });
                }

                const downBtn = block.querySelector('.btn-move-down');
                if (downBtn) {
                    downBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.moveAction(action.id, 'down');
                    });
                }
            }
        });

        // Restore scroll position
        container.scrollTop = scrollTop;

        // Update marker for selected action or condition (if any)
        if (this.selectedActionId) {
            const selectedAction = this.actions.find(a => a.id === this.selectedActionId);
            if (selectedAction) {
                // Use requestAnimationFrame to ensure DOM is ready
                requestAnimationFrame(() => {
                    this.updateSelectedActionMarker(selectedAction);
                });
            }
        } else if (this.selectedCondition) {
            // Show marker for selected condition
            const action = this.actions.find(a => a.id === this.selectedCondition.actionId);
            if (action && action.conditions) {
                const condition = action.conditions.find(c => c.id === this.selectedCondition.conditionId);
                if (condition && condition.params.region) {
                    requestAnimationFrame(() => {
                        this.drawRegionMarker(condition.params.region);
                    });
                }
            }
        }

        // Render thumbnails for image-match actions and conditions
        requestAnimationFrame(() => {
            this.actions.forEach(action => {
                // Render action thumbnails
                if (this.IMAGE_ACTION_TYPES.includes(action.type) && action.region) {
                    this.renderImageThumbnail(action);
                }

                // Render condition thumbnails
                if (action.conditions && action.conditions.length > 0) {
                    action.conditions.forEach(condition => {
                        if (condition.actionType === 'image-match' && condition.params.region) {
                            this.renderConditionImageThumbnail(condition);
                        }
                    });
                }
            });
        });
    }

    captureRegionImage(action) {
        if (!action.region) return;

        const sourceImg = document.getElementById('screen-stream-image');
        if (!sourceImg || !sourceImg.complete) return;

        const region = action.region;

        // Get the actual image dimensions
        const imgActualWidth = sourceImg.naturalWidth || sourceImg.width;
        const imgActualHeight = sourceImg.naturalHeight || sourceImg.height;

        // Calculate scaling factor between device coordinates and actual image size
        const scaleX = imgActualWidth / this.screenWidth;
        const scaleY = imgActualHeight / this.screenHeight;

        // Convert region coordinates to actual image coordinates
        const actualX = Math.round(region.x * scaleX);
        const actualY = Math.round(region.y * scaleY);
        const actualWidth = Math.round(region.width * scaleX);
        const actualHeight = Math.round(region.height * scaleY);

        // Debug info
        console.log('[captureRegionImage] Debug Info:', {
            deviceResolution: { width: this.screenWidth, height: this.screenHeight },
            imageActualSize: { width: imgActualWidth, height: imgActualHeight },
            scale: { x: scaleX, y: scaleY },
            regionDevice: region,
            regionActual: { x: actualX, y: actualY, width: actualWidth, height: actualHeight }
        });

        // Create a temporary canvas to capture the region
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = actualWidth;
        tempCanvas.height = actualHeight;
        const ctx = tempCanvas.getContext('2d');

        try {
            // Draw the selected region from the source image using actual coordinates
            ctx.drawImage(
                sourceImg,
                actualX, actualY, actualWidth, actualHeight,
                0, 0, actualWidth, actualHeight
            );

            // Store the captured image as a data URL
            action.regionImage = tempCanvas.toDataURL('image/png');
        } catch (e) {
            console.error('Failed to capture region image:', e);
        }
    }

    renderImageThumbnail(action) {
        const canvas = document.getElementById(`thumbnail-${action.id}`);
        if (!canvas || !action.region) return;

        // If we have a stored region image, use it
        if (action.regionImage) {
            const img = new Image();
            img.onload = () => {
                const ctx = canvas.getContext('2d');
                const region = action.region;

                // Set canvas size to region size (maintain aspect ratio)
                const maxHeight = 80; // max-height: 80px from CSS
                const aspectRatio = region.width / region.height;

                let displayWidth = region.width;
                let displayHeight = region.height;

                // Scale down if too tall
                if (displayHeight > maxHeight) {
                    displayHeight = maxHeight;
                    displayWidth = maxHeight * aspectRatio;
                }

                canvas.width = region.width;
                canvas.height = region.height;
                canvas.style.width = `${displayWidth}px`;
                canvas.style.height = `${displayHeight}px`;

                // Draw the stored image
                ctx.drawImage(img, 0, 0);
            };
            img.src = action.regionImage;
        }
    }

    renderConditionImageThumbnail(condition) {
        const canvas = document.getElementById(`thumbnail-${condition.id}`);
        if (!canvas || !condition.params.region) return;

        // If we have a stored region image, use it
        if (condition.params.regionImage) {
            const img = new Image();
            img.onload = () => {
                const ctx = canvas.getContext('2d');
                const region = condition.params.region;

                // Set canvas size to region size (maintain aspect ratio)
                const maxHeight = 80; // max-height: 80px from CSS
                const aspectRatio = region.width / region.height;

                let displayWidth = region.width;
                let displayHeight = region.height;

                // Scale down if too tall
                if (displayHeight > maxHeight) {
                    displayHeight = maxHeight;
                    displayWidth = maxHeight * aspectRatio;
                }

                canvas.width = region.width;
                canvas.height = region.height;
                canvas.style.width = `${displayWidth}px`;
                canvas.style.height = `${displayHeight}px`;

                // Draw the stored image
                ctx.drawImage(img, 0, 0);
            };
            img.src = condition.params.regionImage;
        }
    }

    // Drag and Drop handlers

    // Helper: Get range of blocks to move (including paired blocks and everything in between)
    _getPairedBlocksRange(actionId) {
        const draggedAction = this.actions.find(a => a.id === actionId);
        if (!draggedAction) return null;

        let blocksToMove = [draggedAction];
        let pairAction = null;

        // Check if this is a paired block
        if (draggedAction.pairId) {
            pairAction = this.actions.find(a => a.pairId === draggedAction.pairId && a.id !== actionId);
            if (pairAction) {
                blocksToMove.push(pairAction);
            }
        }

        // Find the range (from start to end, including everything in between)
        const startIndex = Math.min(...blocksToMove.map(b => this.actions.findIndex(a => a.id === b.id)));
        const endIndex = Math.max(...blocksToMove.map(b => this.actions.findIndex(a => a.id === b.id)));
        const movingBlocks = this.actions.slice(startIndex, endIndex + 1);

        return {
            draggedAction,
            pairAction,
            startIndex,
            endIndex,
            movingBlocks,
            blockCount: endIndex - startIndex + 1
        };
    }

    // Helper: Validate paired block order
    // Note: movingBlocks is created via slice(startIndex, endIndex+1), which means
    // it ALWAYS preserves the original array order. Therefore, if the original
    // array has valid paired blocks (loop before end-loop), movingBlocks will too.
    // This validation is kept for safety but will always pass for valid pairs.
    _validatePairedBlockOrder(movingBlocks, draggedAction, pairAction) {
        // Since movingBlocks preserves original order, paired blocks are always
        // in correct sequence (opening before closing). No validation needed.
        return true;
    }

    // Helper: Calculate insertion index safely
    _calculateInsertIndex(targetIndex, isAfter, startIndex, blockCount) {
        let insertIndex = targetIndex;
        if (isAfter) {
            insertIndex++;
        }

        // Adjust insertion index if it's after the blocks being moved
        if (insertIndex > startIndex) {
            insertIndex -= blockCount;
        }

        return insertIndex;
    }

    // Helper: Move action blocks safely (preventing data loss)
    _moveActionBlocks(draggedActionId, targetIndex, isAfter = false) {
        const range = this._getPairedBlocksRange(draggedActionId);
        if (!range) {
            console.error('Failed to get paired blocks range');
            return false;
        }

        const { draggedAction, pairAction, startIndex, movingBlocks, blockCount } = range;

        // Validate paired block order
        if (!this._validatePairedBlockOrder(movingBlocks, draggedAction, pairAction)) {
            return false;
        }

        // Calculate safe insertion index
        const insertIndex = this._calculateInsertIndex(targetIndex, isAfter, startIndex, blockCount);

        // Perform the move
        this.actions.splice(startIndex, blockCount);
        this.actions.splice(insertIndex, 0, ...movingBlocks);

        return true;
    }

    handleActionBlockDragStart(event, actionId) {
        this.isDraggingAction = true;
        this.draggedActionId = actionId; // Store for use in dragover

        const action = this.actions.find(a => a.id === actionId);
        if (!action) return;

        event.dataTransfer.setData('actionId', actionId);
        event.dataTransfer.setData('actionType', action.type);
        event.dataTransfer.effectAllowed = 'move';

        // Set custom drag image to the action block itself
        const actionBlock = event.target.closest('[data-action-id]');
        if (actionBlock) {
            const dragImage = actionBlock.querySelector('.action-block');
            if (dragImage) {
                // Add dragging class for visual feedback
                dragImage.classList.add('dragging');
                event.dataTransfer.setDragImage(dragImage, 20, 20);
            }
        }
    }

    handleActionDragEnd(event) {
        console.log('🟢 [DEBUG] handleActionDragEnd CALLED', {
            isDraggingAction: this.isDraggingAction,
            draggedActionId: this.draggedActionId,
            draggedCondition: this.draggedCondition,
            timestamp: new Date().toISOString()
        });

        // Only do visual cleanup here - state clearing happens in drop handlers
        // to avoid race conditions between dragend and drop events

        // Remove dragging class from all blocks
        document.querySelectorAll('.action-block').forEach(block => {
            block.classList.remove('dragging');
        });

        // Remove drag-over classes from all containers
        document.querySelectorAll('[data-action-id]').forEach(container => {
            container.classList.remove('drag-over-before', 'drag-over-after');
        });

        // Remove placeholder
        this.removeDragPlaceholder();

        // Clear drag states after a delay to allow drop event to complete first
        setTimeout(() => {
            console.log('🟢 [DEBUG] Clearing drag states in timeout');
            this.isDraggingAction = false;
            this.draggedActionId = null;
            this.draggedCondition = null;
            this.conditionDropTarget = null;
        }, 100);
    }

    // Container drag handlers for dropping conditions in empty areas
    handleContainerDragOver(event) {
        // Only handle if we're dragging something
        if (!this.draggedCondition && !this.draggedActionId) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
    }

    handleContainerDrop(event) {
        event.preventDefault();
        event.stopPropagation();

        // Handle condition being dropped into action sequence
        if (this.draggedCondition) {
            const { parentActionId, conditionId } = this.draggedCondition;

            const parentAction = this.actions.find(a => a.id === parentActionId);
            if (!parentAction || !parentAction.conditions) return;

            const conditionIndex = parentAction.conditions.findIndex(c => c.id === conditionId);
            if (conditionIndex === -1) return;

            const condition = parentAction.conditions[conditionIndex];
            parentAction.conditions.splice(conditionIndex, 1);

            // Convert condition back to action
            const newAction = {
                id: `action-${Date.now()}`,
                type: condition.actionType,
                ...condition.params
            };

            this.actions.push(newAction);
            this.draggedCondition = null;
            this.renderActionSequence();
            this.markAsChanged();
        }
        // Handle regular action drops to end of list
        else if (this.draggedActionId) {
            const range = this._getPairedBlocksRange(this.draggedActionId);
            if (!range) return;

            const { startIndex, movingBlocks, blockCount } = range;

            // No validation needed - movingBlocks preserves original order
            // which ensures paired blocks (loop/end-loop) maintain correct sequence

            // Move blocks to end
            this.actions.splice(startIndex, blockCount);
            this.actions.push(...movingBlocks);

            this.renderActionSequence();
            this.markAsChanged();

            // Clear drag state immediately after successful drop
            this.isDraggingAction = false;
            this.draggedActionId = null;
        }
    }

    handleActionDragOver(event, targetActionId) {
        event.preventDefault();
        event.stopPropagation();

        // Check if dragging a condition
        if (this.draggedCondition) {
            console.log('🟠 [DEBUG] Handling condition dragover');
            // Handle condition drag over action
            const targetElement = event.currentTarget;
            const actionBlock = targetElement.querySelector('.action-block');
            if (!actionBlock) return;

            // Determine if dropping before or after based on mouse position
            const rect = actionBlock.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            const isAfter = event.clientY > midpoint;

            // Remove existing placeholder
            this.removeDragPlaceholder();

            // Create and insert placeholder element
            const placeholder = document.createElement('div');
            placeholder.className = 'drag-placeholder';
            placeholder.setAttribute('data-target-id', targetActionId);
            placeholder.setAttribute('data-insert-after', isAfter);
            placeholder.style.cssText = `
                height: 80px;
                margin: 12px 0;
                border: 3px dashed #3b82f6;
                border-radius: 10px;
                background: rgba(59, 130, 246, 0.08);
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
                animation: placeholderPulse 1.5s ease-in-out infinite;
            `;

            if (isAfter) {
                targetElement.insertAdjacentElement('afterend', placeholder);
            } else {
                targetElement.insertAdjacentElement('beforebegin', placeholder);
            }
            return;
        }

        // Use stored draggedActionId (getData doesn't work in dragover for security reasons)
        const draggedActionId = this.draggedActionId;
        if (!draggedActionId || draggedActionId === targetActionId) return;

        const targetElement = event.currentTarget;
        const actionBlock = targetElement.querySelector('.action-block');
        if (!actionBlock) return;

        // Get dragged and target actions
        const draggedIndex = this.actions.findIndex(a => a.id === draggedActionId);
        const targetIndex = this.actions.findIndex(a => a.id === targetActionId);
        if (draggedIndex === -1 || targetIndex === -1) return;

        const draggedAction = this.actions[draggedIndex];
        const targetAction = this.actions[targetIndex];

        // Determine if dropping before or after based on mouse position
        const rect = actionBlock.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        let isAfter = event.clientY > midpoint;

        // Smart position adjustment for END blocks
        // If target is an END block (end-if, end-loop, end-while), always insert AFTER it
        if (targetAction.type.startsWith('end-')) {
            isAfter = true;
        }

        // Check if this would be a no-op move (same position)
        // Case 1: Dragging to position immediately after itself (next block)
        if (!isAfter && targetIndex === draggedIndex + 1) {
            return; // No-op, same position
        }
        // Case 2: Dragging to position immediately before itself
        if (isAfter && targetIndex === draggedIndex - 1) {
            return; // No-op, same position
        }

        // Remove existing placeholder
        this.removeDragPlaceholder();

        // Create and insert placeholder element
        const placeholder = document.createElement('div');
        placeholder.className = 'drag-placeholder';
        placeholder.setAttribute('data-target-id', targetActionId);
        placeholder.setAttribute('data-insert-after', isAfter);
        placeholder.style.cssText = `
            height: 80px;
            margin: 12px 0;
            border: 3px dashed #3b82f6;
            border-radius: 10px;
            background: rgba(59, 130, 246, 0.08);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
            animation: placeholderPulse 1.5s ease-in-out infinite;
        `;

        // Make placeholder accept drop events
        placeholder.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        placeholder.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const targetId = placeholder.getAttribute('data-target-id');
            const insertAfter = placeholder.getAttribute('data-insert-after') === 'true';
            this.handleActionDropOnPlaceholder(e, targetId, insertAfter);
        });

        if (isAfter) {
            targetElement.insertAdjacentElement('afterend', placeholder);
        } else {
            targetElement.insertAdjacentElement('beforebegin', placeholder);
        }
    }

    removeDragPlaceholder() {
        const existingPlaceholder = document.querySelector('.drag-placeholder');
        if (existingPlaceholder) {
            existingPlaceholder.remove();
        }
    }

    // Condition drag handlers
    handleConditionDragStart(event, parentActionId, conditionId) {
        console.log('🔴 [DEBUG] handleConditionDragStart CALLED', {
            parentActionId,
            conditionId,
            timestamp: new Date().toISOString()
        });

        event.stopPropagation();
        this.draggedCondition = { parentActionId, conditionId };

        console.log('🔴 [DEBUG] draggedCondition SET:', this.draggedCondition);

        event.dataTransfer.effectAllowed = 'move';
        // Set both to ensure compatibility
        event.dataTransfer.setData('text/plain', conditionId);
        event.dataTransfer.setData('conditionDrag', 'true');  // Mark as condition drag

        console.log('🔴 [DEBUG] DataTransfer SET:', {
            'text/plain': conditionId,
            'conditionDrag': 'true'
        });
    }

    handleConditionDragOver(event, parentActionId, targetConditionId) {
        event.preventDefault();
        event.stopPropagation();

        if (!this.draggedCondition) return;

        // Can't drop on itself
        if (this.draggedCondition.conditionId === targetConditionId) return;

        // Can only reorder within same parent action
        if (this.draggedCondition.parentActionId !== parentActionId) return;

        const targetElement = event.currentTarget;
        const rect = targetElement.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const isAfter = event.clientY > midpoint;

        // Remove existing placeholder
        this.removeDragPlaceholder();

        // Create placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'drag-placeholder';
        placeholder.style.cssText = `
            height: 60px;
            margin: 8px 0;
            border: 3px dashed #3b82f6;
            border-radius: 8px;
            background: rgba(59, 130, 246, 0.08);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
            animation: placeholderPulse 1.5s ease-in-out infinite;
        `;

        if (isAfter) {
            targetElement.parentElement.insertAdjacentElement('afterend', placeholder);
        } else {
            targetElement.parentElement.insertAdjacentElement('beforebegin', placeholder);
        }

        this.conditionDropTarget = { parentActionId, targetConditionId, isAfter };
    }

    handleConditionDragLeave(event, parentActionId, conditionId) {
        // Don't remove placeholder on leave, handle in drop
    }

    handleConditionDrop(event, parentActionId, targetConditionId) {
        console.log('🔷 [DEBUG] handleConditionDrop CALLED', {
            parentActionId,
            targetConditionId,
            draggedCondition: this.draggedCondition,
            conditionDropTarget: this.conditionDropTarget,
            timestamp: new Date().toISOString()
        });

        event.preventDefault();
        event.stopPropagation();

        this.removeDragPlaceholder();

        if (!this.draggedCondition) {
            console.log('🔷 [DEBUG] No draggedCondition, returning');
            return;
        }
        if (!this.conditionDropTarget) {
            console.log('🔷 [DEBUG] No conditionDropTarget, returning');
            return;
        }

        const { parentActionId: sourceParentId, conditionId } = this.draggedCondition;
        const { targetConditionId: targetId, isAfter } = this.conditionDropTarget;

        console.log('🔷 [DEBUG] Reordering conditions:', {
            sourceParentId,
            parentActionId,
            isSameParent: sourceParentId === parentActionId,
            conditionId,
            targetId,
            isAfter
        });

        // Reorder conditions within the same parent
        if (sourceParentId === parentActionId) {
            const action = this.actions.find(a => a.id === parentActionId);
            if (!action || !action.conditions) {
                console.log('🔷 [DEBUG] Action not found or no conditions');
                return;
            }

            const sourceIndex = action.conditions.findIndex(c => c.id === conditionId);
            let targetIndex = action.conditions.findIndex(c => c.id === targetId);

            if (sourceIndex === -1 || targetIndex === -1) {
                console.log('🔷 [DEBUG] Source or target condition not found');
                return;
            }

            // Adjust target index if dropping after
            if (isAfter) targetIndex++;

            // Adjust if moving down
            if (sourceIndex < targetIndex) targetIndex--;

            console.log('🔷 [DEBUG] Moving condition:', {
                sourceIndex,
                targetIndex,
                conditionsBefore: action.conditions.length
            });

            // Perform the move
            const [movedCondition] = action.conditions.splice(sourceIndex, 1);
            action.conditions.splice(targetIndex, 0, movedCondition);

            console.log('🔷 [DEBUG] Condition moved successfully:', {
                conditionsAfter: action.conditions.length
            });

            // Don't call renderActionSettings() without an action parameter
            // The UI will be properly updated by renderActionSequence()
        } else {
            console.log('🔷 [DEBUG] Different parent actions - cross-parent move not implemented');
        }

        this.draggedCondition = null;
        this.conditionDropTarget = null;
        console.log('🔷 [DEBUG] Drag state cleared');
    }

    // Convert condition back to regular action
    handleConditionToActionDrop(event, targetActionId) {
        console.log('🟡 [DEBUG] handleConditionToActionDrop START', {
            draggedCondition: this.draggedCondition,
            targetActionId,
            timestamp: new Date().toISOString(),
            eventType: event.type,
            currentTarget: event.currentTarget?.className
        });

        this.removeDragPlaceholder();

        if (!this.draggedCondition) {
            console.log('🟡 [DEBUG] ERROR: No draggedCondition found!');
            return;
        }

        const { parentActionId, conditionId } = this.draggedCondition;

        // Find parent action and condition
        const parentAction = this.actions.find(a => a.id === parentActionId);
        console.log('🟡 [DEBUG] Parent action found:', {
            found: !!parentAction,
            parentActionId,
            parentActionType: parentAction?.type,
            hasConditions: parentAction?.conditions?.length > 0,
            conditionsCount: parentAction?.conditions?.length,
            conditions: parentAction?.conditions
        });

        if (!parentAction || !parentAction.conditions) {
            console.log('🟡 [DEBUG] ERROR: Parent action not found or no conditions!');
            return;
        }

        const conditionIndex = parentAction.conditions.findIndex(c => c.id === conditionId);
        console.log('🟡 [DEBUG] Condition index:', {
            conditionIndex,
            conditionId,
            allConditionIds: parentAction.conditions.map(c => c.id)
        });

        if (conditionIndex === -1) {
            console.log('🟡 [DEBUG] ERROR: Condition not found in parent!');
            return;
        }

        const condition = parentAction.conditions[conditionIndex];
        console.log('🟡 [DEBUG] Condition to convert:', condition);

        // Create new action from condition
        const newAction = {
            id: `action-${Date.now()}`,
            type: condition.actionType,
            ...condition.params
        };
        console.log('🟡 [DEBUG] New action created:', newAction);

        // Remove condition from parent
        const beforeRemove = parentAction.conditions.length;
        parentAction.conditions.splice(conditionIndex, 1);
        const afterRemove = parentAction.conditions.length;
        console.log('🟡 [DEBUG] Condition removed from parent:', {
            beforeRemove,
            afterRemove,
            removed: beforeRemove - afterRemove === 1
        });

        // Find target action index
        const targetIndex = this.actions.findIndex(a => a.id === targetActionId);
        console.log('🟡 [DEBUG] Target index:', targetIndex);

        if (targetIndex === -1) {
            console.log('🟡 [DEBUG] ERROR: Target action not found!');
            return;
        }

        // Determine if dropping before or after target
        const targetElement = event.currentTarget;
        const actionBlock = targetElement.querySelector('.action-block');
        const rect = actionBlock.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const isAfter = event.clientY > midpoint;

        // Insert action at target position
        let insertIndex = targetIndex;
        if (isAfter) insertIndex++;

        const beforeInsert = this.actions.length;
        this.actions.splice(insertIndex, 0, newAction);
        const afterInsert = this.actions.length;

        console.log('🟡 [DEBUG] Action inserted:', {
            insertIndex,
            isAfter,
            beforeInsert,
            afterInsert,
            inserted: afterInsert - beforeInsert === 1
        });

        // Clear drag state
        this.draggedCondition = null;
        this.conditionDropTarget = null;

        console.log('🟡 [DEBUG] Drag state cleared');

        // Update UI
        this.markAsChanged();
        console.log('🟡 [DEBUG] Marked as changed, rendering UI...');

        // Don't call renderActionSettings() here - the action isn't expanded yet
        // renderActionSequence() will handle rendering everything properly

        this.renderActionSequence();
        console.log('🟡 [DEBUG] Action sequence rendered');

        console.log('🟡 [DEBUG] COMPLETE: Converted condition to action at position', insertIndex);
    }

    handleActionDragLeave(event, targetActionId) {
        // Note: We don't remove placeholder on drag leave because
        // the user might be moving between nested elements
        // Placeholder will be updated or removed on next dragover or drop
    }

    handleActionDropOnPlaceholder(event, targetActionId, insertAfter) {
        // Reuse the main drop handler with the stored position
        const draggedActionId = this.draggedActionId || event.dataTransfer.getData('actionId');
        if (!draggedActionId || draggedActionId === targetActionId) {
            this.removeDragPlaceholder();
            return;
        }

        // Find the dragged action and its pair (if exists)
        const draggedIndex = this.actions.findIndex(a => a.id === draggedActionId);
        const targetIndex = this.actions.findIndex(a => a.id === targetActionId);

        if (draggedIndex === -1 || targetIndex === -1) {
            this.removeDragPlaceholder();
            return;
        }

        const draggedAction = this.actions[draggedIndex];
        let blocksToMove = [draggedAction];
        let pairAction = null;

        if (draggedAction.pairId) {
            pairAction = this.actions.find(a => a.pairId === draggedAction.pairId && a.id !== draggedAction.id);
            if (pairAction) {
                blocksToMove.push(pairAction);
            }
        }

        // Find the range of blocks to move
        const startIndex = Math.min(...blocksToMove.map(b => this.actions.findIndex(a => a.id === b.id)));
        const endIndex = Math.max(...blocksToMove.map(b => this.actions.findIndex(a => a.id === b.id)));

        // Extract ALL blocks in the range
        const movingBlocks = this.actions.slice(startIndex, endIndex + 1);
        const blockCount = endIndex - startIndex + 1;

        // Remove all blocks in the range from current position
        this.actions.splice(startIndex, blockCount);

        // Recalculate target index after removal
        let insertIndex = this.actions.findIndex(a => a.id === targetActionId);
        if (insertIndex === -1) {
            this.removeDragPlaceholder();
            return;
        }

        if (insertAfter) {
            insertIndex++;
        }

        // Insert all blocks at new position
        this.actions.splice(insertIndex, 0, ...movingBlocks);

        // Remove placeholder
        this.removeDragPlaceholder();

        // Mark as changed and re-render
        this.markAsChanged();
        this.renderActionSequence();

        console.log(`Reordered (via placeholder): moved ${blockCount} block(s) to position ${insertIndex}`);
    }

    handleActionDrop(event, targetActionId) {
        event.preventDefault();
        event.stopPropagation();

        // Handle condition drops
        const isConditionDrag = event.dataTransfer.getData('conditionDrag') === 'true';
        if (isConditionDrag || this.draggedCondition) {
            this.handleConditionToActionDrop(event, targetActionId);
            return;
        }

        // Handle action drops
        const draggedActionId = this.draggedActionId || event.dataTransfer.getData('actionId');
        if (!draggedActionId || draggedActionId === targetActionId) return;

        const targetIndex = this.actions.findIndex(a => a.id === targetActionId);
        if (targetIndex === -1) return;

        // Determine if dropping before or after target
        const targetElement = event.currentTarget;
        const actionBlock = targetElement.querySelector('.action-block');
        if (!actionBlock) return;

        const rect = actionBlock.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const isAfter = event.clientY > midpoint;

        // Move blocks using helper function
        if (this._moveActionBlocks(draggedActionId, targetIndex, isAfter)) {
            this.removeDragPlaceholder();
            this.markAsChanged();
            this.renderActionSequence();

            // Clear drag state immediately after successful drop
            this.isDraggingAction = false;
            this.draggedActionId = null;
        }
    }

    handleConditionDrop(event, targetActionId) {
        const draggedActionId = event.dataTransfer.getData('actionId');
        if (!draggedActionId) return;

        const draggedAction = this.actions.find(a => a.id === draggedActionId);
        if (!draggedAction) return;

        // Only allow certain action types as conditions
        const allowedTypes = ['image-match', 'sound-check', 'get-volume', 'click', 'long-press', 'wait'];
        if (!allowedTypes.includes(draggedAction.type)) {
            this.addLog('warning', `${this.getActionTypeLabel(draggedAction.type)} 액션은 조건으로 사용할 수 없습니다.`);
            return;
        }

        // Copy action parameters to condition
        this.addConditionFromAction(targetActionId, draggedAction);
    }

    // Condition management functions
    addConditionFromAction(targetActionId, sourceAction) {
        const targetAction = this.actions.find(a => a.id === targetActionId);
        if (!targetAction || !targetAction.conditions) return;

        // Copy all params from source action (not just specific ones)
        const params = { ...sourceAction };
        delete params.id;
        delete params.type;

        const newCondition = {
            id: `cond-${Date.now()}`,
            actionType: sourceAction.type,
            params: params,
            operator: targetAction.conditions.length > 0 ? 'AND' : null
        };

        targetAction.conditions.push(newCondition);

        // Remove source action from scenario (MOVE, not COPY)
        const sourceIndex = this.actions.findIndex(a => a.id === sourceAction.id);
        if (sourceIndex !== -1) {
            this.actions.splice(sourceIndex, 1);
        }

        // Auto-create tap-matched-image action if image-match is added to IF/ELSE-IF/WHILE
        if (sourceAction.type === 'image-match' && (targetAction.type === 'if' || targetAction.type === 'else-if' || targetAction.type === 'while')) {
            // Check if there's already a tap-matched-image action in the TRUE block
            const targetIndex = this.actions.findIndex(a => a.id === targetActionId);
            const nextAction = this.actions[targetIndex + 1];

            // Only add if the next action is NOT already tap-matched-image
            if (!nextAction || nextAction.type !== 'tap-matched-image') {
                const tapAction = {
                    id: `action-${Date.now()}-tap`,
                    type: 'tap-matched-image',
                    depth: (targetAction.depth || 0) + 1,
                    autoGenerated: true // Mark as auto-generated for easy identification
                };

                // Insert tap-matched-image right after the IF/ELSE-IF/WHILE
                this.actions.splice(targetIndex + 1, 0, tapAction);
                this.addLog('info', '찾은 영역 클릭 액션이 자동으로 추가되었습니다');
            }
        }

        this.renderActionSequence();
        this.addLog('success', `조건 추가: ${this.getActionTypeLabel(sourceAction.type)}`);
    }

    removeCondition(actionId, conditionId) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.conditions) return;

        const index = action.conditions.findIndex(c => c.id === conditionId);
        if (index === -1) return;

        const removedCondition = action.conditions[index];
        action.conditions.splice(index, 1);

        // Update operator for last condition
        if (action.conditions.length > 0) {
            action.conditions[action.conditions.length - 1].operator = null;
        }

        // Auto-delete tap-matched-image if image-match is removed and no more image-match conditions exist
        if (removedCondition.actionType === 'image-match') {
            const hasImageMatch = action.conditions.some(c => c.actionType === 'image-match');

            if (!hasImageMatch) {
                // Find and remove auto-generated tap-matched-image action
                const actionIndex = this.actions.findIndex(a => a.id === actionId);
                const nextAction = this.actions[actionIndex + 1];

                if (nextAction && nextAction.type === 'tap-matched-image' && nextAction.autoGenerated) {
                    this.actions.splice(actionIndex + 1, 1);
                    this.addLog('info', '찾은 영역 클릭 액션이 자동으로 제거되었습니다');
                }
            }
        }

        this.renderActionSequence();
    }

    updateConditionType(actionId, conditionId, actionType) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.conditions) return;

        const condition = action.conditions.find(c => c.id === conditionId);
        if (!condition) return;

        condition.actionType = actionType;

        // Reset params based on action type
        switch (actionType) {
            case 'image-match':
                condition.params = { imagePath: 'image.png', threshold: 0.95 };
                break;
            case 'click':
            case 'long-press':
                condition.params = { x: 0, y: 0 };
                break;
            default:
                condition.params = {};
        }

        this.renderActionSequence();
    }

    toggleConditionNegate(actionId, conditionId, negate) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.conditions) return;

        const condition = action.conditions.find(c => c.id === conditionId);
        if (!condition) return;

        condition.negate = negate;
        this.renderActionSequence();
    }

    updateConditionParam(actionId, conditionId, paramName, paramValue) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.conditions) return;

        const condition = action.conditions.find(c => c.id === conditionId);
        if (!condition) return;

        condition.params[paramName] = paramValue;
        this.renderActionSequence();
    }

    updateConditionOperator(actionId, conditionId, operator) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.conditions) return;

        const condition = action.conditions.find(c => c.id === conditionId);
        if (!condition) return;

        condition.operator = operator;
        this.renderActionSequence();
    }

    updateConditionComparison(actionId, conditionId, field, value) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.conditions) return;

        const condition = action.conditions.find(c => c.id === conditionId);
        if (!condition) return;

        // Initialize comparison object if not exists
        if (!condition.comparison) {
            condition.comparison = { operator: '>=', value: 0 };
        }

        condition.comparison[field] = value;
        this.renderActionSequence();
    }

    updateActionComparison(actionId, field, value) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action) return;

        // Initialize comparison object if not exists (matching default in ActionSettingsBuilder)
        if (!action.comparison) {
            action.comparison = { operator: '>=', value: 50 };
        }

        action.comparison[field] = value;
        this.saveMacro();

        // Update the settings panel without full re-render to avoid resetting the UI
        const settingsPanel = document.querySelector(`[data-action-id="${actionId}"] .settings-panel`);
        if (settingsPanel) {
            settingsPanel.innerHTML = this.getSettingsHTML(action);
        }
    }

    updateConditionRegionProperty(actionId, conditionId, property, value) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.conditions) return;

        const condition = action.conditions.find(c => c.id === conditionId);
        if (!condition || !condition.params.region) return;

        condition.params.region[property] = value;

        // Recapture the image with the new region coordinates
        this.captureConditionRegionImage(action, condition);

        this.saveMacro();
        this.render();
    }

    async autoCropConditionRegion(actionId, conditionId) {
        try {
            const action = this.actions.find(a => a.id === actionId);
            if (!action || !action.conditions) return;

            const condition = action.conditions.find(c => c.id === conditionId);
            if (!condition || !condition.params.region) {
                this.addLog('error', '영역을 찾을 수 없습니다');
                return;
            }

            // Get the thumbnail canvas
            const thumbnailCanvas = document.getElementById(`thumbnail-${conditionId}`);
            if (!thumbnailCanvas) {
                this.addLog('error', '썸네일 캔버스를 찾을 수 없습니다');
                return;
            }

            const ctx = thumbnailCanvas.getContext('2d');
            const width = thumbnailCanvas.width;
            const height = thumbnailCanvas.height;

            // Get image data
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            // Find content bounds (non-background pixels)
            const threshold = 30; // Color difference threshold
            let minX = width, minY = height, maxX = 0, maxY = 0;
            let foundContent = false;

            // Sample background color from corners
            const bgR = data[0], bgG = data[1], bgB = data[2];

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    const r = data[idx], g = data[idx + 1], b = data[idx + 2];

                    const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);

                    if (diff > threshold) {
                        foundContent = true;
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                }
            }

            if (!foundContent || maxX <= minX || maxY <= minY) {
                this.addLog('error', '자동 자르기할 콘텐츠를 찾을 수 없습니다');
                return;
            }

            // Calculate new region based on crop bounds
            const region = condition.params.region;
            const scaleX = region.width / width;
            const scaleY = region.height / height;

            const newRegion = {
                x: Math.round(region.x + minX * scaleX),
                y: Math.round(region.y + minY * scaleY),
                width: Math.round((maxX - minX + 1) * scaleX),
                height: Math.round((maxY - minY + 1) * scaleY)
            };

            condition.params.region = newRegion;
            this.captureConditionRegionImage(action, condition);
            this.saveMacro();
            this.render();

            this.addLog('success', `자동 자르기 완료: ${newRegion.width}×${newRegion.height}`);
        } catch (error) {
            console.error('Auto crop failed:', error);
            this.addLog('error', `자동 자르기 실패: ${error.message}`);
        }
    }

    captureConditionRegionImage(action, condition) {
        if (!condition.params.region) return;

        const sourceImg = document.getElementById('screen-stream-image');
        if (!sourceImg || !sourceImg.complete) return;

        const region = condition.params.region;

        // Get the actual image dimensions
        const imgActualWidth = sourceImg.naturalWidth || sourceImg.width;
        const imgActualHeight = sourceImg.naturalHeight || sourceImg.height;

        // Calculate scaling factor between device coordinates and actual image size
        const scaleX = imgActualWidth / this.screenWidth;
        const scaleY = imgActualHeight / this.screenHeight;

        // Convert region coordinates to actual image coordinates
        const actualX = Math.round(region.x * scaleX);
        const actualY = Math.round(region.y * scaleY);
        const actualWidth = Math.round(region.width * scaleX);
        const actualHeight = Math.round(region.height * scaleY);

        // Create a temporary canvas to capture the region
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = actualWidth;
        tempCanvas.height = actualHeight;
        const ctx = tempCanvas.getContext('2d');

        try {
            // Draw the selected region from the source image using actual coordinates
            ctx.drawImage(
                sourceImg,
                actualX, actualY, actualWidth, actualHeight,
                0, 0, actualWidth, actualHeight
            );

            // Store the captured image as a data URL
            condition.params.regionImage = tempCanvas.toDataURL('image/png');
        } catch (e) {
            console.error('Failed to capture condition region image:', e);
        }
    }

    getActionTypeLabel(type) {
        const labels = {
            'image-match': '이미지 매칭',
            'click': '클릭',
            'long-press': '롱프레스',
            'wait': '대기'
        };
        return labels[type] || type;
    }

    getCurrentScenario() {
        return {
            actions: this.actions
        };
    }

    renderConditionCard(actionId, condition, index, totalConditions) {
        const isLast = index === totalConditions - 1;
        const isFirst = index === 0;
        const config = this.getActionConfig(condition.actionType);

        // Create temporary action object for description
        const tempAction = {
            type: condition.actionType,
            ...condition.params
        };
        const description = this.getActionDescription(tempAction);

        const isExpanded = this.expandedConditionId === condition.id;

        return `
            <div>
                <!-- Condition Block -->
                <div
                    class="bg-white border-2 border-slate-200 hover:border-slate-300 rounded-lg"
                    draggable="true"
                    ondragstart="window.macroApp.handleConditionDragStart(event, '${actionId}', '${condition.id}')"
                    ondragend="window.macroApp.handleActionDragEnd(event)"
                    ondragover="window.macroApp.handleConditionDragOver(event, '${actionId}', '${condition.id}')"
                    ondragleave="window.macroApp.handleConditionDragLeave(event, '${actionId}', '${condition.id}')"
                    ondrop="window.macroApp.handleConditionDrop(event, '${actionId}', '${condition.id}')"
                    onclick="event.stopPropagation()"
                    style="transition: all 0.2s; cursor: grab;"
                    onmousedown="this.style.cursor='grabbing'"
                    onmouseup="this.style.cursor='grab'"
                >
                    <div class="p-3">
                        <div class="flex items-center gap-3">
                            <!-- Icon -->
                            <div class="${config.color} p-2 rounded-lg text-white flex-shrink-0 flex items-center justify-center" style="width: 2.5rem; height: 2.5rem;">
                                <div style="width: 1.25rem; height: 1.25rem;">
                                    ${config.icon}
                                </div>
                            </div>

                            <!-- Content -->
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 mb-1">
                                    <h3 class="text-slate-900 font-medium">${config.label}</h3>
                                    <!-- NOT Toggle -->
                                    <label class="flex items-center gap-1 cursor-pointer group" onclick="event.stopPropagation()">
                                        <input
                                            type="checkbox"
                                            ${condition.negate ? 'checked' : ''}
                                            onchange="window.macroApp.toggleConditionNegate('${actionId}', '${condition.id}', this.checked)"
                                            class="w-3 h-3 rounded border-slate-300 text-red-500 focus:ring-red-500 focus:ring-offset-0 cursor-pointer"
                                        />
                                        <span class="text-xs ${condition.negate ? 'text-red-600 font-medium' : 'text-slate-500'} group-hover:text-red-600 transition-colors">
                                            NOT
                                        </span>
                                    </label>
                                </div>
                                ${description ? `<p class="text-sm text-slate-600 truncate">${description}</p>` : ''}
                            </div>

                            <!-- Actions -->
                            <div class="flex gap-1 flex-shrink-0">
                                <button class="btn-ghost h-8 w-8 p-0" onclick="event.stopPropagation(); window.macroApp.toggleConditionSettings('${condition.id}')">
                                    ${this.getIconSVG('settings')}
                                </button>
                                <button class="btn-ghost h-8 w-8 p-0" ${isFirst ? 'disabled' : ''} onclick="event.stopPropagation(); window.macroApp.moveCondition('${actionId}', '${condition.id}', 'up')">
                                    ${this.getIconSVG('chevron-up')}
                                </button>
                                <button class="btn-ghost h-8 w-8 p-0" ${isLast ? 'disabled' : ''} onclick="event.stopPropagation(); window.macroApp.moveCondition('${actionId}', '${condition.id}', 'down')">
                                    ${this.getIconSVG('chevron-down')}
                                </button>
                                <button class="btn-ghost h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onclick="event.stopPropagation(); window.macroApp.removeCondition('${actionId}', '${condition.id}')">
                                    ${this.getIconSVG('trash')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Expandable Settings -->
                    ${isExpanded ? this.renderConditionSettings(actionId, condition) : ''}
                </div>

                <!-- Simple Divider (no individual operators) -->
                ${!isLast ? `
                    <div class="flex items-center justify-center my-2">
                        <div class="w-full border-t border-slate-200"></div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderConditionSettings(actionId, condition) {
        // Create a temporary action object from condition
        const tempAction = {
            id: condition.id,
            type: condition.actionType,
            ...condition.params
        };

        // Get the same settings HTML as regular actions
        let settingsHTML = this.getSettingsHTML(tempAction);

        // Replace updateActionValue calls with updateConditionParam calls
        settingsHTML = settingsHTML.replace(
            /window\.macroApp\.updateActionValue\('([^']+)',\s*'([^']+)',/g,
            `window.macroApp.updateConditionParam('${actionId}', '${condition.id}', '$2',`
        );

        // Replace updateRegionProperty calls with updateConditionRegionProperty calls
        settingsHTML = settingsHTML.replace(
            /window\.macroApp\.updateRegionProperty\('([^']+)',/g,
            `window.macroApp.updateConditionRegionProperty('${actionId}', '${condition.id}',`
        );

        // Replace autoCropRegion calls
        settingsHTML = settingsHTML.replace(
            /window\.macroApp\.autoCropRegion\('([^']+)'\)/g,
            `window.macroApp.autoCropConditionRegion('${actionId}', '${condition.id}')`
        );

        // Replace resetActionRegion calls
        settingsHTML = settingsHTML.replace(
            /window\.macroApp\.resetActionRegion\('([^']+)'\)/g,
            `window.macroApp.resetConditionRegion('${actionId}', '${condition.id}')`
        );

        // Replace updateActionComparison calls with updateConditionComparison calls
        settingsHTML = settingsHTML.replace(
            /window\.macroApp\.updateActionComparison\('([^']+)',/g,
            `window.macroApp.updateConditionComparison('${actionId}', '${condition.id}',`
        );

        return `
            <div class="settings-panel border-t border-slate-200 bg-slate-50 px-8 py-5" style="border-bottom-left-radius: var(--radius); border-bottom-right-radius: var(--radius); overflow: hidden;">
                ${settingsHTML}
            </div>
        `;
    }

    renderConditionParams(actionId, condition) {
        switch (condition.actionType) {
            case 'image-match':
                return `
                    <div>
                        <label class="text-xs mb-1 block text-slate-600">이미지 이름</label>
                        <input type="text" value="${condition.params.imagePath || 'image.png'}"
                            class="w-full px-2 py-1.5 border border-slate-300 rounded text-xs h-7"
                            placeholder="이미지 이름"
                            onclick="event.stopPropagation()"
                            onchange="window.macroApp.updateConditionParam('${actionId}', '${condition.id}', 'imagePath', this.value)">
                    </div>
                    <div>
                        <label class="text-xs mb-1 block text-slate-600">매칭 정확도: ${Math.round((condition.params.threshold || 0.955) * 100)}%</label>
                        <input type="range"
                            value="${Math.round((condition.params.threshold || 0.955) * 100)}"
                            min="50"
                            max="100"
                            step="1"
                            class="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-emerald-500"
                            onclick="event.stopPropagation()"
                            oninput="window.macroApp.updateConditionParam('${actionId}', '${condition.id}', 'threshold', parseFloat(this.value) / 100)"
                            onchange="window.macroApp.updateConditionParam('${actionId}', '${condition.id}', 'threshold', parseFloat(this.value) / 100)">
                    </div>
                `;
            case 'click':
            case 'long-press':
                return `
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="text-xs mb-1 block text-slate-600">X</label>
                            <input type="number" value="${condition.params.x || 0}"
                                class="w-full px-2 py-1.5 border border-slate-300 rounded text-xs h-7"
                                onclick="event.stopPropagation()"
                                onchange="window.macroApp.updateConditionParam('${actionId}', '${condition.id}', 'x', parseInt(this.value))">
                        </div>
                        <div>
                            <label class="text-xs mb-1 block text-slate-600">Y</label>
                            <input type="number" value="${condition.params.y || 0}"
                                class="w-full px-2 py-1.5 border border-slate-300 rounded text-xs h-7"
                                onclick="event.stopPropagation()"
                                onchange="window.macroApp.updateConditionParam('${actionId}', '${condition.id}', 'y', parseInt(this.value))">
                        </div>
                    </div>
                `;
            case 'wait':
                return `
                    <div>
                        <label class="text-xs mb-1 block text-slate-600">대기 시간: ${condition.params.duration || 1000}ms</label>
                        <input type="range"
                            value="${condition.params.duration || 1000}"
                            min="100"
                            max="10000"
                            step="100"
                            class="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-emerald-500"
                            onclick="event.stopPropagation()"
                            oninput="window.macroApp.updateConditionParam('${actionId}', '${condition.id}', 'duration', parseInt(this.value))"
                            onchange="window.macroApp.updateConditionParam('${actionId}', '${condition.id}', 'duration', parseInt(this.value))">
                    </div>
                `;
            case 'get-volume':
                const operatorOptions = ActionConfigProvider.getComparisonOperators()
                    .map(op => `<option value="${op.value}" ${(condition.params.operator || '>=') === op.value ? 'selected' : ''}>${op.label} (${op.value})</option>`)
                    .join('');
                return `
                    <div class="space-y-2">
                        <div>
                            <label class="text-xs mb-1 block text-slate-600">비교 연산자</label>
                            <select
                                class="w-full px-2 py-1.5 border border-slate-300 rounded text-xs h-7"
                                onclick="event.stopPropagation()"
                                onchange="window.macroApp.updateConditionParam('${actionId}', '${condition.id}', 'operator', this.value)"
                            >
                                ${operatorOptions}
                            </select>
                        </div>
                        <div>
                            <label class="text-xs mb-1 block text-slate-600">Volume Value: ${condition.params.value || 0}%</label>
                            <input type="range"
                                value="${condition.params.value || 0}"
                                min="0"
                                max="100"
                                step="5"
                                class="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-emerald-500"
                                onclick="event.stopPropagation()"
                                oninput="window.macroApp.updateConditionParam('${actionId}', '${condition.id}', 'value', parseInt(this.value))"
                                onchange="window.macroApp.updateConditionParam('${actionId}', '${condition.id}', 'value', parseInt(this.value))">
                        </div>
                    </div>
                `;
            default:
                return '';
        }
    }

    calculateDepths() {
        // Legacy block types (for backwards compatibility)
        const legacyBlockStartTypes = ['loop', 'while'];
        const legacyBlockEndTypes = ['end-if', 'end-loop', 'end-while'];
        const legacyBlockMidTypes = ['else-if'];

        // New flat condition block types
        const conditionStartTypes = ['if', 'image-match', 'get-volume', 'sound-check'];
        const conditionMidTypes = ['else'];
        const conditionEndTypes = ['endif'];

        let currentDepth = 0;
        return this.actions.map((action) => {
            let actionDepth = currentDepth;

            // Handle condition mid blocks (else) - show at same level as start
            if (conditionMidTypes.includes(action.type)) {
                actionDepth = Math.max(0, currentDepth - 1);
            }

            // Handle legacy mid blocks (else-if)
            if (legacyBlockMidTypes.includes(action.type)) {
                actionDepth = Math.max(0, currentDepth - 1);
            }

            // Handle condition end blocks (endif)
            if (conditionEndTypes.includes(action.type)) {
                currentDepth = Math.max(0, currentDepth - 1);
                actionDepth = currentDepth;
            }

            // Handle legacy end blocks
            if (legacyBlockEndTypes.includes(action.type)) {
                currentDepth = Math.max(0, currentDepth - 1);
                actionDepth = currentDepth;
            }

            const result = { ...action, depth: actionDepth };

            // Handle condition start blocks - increase depth after
            if (conditionStartTypes.includes(action.type)) {
                currentDepth++;
            }

            // Handle legacy start blocks (loop, while)
            if (legacyBlockStartTypes.includes(action.type)) {
                currentDepth++;
            }

            // Handle condition mid blocks - increase depth after
            if (conditionMidTypes.includes(action.type)) {
                currentDepth = actionDepth + 1;
            }

            // Handle legacy mid blocks
            if (legacyBlockMidTypes.includes(action.type)) {
                currentDepth = actionDepth + 1;
            }

            return result;
        });
    }

    /**
     * Find the condition starter (if, image-match, get-volume, sound-check) for a given paired block
     * @param {Object} action - The action to find the starter for (endif, else, else-if)
     * @returns {Object|null} The condition starter action or null if not found
     */
    findConditionStarter(action) {
        if (!action.pairId) return null;

        const conditionStartTypes = ['if', 'image-match', 'get-volume', 'sound-check'];
        return this.actions.find(a =>
            a.pairId === action.pairId && conditionStartTypes.includes(a.type)
        );
    }

    /**
     * Get action config with color inheritance for paired blocks
     * For endif, else, else-if: inherit color from their condition starter
     * @param {Object} action - The action object
     * @returns {Object} UI configuration with potentially inherited colors
     */
    getActionConfigWithInheritance(action) {
        const baseConfig = this.getActionConfig(action.type);

        // Types that should inherit color from their condition starter
        const inheritColorTypes = ['endif', 'else', 'else-if', 'end-if'];

        if (inheritColorTypes.includes(action.type)) {
            const starter = this.findConditionStarter(action);
            if (starter) {
                const starterConfig = this.getActionConfig(starter.type);
                // Inherit color, borderClass, bgClass from starter, but keep own label and icon
                return {
                    ...baseConfig,
                    color: starterConfig.color,
                    borderClass: starterConfig.borderClass,
                    bgClass: starterConfig.bgClass
                };
            }
        }

        return baseConfig;
    }

    renderActionBlock(action, index, total) {
        const config = this.getActionConfigWithInheritance(action);
        const isSelected = this.selectedActionId === action.id;
        const isRunning = this.isRunning && isSelected;
        const isFirst = index === 0;
        const isLast = index === total - 1;
        const depth = action.depth || 0;

        const description = this.getActionDescription(action);
        const isExpanded = action.id === this.expandedActionId;

        // Border classes based on selection
        const borderClass = isSelected ? config.borderClass : 'border-slate-200 hover:border-slate-300';
        const ringClass = isRunning ? 'ring-4 ring-blue-400 ring-opacity-50 animate-pulse' : '';

        return `
            <div style="margin-left: ${depth * 24}px; position: relative;"
                 data-action-id="${action.id}"
                 ondragover="window.macroApp.handleActionDragOver(event, '${action.id}')"
                 ondragleave="window.macroApp.handleActionDragLeave(event, '${action.id}')"
                 ondrop="window.macroApp.handleActionDrop(event, '${action.id}')">
                ${depth > 0 ? '<div style="position: absolute; left: -12px; top: 0; bottom: 0; width: 2px; background-color: var(--slate-300);"></div>' : ''}
                ${!isLast ? `<div class="action-connector" style="left: ${24 + depth * 24}px;"></div>` : ''}

                <div class="action-block ${config.bgClass} border-2 ${borderClass} ${ringClass} ${isSelected ? 'shadow-lg' : ''} ${isExpanded ? 'expanded' : ''}" style="border-radius: var(--radius); cursor: pointer; transition: all 0.2s; position: relative;">
                    <div class="p-4">
                        <div class="flex items-center gap-3">
                            <!-- Drag Handle -->
                            <div class="drag-handle flex-shrink-0"
                                draggable="true"
                                onclick="event.stopPropagation()"
                                ondragstart="window.macroApp.handleActionBlockDragStart(event, '${action.id}')"
                                ondragend="window.macroApp.handleActionDragEnd(event)"
                                style="cursor: grab; padding: 0.25rem; opacity: 0.3; transition: opacity 0.2s;"
                                onmouseenter="this.style.opacity='0.6'"
                                onmouseleave="this.style.opacity='0.3'">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <circle cx="9" cy="5" r="2"/>
                                    <circle cx="9" cy="12" r="2"/>
                                    <circle cx="9" cy="19" r="2"/>
                                    <circle cx="15" cy="5" r="2"/>
                                    <circle cx="15" cy="12" r="2"/>
                                    <circle cx="15" cy="19" r="2"/>
                                </svg>
                            </div>

                            <!-- Index Badge -->
                            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center text-sm text-slate-700">
                                ${index + 1}
                            </div>

                            <!-- Icon -->
                            <div class="${config.color} p-2 rounded-lg text-white flex-shrink-0 flex items-center justify-center" style="width: 2.5rem; height: 2.5rem;">
                                <div style="width: 1.25rem; height: 1.25rem;">
                                    ${config.icon}
                                </div>
                            </div>

                            <!-- Content -->
                            <div class="flex-1 min-w-0">
                                <h3 class="text-slate-900 mb-1">${config.label}</h3>
                                ${description ? `<p class="text-sm text-slate-600 truncate">${description}</p>` : ''}
                            </div>

                            <!-- Actions -->
                            <div class="flex gap-1 flex-shrink-0">
                                ${!['end-if', 'end-loop', 'end-while', 'else'].includes(action.type) ? `
                                <button class="btn-ghost h-8 w-8 p-0" onclick="event.stopPropagation(); window.macroApp.toggleActionSettings('${action.id}')">
                                    ${this.getIconSVG('settings')}
                                </button>
                                ` : ''}
                                <button class="btn-ghost h-8 w-8 p-0 btn-move-up" ${isFirst ? 'disabled' : ''}>
                                    ${this.getIconSVG('chevron-up')}
                                </button>
                                <button class="btn-ghost h-8 w-8 p-0 btn-move-down" ${isLast ? 'disabled' : ''}>
                                    ${this.getIconSVG('chevron-down')}
                                </button>
                                <button class="btn-ghost h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 btn-delete">
                                    ${this.getIconSVG('trash')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Expandable Settings -->
                    ${isExpanded ? this.renderActionSettings(action) : ''}
                </div>
            </div>
        `;
    }

    renderActionSettings(action) {
        return `
            <div class="settings-panel border-t border-slate-200 bg-white px-8 py-5" onclick="event.stopPropagation()" style="border-bottom-left-radius: var(--radius); border-bottom-right-radius: var(--radius); overflow: hidden;">
                ${this.getSettingsHTML(action)}
            </div>
        `;
    }

    getSettingsHTML(action) {
        // Phase 2 Refactoring: Delegate to ActionSettingsBuilder
        return this.actionSettingsBuilder.build(action);
    }

    toggleActionSettings(id) {
        if (this.expandedActionId === id) {
            this.expandedActionId = null;
        } else {
            this.expandedActionId = id;
        }
        this.renderActionSequence();
    }

    toggleConditionSettings(conditionId) {
        if (this.expandedConditionId === conditionId) {
            this.expandedConditionId = null;
            this.selectedCondition = null;

            // Clear markers from screen
            this.clearScreenMarkers();
        } else {
            this.expandedConditionId = conditionId;

            // Find the action and condition
            let foundAction = null;
            let foundCondition = null;
            for (const action of this.actions) {
                if (action.conditions) {
                    const condition = action.conditions.find(c => c.id === conditionId);
                    if (condition) {
                        foundAction = action;
                        foundCondition = condition;
                        break;
                    }
                }
            }

            // If image-match condition, enable region selection
            if (foundCondition && foundCondition.actionType === 'image-match') {
                this.selectedCondition = {
                    actionId: foundAction.id,
                    conditionId: conditionId
                };
            } else {
                this.selectedCondition = null;
            }
        }
        this.renderActionSequence();
    }

    moveCondition(actionId, conditionId, direction) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.conditions) return;

        const index = action.conditions.findIndex(c => c.id === conditionId);
        if (index === -1) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= action.conditions.length) return;

        // Swap conditions
        [action.conditions[index], action.conditions[newIndex]] =
            [action.conditions[newIndex], action.conditions[index]];

        this.renderActionSequence();
    }

    updateActionValue(id, key, value) {
        const action = this.actions.find(a => a.id === id);
        if (action) {
            action[key] = value;
            // Mark as changed
            this.markAsChanged();

            // Special handling for conditionOperator to update UI badge
            if (key === 'conditionOperator') {
                this.updateConditionOperatorUI(id, value);
            }
            // Don't re-render to avoid losing focus
        }
    }

    updateConditionOperatorUI(actionId, operator) {
        const isAnd = operator === 'AND';

        // Update badge
        const badgeEl = document.querySelector(`#action-settings-${actionId} .px-3.py-1.text-white.text-xs.font-bold.rounded-full`);
        if (badgeEl) {
            badgeEl.textContent = operator;
            badgeEl.className = `px-3 py-1 ${isAnd ? 'bg-blue-500' : 'bg-orange-500'} text-white text-xs font-bold rounded-full shadow-sm`;
        }

        // Update buttons
        const buttons = document.querySelectorAll(`#action-settings-${actionId} button[onclick*="conditionOperator"]`);
        buttons.forEach(btn => {
            const isAndBtn = btn.textContent.includes('AND');
            if (isAndBtn && isAnd) {
                btn.className = 'px-3 py-1.5 text-xs rounded-md font-medium transition-all bg-blue-500 text-white shadow-sm';
            } else if (isAndBtn && !isAnd) {
                btn.className = 'px-3 py-1.5 text-xs rounded-md font-medium transition-all bg-white border border-slate-300 text-slate-700 hover:bg-slate-50';
            } else if (!isAndBtn && !isAnd) {
                btn.className = 'px-3 py-1.5 text-xs rounded-md font-medium transition-all bg-orange-500 text-white shadow-sm';
            } else {
                btn.className = 'px-3 py-1.5 text-xs rounded-md font-medium transition-all bg-white border border-slate-300 text-slate-700 hover:bg-slate-50';
            }
        });
    }

    getActionConfig(type) {
        // Delegate to ActionConfigProvider for single source of truth
        // This prevents UI config duplication and ensures consistency
        return this.actionConfigProvider.getUIConfig(type, this.getIconSVG.bind(this));
    }

    getActionDescription(action) {
        switch (action.type) {
            case 'click':
                return `좌표: (${action.x || 0}, ${action.y || 0})`;
            case 'long-press':
                return `좌표: (${action.x || 0}, ${action.y || 0}), ${action.duration || 1000}ms`;
            case 'drag':
                return `(${action.x || 0}, ${action.y || 0}) → (${action.endX || 0}, ${action.endY || 0})`;
            case 'keyboard':
                return action.text || '텍스트 미입력';
            case 'wait':
                return `${action.duration || 1000}ms 대기`;
            case 'screenshot':
                return action.filename || 'screenshot.png';
            case 'image-match':
                if (action.region) {
                    return `영역: ${action.region.width}×${action.region.height} • ${Math.round((action.threshold || 0.95) * 100)}%`;
                }
                return `${action.imagePath || 'image.png'} • ${Math.round((action.threshold || 0.95) * 100)}%`;
            case 'tap-matched-image':
                if (action.linkedImageMatchId) {
                    // Find the linked image-match action (including nested ones)
                    const allActions = this.getAllActionsFlattened();
                    const linkedAction = allActions.find(a => a.id === action.linkedImageMatchId);
                    if (linkedAction) {
                        // Use parent action index if this is a condition
                        const displayId = linkedAction.isCondition ? linkedAction.parentActionId : linkedAction.id;
                        const actionIndex = this.getActionDisplayIndex(displayId);

                        if (linkedAction.isCondition) {
                            return `#${actionIndex} If 조건`;
                        } else if (linkedAction.region) {
                            return `#${actionIndex} 이미지 매칭 결과`;
                        } else {
                            return `#${actionIndex} ${linkedAction.imagePath || 'image.png'}`;
                        }
                    }
                }
                return '마지막 매칭 위치';
            case 'if':
            case 'else-if':
            case 'while':
                if (!action.conditions || action.conditions.length === 0) {
                    return '조건 없음';
                }
                // Show condition summary: "image-match, click"
                const conditionTypes = action.conditions.map(c => {
                    const config = this.getActionConfig(c.actionType);
                    return config.label;
                }).join(', ');
                return conditionTypes;
            case 'log':
                return action.message || '로그 메시지';
            case 'set-variable':
                const source = action.source || 'previous';
                const varName = action.variableName || 'unnamed';
                if (source === 'previous') {
                    return `${varName} = Previous Result`;
                } else {
                    return `${varName} = ${action.value || 0}`;
                }
            case 'calc-variable':
                const targetVar = action.targetVariable || 'result';
                const op1Type = action.operand1Type || 'variable';
                const op2Type = action.operand2Type || 'constant';
                const operation = action.operation || '+';

                const op1Str = op1Type === 'variable'
                    ? (action.operand1Variable || '?')
                    : (action.operand1Value || 0);
                const op2Str = op2Type === 'variable'
                    ? (action.operand2Variable || '?')
                    : (action.operand2Value || 0);

                return `${targetVar} = ${op1Str} ${operation} ${op2Str}`;
            case 'loop':
                const loopCountType = action.countType || 'constant';
                if (loopCountType === 'variable') {
                    return `변수 ${action.variableName || '?'}회 반복`;
                } else {
                    return `${action.count || action.loopCount || 1}회 반복`;
                }
            case 'success':
                return action.message || '성공 종료';
            case 'skip':
                return action.message || '시나리오 스킵';
            case 'fail':
                return action.message || '실패 종료';
            case 'home':
            case 'back':
                return '시스템 버튼';
            case 'test':
                return 'UI 컴포넌트 샘플';
            case 'sound-check':
                const expectation = action.expectation || 'present';
                const duration = (action.duration || 5000) / 1000;
                if (expectation === 'present') {
                    return `${duration}초간 소리 감지`;
                } else if (expectation === 'silent') {
                    return `${duration}초간 무음 확인`;
                } else if (expectation === 'level') {
                    return `${duration}초간 ${action.threshold?.min || 0}~${action.threshold?.max || 100}dB`;
                }
                return `${duration}초간 측정`;
            case 'get-volume':
                return '시스템 볼륨 확인';
            default:
                return '';
        }
    }

    selectAction(id) {
        // Clear condition-related states when selecting an action
        this.selectedCondition = null;
        this.expandedConditionId = null;

        this.selectedActionId = id;
        this.renderActionSequence();

        const action = this.actions.find(a => a.id === id);
        if (action) {
            this.updateSelectedActionMarker(action);
        }
    }

    refreshActionSettings(id) {
        // Refresh only the settings panel for the given action
        // This keeps the action selected and just re-renders the settings
        this.selectedActionId = id;
        this.renderActionSequence();
    }

    toggleElseBranch(actionId) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action) return;

        // Find the action's index and matching endif
        const actionIndex = this.actions.findIndex(a => a.id === actionId);
        if (actionIndex === -1) return;

        const endifIndex = this.findMatchingEndif(actionIndex);
        if (endifIndex === -1) return;

        if (action.hasElse) {
            // Remove ELSE block
            // Find ELSE block between this action and ENDIF
            const elseIndex = this.actions.findIndex((a, idx) =>
                idx > actionIndex && idx < endifIndex && a.type === 'else' && a.pairId === action.pairId
            );

            if (elseIndex !== -1) {
                this.actions.splice(elseIndex, 1);
            }

            action.hasElse = false;
        } else {
            // Add ELSE block before ENDIF
            const elseAction = {
                id: `else-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: 'else',
                pairId: action.pairId
            };

            this.actions.splice(endifIndex, 0, elseAction);
            action.hasElse = true;
        }

        this.markAsChanged();
        this.refreshActionSettings(actionId);
    }

    findMatchingEndif(startIndex) {
        const startAction = this.actions[startIndex];
        if (!startAction || !startAction.pairId) return -1;

        for (let i = startIndex + 1; i < this.actions.length; i++) {
            const action = this.actions[i];
            if (action.type === 'endif' && action.pairId === startAction.pairId) {
                return i;
            }
        }
        return -1;
    }

    updateActionSetting(actionId, setting, value) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action) return;

        action[setting] = value;
        this.markAsChanged();

        // Re-render to update UI
        this.renderActionSequence();

        // Update the slider label in real-time
        const slider = document.querySelector(`input[data-action-id="${actionId}"][data-setting="${setting}"]`);
        if (slider && setting === 'threshold') {
            const label = slider.parentElement.querySelector('label span');
            if (label) {
                label.textContent = `${Math.round(value * 100)}%`;
            }
        }
    }

    deleteAction(id) {
        // Find the action to delete
        const actionToDelete = this.actions.find(a => a.id === id);
        if (!actionToDelete) return;

        // If action has a pairId, delete its pair as well
        if (actionToDelete.pairId) {
            this.actions = this.actions.filter(a => a.pairId !== actionToDelete.pairId);
        } else {
            this.actions = this.actions.filter(a => a.id !== id);
        }

        // Mark as changed
        this.markAsChanged();

        // If deleted action was selected, clear selection and markers
        if (this.selectedActionId === id) {
            this.selectedActionId = null;

            // Clear all markers from screen
            const screenPreview = document.getElementById('screen-preview-canvas');
            if (screenPreview) {
                const markers = screenPreview.querySelectorAll('.action-marker, .action-marker-line');
                markers.forEach(m => m.remove());
            }
        }

        this.renderActionSequence();
    }

    moveAction(id, direction) {
        const action = this.actions.find(a => a.id === id);
        if (!action) return;

        const index = this.actions.findIndex(a => a.id === id);
        if (index === -1) return;

        // Check if this action has a pair
        let blocksToMove = [action];
        let pairAction = null;

        if (action.pairId) {
            pairAction = this.actions.find(a => a.pairId === action.pairId && a.id !== action.id);
            if (pairAction) {
                blocksToMove.push(pairAction);
            }
        }

        // Find the range of blocks to move (start and end indices)
        const startIndex = Math.min(...blocksToMove.map(b => this.actions.findIndex(a => a.id === b.id)));
        const endIndex = Math.max(...blocksToMove.map(b => this.actions.findIndex(a => a.id === b.id)));
        const blockCount = endIndex - startIndex + 1;

        // Calculate new position for the entire block
        let newStartIndex;
        if (direction === 'up') {
            newStartIndex = startIndex - 1;
            if (newStartIndex < 0) return;
        } else {
            newStartIndex = endIndex + 1;
            if (newStartIndex >= this.actions.length) return;
        }

        // Extract all blocks in the range (including any actions between pair blocks)
        const movingBlocks = this.actions.slice(startIndex, endIndex + 1);

        // Remove them from current position
        this.actions.splice(startIndex, blockCount);

        // Calculate insertion index after removal
        let insertIndex;
        if (direction === 'up') {
            insertIndex = startIndex - 1;
        } else {
            // When moving down, the insertion point doesn't change because we already removed the blocks
            insertIndex = startIndex + 1;
        }

        // Insert all blocks at new position
        this.actions.splice(insertIndex, 0, ...movingBlocks);

        // Mark as changed
        this.markAsChanged();

        this.renderActionSequence();
    }

    calculateTotalActionCount(startIndex = 0, endIndex = null) {
        // Calculate the total number of actions that will be executed, including loop iterations
        if (endIndex === null) {
            endIndex = this.actions.length;
        }

        let totalCount = 0;

        for (let i = startIndex; i < endIndex; i++) {
            const action = this.actions[i];

            if (action.type === 'loop') {
                // Find the end of this loop
                const loopEnd = this.findBlockEnd(i, ['end-loop']);
                const loopCount = action.loopCount || 1;

                // Calculate actions inside the loop (recursively)
                const actionsInLoop = this.calculateTotalActionCount(i + 1, loopEnd);

                // Multiply by loop iterations
                totalCount += actionsInLoop * loopCount;

                // Skip to end of loop
                i = loopEnd;
            } else if (action.type === 'while') {
                // For while loops, we can't predict the count
                // Return null to indicate indeterminate progress
                return null;
            } else if (action.type === 'if' || action.type === 'else-if' || action.type === 'else') {
                // For conditionals, we can't predict which branch will execute
                // Return null to indicate indeterminate progress
                return null;
            } else if (!action.type.startsWith('end-')) {
                // Count regular actions (skip end-loop, end-while, end-if markers)
                totalCount++;
            }
        }

        return totalCount;
    }

    // ==================== Variable System Methods ====================

    setVariable(name, value) {
        this.variables[name] = value;
        console.log(`[Variable] Set: ${name} = ${value}`);
    }

    getVariable(name) {
        const value = this.variables[name];
        if (value === undefined) {
            console.warn(`[Variable] Variable '${name}' is not defined`);
        }
        return value;
    }

    clearVariables() {
        console.log('[Variable] Clearing all variables');
        this.variables = {};
        this.lastActionResult = null;
    }

    // ==================== Macro Execution Methods ====================

    async runMacro(scenarioKey = null) {
        if (!this.isDeviceConnected) {
            this.addLog('error', '장치가 연결되지 않았습니다');
            return;
        }

        if (this.actions.length === 0) {
            this.addLog('warning', '실행할 액션이 없습니다');
            return;
        }

        this.isRunning = true;
        this.shouldStop = false;
        this.scenarioResult = null; // Reset result at start
        this.clearVariables(); // Clear variables at start of macro execution
        const runBtn = document.getElementById('btn-run-macro');
        if (runBtn) {
            runBtn.innerHTML = `
                <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6"></path>
                </svg>
                중단
            `;
        }

        // If scenarioKey is provided, track its execution
        if (scenarioKey) {
            // Calculate total expected action count (null if indeterminate like while/if)
            const totalActions = this.calculateTotalActionCount();

            this.runningScenarios.set(scenarioKey, {
                status: 'running',
                progress: { current: 0, total: totalActions }
            });
            // Refresh scenario list to show progress
            if (this.isScenarioListVisible()) {
                this.renderScenarioListInPanel();
            }
        }

        this.addLog('info', `매크로 실행 시작: ${this.macroName}`);

        await this.executeActionsRange(0, this.actions.length, scenarioKey);

        const wasStopped = this.shouldStop;

        this.isRunning = false;
        this.shouldStop = false;
        this.selectedActionId = null;

        // Only render action sequence if scenario list is not visible
        // to prevent switching away from scenario list during execution
        if (!this.isScenarioListVisible()) {
            this.renderActionSequence();
        }

        this.clearScreenMarkers();

        // Log final result
        let finalStatus = 'completed';
        let finalMessage = '매크로 실행 완료';

        if (this.scenarioResult) {
            const { status, message } = this.scenarioResult;
            finalStatus = status; // 'pass', 'skip', or 'fail'
            finalMessage = message;

            if (status === 'pass') {
                this.addLog('success', `시나리오 완료 (PASS): ${message}`);
            } else if (status === 'skip') {
                this.addLog('info', `시나리오 스킵 (SKIP): ${message}`);
            } else if (status === 'fail') {
                this.addLog('error', `시나리오 실패 (FAIL): ${message}`);
            }
        } else if (wasStopped) {
            finalStatus = 'stopped';
            finalMessage = '매크로 실행이 중단되었습니다';
            this.addLog('warning', finalMessage);
        } else {
            this.addLog('success', '매크로 실행 완료');
        }

        // Save execution result to scenario file metadata
        await this.saveExecutionResult(finalStatus, finalMessage);

        // Clean up scenario running state
        if (scenarioKey) {
            this.runningScenarios.delete(scenarioKey);
            // Refresh scenario list to remove progress
            if (this.isScenarioListVisible()) {
                this.renderScenarioListInPanel();
            }
        }

        if (runBtn) {
            runBtn.innerHTML = `
                <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                실행
            `;
        }
    }

    stopMacro() {
        if (this.isRunning) {
            this.shouldStop = true;
            this.addLog('info', '매크로 중단 요청...');
        }
    }

    cancelScenario(scenarioKey) {
        // Set the stop flag to interrupt the running scenario
        this.shouldStop = true;

        // Clean up the running state
        if (this.runningScenarios.has(scenarioKey)) {
            this.runningScenarios.delete(scenarioKey);
            this.addLog('info', `시나리오 실행 중단: ${scenarioKey}`);

            // Refresh the scenario list to update the UI
            if (this.isScenarioListVisible()) {
                this.renderScenarioListInPanel();
            }
        }
    }

    async executeActionsRange(startIndex, endIndex, scenarioKey = null) {
        let i = startIndex;

        while (i < endIndex) {
            // Check if stop was requested
            if (this.shouldStop) {
                break;
            }

            const action = this.actions[i];

            // Highlight current action and update UI
            this.selectedActionId = action.id;

            // Only render action sequence if scenario list is not visible
            if (!this.isScenarioListVisible()) {
                this.renderActionSequence(); // This already calls updateSelectedActionMarker internally
            }

            try {
                // Handle control flow actions
                if (action.type === 'if' || action.type === 'else-if') {
                    const conditionResult = await this.evaluateConditions(action);

                    // Add delay and log for control flow action
                    const delay = parseInt(document.getElementById('option-delay')?.value || 300);
                    if (delay > 0) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }

                    this.addLog('info', `${this.getActionTypeName(action.type)} 조건: ${conditionResult ? '참' : '거짓'}`);

                    if (conditionResult) {
                        // Execute block until else-if/else/end-if
                        const blockEnd = this.findBlockEnd(i, ['else-if', 'else', 'end-if']);
                        await this.executeActionsRange(i + 1, blockEnd, scenarioKey);
                        // Skip to end-if
                        i = this.findBlockEnd(i, ['end-if']) + 1;
                    } else {
                        // Skip to next else-if/else/end-if
                        i = this.findBlockEnd(i, ['else-if', 'else', 'end-if']);

                        // Don't execute the else-if/else block yet, let loop handle it
                        continue;
                    }
                } else if (action.type === 'else') {
                    // If we reach else, it means previous if/else-if were false
                    // Add delay and log
                    const delay = parseInt(document.getElementById('option-delay')?.value || 300);
                    if (delay > 0) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }

                    this.addLog('info', `${this.getActionTypeName(action.type)} 실행`);

                    // Execute until end-if
                    const blockEnd = this.findBlockEnd(i, ['end-if']);
                    await this.executeActionsRange(i + 1, blockEnd, scenarioKey);
                    i = blockEnd + 1;
                } else if (action.type === 'while') {
                    const whileStart = i;
                    const whileEnd = this.findBlockEnd(i, ['end-while']);

                    // Execute while loop
                    let iterations = 0;
                    const maxIterations = 1000; // Safety limit

                    while (iterations < maxIterations) {
                        const conditionResult = await this.evaluateConditions(action);

                        if (!conditionResult) break;

                        await this.executeActionsRange(whileStart + 1, whileEnd, scenarioKey);
                        iterations++;
                    }

                    if (iterations >= maxIterations) {
                        this.addLog('warning', 'While loop reached maximum iterations (1000)');
                    }

                    i = whileEnd + 1;
                } else if (action.type === 'loop') {
                    const loopStart = i;
                    const loopEnd = this.findBlockEnd(i, ['end-loop']);

                    // Get loop count from either constant or variable
                    let loopCount;
                    const countType = action.countType || 'constant';

                    if (countType === 'variable') {
                        const variableName = action.variableName;
                        if (!variableName) {
                            this.addLog('error', '[loop] Variable name is required when using variable mode');
                            throw new Error('Loop variable name is required');
                        }

                        loopCount = this.getVariable(variableName);
                        if (loopCount === undefined) {
                            this.addLog('error', `[loop] Variable '${variableName}' is not defined`);
                            throw new Error(`Variable '${variableName}' not found`);
                        }

                        loopCount = Math.floor(Number(loopCount));
                        if (isNaN(loopCount) || loopCount < 0) {
                            this.addLog('error', `[loop] Invalid loop count from variable '${variableName}': ${loopCount}`);
                            throw new Error(`Invalid loop count: ${loopCount}`);
                        }

                        console.log(`[loop] Using variable '${variableName}' = ${loopCount}`);
                    } else {
                        loopCount = action.count || action.loopCount || 1; // Support both old and new format
                    }

                    for (let j = 0; j < loopCount; j++) {
                        await this.executeActionsRange(loopStart + 1, loopEnd, scenarioKey);
                    }

                    i = loopEnd + 1;
                } else if (action.type === 'success') {
                    // Scenario succeeded - terminate with success
                    const message = action.message || '성공 종료';
                    this.addLog('success', `Success: ${message}`);
                    this.scenarioResult = { status: 'pass', message: message };
                    break; // Exit execution
                } else if (action.type === 'skip') {
                    // Scenario skipped - terminate with skip
                    const message = action.message || '시나리오 스킵';
                    this.addLog('info', `Skip: ${message}`);
                    this.scenarioResult = { status: 'skip', message: message };
                    break; // Exit execution
                } else if (action.type === 'fail') {
                    // Scenario failed - terminate with failure
                    const message = action.message || '실패 종료';
                    this.addLog('error', `Fail: ${message}`);
                    this.scenarioResult = { status: 'fail', message: message };
                    break; // Exit execution
                } else if (action.type === 'get-volume' || action.type === 'image-match' || action.type === 'sound-check') {
                    // New flat condition starters - execute condition and evaluate
                    const result = await this.executeAction(action);

                    // Add delay
                    const delay = parseInt(document.getElementById('option-delay')?.value || 300);
                    if (delay > 0) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }

                    // Evaluate condition based on action result
                    let conditionMet = false;

                    if (action.type === 'get-volume' && result.success) {
                        const volumeValue = result.volume;
                        const comparison = action.comparison || { operator: '>=', value: 50 };

                        // Store volume value for use by set-variable
                        this.lastActionResult = volumeValue;

                        switch (comparison.operator) {
                            case '>=':
                                conditionMet = volumeValue >= comparison.value;
                                break;
                            case '<=':
                                conditionMet = volumeValue <= comparison.value;
                                break;
                            case '==':
                                conditionMet = volumeValue === comparison.value;
                                break;
                            case '>':
                                conditionMet = volumeValue > comparison.value;
                                break;
                            case '<':
                                conditionMet = volumeValue < comparison.value;
                                break;
                            default:
                                conditionMet = false;
                        }

                        // Color code: green for true, gray for false
                        const logType = conditionMet ? 'success' : 'info';
                        this.addLog(logType, `${this.getActionTypeName(action.type)} 실행 완료 (볼륨: ${volumeValue}, 조건: ${conditionMet ? '참' : '거짓'})`);
                    } else if (action.type === 'image-match' && result.success) {
                        conditionMet = result.found || false;
                        // Color code: green for true, gray for false
                        const logType = conditionMet ? 'success' : 'info';
                        this.addLog(logType, `${this.getActionTypeName(action.type)} 실행 완료 (조건: ${conditionMet ? '참' : '거짓'})`);
                    } else if (action.type === 'sound-check' && result.success) {
                        conditionMet = result.conditionMet || false;
                        // Color code: green for true, gray for false
                        const logType = conditionMet ? 'success' : 'info';
                        this.addLog(logType, `${this.getActionTypeName(action.type)} 실행 완료 (조건: ${conditionMet ? '참' : '거짓'})`);
                    } else {
                        // Execution failed
                        conditionMet = false;
                        this.addLog('error', `${this.getActionTypeName(action.type)} 실행 실패: ${result.error}`);
                    }

                    // Handle condition branching (similar to if/else)
                    const endifIndex = this.findPairedEndif(i);
                    const elseIndex = this.findElseInBlock(i, endifIndex);

                    if (conditionMet) {
                        // Execute actions until else or endif
                        const blockEnd = elseIndex !== -1 ? elseIndex : endifIndex;
                        await this.executeActionsRange(i + 1, blockEnd, scenarioKey);
                        // Jump to endif
                        i = endifIndex + 1;
                    } else {
                        // Condition not met
                        if (elseIndex !== -1) {
                            // Execute else block
                            this.addLog('info', 'ELSE 블록 실행');
                            await this.executeActionsRange(elseIndex + 1, endifIndex, scenarioKey);
                        }
                        // Jump to endif
                        i = endifIndex + 1;
                    }
                } else if (action.type === 'endif') {
                    // Add delay and log for endif
                    const delay = parseInt(document.getElementById('option-delay')?.value || 300);
                    if (delay > 0) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }

                    this.addLog('info', `${this.getActionTypeName(action.type)} 완료`);
                    i++;
                } else if (action.type === 'end-if' || action.type === 'end-loop' || action.type === 'end-while') {
                    // Add delay and log for end markers
                    const delay = parseInt(document.getElementById('option-delay')?.value || 300);
                    if (delay > 0) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }

                    this.addLog('info', `${this.getActionTypeName(action.type)} 완료`);
                    i++;
                } else {
                    // Regular action - execute it
                    const result = await this.executeAction(action);

                    if (result.success) {
                        this.addLog('success', `${this.getActionTypeName(action.type)} 실행 완료`);
                    } else {
                        this.addLog('error', `${this.getActionTypeName(action.type)} 실행 실패: ${result.error}`);
                    }

                    // Update progress after executing a real action
                    if (scenarioKey) {
                        const runningState = this.runningScenarios.get(scenarioKey);
                        if (runningState) {
                            runningState.progress.current++;
                            // Refresh scenario list to show updated progress
                            if (this.isScenarioListVisible()) {
                                this.renderScenarioListInPanel();
                            }
                        }
                    }

                    // Get delay from option
                    const delay = parseInt(document.getElementById('option-delay')?.value || 300);
                    if (delay > 0) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }

                    i++;
                }
            } catch (error) {
                this.addLog('error', `액션 실행 오류: ${error.message}`);
                break;
            }
        }
    }

    findBlockEnd(startIndex, endTypes) {
        let depth = 0;
        const blockStartTypes = ['if', 'else-if', 'loop', 'while'];
        const blockEndTypes = ['end-if', 'end-loop', 'end-while'];

        for (let i = startIndex; i < this.actions.length; i++) {
            const action = this.actions[i];

            if (i === startIndex) {
                // Start counting depth from the first action
                if (blockStartTypes.includes(action.type)) {
                    depth = 1;
                }
                continue;
            }

            // Increase depth for nested blocks
            if (blockStartTypes.includes(action.type) && !['else-if', 'else'].includes(action.type)) {
                depth++;
            }

            // Check if this is one of the end types we're looking for
            if (endTypes.includes(action.type) && depth === 1) {
                return i;
            }

            // Decrease depth for block end
            if (blockEndTypes.includes(action.type)) {
                depth--;
                if (depth === 0) return i;
            }
        }

        return this.actions.length;
    }

    findPairedEndif(startIndex) {
        // Find the endif that pairs with the condition starter at startIndex
        const starterAction = this.actions[startIndex];
        const pairId = starterAction.pairId;

        if (!pairId) {
            console.error('No pairId found for action at index', startIndex);
            return this.actions.length;
        }

        for (let i = startIndex + 1; i < this.actions.length; i++) {
            const action = this.actions[i];
            if (action.type === 'endif' && action.pairId === pairId) {
                return i;
            }
        }

        return this.actions.length;
    }

    findElseInBlock(startIndex, endifIndex) {
        // Find the else block between startIndex and endifIndex
        const starterAction = this.actions[startIndex];
        const pairId = starterAction.pairId;

        if (!pairId) {
            return -1;
        }

        for (let i = startIndex + 1; i < endifIndex; i++) {
            const action = this.actions[i];
            if (action.type === 'else' && action.pairId === pairId) {
                return i;
            }
        }

        return -1;
    }

    async evaluateConditions(action) {
        const conditions = action.conditions;
        const conditionOperator = action.conditionOperator || 'AND'; // Default to AND

        if (!conditions || conditions.length === 0) {
            return false;
        }

        // Evaluate all conditions
        const conditionResults = [];
        for (const condition of conditions) {
            // Create action object from condition
            const conditionAction = {
                id: condition.id,
                type: condition.actionType,
                ...condition.params
            };

            // Execute condition action
            const result = await this.executeAction(conditionAction);

            // Evaluate condition based on action type
            let conditionMet = false;

            if (condition.actionType === 'get-volume') {
                // For get-volume, compare the actual volume value
                if (result.success && result.volume !== undefined) {
                    const actualValue = result.volume;
                    const operator = condition.params.operator || '>=';
                    const expectedValue = condition.params.value || 0;
                    conditionMet = this._evaluateComparison(actualValue, operator, expectedValue);
                    this.addLog('info', `볼륨 조건: ${actualValue} ${operator} ${expectedValue} = ${conditionMet}`);
                }
            } else if (condition.actionType === 'sound-check') {
                // For sound-check, compare the similarity value
                if (result.success && result.similarity !== undefined) {
                    const actualValue = result.similarity;
                    const operator = condition.params.operator || '>=';
                    const expectedValue = condition.params.threshold || 0.8;
                    conditionMet = this._evaluateComparison(actualValue, operator, expectedValue);
                    this.addLog('info', `사운드 조건: ${actualValue} ${operator} ${expectedValue} = ${conditionMet}`);
                }
            } else {
                // For other actions (like image-match), use success status
                conditionMet = result.success;
            }

            // Apply negation if needed
            const finalResult = condition.negate ? !conditionMet : conditionMet;

            this.addLog('info', `조건 평가: ${condition.negate ? 'NOT ' : ''}${condition.actionType} = ${finalResult ? 'true' : 'false'}`);

            conditionResults.push(finalResult);
        }

        // Apply global condition operator
        let finalResult;
        if (conditionOperator === 'OR') {
            // OR: At least one condition must be true
            finalResult = conditionResults.some(r => r);
        } else {
            // AND: All conditions must be true
            finalResult = conditionResults.every(r => r);
        }

        this.addLog('info', `최종 조건 결과 (${conditionOperator}): ${finalResult ? 'true' : 'false'}`);

        return finalResult;
    }

    /**
     * Evaluate comparison operator for numeric conditions
     */
    _evaluateComparison(actualValue, operator, expectedValue) {
        switch (operator) {
            case '>=':
                return actualValue >= expectedValue;
            case '<=':
                return actualValue <= expectedValue;
            case '>':
                return actualValue > expectedValue;
            case '<':
                return actualValue < expectedValue;
            case '==':
            case '===':
                return actualValue === expectedValue;
            case '!=':
            case '!==':
                return actualValue !== expectedValue;
            default:
                console.warn(`Unknown operator: ${operator}`);
                return false;
        }
    }

    async executeAction(action) {
        try {
            // Highlight the action being executed
            this.selectedActionId = action.id;

            // Only render action sequence if scenario list is not visible
            if (!this.isScenarioListVisible()) {
                this.renderActionSequence();
            }

            // Show marker for actions with coordinates
            if (action.x !== undefined && action.y !== undefined) {
                if (action.type === 'drag' && action.endX !== undefined && action.endY !== undefined) {
                    // Draw drag line
                    this.drawDragMarker(action.x, action.y, action.endX, action.endY);
                } else {
                    // Draw single point marker
                    this.drawCoordinateMarker(action.x, action.y);
                }
            } else if (action.region) {
                // Draw region marker for image-match
                this.drawRegionMarker(action.region);
            }

            // Handle image-match action differently (frontend processing)
            if (action.type === 'image-match') {
                return await this.executeImageMatchAction(action);
            }

            // Handle sound-check action (frontend processing)
            if (action.type === 'sound-check') {
                return await this.executeSoundCheckAction(action);
            }

            // Handle tap-matched-image action (frontend processing)
            if (action.type === 'tap-matched-image') {
                // First, find the image using executeImageMatchAction
                const matchResult = await this.executeImageMatchAction(action);

                if (!matchResult.success || !matchResult.found) {
                    // Don't log here - let executeActionsRange handle logging
                    return matchResult;
                }

                // Now click the matched coordinate
                const clickAction = {
                    type: 'click',
                    x: matchResult.x,
                    y: matchResult.y
                };

                // Don't log intermediate steps - let executeActionsRange handle logging
                const clickResult = await window.api.action.execute(this.mapActionToBackend(clickAction));

                // Return combined result with coordinates
                return {
                    ...clickResult,
                    x: matchResult.x,
                    y: matchResult.y
                };
            }

            // Handle set-variable action (frontend processing)
            if (action.type === 'set-variable') {
                const variableName = action.variableName;
                const source = action.source || 'previous';

                if (!variableName) {
                    return { success: false, error: 'Variable name is required' };
                }

                let value;
                if (source === 'previous') {
                    // Use result from previous action
                    value = this.lastActionResult;
                    if (value === null || value === undefined) {
                        console.warn('[set-variable] No previous action result available');
                        value = 0; // Default to 0 if no previous result
                    }
                } else {
                    // Use constant value
                    value = action.value || 0;
                }

                // Store the value in variable
                this.setVariable(variableName, value);

                // Also update lastActionResult so next action can use this value
                this.lastActionResult = value;

                return { success: true, value: value };
            }

            if (action.type === 'calc-variable') {
                const targetVariable = action.targetVariable;

                if (!targetVariable) {
                    return { success: false, error: 'Target variable name is required' };
                }

                // Get first operand value
                let operand1;
                const operand1Type = action.operand1Type || 'variable';
                if (operand1Type === 'variable') {
                    const variableName = action.operand1Variable;
                    if (!variableName) {
                        return { success: false, error: 'First variable name is required' };
                    }
                    operand1 = this.getVariable(variableName);
                    if (operand1 === undefined) {
                        return { success: false, error: `Variable '${variableName}' is not defined` };
                    }
                } else {
                    operand1 = action.operand1Value || 0;
                }

                // Get second operand value
                let operand2;
                const operand2Type = action.operand2Type || 'constant';
                if (operand2Type === 'variable') {
                    const variableName = action.operand2Variable;
                    if (!variableName) {
                        return { success: false, error: 'Second variable name is required' };
                    }
                    operand2 = this.getVariable(variableName);
                    if (operand2 === undefined) {
                        return { success: false, error: `Variable '${variableName}' is not defined` };
                    }
                } else {
                    operand2 = action.operand2Value || 0;
                }

                // Convert to numbers
                operand1 = Number(operand1);
                operand2 = Number(operand2);

                // Perform operation
                const operation = action.operation || '+';
                let result;
                switch (operation) {
                    case '+':
                        result = operand1 + operand2;
                        break;
                    case '-':
                        result = operand1 - operand2;
                        break;
                    case '*':
                        result = operand1 * operand2;
                        break;
                    case '/':
                        if (operand2 === 0) {
                            return { success: false, error: 'Division by zero' };
                        }
                        result = operand1 / operand2;
                        break;
                    default:
                        return { success: false, error: `Unknown operation: ${operation}` };
                }

                // Store result in target variable
                this.setVariable(targetVariable, result);

                // Update lastActionResult
                this.lastActionResult = result;

                console.log(`[calc-variable] ${operand1} ${operation} ${operand2} = ${result} -> ${targetVariable}`);
                return { success: true, value: result };
            }

            // Map frontend action format to backend format
            const backendAction = this.mapActionToBackend(action);
            console.log('[executeAction] Original action:', action);
            console.log('[executeAction] Backend action:', backendAction);
            console.log('[executeAction] window.api:', window.api);
            console.log('[executeAction] window.api.action:', window.api?.action);

            const result = await window.api.action.execute(backendAction);
            console.log('[executeAction] Result:', result);
            return result;
        } catch (error) {
            console.error('[executeAction] Error:', error);
            return { success: false, error: error.message };
        }
    }

    async executeImageMatchAction(action) {
        try {
            console.log('[executeImageMatchAction] Starting with action:', action);

            if (!action.region) {
                const msg = 'No region defined';
                console.error('[executeImageMatchAction]', msg);
                this.addLog('error', `이미지 매칭 실패: ${msg}`);
                return { success: false, error: msg };
            }

            if (!window.imageMatcher) {
                const msg = 'Image matcher not available';
                console.error('[executeImageMatchAction]', msg);
                this.addLog('error', `이미지 매칭 실패: ${msg}`);
                return { success: false, error: msg };
            }

            // Get current screen image and convert to canvas
            const screenImg = document.getElementById('screen-stream-image');
            if (!screenImg) {
                const msg = 'Screen image element not found';
                console.error('[executeImageMatchAction]', msg);
                this.addLog('error', `이미지 매칭 실패: ${msg}`);
                return { success: false, error: msg };
            }

            if (!screenImg.complete) {
                const msg = 'Screen image not loaded yet';
                console.error('[executeImageMatchAction]', msg);
                this.addLog('error', `이미지 매칭 실패: ${msg}`);
                return { success: false, error: msg };
            }

            console.log('[executeImageMatchAction] Screen image:', screenImg.width, 'x', screenImg.height);

            // Create temporary canvas from screen image
            const screenCanvas = document.createElement('canvas');
            screenCanvas.width = screenImg.naturalWidth || screenImg.width;
            screenCanvas.height = screenImg.naturalHeight || screenImg.height;
            const screenCtx = screenCanvas.getContext('2d');

            if (!screenCtx) {
                const msg = 'Failed to get screen canvas 2d context';
                console.error('[executeImageMatchAction]', msg);
                this.addLog('error', `이미지 매칭 실패: ${msg}`);
                return { success: false, error: msg };
            }

            screenCtx.drawImage(screenImg, 0, 0);
            console.log('[executeImageMatchAction] Screen canvas created:', screenCanvas.width, 'x', screenCanvas.height);

            // Use saved regionImage (captured at the time of selection)
            if (!action.regionImage) {
                const msg = 'No saved region image found';
                console.error('[executeImageMatchAction]', msg);
                this.addLog('error', `이미지 매칭 실패: ${msg}`);
                return { success: false, error: msg };
            }

            // Load the saved template image
            const templateImg = new Image();
            await new Promise((resolve, reject) => {
                templateImg.onload = resolve;
                templateImg.onerror = reject;
                templateImg.src = action.regionImage;
            });

            console.log('[executeImageMatchAction] Template image loaded:', templateImg.width, 'x', templateImg.height);

            // Create template canvas from saved image
            const templateCanvas = document.createElement('canvas');
            templateCanvas.width = templateImg.width;
            templateCanvas.height = templateImg.height;
            const templateCtx = templateCanvas.getContext('2d');

            if (!templateCtx) {
                const msg = 'Failed to get template canvas 2d context';
                console.error('[executeImageMatchAction]', msg);
                this.addLog('error', `이미지 매칭 실패: ${msg}`);
                return { success: false, error: msg };
            }

            templateCtx.drawImage(templateImg, 0, 0);

            // Calculate scaling factor between device coordinates and actual image size
            const scaleX = screenCanvas.width / this.screenWidth;
            const scaleY = screenCanvas.height / this.screenHeight;

            // Convert region coordinates to actual image coordinates (for crop hint)
            const actualX = Math.round(action.region.x * scaleX);
            const actualY = Math.round(action.region.y * scaleY);

            console.log('[executeImageMatchAction] Search parameters:', {
                deviceRegion: action.region,
                scale: { x: scaleX, y: scaleY },
                cropHint: { x: actualX, y: actualY },
                templateSize: { width: templateImg.width, height: templateImg.height }
            });

            const sourceImageData = screenCtx.getImageData(0, 0, screenCanvas.width, screenCanvas.height);
            const templateImageData = templateCtx.getImageData(0, 0, templateCanvas.width, templateCanvas.height);

            console.log('[executeImageMatchAction] ImageData created, source:', sourceImageData.width, 'x', sourceImageData.height, 'template:', templateImageData.width, 'x', templateImageData.height);
            console.log('[executeImageMatchAction] Device resolution:', this.screenWidth, 'x', this.screenHeight);
            console.log('[executeImageMatchAction] Region (device coordinates):', action.region);

            const threshold = action.threshold || 0.95;
            console.log('[executeImageMatchAction] Calling findTemplate with threshold:', threshold);

            const result = await window.imageMatcher.findTemplate(sourceImageData, templateImageData, {
                threshold: threshold,
                cropLocation: {
                    x: actualX,
                    y: actualY
                },
                useCache: false,
                colorInvariant: false  // Include color information for better distinction
            });

            console.log('[executeImageMatchAction] findTemplate result:', result);

            if (result.found) {
                // result.x, result.y are in actual image coordinates (naturalWidth x naturalHeight)
                // We need to convert them back to device coordinates (screenWidth x screenHeight)

                // Convert matched position from actual image coordinates to device coordinates
                const deviceX = Math.round(result.x / scaleX);
                const deviceY = Math.round(result.y / scaleY);

                // Calculate center of matched region in device coordinates
                const centerX = deviceX + Math.round(action.region.width / 2);
                const centerY = deviceY + Math.round(action.region.height / 2);

                console.log('[executeImageMatchAction] Coordinate conversion:', {
                    actualImageCoords: { x: result.x, y: result.y },
                    scale: { x: scaleX, y: scaleY },
                    deviceCoords: { x: deviceX, y: deviceY },
                    regionSize: { width: action.region.width, height: action.region.height },
                    centerCoords: { x: centerX, y: centerY }
                });

                // Store the center coordinate for tap-matched-image action
                this.lastMatchedCoordinate = { x: centerX, y: centerY };

                // Draw marker at the matched location (in device coordinates)
                const matchedRegion = {
                    x: deviceX,
                    y: deviceY,
                    width: action.region.width,
                    height: action.region.height
                };
                this.drawRegionMarker(matchedRegion, '#10b981'); // Green color for successful match

                this.addLog('success', `이미지 매칭 성공: (${deviceX}, ${deviceY}) -> 중심: (${centerX}, ${centerY}), 정확도: ${(result.score * 100).toFixed(1)}%`);
                return { success: true, found: true, x: centerX, y: centerY, score: result.score };
            } else {
                // Clear last matched coordinate on failure
                this.lastMatchedCoordinate = null;

                // Draw red marker at the best match location (even though it failed threshold)
                if (result.score > 0) {
                    const deviceX = Math.round(result.x / scaleX);
                    const deviceY = Math.round(result.y / scaleY);

                    const bestMatchRegion = {
                        x: deviceX,
                        y: deviceY,
                        width: action.region.width,
                        height: action.region.height
                    };
                    this.drawRegionMarker(bestMatchRegion, '#ef4444'); // Red color for failed match
                }

                const errorMsg = `이미지를 찾지 못했습니다 (최고 점수: ${(result.score * 100).toFixed(1)}%)`;
                // Don't log here - let executeActionsRange handle logging
                return { success: false, found: false, score: result.score, error: errorMsg };
            }
        } catch (error) {
            const errorMsg = error && error.message ? error.message : String(error);
            console.error('[executeImageMatchAction] Error:', error);
            console.error('[executeImageMatchAction] Error stack:', error && error.stack);
            this.addLog('error', `이미지 매칭 에러: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
    }

    async executeSoundCheckAction(action) {
        try {
            console.log('[executeSoundCheckAction] Starting with action:', action);

            const duration = action.duration || 5000;
            const expectation = action.expectation || 'present';
            const threshold = action.threshold || { min: 40, max: 80 };

            // Don't log here - let executeActionsRange handle logging

            // AudioCapture should be available globally from the included script
            if (!window.AudioCapture) {
                throw new Error('AudioCapture not available. Please check if audio-capture.js is loaded.');
            }

            const audioCapture = new window.AudioCapture();

            try {
                // Initialize microphone with selected device (if specified)
                const audioDeviceId = action.audioDeviceId || null;
                await audioCapture.init(audioDeviceId);

                // Collect samples during the duration
                const samples = [];
                const startTime = Date.now();

                // Create a promise that resolves after duration
                await new Promise((resolve) => {
                    const interval = setInterval(() => {
                        const elapsed = Date.now() - startTime;

                        // Get current decibel level
                        const db = audioCapture.getDecibel();
                        samples.push(db);

                        // Update UI with current level
                        this.addLog('info', `현재 데시벨: ${db.toFixed(1)} dB`);

                        if (elapsed >= duration) {
                            clearInterval(interval);
                            resolve();
                        }
                    }, 100); // Sample every 100ms
                });

                // Analyze results
                const avgDb = samples.reduce((a, b) => a + b, 0) / samples.length;
                const maxDb = Math.max(...samples);
                const minDb = Math.min(...samples);

                this.addLog('info', `측정 완료 - 평균: ${avgDb.toFixed(1)}dB, 최대: ${maxDb.toFixed(1)}dB, 최소: ${minDb.toFixed(1)}dB`);

                // Check expectation
                let success = false;
                let message = '';

                if (expectation === 'present') {
                    // Sound should be present - check if max exceeds threshold (default 30dB)
                    const soundThreshold = threshold.min || 30;
                    success = maxDb > soundThreshold;
                    message = success ?
                        `소리가 감지되었습니다 (최대: ${maxDb.toFixed(1)}dB)` :
                        `소리가 감지되지 않았습니다 (최대: ${maxDb.toFixed(1)}dB < ${soundThreshold}dB)`;
                } else if (expectation === 'silent') {
                    // Should be silent - check if max is below threshold (default 30dB)
                    const silenceThreshold = threshold.max || 30;
                    success = maxDb < silenceThreshold;
                    message = success ?
                        `무음 상태 확인 (최대: ${maxDb.toFixed(1)}dB)` :
                        `예상치 않은 소리가 감지되었습니다 (최대: ${maxDb.toFixed(1)}dB > ${silenceThreshold}dB)`;
                } else if (expectation === 'level') {
                    // Should be within range - check average
                    success = avgDb >= threshold.min && avgDb <= threshold.max;
                    message = success ?
                        `데시벨이 범위 내입니다 (평균: ${avgDb.toFixed(1)}dB, 범위: ${threshold.min}-${threshold.max}dB)` :
                        `데시벨이 범위를 벗어났습니다 (평균: ${avgDb.toFixed(1)}dB, 예상: ${threshold.min}-${threshold.max}dB)`;
                }

                if (success) {
                    this.addLog('success', `사운드 체크 성공: ${message}`);
                } else {
                    this.addLog('error', `사운드 체크 실패: ${message}`);
                }

                return {
                    success,
                    message,
                    error: success ? undefined : message, // Add error property for consistency
                    data: {
                        average: avgDb,
                        max: maxDb,
                        min: minDb,
                        samples: samples.length
                    }
                };

            } finally {
                // Always cleanup audio capture
                audioCapture.cleanup();
            }

        } catch (error) {
            const errorMsg = error && error.message ? error.message : String(error);
            console.error('[executeSoundCheckAction] Error:', error);
            this.addLog('error', `사운드 체크 에러: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
    }

    openSoundCheckModal(actionId) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action) {
            console.error('Action not found:', actionId);
            return;
        }

        // Check if SoundCheckModal component is available
        if (!window.SoundCheckModal) {
            console.error('SoundCheckModal component not available');
            this.addLog('error', 'Sound check modal component not loaded');
            return;
        }

        // Create the modal
        const modal = new window.SoundCheckModal();

        // Show the modal with callbacks
        modal.show(
            action,
            (updatedConfig) => {
                // onSave: Update the action with new configuration
                Object.assign(action, updatedConfig);
                this.renderActionSequence();
                this.addLog('info', 'Sound check configuration updated');
            },
            () => {
                // onCancel: Do nothing
                this.addLog('info', 'Sound check configuration cancelled');
            }
        );
    }

    mapActionToBackend(action) {
        const mapped = { type: action.type };

        switch (action.type) {
            case 'click':
                return { type: 'tap', x: action.x, y: action.y, duration: 100 };
            case 'long-press':
                return { type: 'tap', x: action.x, y: action.y, duration: action.duration || 1000 };
            case 'drag':
                return { type: 'swipe', x1: action.x, y1: action.y, x2: action.endX, y2: action.endY, duration: action.duration || 300 };
            case 'input':
                return { type: 'input', text: action.text };
            case 'wait':
                return { type: 'wait', delay: action.delay || 1000 };
            case 'home':
                return { type: 'key', keyCode: 3 }; // HOME
            case 'back':
                return { type: 'key', keyCode: 4 }; // BACK
            case 'scroll':
                return { type: 'scroll', direction: action.direction || 'down', amount: action.amount || 300 };
            default:
                return action;
        }
    }

    getActionTypeName(type) {
        const names = {
            'click': '클릭',
            'long-press': '롱프레스',
            'drag': '드래그',
            'input': '텍스트 입력',
            'wait': '대기',
            'home': '홈 버튼',
            'back': '뒤로 버튼',
            'scroll': '스크롤',
            'tap-matched-image': '찾은 영역 클릭'
        };
        return names[type] || type;
    }

    async saveAsMacro() {
        // Get description from input field
        const macroDescriptionInput = document.getElementById('macro-description-input');
        if (macroDescriptionInput) {
            this.macroDescription = macroDescriptionInput.value || '';
        }

        // Export to new file (Save As)
        const macroData = {
            name: this.macroName,
            description: this.macroDescription,
            actions: this.actions,
            createdAt: new Date().toISOString(),
            version: '1.0'
        };

        const data = JSON.stringify(macroData, null, 2);

        // Use macro name as default filename (sanitized using helper function)
        const sanitizedName = this.sanitizeFilename(this.macroName);
        const defaultFilename = sanitizedName + '.json';

        // Show save dialog
        const result = await api.file.showSaveDialog({
            title: '시나리오 저장',
            defaultPath: defaultFilename,
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        // User cancelled
        if (result.canceled || !result.filePath) {
            return;
        }

        // Write file
        const writeResult = await api.file.writeFile(result.filePath, data);

        if (writeResult.success) {
            // Save to scenario registry AND store scenario data in localStorage
            const filename = result.filePath.split(/[\\/]/).pop();
            this.addScenarioToRegistry(sanitizedName, filename, macroData);
            console.log(`Exported macro as: ${result.filePath}`);
            this.addLog('success', `시나리오 저장 완료: ${filename}`);
        } else {
            console.error('Failed to save file:', writeResult.error);
            this.addLog('error', `저장 실패: ${writeResult.error}`);
        }
    }

    saveMetadata(field) {
        // Quick save for name/description only (doesn't export file, just updates in localStorage)
        if (!this.currentScenarioKey) {
            // No scenario loaded yet, use saveAsMacro
            this.saveAsMacro();
            this.showSavedFeedback(field, 'save');
            return;
        }

        // Get latest values from inputs
        const macroNameInput = document.getElementById('macro-name-input');
        const macroDescriptionInput = document.getElementById('macro-description-input');

        if (macroNameInput) {
            this.macroName = macroNameInput.value;
        }
        if (macroDescriptionInput) {
            this.macroDescription = macroDescriptionInput.value || '';
        }

        // Update existing scenario in localStorage
        const macroData = {
            name: this.macroName,
            description: this.macroDescription,
            actions: this.actions,
            createdAt: new Date().toISOString(),
            version: '1.0'
        };

        // Update registry and data
        const sanitizedName = this.macroName.replace(/[^a-z0-9가-힣]/gi, '_');
        const filename = sanitizedName + '.json';
        this.addScenarioToRegistry(this.currentScenarioKey, filename, macroData);

        // Show feedback only on "저장" button
        this.showSavedFeedback(field, 'save');

        // Mark as saved
        this.originalMacroName = this.macroName;
        this.originalMacroDescription = this.macroDescription;

        console.log('[saveMetadata] Metadata saved:', field);
    }

    cancelMetadataEdit(field) {
        // Restore original values
        const macroNameInput = document.getElementById('macro-name-input');
        const macroDescriptionInput = document.getElementById('macro-description-input');

        if (field === 'name' && macroNameInput) {
            this.macroName = this.originalMacroName;
            macroNameInput.value = this.originalMacroName;
        } else if (field === 'description' && macroDescriptionInput) {
            this.macroDescription = this.originalMacroDescription;
            macroDescriptionInput.value = this.originalMacroDescription;
        }

        // Check if there are still other unsaved changes
        this.checkForChanges();

        console.log('[cancelMetadataEdit] Edit cancelled:', field);
    }

    showSavedFeedback(field, buttonType = 'both') {
        // Show "✓ 저장됨" on save button(s) briefly (inline buttons only)
        const btnSaveInline = document.getElementById('btn-save-macro-inline');
        const btnSaveAsInline = document.getElementById('btn-save-as-macro-inline');

        // Store original text
        const originalSaveText = btnSaveInline ? btnSaveInline.innerHTML : '';
        const originalSaveAsText = btnSaveAsInline ? btnSaveAsInline.innerHTML : '';

        const savedHTML = `
            <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            저장됨
        `;

        // Update button text to show saved state based on buttonType
        if (btnSaveInline && (buttonType === 'both' || buttonType === 'save')) {
            btnSaveInline.innerHTML = savedHTML;
            btnSaveInline.style.color = '#16a34a';
        }

        if (btnSaveAsInline && (buttonType === 'both' || buttonType === 'saveAs')) {
            btnSaveAsInline.innerHTML = savedHTML;
            btnSaveAsInline.style.color = '#16a34a';
        }

        // Restore original text after 2 seconds
        setTimeout(() => {
            if (btnSaveInline && (buttonType === 'both' || buttonType === 'save')) {
                btnSaveInline.innerHTML = originalSaveText;
                btnSaveInline.style.color = '';
            }
            if (btnSaveAsInline && (buttonType === 'both' || buttonType === 'saveAs')) {
                btnSaveAsInline.innerHTML = originalSaveAsText;
                btnSaveAsInline.style.color = '';
            }
        }, 2000);
    }

    addScenarioToRegistry(key, filename, macroData) {
        // Add scenario to registry for tracking
        const registry = JSON.parse(localStorage.getItem('scenario_registry') || '{}');
        registry[key] = {
            name: this.macroName,
            description: this.macroDescription || '',
            filename: filename,
            savedAt: new Date().toISOString(),
            actionsCount: this.actions.length
        };
        localStorage.setItem('scenario_registry', JSON.stringify(registry));

        // Also save the actual scenario data to localStorage for easy loading
        const scenariosData = JSON.parse(localStorage.getItem('scenario_data') || '{}');
        scenariosData[key] = macroData;
        localStorage.setItem('scenario_data', JSON.stringify(scenariosData));

        // Mark as saved
        this.markAsSaved();
    }

    /**
     * Load scenario by filePath
     * Loads the first scenario from the given file
     * @param {string} filePath - The file path
     * @returns {object|null} - Scenario data or null if not found
     */
    loadScenarioByFilePath(filePath) {
        console.log('[loadScenarioByFilePath] Loading from file:', filePath);

        // Load the file data
        const scenarioData = JSON.parse(localStorage.getItem('scenario_data') || '{}');
        const fileData = scenarioData[filePath];

        if (!fileData || !fileData.scenarios || fileData.scenarios.length === 0) {
            console.error('[loadScenarioByFilePath] File not found or empty:', filePath);
            return null;
        }

        // Return the first scenario in the file
        const scenario = fileData.scenarios[0];
        console.log('[loadScenarioByFilePath] Loaded scenario:', scenario.name);

        return {
            ...scenario,
            filePath: filePath  // Include filePath for reference
        };
    }

    /**
     * Load scenario by scenarioId
     * Uses scenario_index to find the file, then loads the scenario from that file
     * @param {string} scenarioId - The unique scenario ID
     * @returns {object|null} - Scenario data or null if not found
     */
    loadScenarioFromRegistry(scenarioId) {
        console.log('[loadScenarioFromRegistry] Loading scenario:', scenarioId);

        // Load index to find which file contains this scenario
        const index = JSON.parse(localStorage.getItem('scenario_index') || '{}');
        const indexEntry = index[scenarioId];

        if (!indexEntry) {
            console.error('[loadScenarioFromRegistry] Scenario not found in index:', scenarioId);
            return null;
        }

        const { filePath } = indexEntry;

        // Load the file data
        const scenarioData = JSON.parse(localStorage.getItem('scenario_data') || '{}');
        const fileData = scenarioData[filePath];

        if (!fileData) {
            console.error('[loadScenarioFromRegistry] File not found:', filePath);
            return null;
        }

        // Find the specific scenario within the file
        const scenario = fileData.scenarios.find(s => s.id === scenarioId);

        if (!scenario) {
            console.error('[loadScenarioFromRegistry] Scenario not found in file:', scenarioId);
            return null;
        }

        console.log('[loadScenarioFromRegistry] Loaded scenario:', scenario.name);
        return {
            ...scenario,
            filePath: filePath  // Include filePath for reference
        };
    }

    /**
     * Edit scenario by scenarioId or filePath
     * @param {string} keyOrId - Either a scenarioId or filePath
     */
    editScenario(keyOrId) {
        console.log('[editScenario] Loading scenario for editing:', keyOrId);

        // Check for unsaved changes before loading new scenario
        if (!this.checkUnsavedChanges()) {
            console.log('[editScenario] User cancelled due to unsaved changes');
            return;
        }

        // Try to load as scenarioId first
        let scenarioData = this.loadScenarioFromRegistry(keyOrId);

        // If not found, try to load by filePath
        if (!scenarioData) {
            console.log('[editScenario] Not found as scenarioId, trying as filePath:', keyOrId);
            scenarioData = this.loadScenarioByFilePath(keyOrId);
        }

        if (!scenarioData) {
            console.error('[editScenario] Scenario not found:', keyOrId);
            return;
        }

        // Load the scenario into the editor
        this.actions = scenarioData.actions || [];
        this.macroName = scenarioData.name || '';
        this.macroDescription = scenarioData.description || '';

        // Store current file path and scenario ID for saving
        this.currentFilePath = scenarioData.filePath;
        this.currentScenarioId = scenarioData.id; // Use the actual scenario ID from data
        this.currentScenarioKey = scenarioData.id; // Backward compatibility

        // Update UI
        const macroNameInput = document.getElementById('macro-name-input');
        if (macroNameInput) {
            macroNameInput.value = this.macroName;
        }
        const macroDescriptionInput = document.getElementById('macro-description-input');
        if (macroDescriptionInput) {
            macroDescriptionInput.value = this.macroDescription;
        }

        // Update filename preview
        this.updateFilenamePreview();

        // Switch to action sequence view
        this.renderActionSequence();

        // Mark as saved (loaded from storage)
        this.markAsSaved();

        // Enable toolbar buttons and action list
        this.updateToolbarButtons(true);

        // Render action list with correct enabled/disabled state based on device connection
        setTimeout(() => {
            console.log('[editScenario] Rendering action list - isDeviceConnected:', this.isDeviceConnected);
            this.renderActionList();
        }, 100);

        console.log('[editScenario] Loaded scenario with', this.actions.length, 'actions');
    }

    deleteScenario(key, filename) {
        console.log('[deleteScenario] Deleting scenario:', key, filename);

        // Show confirmation dialog
        const confirmDelete = confirm(`시나리오 "${filename}"을(를) 삭제하시겠습니까?`);

        if (!confirmDelete) {
            console.log('[deleteScenario] Deletion cancelled by user');
            return;
        }

        try {
            // Get the scenario registry
            const registryData = localStorage.getItem('scenario_registry');
            if (!registryData) {
                console.error('[deleteScenario] No scenario registry found');
                return;
            }

            const registry = JSON.parse(registryData);

            // Remove scenario from registry
            if (registry[key]) {
                delete registry[key];

                // Save updated registry
                localStorage.setItem('scenario_registry', JSON.stringify(registry));

                // Remove scenario data from localStorage
                localStorage.removeItem(key);

                console.log('[deleteScenario] Successfully deleted scenario:', key);

                // Refresh the scenario list
                this.renderScenarioListInPanel();
            } else {
                console.error('[deleteScenario] Scenario not found in registry:', key);
            }
        } catch (error) {
            console.error('[deleteScenario] Error deleting scenario:', error);
            alert('시나리오 삭제 중 오류가 발생했습니다.');
        }
    }

    duplicateScenario(key, filename) {
        console.log('[duplicateScenario] Duplicating scenario:', key, filename);

        try {
            // Load the original scenario
            const scenarioData = this.loadScenarioFromRegistry(key);

            if (!scenarioData) {
                console.error('[duplicateScenario] Scenario not found:', key);
                alert('시나리오를 찾을 수 없습니다.');
                return;
            }

            // Generate unique filename for the duplicate
            const baseFilename = filename.replace(/\s*\(복사\s*\d*\)\s*$/, '');
            let newFilename = `${baseFilename} (복사)`;
            let counter = 2;

            // Get existing filenames to check for duplicates
            const registryData = localStorage.getItem('scenario_registry');
            const registry = registryData ? JSON.parse(registryData) : {};
            const existingFilenames = Object.values(registry).map(item => item.filename);

            // Find unique filename
            while (existingFilenames.includes(newFilename)) {
                newFilename = `${baseFilename} (복사 ${counter})`;
                counter++;
            }

            // Create new scenario with duplicate data
            const newKey = `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const newScenarioData = {
                name: newFilename,
                actions: JSON.parse(JSON.stringify(scenarioData.actions)) // Deep copy
            };

            // Save the duplicated scenario
            localStorage.setItem(newKey, JSON.stringify(newScenarioData));

            // Update registry
            registry[newKey] = {
                filename: newFilename,
                savedAt: new Date().toISOString(),
                actionsCount: scenarioData.actions.length
            };
            localStorage.setItem('scenario_registry', JSON.stringify(registry));

            console.log('[duplicateScenario] Successfully duplicated scenario:', newFilename);

            // Refresh the scenario list
            this.renderScenarioListInPanel();

        } catch (error) {
            console.error('[duplicateScenario] Error duplicating scenario:', error);
            alert('시나리오 복제 중 오류가 발생했습니다.');
        }
    }

    importMacro(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target?.result);

                // Support both old format (just actions array) and new format (with metadata)
                if (Array.isArray(imported)) {
                    this.actions = imported;
                    this.macroName = file.name.replace('.json', '');
                } else {
                    this.actions = imported.actions || [];
                    this.macroName = imported.name || file.name.replace('.json', '');
                }

                // Store the file path for future saves
                this.currentFilePath = file.path || null;

                // Update UI
                const nameInput = document.getElementById('macro-name-input');
                if (nameInput) {
                    nameInput.value = this.macroName;
                }

                this.renderActionSequence();
                console.log(`Loaded macro: ${this.macroName} (${this.actions.length} actions)`);
            } catch (error) {
                console.error('Failed to import macro:', error);
                alert('매크로 파일을 불러오는데 실패했습니다.');
            }
        };
        reader.readAsText(file);
    }

    saveMacro() {
        // Save to current scenario (overwrite if loaded from registry, otherwise prompt for new name)
        if (this.currentScenarioKey) {
            // Save to existing scenario in registry
            console.log('[saveMacro] Saving to existing scenario:', this.currentScenarioKey);
            this.saveToRegistry(this.currentScenarioKey);
        } else {
            // No scenario loaded - use save as (prompt for name)
            console.log('[saveMacro] No current scenario, using save as');
            this.saveAsMacro();
        }
    }

    async saveExecutionResult(status, message) {
        // Create execution result metadata
        const executionResult = {
            scenarioName: this.macroName,
            status: status, // 'pass', 'fail', 'skip', 'stopped', 'completed'
            message: message,
            timestamp: new Date().toISOString(),
            actionsCount: this.actions.length
        };

        // Store in localStorage for now (in real Electron app, save to file)
        try {
            // Get existing results
            const resultsKey = 'scenario_execution_results';
            const existingResults = JSON.parse(localStorage.getItem(resultsKey) || '{}');

            // Use macro name as key, store latest result
            const sanitizedName = this.macroName.replace(/[^a-z0-9가-힣]/gi, '_');
            existingResults[sanitizedName] = executionResult;

            // Save back to localStorage
            localStorage.setItem(resultsKey, JSON.stringify(existingResults));

            console.log(`Saved execution result for "${this.macroName}":`, executionResult);
        } catch (error) {
            console.error('Failed to save execution result:', error);
        }
    }

    getIconSVG(name) {
        const icons = {
            'click': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>',
            'hand': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"></path></svg>',
            'move': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path></svg>',
            'keyboard': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>',
            'clock': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
            'home': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>',
            'arrow-left': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>',
            'camera': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>',
            'image': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>',
            'git-branch': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path></svg>',
            'code': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>',
            'repeat': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>',
            'rotate-cw': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>',
            'x': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>',
            'file-text': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>',
            'settings': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>',
            'chevron-up': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>',
            'chevron-down': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>',
            'trash': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>',
            'target': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"/><circle cx="12" cy="12" r="6" stroke-width="2"/><circle cx="12" cy="12" r="2" stroke-width="2"/></svg>',
            'check-circle': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
            'x-circle': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
            'alert-circle': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
            'skip-forward': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>',
            'fast-forward': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>',
            'mic': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>',
            'volume': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>',
            'corner-down-right': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l5 5-5 5"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v7a4 4 0 004 4h12"></path></svg>',
            'corner-down-left': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10l-5 5 5 5"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 4v7a4 4 0 01-4 4H4"></path></svg>',
            'help-circle': '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
        };
        return icons[name] || icons['help-circle'];
    }

    // Coordinate picking methods
    startCoordinatePicking(type) {
        this.isPickingCoordinate = true;
        this.pendingActionType = type;

        // Add visual feedback
        document.body.classList.add('picking-coordinate');

        // Add visual indicator to the action card
        const actionCards = document.querySelectorAll('.action-card');
        actionCards.forEach(card => {
            if (card.dataset.actionType === type) {
                card.classList.add('picking-active');
            }
        });

        // Create tooltip
        this.createPickingTooltip();
    }

    cancelCoordinatePicking() {
        this.isPickingCoordinate = false;
        this.pendingActionType = null;
        this.dragStartPoint = null; // Reset drag start point

        // Remove visual feedback
        document.body.classList.remove('picking-coordinate');

        // Remove visual indicator from action cards
        const actionCards = document.querySelectorAll('.action-card.picking-active');
        actionCards.forEach(card => card.classList.remove('picking-active'));

        // Remove tooltip
        const tooltip = document.getElementById('coordinate-picking-tooltip');
        if (tooltip) {
            tooltip.remove();
        }

        // Clear any screen markers left from coordinate picking
        this.clearScreenMarkers();
    }

    createPickingTooltip() {
        // Remove existing tooltip
        const existing = document.getElementById('coordinate-picking-tooltip');
        if (existing) {
            existing.remove();
        }

        // Create message based on action type
        let message = '화면을 클릭하여 좌표를 선택하세요';
        if (this.pendingActionType === 'drag') {
            message = '화면을 클릭하여 첫번째 지점을 선택하세요';
        }

        // Create new tooltip
        const tooltip = document.createElement('div');
        tooltip.id = 'coordinate-picking-tooltip';
        tooltip.innerHTML = `
            <div class="coordinate-tooltip">
                <p>${message}</p>
                <p class="coordinate-tooltip-hint">ESC 키로 취소</p>
            </div>
        `;
        document.body.appendChild(tooltip);
    }

    updatePickingTooltip(e) {
        const tooltip = document.getElementById('coordinate-picking-tooltip');
        if (tooltip) {
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY + 15) + 'px';
        }
    }

    handleScreenPreviewClick(e) {
        // Use the same coordinate calculation as handleScreenClick for consistency
        const coords = this.getScaledCoordinates(e);
        if (!coords) {
            console.warn('[handleScreenPreviewClick] Could not get scaled coordinates');
            return;
        }

        const x = coords.x;
        const y = coords.y;

        // Add debug logging for drag endpoint
        console.log('[handleScreenPreviewClick] Click captured:', {
            clientX: e.clientX,
            clientY: e.clientY,
            deviceCoords: { x, y },
            isDragEnd: !!this.dragStartPoint
        });

        // Handle drag action (requires two clicks)
        if (this.pendingActionType === 'drag') {
            if (!this.dragStartPoint) {
                // First click - store start point and show marker
                this.dragStartPoint = { x, y };
                this.addLog('info', `드래그 시작점: (${x}, ${y})`);

                // Show start point marker on screen
                this.showDragStartMarker(x, y);

                // Update tooltip to ask for end point
                this.updatePickingTooltipMessage();
            } else {
                // Second click - create drag action with start and end points
                console.log('[handleScreenPreviewClick] Creating drag action:', {
                    start: this.dragStartPoint,
                    end: { x, y }
                });

                this.createDragAction(this.dragStartPoint.x, this.dragStartPoint.y, x, y);

                // Exit picking mode
                this.cancelCoordinatePicking();
            }
        } else {
            // Handle click and long-press (single click)
            this.createActionWithCoordinate(this.pendingActionType, x, y);

            // Exit picking mode
            this.cancelCoordinatePicking();
        }
    }

    createActionWithCoordinate(type, x, y) {
        const newAction = {
            id: `action-${Date.now()}`,
            type,
            x,
            y,
            ...(type === 'long-press' && { duration: 1000 }),
        };

        this.actions.push(newAction);
        this.selectedActionId = newAction.id;

        // renderActionSequence will automatically update marker for selected action
        this.renderActionSequence();

        // Clear selection markers (red box)
        this.clearScreenMarkers();

        // Log the action creation
        const actionName = type === 'click' ? '클릭' : '롱프레스';
        this.addLog('success', `${actionName} 액션 추가: (${x}, ${y})`);

        // Execute immediately if instant execute is enabled
        const instantExecute = document.getElementById('option-instant-execute')?.checked;
        if (instantExecute && this.isDeviceConnected) {
            this.executeAction(newAction).then(result => {
                if (result.success) {
                    this.addLog('info', `즉시 실행: ${actionName} 성공`);
                } else {
                    this.addLog('error', `즉시 실행: ${actionName} 실패 - ${result.error}`);
                }
            });
        }
    }

    createDragAction(startX, startY, endX, endY) {
        const newAction = {
            id: `action-${Date.now()}`,
            type: 'drag',
            x: startX,
            y: startY,
            endX: endX,
            endY: endY
        };

        this.actions.push(newAction);
        this.selectedActionId = newAction.id;

        // renderActionSequence will automatically update marker for selected action
        this.renderActionSequence();

        // Clear selection markers (red box)
        this.clearScreenMarkers();

        // Log the action creation
        this.addLog('success', `드래그 액션 추가: (${startX}, ${startY}) → (${endX}, ${endY})`);

        // Execute immediately if instant execute is enabled
        const instantExecute = document.getElementById('option-instant-execute')?.checked;
        if (instantExecute && this.isDeviceConnected) {
            this.executeAction(newAction).then(result => {
                if (result.success) {
                    this.addLog('info', `즉시 실행: 드래그 성공`);
                } else {
                    this.addLog('error', `즉시 실행: 드래그 실패 - ${result.error}`);
                }
            });
        }
    }

    updatePickingTooltipMessage() {
        const tooltip = document.getElementById('coordinate-picking-tooltip');
        if (tooltip) {
            tooltip.innerHTML = `
                <div class="coordinate-tooltip">
                    <p>두번째 지점을 선택하세요</p>
                    <p class="coordinate-tooltip-hint">ESC 키로 취소</p>
                </div>
            `;
        }
    }

    showDragStartMarker(x, y) {
        const screenPreview = document.getElementById('screen-preview-canvas');
        const img = document.getElementById('screen-stream-image');
        if (!screenPreview || !img) return;

        // Clear any existing markers
        const existingMarkers = screenPreview.querySelectorAll('.action-marker, .action-marker-line');
        existingMarkers.forEach(m => m.remove());

        // Calculate position in pixels relative to container
        const imgRect = img.getBoundingClientRect();

        // Get display info with letterbox offset
        const { actualImgWidth, actualImgHeight, offsetX, offsetY } = this.getImageDisplayInfo(img, imgRect);

        // Normalize device coordinates to 0-1
        const normalizedX = x / this.screenWidth;
        const normalizedY = y / this.screenHeight;

        // Scale to actual image dimensions
        const imgX = normalizedX * actualImgWidth;
        const imgY = normalizedY * actualImgHeight;

        // Position relative to container (accounting for letterbox)
        const markerX = offsetX + imgX;
        const markerY = offsetY + imgY;

        // Create start point marker
        const marker = document.createElement('div');
        marker.className = 'action-marker';
        marker.style.left = `${markerX}px`;
        marker.style.top = `${markerY}px`;
        marker.innerHTML = '<div class="action-marker-pulse"></div>';
        screenPreview.appendChild(marker);
    }

    clearScreenMarkers() {
        const screenPreview = document.getElementById('screen-preview-canvas');
        if (screenPreview) {
            const markers = screenPreview.querySelectorAll('.action-marker, .action-marker-line, .region-marker');
            markers.forEach(m => m.remove());
        }
    }

    toggleScreenMarkers(show) {
        const screenPreview = document.getElementById('screen-preview-canvas');
        if (screenPreview) {
            if (show) {
                screenPreview.classList.remove('hide-markers');
            } else {
                screenPreview.classList.add('hide-markers');
            }
        }
    }

    // Condition Management
    handleConditionDrop(event, targetActionId) {
        const draggedActionId = event.dataTransfer.getData('actionId');
        if (!draggedActionId) return;

        const draggedAction = this.actions.find(a => a.id === draggedActionId);
        if (!draggedAction) return;

        // Only allow certain action types as conditions
        const allowedTypes = ['image-match', 'sound-check', 'get-volume', 'click', 'long-press', 'wait'];
        if (!allowedTypes.includes(draggedAction.type)) {
            this.addLog('warning', `${this.getActionTypeLabel(draggedAction.type)} 액션은 조건으로 사용할 수 없습니다.`);
            return;
        }

        // Copy action parameters to condition
        this.addConditionFromAction(targetActionId, draggedAction);
    }

    addConditionFromAction(targetActionId, sourceAction) {
        const targetAction = this.actions.find(a => a.id === targetActionId);
        if (!targetAction || !targetAction.conditions) return;

        // Copy all params from source action (not just specific ones)
        const params = { ...sourceAction };
        delete params.id;
        delete params.type;

        const newCondition = {
            id: `cond-${Date.now()}`,
            actionType: sourceAction.type,
            params: params,
            operator: targetAction.conditions.length > 0 ? 'AND' : null
        };

        targetAction.conditions.push(newCondition);

        // Remove source action from scenario (MOVE, not COPY)
        const sourceIndex = this.actions.findIndex(a => a.id === sourceAction.id);
        if (sourceIndex !== -1) {
            this.actions.splice(sourceIndex, 1);
        }

        // Auto-create tap-matched-image action if image-match is added to IF/ELSE-IF/WHILE
        if (sourceAction.type === 'image-match' && (targetAction.type === 'if' || targetAction.type === 'else-if' || targetAction.type === 'while')) {
            // Check if there's already a tap-matched-image action in the TRUE block
            const targetIndex = this.actions.findIndex(a => a.id === targetActionId);
            const nextAction = this.actions[targetIndex + 1];

            // Only add if the next action is NOT already tap-matched-image
            if (!nextAction || nextAction.type !== 'tap-matched-image') {
                const tapAction = {
                    id: `action-${Date.now()}-tap`,
                    type: 'tap-matched-image',
                    depth: (targetAction.depth || 0) + 1,
                    autoGenerated: true // Mark as auto-generated for easy identification
                };

                // Insert tap-matched-image right after the IF/ELSE-IF/WHILE
                this.actions.splice(targetIndex + 1, 0, tapAction);
                this.addLog('info', '찾은 영역 클릭 액션이 자동으로 추가되었습니다');
            }
        }

        this.renderActionSequence();
        this.addLog('success', `조건 추가: ${this.getActionTypeLabel(sourceAction.type)}`);
    }

    removeCondition(actionId, conditionId) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.conditions) return;

        const index = action.conditions.findIndex(c => c.id === conditionId);
        if (index === -1) return;

        const removedCondition = action.conditions[index];
        action.conditions.splice(index, 1);

        // Update operator for last condition
        if (action.conditions.length > 0) {
            action.conditions[action.conditions.length - 1].operator = null;
        }

        // Auto-delete tap-matched-image if image-match is removed and no more image-match conditions exist
        if (removedCondition.actionType === 'image-match') {
            const hasImageMatch = action.conditions.some(c => c.actionType === 'image-match');

            if (!hasImageMatch) {
                // Find and remove auto-generated tap-matched-image action
                const actionIndex = this.actions.findIndex(a => a.id === actionId);
                const nextAction = this.actions[actionIndex + 1];

                if (nextAction && nextAction.type === 'tap-matched-image' && nextAction.autoGenerated) {
                    this.actions.splice(actionIndex + 1, 1);
                    this.addLog('info', '찾은 영역 클릭 액션이 자동으로 제거되었습니다');
                }
            }
        }

        this.renderActionSequence();
    }

    toggleConditionNegate(actionId, conditionId, negate) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.conditions) return;

        const condition = action.conditions.find(c => c.id === conditionId);
        if (!condition) return;

        condition.negate = negate;
        this.renderActionSequence();
    }

    updateConditionParam(actionId, conditionId, paramName, paramValue) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.conditions) return;

        const condition = action.conditions.find(c => c.id === conditionId);
        if (!condition) return;

        condition.params[paramName] = paramValue;
        this.renderActionSequence();
    }

    updateConditionOperator(actionId, conditionId, operator) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.conditions) return;

        const condition = action.conditions.find(c => c.id === conditionId);
        if (!condition) return;

        condition.operator = operator;
        this.renderActionSequence();
    }

    renderConditionCard(actionId, condition, index, totalConditions) {
        const isLast = index === totalConditions - 1;
        const isFirst = index === 0;
        const config = this.getActionConfig(condition.actionType);

        // Create temporary action object for description
        const tempAction = {
            type: condition.actionType,
            ...condition.params
        };
        const description = this.getActionDescription(tempAction);

        const isExpanded = this.expandedConditionId === condition.id;

        return `
            <div>
                <!-- Condition Block -->
                <div
                    class="bg-white border-2 border-slate-200 hover:border-slate-300 rounded-lg"
                    draggable="true"
                    ondragstart="window.macroApp.handleConditionDragStart(event, '${actionId}', '${condition.id}')"
                    ondragend="window.macroApp.handleActionDragEnd(event)"
                    ondragover="window.macroApp.handleConditionDragOver(event, '${actionId}', '${condition.id}')"
                    ondragleave="window.macroApp.handleConditionDragLeave(event, '${actionId}', '${condition.id}')"
                    ondrop="window.macroApp.handleConditionDrop(event, '${actionId}', '${condition.id}')"
                    onclick="event.stopPropagation()"
                    style="transition: all 0.2s; cursor: grab;"
                    onmousedown="this.style.cursor='grabbing'"
                    onmouseup="this.style.cursor='grab'"
                >
                    <div class="p-3">
                        <div class="flex items-center gap-3">
                            <!-- Icon -->
                            <div class="${config.color} p-2 rounded-lg text-white flex-shrink-0 flex items-center justify-center" style="width: 2.5rem; height: 2.5rem;">
                                <div style="width: 1.25rem; height: 1.25rem;">
                                    ${config.icon}
                                </div>
                            </div>

                            <!-- Content -->
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 mb-1">
                                    <h3 class="text-slate-900 font-medium">${config.label}</h3>
                                    <!-- NOT Toggle -->
                                    <label class="flex items-center gap-1 cursor-pointer group" onclick="event.stopPropagation()">
                                        <input
                                            type="checkbox"
                                            ${condition.negate ? 'checked' : ''}
                                            onchange="window.macroApp.toggleConditionNegate('${actionId}', '${condition.id}', this.checked)"
                                            class="w-3 h-3 rounded border-slate-300 text-red-500 focus:ring-red-500 focus:ring-offset-0 cursor-pointer"
                                        />
                                        <span class="text-xs ${condition.negate ? 'text-red-600 font-medium' : 'text-slate-500'} group-hover:text-red-600 transition-colors">
                                            NOT
                                        </span>
                                    </label>
                                </div>
                                ${description ? `<p class="text-sm text-slate-600 truncate">${description}</p>` : ''}
                            </div>

                            <!-- Actions -->
                            <div class="flex gap-1 flex-shrink-0">
                                <button class="btn-ghost h-8 w-8 p-0" onclick="event.stopPropagation(); window.macroApp.toggleConditionSettings('${condition.id}')">
                                    ${this.getIconSVG('settings')}
                                </button>
                                <button class="btn-ghost h-8 w-8 p-0" ${isFirst ? 'disabled' : ''} onclick="event.stopPropagation(); window.macroApp.moveCondition('${actionId}', '${condition.id}', 'up')">
                                    ${this.getIconSVG('chevron-up')}
                                </button>
                                <button class="btn-ghost h-8 w-8 p-0" ${isLast ? 'disabled' : ''} onclick="event.stopPropagation(); window.macroApp.moveCondition('${actionId}', '${condition.id}', 'down')">
                                    ${this.getIconSVG('chevron-down')}
                                </button>
                                <button class="btn-ghost h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onclick="event.stopPropagation(); window.macroApp.removeCondition('${actionId}', '${condition.id}')">
                                    ${this.getIconSVG('trash')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Expandable Settings -->
                    ${isExpanded ? this.renderConditionSettings(actionId, condition) : ''}
                </div>

                <!-- Simple Divider (no individual operators) -->
                ${!isLast ? `
                    <div class="flex items-center justify-center my-2">
                        <div class="w-full border-t border-slate-200"></div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderConditionSettings(actionId, condition) {
        // Create a temporary action object from condition
        const tempAction = {
            id: condition.id,
            type: condition.actionType,
            ...condition.params
        };

        // Get the same settings HTML as regular actions
        let settingsHTML = this.getSettingsHTML(tempAction);

        // Replace updateActionValue calls with updateConditionParam calls
        settingsHTML = settingsHTML.replace(
            /window\.macroApp\.updateActionValue\('([^']+)',\s*'([^']+)',/g,
            `window.macroApp.updateConditionParam('${actionId}', '${condition.id}', '$2',`
        );

        // Replace updateRegionProperty calls with updateConditionRegionProperty calls
        settingsHTML = settingsHTML.replace(
            /window\.macroApp\.updateRegionProperty\('([^']+)',/g,
            `window.macroApp.updateConditionRegionProperty('${actionId}', '${condition.id}',`
        );

        // Replace autoCropRegion calls
        settingsHTML = settingsHTML.replace(
            /window\.macroApp\.autoCropRegion\('([^']+)'\)/g,
            `window.macroApp.autoCropConditionRegion('${actionId}', '${condition.id}')`
        );

        // Replace resetActionRegion calls
        settingsHTML = settingsHTML.replace(
            /window\.macroApp\.resetActionRegion\('([^']+)'\)/g,
            `window.macroApp.resetConditionRegion('${actionId}', '${condition.id}')`
        );

        // Replace updateActionComparison calls with updateConditionComparison calls
        settingsHTML = settingsHTML.replace(
            /window\.macroApp\.updateActionComparison\('([^']+)',/g,
            `window.macroApp.updateConditionComparison('${actionId}', '${condition.id}',`
        );

        return `
            <div class="settings-panel border-t border-slate-200 bg-slate-50 px-8 py-5" style="border-bottom-left-radius: var(--radius); border-bottom-right-radius: var(--radius); overflow: hidden;">
                ${settingsHTML}
            </div>
        `;
    }

    toggleConditionSettings(conditionId) {
        if (this.expandedConditionId === conditionId) {
            this.expandedConditionId = null;
            this.selectedCondition = null;

            // Clear markers from screen
            this.clearScreenMarkers();
        } else {
            this.expandedConditionId = conditionId;

            // Find the action and condition
            let foundAction = null;
            let foundCondition = null;
            for (const action of this.actions) {
                if (action.conditions) {
                    const condition = action.conditions.find(c => c.id === conditionId);
                    if (condition) {
                        foundAction = action;
                        foundCondition = condition;
                        break;
                    }
                }
            }

            // If image-match condition, enable region selection
            if (foundCondition && foundCondition.actionType === 'image-match') {
                this.selectedCondition = {
                    actionId: foundAction.id,
                    conditionId: conditionId
                };
            } else {
                this.selectedCondition = null;
            }
        }
        this.renderActionSequence();
    }

    moveCondition(actionId, conditionId, direction) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.conditions) return;

        const index = action.conditions.findIndex(c => c.id === conditionId);
        if (index === -1) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= action.conditions.length) return;

        // Swap conditions
        [action.conditions[index], action.conditions[newIndex]] =
            [action.conditions[newIndex], action.conditions[index]];

        this.renderActionSequence();
    }

    // Log management methods
    addLog(level, message) {
        if (this.logger) {
            this.logger.log(level, message);
        }
    }

    addLogEntry(entry) {
        // Called from event bus when logger emits log:entry
        this.renderLogs();
    }

    clearLogs() {
        if (this.logger) {
            this.logger.clear();
        }
        this.renderLogs();
        this.addLog('info', '로그가 초기화되었습니다');
    }

    restoreDeviceCards() {
        // Remove all animation classes to restore original state
        const methodsContainer = document.querySelector('.device-connection-methods');
        const allCards = document.querySelectorAll('.device-method-card');

        if (methodsContainer) {
            methodsContainer.classList.remove('adb-active', 'isap-active');
        }

        allCards.forEach(card => {
            card.classList.remove('collapsed', 'expanded');
        });

        // Remove device lists and iSAP forms from both cards
        const deviceLists = document.querySelectorAll('.device-list');
        deviceLists.forEach(list => list.remove());

        const isapForms = document.querySelectorAll('.isap-connection-form');
        isapForms.forEach(form => form.remove());

        // Reset ADB button
        const adbButton = document.getElementById('btn-connect-adb');
        if (adbButton) {
            adbButton.classList.remove('loading');
            adbButton.innerHTML = `
                <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                ADB 연결
            `;
        }

        // Reset iSAP button
        const isapButton = document.getElementById('btn-connect-isap');
        if (isapButton) {
            isapButton.classList.remove('loading');
            isapButton.innerHTML = `
                <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                iSAP 연결
            `;
        }

        // Reset device connection state
        this.isDeviceConnected = false;
        this.deviceType = null;
        this.deviceName = null;
        this.adbDevices = null;

        this.addLog('warning', '장치 연결이 취소되었습니다');
    }

    async connectDevice(type) {
        const buttonId = type === 'adb' ? 'btn-connect-adb' : 'btn-connect-isap';
        const button = document.getElementById(buttonId);
        const card = button?.closest('.device-method-card');

        if (!button || !card) return;

        // Add card animation classes
        const methodsContainer = card.closest('.device-connection-methods');
        const oppositeCard = type === 'adb'
            ? document.getElementById('btn-connect-isap')?.closest('.device-method-card')
            : document.getElementById('btn-connect-adb')?.closest('.device-method-card');

        if (methodsContainer && oppositeCard) {
            // Add active class to container
            methodsContainer.classList.remove('adb-active', 'isap-active');
            methodsContainer.classList.add(type === 'adb' ? 'adb-active' : 'isap-active');

            // Collapse opposite card and expand current card
            oppositeCard.classList.add('collapsed');
            card.classList.add('expanded');
        }

        if (type === 'adb') {
            // Show loading state for ADB
            button.classList.add('loading');
            button.innerHTML = `
                <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                연결 중...
            `;

            this.addLog('info', 'ADB 장치를 검색 중...');
        }

        if (type === 'adb') {
            try {
                // Call real ADB devices API
                const result = await window.api.device.list();

                if (result.success && result.devices.length > 0) {
                    // Extract device names with serial numbers
                    const deviceNames = result.devices.map(d => {
                        // Show "Model (Serial)" or just serial if model is unknown
                        if (d.model && d.model !== 'Unknown') {
                            return `${d.model} (${d.id})`;
                        } else {
                            return d.id;
                        }
                    });

                    // Store full device info for later use
                    this.adbDevices = result.devices;

                    // Show device list in card
                    this.showDeviceList(card, deviceNames, type);

                    this.addLog('success', `${result.devices.length}개의 장치를 찾았습니다`);
                } else {
                    this.addLog('warning', 'ADB 장치를 찾을 수 없습니다');

                    // Show no devices message in card
                    this.showNoDevicesMessage(card);

                    // Reset button
                    button.classList.remove('loading');
                    button.innerHTML = `
                        <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                        </svg>
                        ADB 연결
                    `;
                }
            } catch (error) {
                this.addLog('error', `ADB 연결 실패: ${error.message}`);

                // Reset button
                button.classList.remove('loading');
                button.innerHTML = `
                    <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                    ADB 연결
                `;
            }
        } else {
            // iSAP - show SSH connection form
            button.classList.remove('loading');
            this.showISAPConnectionForm(card);
            this.addLog('info', 'iSAP 연결 정보를 입력하세요');
        }
    }

    showDeviceList(card, devices, type) {
        // Find or create device list container
        let deviceList = card.querySelector('.device-list');
        if (!deviceList) {
            deviceList = document.createElement('div');
            deviceList.className = 'device-list';
            card.appendChild(deviceList);
        }

        // Clear existing list
        deviceList.innerHTML = '';

        // Add devices with staggered animation
        devices.forEach((deviceName, index) => {
            const deviceItem = document.createElement('div');
            deviceItem.className = 'device-item';
            deviceItem.style.animationDelay = `${index * 0.1}s`;
            deviceItem.innerHTML = `
                <span class="device-item-name">${deviceName}</span>
                <span class="device-item-status">연결 가능</span>
            `;

            deviceItem.addEventListener('click', () => {
                this.selectDevice(deviceName, type);
            });

            deviceList.appendChild(deviceItem);
        });
    }

    showNoDevicesMessage(card) {
        // Find or create device list container
        let deviceList = card.querySelector('.device-list');
        if (!deviceList) {
            deviceList = document.createElement('div');
            deviceList.className = 'device-list';
            card.appendChild(deviceList);
        }

        // Clear existing list
        deviceList.innerHTML = '';

        // Create no devices message
        const messageContainer = document.createElement('div');
        messageContainer.className = 'no-devices-message';
        messageContainer.innerHTML = `
            <div class="no-devices-icon">
                <svg class="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
            </div>
            <p class="no-devices-title">연결된 장치를 찾을 수 없습니다</p>
            <ul class="no-devices-tips">
                <li>USB 케이블이 연결되어 있는지 확인하세요</li>
                <li>장치에서 USB 디버깅이 활성화되어 있는지 확인하세요</li>
                <li>ADB 드라이버가 설치되어 있는지 확인하세요</li>
            </ul>
        `;

        deviceList.appendChild(messageContainer);
    }

    showISAPConnectionForm(card) {
        // Find or create connection form container
        let formContainer = card.querySelector('.isap-connection-form');
        if (!formContainer) {
            formContainer = document.createElement('div');
            formContainer.className = 'isap-connection-form';
            card.appendChild(formContainer);
        }

        formContainer.innerHTML = `
            <div class="ssh-form">
                <div class="form-group">
                    <label class="form-label">호스트 IP</label>
                    <input type="text" id="isap-host" class="form-input" placeholder="10.0.3.0" value="10.0.3.0">
                </div>
                <div class="form-group">
                    <label class="form-label">포트</label>
                    <input type="number" id="isap-port" class="form-input" placeholder="20000" value="20000">
                </div>
                <div class="form-group">
                    <label class="form-label">사용자명</label>
                    <input type="text" id="isap-username" class="form-input" placeholder="root" value="root">
                </div>
                <div class="form-group">
                    <label class="form-label">패스워드</label>
                    <input type="password" id="isap-password" class="form-input" placeholder="패스워드 입력" value="">
                </div>

                <div class="form-divider"></div>

                <div class="form-group">
                    <label class="form-checkbox">
                        <input type="checkbox" id="isap-proxy-enabled">
                        <span>Proxy Jump 사용</span>
                    </label>
                </div>

                <div id="isap-proxy-fields" class="proxy-fields hidden">
                    <div class="form-group">
                        <label class="form-label">Proxy 호스트</label>
                        <input type="text" id="isap-proxy-host" class="form-input" placeholder="raspberry.local">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Proxy 포트</label>
                        <input type="number" id="isap-proxy-port" class="form-input" placeholder="22" value="22">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Proxy 사용자명</label>
                        <input type="text" id="isap-proxy-username" class="form-input" placeholder="pi" value="pi">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Proxy 패스워드</label>
                        <input type="password" id="isap-proxy-password" class="form-input" placeholder="패스워드 입력" value="">
                    </div>
                </div>

                <button class="btn-primary w-full mt-4" id="isap-connect-btn">
                    <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                    연결
                </button>
            </div>
        `;

        // Toggle proxy fields
        const proxyCheckbox = formContainer.querySelector('#isap-proxy-enabled');
        const proxyFields = formContainer.querySelector('#isap-proxy-fields');

        proxyCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                proxyFields.classList.remove('hidden');
            } else {
                proxyFields.classList.add('hidden');
            }
        });

        // Connect button handler
        const connectBtn = formContainer.querySelector('#isap-connect-btn');
        connectBtn.addEventListener('click', () => this.connectISAP());
    }

    async connectISAP() {
        const host = document.getElementById('isap-host').value.trim();
        const port = document.getElementById('isap-port').value;
        const username = document.getElementById('isap-username').value.trim();
        const password = document.getElementById('isap-password').value;
        const proxyEnabled = document.getElementById('isap-proxy-enabled').checked;

        if (!host) {
            this.addLog('error', '호스트 IP를 입력하세요');
            return;
        }

        if (!password) {
            this.addLog('error', '패스워드를 입력하세요');
            return;
        }

        const connectionInfo = {
            host,
            port: parseInt(port) || 20000,
            username: username || 'root',
            password,
        };

        if (proxyEnabled) {
            const proxyHost = document.getElementById('isap-proxy-host').value.trim();
            const proxyPort = document.getElementById('isap-proxy-port').value;
            const proxyUsername = document.getElementById('isap-proxy-username').value.trim();
            const proxyPassword = document.getElementById('isap-proxy-password').value;

            if (!proxyHost) {
                this.addLog('error', 'Proxy 호스트를 입력하세요');
                return;
            }

            if (!proxyPassword) {
                this.addLog('error', 'Proxy 패스워드를 입력하세요');
                return;
            }

            connectionInfo.proxy = {
                host: proxyHost,
                port: parseInt(proxyPort) || 22,
                username: proxyUsername || 'pi',
                password: proxyPassword,
            };
        }

        this.addLog('info', `iSAP 장치에 연결 중... ${username}@${host}:${port}`);
        if (proxyEnabled) {
            this.addLog('info', `Proxy Jump: ${connectionInfo.proxy.username}@${connectionInfo.proxy.host}:${connectionInfo.proxy.port}`);
        }

        // TODO: Implement actual iSAP connection via backend
        // For now, just simulate connection
        await new Promise(resolve => setTimeout(resolve, 1500));

        this.isDeviceConnected = true;
        this.deviceType = 'isap';
        this.deviceName = `${username}@${host}`;
        this.fps = 30;

        this.renderScreenPreview();
        this.renderDeviceStatus();
        this.addLog('success', `iSAP 장치에 연결되었습니다`);

        // Refresh scenario list if it's currently visible
        if (this.isScenarioListVisible()) {
            this.renderScenarioListInPanel();
        }
    }

    async selectDevice(deviceName, type) {
        this.deviceType = type;
        this.deviceName = deviceName;

        if (type === 'adb' && this.adbDevices) {
            try {
                // Extract serial number from "Model (Serial)" format
                const serialMatch = deviceName.match(/\(([^)]+)\)$/);
                const serial = serialMatch ? serialMatch[1] : deviceName;

                // Find the device by serial
                const device = this.adbDevices.find(d => d.id === serial);

                if (device) {
                    this.addLog('info', `${deviceName} 장치에 연결 중...`);

                    // Select device via API
                    const result = await window.api.device.select(device.id);

                    if (result) {
                        this.isDeviceConnected = true;
                        this.fps = 30;

                        // Connect to ProtocolManager
                        try {
                            await window.api.protocol.connect(device.id, 'adb');
                            this.addLog('info', 'Protocol Manager 연결 완료');
                        } catch (protocolError) {
                            this.addLog('warning', `Protocol Manager 연결 실패: ${protocolError.message}`);
                        }

                        // Store device screen resolution
                        // Result format: {success: true, info: {...}}
                        const deviceInfo = result.info || result;

                        if (deviceInfo.screen) {
                            this.screenWidth = deviceInfo.screen.width;
                            this.screenHeight = deviceInfo.screen.height;

                            // Update coordinate system with new device dimensions
                            this.coordinateSystem.init(this.screenWidth, this.screenHeight, 0);
                        }

                        // Hide device connection UI and show screen preview
                        const deviceConnectionUI = document.getElementById('device-connection-ui');
                        if (deviceConnectionUI) {
                            deviceConnectionUI.style.display = 'none';
                        }

                        // Render screen preview
                        this.renderScreenPreview();

                        // Render device status in header
                        this.renderDeviceStatus();

                        this.addLog('success', `${deviceName} 장치가 연결되었습니다`);

                        // Refresh scenario list if it's currently visible
                        if (this.isScenarioListVisible()) {
                            this.renderScenarioListInPanel();
                        }

                        // Start screen stream
                        this.startScreenStream();
                    } else {
                        this.addLog('error', `장치 연결 실패: ${result.error || 'Unknown error'}`);
                    }
                }
            } catch (error) {
                this.addLog('error', `장치 선택 실패: ${error.message}`);
            }
        } else {
            // iSAP - keep original behavior for now
            this.isDeviceConnected = true;
            this.fps = 30;

            // Hide device connection UI and show screen preview
            const deviceConnectionUI = document.getElementById('device-connection-ui');
            if (deviceConnectionUI) {
                deviceConnectionUI.style.display = 'none';
            }

            // Render screen preview
            this.renderScreenPreview();

            // Render device status in header
            this.renderDeviceStatus();

            this.addLog('success', `${deviceName} 장치가 연결되었습니다`);

            // Refresh scenario list if it's currently visible
            if (this.isScenarioListVisible()) {
                this.renderScenarioListInPanel();
            }
        }
    }

    async startScreenStream() {
        try {
            this.addLog('info', '화면 스트리밍을 시작합니다...');

            // Start stream with 30 FPS
            const result = await window.api.screen.startStream({ maxFps: 30 });

            if (result) {
                this.addLog('success', '화면 스트리밍이 시작되었습니다');
                this.isScreenPaused = false;

                // Listen for stream data
                window.api.screen.onStreamData((data) => {
                    // Only update image if not paused
                    if (!this.isScreenPaused) {
                        const img = document.getElementById('screen-stream-image');
                        if (img && data.dataUrl) {
                            img.src = data.dataUrl;
                        }
                    }
                });
            }
        } catch (error) {
            this.addLog('error', `화면 스트리밍 실패: ${error.message}`);
        }
    }

    toggleScreenPause() {
        this.isScreenPaused = !this.isScreenPaused;

        const pauseBtn = document.getElementById('btn-pause-screen');
        if (!pauseBtn) return;

        if (this.isScreenPaused) {
            // Update button to show "Resume" state
            pauseBtn.innerHTML = `
                <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                재개
            `;
            pauseBtn.classList.remove('btn-outline');
            pauseBtn.classList.add('btn-primary');
        } else {
            // Update button to show "Pause" state
            pauseBtn.innerHTML = `
                <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                일시정지
            `;
            pauseBtn.classList.remove('btn-primary');
            pauseBtn.classList.add('btn-outline');
        }
    }

    renderDeviceStatus() {
        const container = document.getElementById('device-status');
        if (!container) return;

        if (!this.isDeviceConnected) {
            container.innerHTML = `
                <div class="device-status-indicator">
                    <div class="status-light disconnected"></div>
                    <span class="device-status-value">장치 없음</span>
                </div>
                <div class="device-status-divider"></div>
                <div class="device-status-indicator">
                    <span class="device-status-label">FPS</span>
                    <span class="device-status-value">-</span>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="device-status-indicator">
                <div class="status-light connected"></div>
                <span class="device-status-value">${this.deviceName}</span>
            </div>
            <div class="device-status-divider"></div>
            <div class="device-status-indicator">
                <span class="device-status-label">FPS</span>
                <span class="device-status-value">${this.fps}</span>
            </div>
        `;
    }

    renderLogs() {
        const container = document.getElementById('log-output-content');
        if (!container) return;

        if (this.logs.length === 0) {
            container.innerHTML = `
                <div class="log-entry">
                    <span class="log-timestamp">00:00:00</span>
                    <span class="log-level log-level-info">[INFO]</span>
                    <span class="log-message">로그가 없습니다</span>
                </div>
            `;
            return;
        }

        const logsHtml = this.logs.map(log => {
            const levelClass = `log-level-${log.level}`;
            const levelText = {
                'info': '[INFO]',
                'success': '[SUCCESS]',
                'warning': '[WARNING]',
                'error': '[ERROR]'
            }[log.level] || '[INFO]';

            return `
                <div class="log-entry">
                    <span class="log-timestamp">${log.timestamp}</span>
                    <span class="log-level ${levelClass}">${levelText}</span>
                    <span class="log-message">${log.message}</span>
                </div>
            `;
        }).join('');

        container.innerHTML = logsHtml;

        // Auto scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    clearLogs() {
        this.logs = [];
        this.renderLogs();
        this.addLog('info', '로그가 초기화되었습니다');
    }

    // Update region property (x, y, width, height)
    resetActionRegion(actionId) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action) return;

        action.region = null;

        // Clear the marker immediately
        this.updateSelectedActionMarker(action);

        // Re-render without showing save alert
        this.renderActionSequence();
    }

    resetConditionRegion(actionId, conditionId) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.conditions) return;

        const condition = action.conditions.find(c => c.id === conditionId);
        if (!condition) return;

        condition.params.region = null;

        // Clear markers
        const screenPreview = document.getElementById('screen-preview-canvas');
        if (screenPreview) {
            const markers = screenPreview.querySelectorAll('.action-marker, .action-marker-line');
            markers.forEach(m => m.remove());
        }

        this.saveMacro();
        this.renderActionSequence();
    }

    updateRegionProperty(actionId, property, value) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action || !action.region) return;

        action.region[property] = value;

        // Recapture the image with the new region coordinates
        this.captureRegionImage(action);

        this.saveMacro();
        this.render();
    }

    // Auto crop region - removes uniform background from captured image
    async autoCropRegion(actionId) {
        try {
            const action = this.actions.find(a => a.id === actionId);
            if (!action || !action.region) {
                this.addLog('error', '영역을 찾을 수 없습니다');
                return;
            }

            // Get the thumbnail canvas
            const thumbnailCanvas = document.getElementById(`thumbnail-${actionId}`);
            if (!thumbnailCanvas) {
                this.addLog('error', '썸네일 캔버스를 찾을 수 없습니다');
                return;
            }

            const ctx = thumbnailCanvas.getContext('2d');
            const width = thumbnailCanvas.width;
            const height = thumbnailCanvas.height;

            // Get image data
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            // Sample corner pixels to determine background color
            const cornerSamples = [
                { x: 0, y: 0 },
                { x: width - 1, y: 0 },
                { x: 0, y: height - 1 },
                { x: width - 1, y: height - 1 }
            ];

            // Calculate average background color from corners
            let bgR = 0, bgG = 0, bgB = 0, bgA = 0;
            cornerSamples.forEach(sample => {
                const idx = (sample.y * width + sample.x) * 4;
                bgR += data[idx];
                bgG += data[idx + 1];
                bgB += data[idx + 2];
                bgA += data[idx + 3];
            });
            bgR = Math.round(bgR / 4);
            bgG = Math.round(bgG / 4);
            bgB = Math.round(bgB / 4);
            bgA = Math.round(bgA / 4);

            // Tolerance for background matching
            const tolerance = 30;

            // Find the bounding box of non-background pixels
            let minX = width, minY = height, maxX = 0, maxY = 0;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];
                    const a = data[idx + 3];

                    // Check if pixel is significantly different from background
                    const diffR = Math.abs(r - bgR);
                    const diffG = Math.abs(g - bgG);
                    const diffB = Math.abs(b - bgB);
                    const diffA = Math.abs(a - bgA);

                    if (diffR > tolerance || diffG > tolerance || diffB > tolerance || diffA > tolerance) {
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }

            // Check if we found any content
            if (maxX === 0 && maxY === 0) {
                this.addLog('warning', '자동 크롭할 영역을 찾을 수 없습니다');
                return;
            }

            // Add small padding
            const padding = 2;
            minX = Math.max(0, minX - padding);
            minY = Math.max(0, minY - padding);
            maxX = Math.min(width - 1, maxX + padding);
            maxY = Math.min(height - 1, maxY + padding);

            // Calculate cropped dimensions
            const cropWidth = maxX - minX + 1;
            const cropHeight = maxY - minY + 1;

            // Check if crop area is valid
            if (cropWidth < 10 || cropHeight < 10) {
                this.addLog('warning', '크롭 영역이 너무 작습니다');
                return;
            }

            // Calculate the original region coordinates (in screen space)
            const originalRegion = action.region;
            const scaleX = originalRegion.width / width;
            const scaleY = originalRegion.height / height;

            // Update the region to the cropped area (in screen coordinates)
            action.region = {
                x: Math.round(originalRegion.x + minX * scaleX),
                y: Math.round(originalRegion.y + minY * scaleY),
                width: Math.round(cropWidth * scaleX),
                height: Math.round(cropHeight * scaleY)
            };

            this.addLog('success', `자동 크롭 완료: ${cropWidth}×${cropHeight}`);
            this.renderActionSequence();

        } catch (error) {
            this.addLog('error', `자동 크롭 실패: ${error.message}`);
        }
    }

    // Test image matching - checks if current screen matches the template
    async testImageMatch(actionId) {
        try {
            const action = this.actions.find(a => a.id === actionId);
            if (!action || !action.region) {
                this.addLog('error', '영역을 찾을 수 없습니다');
                return;
            }

            // Check if imageMatcher is available
            if (!window.imageMatcher) {
                this.addLog('error', '이미지 매칭 엔진을 찾을 수 없습니다');
                return;
            }

            // Get the current screen image and convert to canvas
            const screenImg = document.getElementById('screen-stream-image');
            if (!screenImg || !screenImg.complete) {
                this.addLog('error', '스크린 이미지를 찾을 수 없습니다');
                return;
            }

            // Create temporary canvas from screen image
            const screenCanvas = document.createElement('canvas');
            screenCanvas.width = screenImg.naturalWidth || screenImg.width;
            screenCanvas.height = screenImg.naturalHeight || screenImg.height;
            const screenCtx = screenCanvas.getContext('2d');
            screenCtx.drawImage(screenImg, 0, 0);

            // Get the template canvas (thumbnail)
            const templateCanvas = document.getElementById(`thumbnail-${actionId}`);
            if (!templateCanvas) {
                this.addLog('error', '템플릿 이미지를 찾을 수 없습니다');
                return;
            }

            this.addLog('info', '이미지 매칭 테스트 시작...');

            // Get image data from both canvases
            const templateCtx = templateCanvas.getContext('2d');

            const sourceImageData = screenCtx.getImageData(0, 0, screenCanvas.width, screenCanvas.height);
            const templateImageData = templateCtx.getImageData(0, 0, templateCanvas.width, templateCanvas.height);

            // Perform template matching
            const threshold = action.threshold || 0.95;
            const result = await window.imageMatcher.findTemplate(sourceImageData, templateImageData, {
                threshold: threshold,
                cropLocation: {
                    x: action.region.x,
                    y: action.region.y
                },
                useCache: false
            });

            if (result.found) {
                this.addLog('success', `매칭 성공! 위치: (${result.x}, ${result.y}), 정확도: ${(result.score * 100).toFixed(1)}%`);

                // TODO: Draw match location on screen (needs overlay canvas implementation)
                // For now, just log the result

                // Clear the log highlight after 2 seconds
                setTimeout(() => {
                    // Future: clear visual indicator
                }, 2000);
            } else {
                this.addLog('warning', `매칭 실패. 최고 점수: ${(result.score * 100).toFixed(1)}% (임계값: ${(threshold * 100).toFixed(0)}%)`);
            }

        } catch (error) {
            this.addLog('error', `이미지 매칭 테스트 실패: ${error.message}`);
        }
    }

    // Scenario List Modal Methods
    openScenarioListModal() {
        console.log('[openScenarioList] Opening scenario sidebar');
        const sidebar = document.getElementById('scenario-sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        if (sidebar && overlay) {
            sidebar.classList.add('open');
            overlay.classList.add('active');
            this.renderScenarioTree();
        }
    }

    closeScenarioListModal() {
        console.log('[closeScenarioList] Restoring action sequence view');
        // Restore the action sequence view
        this.renderActionSequence();
    }

    closeScenarioModal() {
        console.log('[closeScenarioModal] Closing scenario modal');
        const modal = document.getElementById('scenario-list-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    showAddActionPrompt() {
        const dialog = document.getElementById('add-action-prompt-dialog');
        if (!dialog) return;

        // Show the dialog
        dialog.style.display = 'flex';

        // Setup event listeners
        const closeBtn = document.getElementById('btn-close-prompt-dialog');
        const confirmBtn = document.getElementById('btn-confirm-prompt');

        const closeDialog = () => {
            dialog.style.display = 'none';
        };

        // Remove old listeners by cloning
        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.addEventListener('click', closeDialog);
        }

        if (confirmBtn) {
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            newConfirmBtn.addEventListener('click', closeDialog);
        }

        // Close on overlay click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                closeDialog();
            }
        });

        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeDialog();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    markAsChanged() {
        this.hasUnsavedChanges = true;
        this.updateToolbarButtons(true);

        // Auto-save to registry after a short delay (debounce)
        if (this.currentScenarioKey) {
            clearTimeout(this._autoSaveTimeout);
            this._autoSaveTimeout = setTimeout(() => {
                this.saveToRegistry(this.currentScenarioKey);
                console.log('[Auto-save] Scenario saved automatically');
            }, 1000); // Save after 1 second of inactivity
        }
    }

    markAsSaved() {
        this.savedState = JSON.stringify(this.actions);
        this.hasUnsavedChanges = false;
        this.updateToolbarButtons(true);
    }

    checkUnsavedChanges() {
        // Check if there are unsaved changes
        this.checkForChanges();

        if (this.hasUnsavedChanges) {
            return confirm('저장되지 않은 변경사항이 있습니다. 계속하시겠습니까?');
        }

        return true;
    }

    checkForChanges() {
        if (!this.savedState) {
            // No saved state means this is a new scenario with actions
            this.hasUnsavedChanges = this.actions.length > 0;
        } else {
            const currentState = JSON.stringify(this.actions);
            this.hasUnsavedChanges = currentState !== this.savedState;
        }
        this.updateToolbarButtons(true);
    }

    updateToolbarButtons(hasScenario) {
        // Sub-toolbar with save buttons
        const subToolbar = document.getElementById('scenario-sub-toolbar');
        const filenameDisplay = document.getElementById('scenario-filename-display');
        const runBtn = document.getElementById('btn-run-macro');

        // Save buttons row (below toolbar)
        const saveButtonsRow = document.getElementById('save-buttons-row');
        const saveBtnInline = document.getElementById('btn-save-macro-inline');
        const saveAsBtnInline = document.getElementById('btn-save-as-macro-inline');

        const actionListContainer = document.getElementById('action-list-container');

        // Show sub-toolbar with save buttons when scenario exists
        if (subToolbar) {
            subToolbar.style.display = hasScenario ? '' : 'none';
        }

        // Update filename display
        if (filenameDisplay && hasScenario) {
            let displayName = '';
            if (this.currentFilePath) {
                displayName = this.currentFilePath.includes('/')
                    ? this.currentFilePath.split('/').pop()
                    : this.currentFilePath;
            } else if (this.macroName) {
                displayName = this.macroName.replace(/[<>:"/\\|?*]/g, '_') + '.json';
            } else {
                displayName = '새_시나리오.json';
            }
            filenameDisplay.textContent = displayName;
        }

        // Show/hide save buttons row
        if (saveButtonsRow) {
            saveButtonsRow.style.display = hasScenario ? 'block' : 'none';
        }

        // Update inline save button states
        if (saveBtnInline) {
            saveBtnInline.disabled = !this.hasUnsavedChanges;
        }

        // Show run button in toolbar
        if (runBtn) runBtn.style.display = hasScenario ? 'inline-flex' : 'none';

        // Enable/disable action list panel
        if (actionListContainer) {
            if (hasScenario) {
                actionListContainer.style.pointerEvents = 'auto';
                actionListContainer.style.opacity = '1';
            } else {
                actionListContainer.style.pointerEvents = 'none';
                actionListContainer.style.opacity = '0.5';
            }
        }
    }

    renderScenarioList() {
        console.log('[renderScenarioList] Rendering scenario list');
        const container = document.getElementById('scenario-list-container');
        if (!container) {
            console.error('[renderScenarioList] Container not found');
            return;
        }

        // Get new structure data from localStorage
        const scenarioData = JSON.parse(localStorage.getItem('scenario_data') || '{}');
        const registry = JSON.parse(localStorage.getItem('scenario_registry') || '{}');
        const results = JSON.parse(localStorage.getItem('scenario_execution_results') || '{}');

        console.log('[renderScenarioList] Files:', Object.keys(scenarioData).length);

        // Check if we have any files
        const fileCount = Object.keys(scenarioData).length;
        if (fileCount === 0) {
            container.innerHTML = `
                <div class="text-center py-12 text-slate-500">
                    <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <p class="text-lg font-medium">저장된 시나리오가 없습니다</p>
                    <p class="text-sm mt-2">시나리오를 저장하면 여기에 표시됩니다</p>
                </div>
            `;
            return;
        }

        // Build hierarchical structure: files -> scenarios
        const files = Object.entries(scenarioData).map(([filePath, fileData]) => {
            const fileRegistry = registry[filePath] || {};
            const scenarios = (fileData.scenarios || []).map(scenario => {
                const executionResult = results[scenario.id];
                return {
                    id: scenario.id,
                    name: scenario.name,
                    actionsCount: scenario.actions?.length || 0,
                    status: executionResult ? executionResult.status : 'never_run',
                    message: executionResult ? executionResult.message : '미실행',
                    timestamp: executionResult ? executionResult.timestamp : fileRegistry.timestamp
                };
            });

            return {
                filePath,
                fileName: fileData.name,
                scenarios,
                timestamp: fileRegistry.timestamp || Date.now()
            };
        });

        // Sort files by most recent
        files.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Render files and their scenarios
        container.innerHTML = files.map(file => {
            const scenariosHTML = file.scenarios.map(scenario => {
                const statusIcon = this.getStatusIcon(scenario.status);
                const statusColor = this.getStatusColor(scenario.status);
                const statusText = this.getStatusText(scenario.status);
                const timestamp = new Date(scenario.timestamp).toLocaleString('ko-KR');

                return `
                    <div class="border-l-2 border-slate-200 pl-4 ml-4 mb-2 hover:bg-slate-50 rounded transition-colors p-2">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3 flex-1 cursor-pointer" onclick="window.macroApp.editScenario('${scenario.id}')">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2">
                                        <h4 class="text-sm font-medium text-slate-900">${scenario.name}</h4>
                                        <span class="px-2 py-0.5 text-xs font-medium rounded ${statusColor}">
                                            ${statusIcon} ${statusText}
                                        </span>
                                    </div>
                                    <p class="text-xs text-slate-500 mt-1">${scenario.actionsCount}개 액션 • ${timestamp}</p>
                                </div>
                            </div>
                            <button class="btn-outline btn-sm" onclick="event.stopPropagation(); window.macroApp.runSingleScenario('${scenario.id}')">
                                실행
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="border rounded-lg mb-3 overflow-hidden">
                    <!-- File Header -->
                    <div class="bg-slate-100 px-4 py-3 border-b">
                        <div class="flex items-center gap-2">
                            <svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                            </svg>
                            <h3 class="font-medium text-slate-900">${file.fileName}</h3>
                            <span class="text-xs text-slate-500">(${file.scenarios.length}개 시나리오)</span>
                        </div>
                    </div>
                    <!-- Scenarios List -->
                    <div class="p-3">
                        ${scenariosHTML}
                    </div>
                </div>
            `;
        }).join('');

        // Update selected count (if needed for checkbox functionality)
        this.updateSelectedCount();
    }

    getStatusIcon(status) {
        switch (status) {
            case 'pass': return '✓';
            case 'fail': return '✗';
            case 'skip': return '⊘';
            case 'stopped': return '■';
            case 'never_run': return '○';
            case 'completed': return '✓';
            default: return '○';
        }
    }

    getStatusColor(status) {
        switch (status) {
            case 'pass': return 'bg-green-100 text-green-800';
            case 'fail': return 'bg-red-100 text-red-800';
            case 'skip': return 'bg-yellow-100 text-yellow-800';
            case 'stopped': return 'bg-slate-100 text-slate-800';
            case 'never_run': return 'bg-blue-100 text-blue-800';
            case 'completed': return 'bg-green-100 text-green-800';
            default: return 'bg-slate-100 text-slate-600';
        }
    }

    getStatusText(status) {
        switch (status) {
            case 'pass': return 'PASS';
            case 'fail': return 'FAIL';
            case 'skip': return 'SKIP';
            case 'stopped': return '중단됨';
            case 'never_run': return '미실행';
            case 'completed': return '완료';
            default: return '미실행';
        }
    }

    updateSelectedCount() {
        const checkboxes = document.querySelectorAll('.scenario-checkbox:checked');
        const countEl = document.getElementById('selected-count');
        if (countEl) {
            countEl.textContent = checkboxes.length;
        }
    }

    renderScenarioTree() {
        console.log('[renderScenarioTree] Rendering scenario tree');
        const container = document.getElementById('scenario-tree-container');
        if (!container) {
            console.error('[renderScenarioTree] Container not found');
            return;
        }

        // Get registry from localStorage
        const registry = JSON.parse(localStorage.getItem('scenario_registry') || '{}');
        const results = JSON.parse(localStorage.getItem('scenario_execution_results') || '{}');

        // Convert to array and sort
        const scenarios = Object.entries(registry).map(([key, data]) => ({
            key,
            name: data.name,
            filename: data.filename,
            status: results[key]?.status || 'never_run'
        }));

        scenarios.sort((a, b) => a.name.localeCompare(b.name));

        if (scenarios.length === 0) {
            container.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--slate-400);">
                    <p>시나리오가 없습니다</p>
                    <p style="font-size: 0.875rem; margin-top: 0.5rem;">새 시나리오를 만들어 시작하세요</p>
                </div>
            `;
            return;
        }

        // Render scenario list
        container.innerHTML = scenarios.map(scenario => {
            const statusIcon = this.getStatusIcon(scenario.status);
            const statusColor = this.getStatusColor(scenario.status);

            return `
                <div class="scenario-tree-item" data-key="${scenario.key}">
                    <svg class="tree-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <div class="tree-label-container">
                        <span class="tree-label">${scenario.name}</span>
                    </div>
                    <span class="icon-sm ${statusColor}">${statusIcon}</span>
                </div>
            `;
        }).join('');

        // Add click handlers
        container.querySelectorAll('.scenario-tree-item').forEach(item => {
            item.addEventListener('click', () => {
                const key = item.dataset.key;
                const scenarioData = this.loadScenarioFromRegistry(key);

                if (scenarioData) {
                    // Load the scenario data
                    this.actions = scenarioData.actions || [];
                    this.macroName = scenarioData.name || key;
                    this.currentFilePath = null; // Reset file path since we're loading from registry

                    // Update UI
                    this.renderActionSequence();
                    const macroNameInput = document.getElementById('macro-name-input');
                    if (macroNameInput) {
                        macroNameInput.value = this.macroName;
                    }

                    // Mark as saved (loaded from registry)
                    this.markAsSaved();

                    // Show action buttons since we have a scenario loaded
                    this.updateToolbarButtons(true);

                    // Log success
                    this.addLog('success', `Loaded scenario: ${this.macroName}`);
                }

                this.closeScenarioListModal();
            });
        });
    }

    createNewScenario() {
        console.log('[createNewScenario] Opening new scenario dialog');

        const dialog = document.getElementById('new-scenario-dialog');
        const input = document.getElementById('scenario-name-input');

        if (!dialog || !input) {
            console.error('[createNewScenario] Dialog elements not found');
            return;
        }

        // Show dialog
        dialog.style.display = 'flex';
        input.value = '';

        // Initialize filename preview
        this.updateDialogFilenamePreview('');

        // Add input event listener for real-time filename preview
        const handleInput = () => {
            this.updateDialogFilenamePreview(input.value);
        };
        input.addEventListener('input', handleInput);

        input.focus();

        // Setup event listeners (remove old ones first)
        const createBtn = document.getElementById('btn-create-scenario');
        const cancelBtn = document.getElementById('btn-cancel-scenario');
        const closeBtn = document.getElementById('btn-close-dialog');

        const closeDialog = () => {
            dialog.style.display = 'none';
            input.value = '';
            input.removeEventListener('input', handleInput); // Clean up event listener
        };

        const createScenario = () => {
            const scenarioName = input.value.trim();
            const errorEl = document.getElementById('scenario-name-error');

            if (!scenarioName) {
                if (errorEl) {
                    errorEl.textContent = 'Please enter a scenario name';
                    errorEl.style.display = 'block';
                }
                input.focus();
                return;
            }

            // Hide error if shown
            if (errorEl) {
                errorEl.style.display = 'none';
            }

            console.log('[createNewScenario] Creating scenario:', scenarioName);

            // Reset current state
            this.actions = [];
            this.macroName = scenarioName;

            // Generate new file path and scenario ID
            const filePath = this.generateFilePath(scenarioName);
            const scenarioId = this.generateScenarioId();

            // Create new file structure with scenarios array
            const scenarioData = JSON.parse(localStorage.getItem('scenario_data') || '{}');
            scenarioData[filePath] = {
                name: scenarioName, // File name (used for display)
                scenarios: [{
                    id: scenarioId,
                    name: scenarioName,
                    actions: [],
                    description: ''
                }]
            };

            // Update registry (file metadata)
            const registry = JSON.parse(localStorage.getItem('scenario_registry') || '{}');
            registry[filePath] = {
                name: scenarioName,
                filename: filePath, // Add filename for display in scenario list
                timestamp: Date.now(),
                scenarioCount: 1
            };

            // Update index (fast lookup)
            const index = JSON.parse(localStorage.getItem('scenario_index') || '{}');
            index[scenarioId] = { filePath, scenarioId };

            // Save to localStorage
            localStorage.setItem('scenario_data', JSON.stringify(scenarioData));
            localStorage.setItem('scenario_registry', JSON.stringify(registry));
            localStorage.setItem('scenario_index', JSON.stringify(index));

            // Set current file and scenario
            this.currentFilePath = filePath;
            this.currentScenarioId = scenarioId;
            this.currentScenarioKey = scenarioId; // Backward compatibility

            // Update UI
            this.renderActionSequence();
            const macroNameInput = document.getElementById('macro-name-input');
            if (macroNameInput) {
                macroNameInput.value = scenarioName;
            }

            // Update filename preview
            this.updateFilenamePreview();

            // Mark as saved (new scenario with no actions)
            this.markAsSaved();

            // Show action buttons since we have a scenario now
            this.updateToolbarButtons(true);

            // Close dialog and sidebar
            closeDialog();
            this.closeScenarioListModal();

            // Show success message
            this.addLog('success', `New scenario "${scenarioName}" created`);

            // Show prompt to add actions
            this.showAddActionPrompt();

            console.log('[createNewScenario] Created:', { filePath, scenarioId });
        };

        // Remove old listeners by cloning
        const newCreateBtn = createBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        const newCloseBtn = closeBtn.cloneNode(true);

        createBtn.parentNode.replaceChild(newCreateBtn, createBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

        // Add new listeners
        newCreateBtn.addEventListener('click', createScenario);
        newCancelBtn.addEventListener('click', closeDialog);
        newCloseBtn.addEventListener('click', closeDialog);

        // Enter key to create
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                createScenario();
            }
        });

        // Escape key to cancel
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeDialog();
            }
        });
    }

    isScenarioListVisible() {
        // Check if scenario list is currently being displayed
        const backToListBtn = document.getElementById('btn-back-to-list');
        return backToListBtn && backToListBtn.style.display === 'none';
    }

    renderScenarioListInPanel(skipUnsavedCheck = false) {
        // Check for unsaved changes before navigating away (skip if called after delete/save operations)
        if (!skipUnsavedCheck && !this.checkUnsavedChanges()) {
            console.log('[renderScenarioListInPanel] User cancelled due to unsaved changes');
            return;
        }

        const actionList = document.getElementById('action-sequence-list');
        if (!actionList) return;

        // Get registry, results, and scenario data
        const registry = JSON.parse(localStorage.getItem('scenario_registry') || '{}');
        const results = JSON.parse(localStorage.getItem('scenario_execution_results') || '{}');
        const scenarioData = JSON.parse(localStorage.getItem('scenario_data') || '{}');

        // Merge and sort scenarios
        const scenarios = Object.entries(registry).map(([key, registryData]) => {
            const executionResult = results[key];

            // Get actual action count from scenario_data instead of cached registry value
            let actualActionsCount = 0;
            const fileData = scenarioData[key];
            if (fileData && fileData.scenarios && fileData.scenarios.length > 0) {
                // Sum up actions from all scenarios in this file
                // Exclude structural markers (else, endif) from count
                actualActionsCount = fileData.scenarios.reduce((sum, scenario) => {
                    const actions = scenario.actions || [];
                    const validActions = actions.filter(action =>
                        action.type !== 'else' && action.type !== 'endif'
                    );
                    return sum + validActions.length;
                }, 0);
            }

            return {
                key,
                name: registryData.name,
                filename: registryData.filename,
                savedAt: registryData.savedAt,
                actionsCount: actualActionsCount,
                status: executionResult ? executionResult.status : 'never_run',
                message: executionResult ? executionResult.message : '미실행',
                timestamp: executionResult ? executionResult.timestamp : registryData.savedAt
            };
        });

        scenarios.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Render in the main panel
        if (scenarios.length === 0) {
            actionList.innerHTML = `
                <div class="empty-state" style="display: flex;">
                    <svg class="empty-icon" style="width: 64px; height: 64px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <p class="empty-title">저장된 시나리오가 없습니다</p>
                    <p class="empty-description">시나리오를 저장하면 여기에 표시됩니다</p>
                </div>
            `;
        } else {
            // Check device connection status using the global flag
            const disabledAttr = this.isDeviceConnected ? '' : 'disabled';

            const scenarioHTML = scenarios.map(scenario => {
                const statusIcon = this.getStatusIcon(scenario.status);
                const statusColor = this.getStatusColor(scenario.status);
                const statusText = this.getStatusText(scenario.status);
                const timestamp = new Date(scenario.timestamp).toLocaleString('ko-KR');

                // Check if this scenario is currently running
                const runningState = this.runningScenarios.get(scenario.key);
                const isRunning = runningState && runningState.status === 'running';

                // Progress bar and info for running scenarios
                let progressHTML = '';
                if (isRunning && runningState.progress) {
                    // Show action count (total may be null for loops)
                    const progressText = runningState.progress.total !== null
                        ? `${runningState.progress.current} / ${runningState.progress.total}`
                        : `${runningState.progress.current}개 액션 실행됨`;

                    // For indeterminate progress (no total), show animated bar
                    const progressBarHTML = runningState.progress.total !== null
                        ? `<div style="width: ${Math.round((runningState.progress.current / runningState.progress.total) * 100)}%; height: 100%; background: #2563eb; transition: width 0.3s;"></div>`
                        : `<div style="width: 100%; height: 100%; background: linear-gradient(90deg, #2563eb 0%, #3b82f6 50%, #2563eb 100%); animation: progress-indeterminate 1.5s ease-in-out infinite;"></div>`;

                    progressHTML = `
                        <!-- Progress Bar -->
                        <div style="padding-left: 28px; margin-bottom: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <span style="font-size: 12px; color: #2563eb; font-weight: 500;">실행 중...</span>
                                <span style="font-size: 12px; color: #64748b;">${progressText}</span>
                            </div>
                            <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                                ${progressBarHTML}
                            </div>
                        </div>
                    `;
                }

                // Get status badge class
                const statusBadgeClass = scenario.status === 'pass' ? 'status-pass'
                    : scenario.status === 'fail' ? 'status-fail'
                    : scenario.status === 'skip' ? 'status-skip'
                    : 'status-never-run';

                // Format relative time
                let relativeTime = '-';
                if (scenario.timestamp) {
                    const lastRunDate = new Date(scenario.timestamp);
                    if (!isNaN(lastRunDate.getTime())) {
                        const now = new Date();
                        const diffMs = now - lastRunDate;
                        const diffMins = Math.floor(diffMs / 60000);
                        const diffHours = Math.floor(diffMs / 3600000);
                        const diffDays = Math.floor(diffMs / 86400000);

                        if (diffMins < 1) {
                            relativeTime = '방금 전';
                        } else if (diffMins < 60) {
                            relativeTime = `${diffMins}분 전`;
                        } else if (diffHours < 24) {
                            relativeTime = `${diffHours}시간 전`;
                        } else if (diffDays < 7) {
                            relativeTime = `${diffDays}일 전`;
                        } else {
                            relativeTime = lastRunDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
                        }
                    }
                }

                // Actions count
                const actionsCount = scenario.actionsCount || 0;

                // Card classes
                const cardClasses = ['scenario-card-v2', 'scenario-card'];
                if (isRunning) cardClasses.push('running');

                return `
                    <div class="${cardClasses.join(' ')}" data-key="${scenario.key}">
                        <!-- Progress bar for running scenarios -->
                        ${isRunning && runningState.progress ? `
                            <div class="scenario-progress-bar">
                                ${runningState.progress.total !== null
                                    ? `<div class="scenario-progress-fill" style="width: ${Math.round((runningState.progress.current / runningState.progress.total) * 100)}%;"></div>`
                                    : `<div class="scenario-progress-fill indeterminate"></div>`
                                }
                            </div>
                        ` : ''}

                        <!-- Card main content -->
                        <div class="scenario-card-main">
                            <input type="checkbox" class="scenario-checkbox scenario-checkbox-v2" data-key="${scenario.key}" data-filename="${scenario.filename}" ${isRunning ? 'disabled' : ''}>

                            <div class="scenario-card-info">
                                <div class="scenario-card-title scenario-name-clickable" data-key="${scenario.key}">
                                    ${scenario.filename}
                                </div>
                                <div class="scenario-card-meta">
                                    <span class="scenario-status-badge ${statusBadgeClass}">
                                        ${statusText}
                                    </span>
                                    <span class="scenario-meta-divider"></span>
                                    <span class="scenario-meta-item">
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"></path>
                                        </svg>
                                        ${actionsCount}개 액션
                                    </span>
                                    <span class="scenario-meta-divider"></span>
                                    <span class="scenario-meta-item">
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                        </svg>
                                        ${relativeTime}
                                    </span>
                                </div>
                            </div>

                            <div class="scenario-card-actions">
                                ${isRunning ? `
                                    <button class="scenario-action-btn btn-stop" onclick="window.macroApp.cancelScenario('${scenario.key}')" title="중단">
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path>
                                        </svg>
                                    </button>
                                ` : `
                                    <button class="scenario-action-btn btn-run" onclick="window.macroApp.runSingleScenario('${scenario.key}')" ${disabledAttr} title="실행">
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                                        </svg>
                                    </button>
                                `}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            actionList.innerHTML = `
                <div class="px-6 py-4">
                    ${scenarioHTML}
                </div>
            `;

            // Add change listeners to checkboxes
            actionList.querySelectorAll('.scenario-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', () => this.updateSelectedCount());
            });

            // Add click listeners to scenario names for editing
            actionList.querySelectorAll('.scenario-name-clickable').forEach(nameEl => {
                nameEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const key = nameEl.dataset.key;
                    if (key) {
                        this.editScenario(key);
                    }
                });
            });

            // Add click listeners to scenario cards for checkbox toggle
            actionList.querySelectorAll('.scenario-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    // Don't trigger if clicking on button, name, checkbox itself, or any interactive element
                    if (e.target.tagName === 'BUTTON' ||
                        e.target.tagName === 'INPUT' ||
                        e.target.closest('button') ||
                        e.target.closest('.scenario-name-clickable')) {
                        return;
                    }

                    // Toggle checkbox
                    const checkbox = card.querySelector('.scenario-checkbox');
                    if (checkbox && !checkbox.disabled) {
                        checkbox.checked = !checkbox.checked;
                        this.updateSelectedCount();
                    }
                });
            });
        }

        // Show/hide UI elements for scenario list view
        const btnBackToList = document.getElementById('btn-back-to-list');
        const btnSelectAll = document.getElementById('btn-select-all');
        const btnRunSelected = document.getElementById('btn-run-selected');
        const actionPanel = document.getElementById('action-panel');
        const scenarioListHeader = document.getElementById('scenario-list-header');
        const scenarioEditHeader = document.getElementById('scenario-edit-header');
        const macroNameContainer = document.getElementById('macro-name-container');
        const isDeviceConnected = this.adbDevices && this.adbDevices.length > 0;

        // Switch headers: show list header, hide edit header
        if (scenarioListHeader) {
            scenarioListHeader.style.display = '';
        }
        if (scenarioEditHeader) {
            scenarioEditHeader.style.display = 'none';
        }
        // Hide macro name input in content area
        if (macroNameContainer) {
            macroNameContainer.style.display = 'none';
        }

        // Hide sub-toolbar in scenario list view
        const subToolbar = document.getElementById('scenario-sub-toolbar');
        if (subToolbar) {
            subToolbar.style.display = 'none';
        }

        // Hide delay selector in scenario list view
        const delaySelectWrapper = document.getElementById('delay-select-wrapper');
        if (delaySelectWrapper) {
            delaySelectWrapper.style.display = 'none';
        }

        // Hide "back to list" button, show "new scenario" button in scenario list view
        if (btnBackToList) {
            btnBackToList.style.display = 'none';
            btnBackToList.style.visibility = 'hidden';
        }
        const btnNewScenario = document.getElementById('btn-new-scenario');
        if (btnNewScenario) {
            btnNewScenario.style.setProperty('display', '', 'important');
            btnNewScenario.style.visibility = 'visible';
        }

        // Show scenario list buttons (select-all, run-selected, delete-selected)
        if (btnSelectAll) {
            btnSelectAll.style.display = '';
            btnSelectAll.style.visibility = 'visible';
        }
        if (btnRunSelected) {
            btnRunSelected.style.display = '';
            btnRunSelected.style.visibility = 'visible';
            btnRunSelected.disabled = !isDeviceConnected;
        }
        const btnDeleteSelected = document.getElementById('btn-delete-selected');
        if (btnDeleteSelected) {
            btnDeleteSelected.style.display = '';
            btnDeleteSelected.style.visibility = 'visible';
        }

        // Hide action panel in scenario list view (with slide animation)
        if (actionPanel) {
            actionPanel.classList.add('hidden');
        }

        // Disable action list since we're in scenario list view (no active scenario)
        this.updateToolbarButtons(false);
    }

    toggleSelectAll() {
        const checkboxes = document.querySelectorAll('.scenario-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);

        checkboxes.forEach(cb => {
            cb.checked = !allChecked;
        });

        this.updateSelectedCount();
    }

    async runSelectedScenarios() {
        const checkboxes = document.querySelectorAll('.scenario-checkbox:checked');
        const selectedKeys = Array.from(checkboxes).map(cb => cb.dataset.key);

        if (selectedKeys.length === 0) {
            alert('실행할 시나리오를 선택해주세요');
            return;
        }

        // Keep the scenario list visible - do not close modal or switch views

        this.addLog('info', `일괄 실행 시작: ${selectedKeys.length}개 시나리오`);

        // Run scenarios sequentially
        for (let i = 0; i < selectedKeys.length; i++) {
            const key = selectedKeys[i];
            const registry = JSON.parse(localStorage.getItem('scenario_registry') || '{}');
            const scenarioInfo = registry[key];

            if (!scenarioInfo) {
                this.addLog('warning', `시나리오를 찾을 수 없음: ${key}`);
                continue;
            }

            this.addLog('info', `[${i + 1}/${selectedKeys.length}] ${scenarioInfo.name} 실행 중...`);

            // Load scenario data
            const scenarioData = this.loadScenarioFromRegistry(key);
            if (!scenarioData) {
                this.addLog('error', `시나리오 로드 실패: ${scenarioInfo.name}`);
                continue;
            }

            // Load the scenario data internally for execution
            this.actions = scenarioData.actions || [];
            this.macroName = scenarioData.name || 'Unnamed';

            // Run the scenario with key for progress tracking (scenario list stays visible)
            await this.runMacro(key);

            // Small delay between scenarios
            if (i < selectedKeys.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        this.addLog('success', `일괄 실행 완료: ${selectedKeys.length}개 시나리오`);
    }

    deleteSelectedScenarios() {
        const checkboxes = document.querySelectorAll('.scenario-checkbox:checked');
        const selectedItems = Array.from(checkboxes).map(cb => ({
            key: cb.dataset.key,
            filename: cb.dataset.filename
        }));

        if (selectedItems.length === 0) {
            alert('삭제할 시나리오를 선택해주세요');
            return;
        }

        // Show confirmation dialog
        const confirmDelete = confirm(`선택한 ${selectedItems.length}개의 시나리오를 삭제하시겠습니까?`);

        if (!confirmDelete) {
            return;
        }

        try {
            const registry = JSON.parse(localStorage.getItem('scenario_registry') || '{}');

            // Delete each selected scenario
            selectedItems.forEach(({ key }) => {
                if (registry[key]) {
                    delete registry[key];
                }
                localStorage.removeItem(key);
            });

            // Save updated registry
            localStorage.setItem('scenario_registry', JSON.stringify(registry));

            this.addLog('success', `${selectedItems.length}개 시나리오 삭제 완료`);

            // Refresh scenario list (skip unsaved check since we just deleted scenarios)
            this.renderScenarioListInPanel(true);
        } catch (error) {
            console.error('[deleteSelectedScenarios] Error:', error);
            this.addLog('error', `시나리오 삭제 실패: ${error.message}`);
        }
    }

    // Add selected scenarios as blocks for multi-scenario workflow
    addSelectedScenariosAsBlocks() {
        const checkboxes = document.querySelectorAll('.scenario-checkbox:checked');
        const selectedKeys = Array.from(checkboxes).map(cb => cb.dataset.key);

        if (selectedKeys.length === 0) {
            alert('추가할 시나리오를 선택해주세요');
            return;
        }

        // Add the scenario blocks
        this.addScenarioBlocks(selectedKeys);

        // Close the modal
        this.closeScenarioListModal();

        // Log the action
        console.log(`Added ${selectedKeys.length} scenario blocks`);
    }

    // Run all scenario blocks sequentially
    async runAllScenarioBlocks() {
        if (this.scenarioBlocks.length === 0) {
            alert('실행할 시나리오 블록이 없습니다');
            return;
        }

        console.log(`Starting execution of ${this.scenarioBlocks.length} scenario blocks`);

        // Reset all blocks to pending status
        this.scenarioBlocks.forEach(block => {
            block.status = 'pending';
            block.executedActions = 0;
            block.errorMessage = null;
        });
        this.renderScenarioBlocks();

        // Run each block sequentially
        for (let i = 0; i < this.scenarioBlocks.length; i++) {
            const block = this.scenarioBlocks[i];

            console.log(`[${i + 1}/${this.scenarioBlocks.length}] Executing: ${block.scenarioName}`);

            // Update block status to running
            this.updateBlockStatus(block.id, 'running', 0, null);

            try {
                // Execute each action in the block
                for (let actionIndex = 0; actionIndex < block.actions.length; actionIndex++) {
                    const action = block.actions[actionIndex];

                    // Update progress
                    this.updateBlockStatus(block.id, 'running', actionIndex, null);

                    // Execute the action
                    await this.executeAction(action);

                    // Small delay between actions
                    await new Promise(resolve => setTimeout(resolve, 300));
                }

                // All actions completed successfully
                this.updateBlockStatus(block.id, 'success', block.actions.length, null);
                console.log(`Block "${block.scenarioName}" completed successfully`);

            } catch (error) {
                // Action failed
                console.error(`Block "${block.scenarioName}" failed:`, error);
                this.updateBlockStatus(block.id, 'failed', block.executedActions, error.message);

                // Ask user if they want to continue or stop
                const shouldContinue = confirm(
                    `시나리오 "${block.scenarioName}"에서 오류가 발생했습니다.\n\n` +
                    `오류: ${error.message}\n\n` +
                    `다음 시나리오를 계속 실행하시겠습니까?`
                );

                if (!shouldContinue) {
                    console.log('User canceled execution');
                    break;
                }
            }

            // Delay between blocks
            if (i < this.scenarioBlocks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log('All scenario blocks execution finished');
    }

    async runSingleScenario(key) {
        console.log('Running single scenario:', key);

        // Load scenario data from localStorage
        const scenarioData = this.loadScenarioFromRegistry(key);
        if (!scenarioData) {
            alert('시나리오를 찾을 수 없습니다.');
            return;
        }

        // Keep the scenario list visible - do not close modal or switch views
        // Just load the scenario data internally for execution
        this.actions = scenarioData.actions || [];
        this.macroName = scenarioData.name || 'Unnamed';

        this.addLog('info', `시나리오 실행 시작: ${this.macroName} (${this.actions.length}개 액션)`);

        // Run the scenario with the key for progress tracking
        await this.runMacro(key);
    }

    // ==================== Scenario Block Management Methods ====================

    // Create a new scenario block from scenario key
    createScenarioBlock(scenarioKey, scenarioName, actions = []) {
        const blockId = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const block = {
            id: blockId,
            scenarioKey: scenarioKey,
            scenarioName: scenarioName,
            expanded: false,
            actions: JSON.parse(JSON.stringify(actions)), // Deep copy
            status: 'pending', // pending, running, success, failed
            executionResult: null,
            errorMessage: null,
            executedActions: 0,
            totalActions: actions.length
        };

        return block;
    }

    // Add scenario blocks from selected scenarios
    addScenarioBlocks(scenarioKeys) {
        const registry = JSON.parse(localStorage.getItem('scenario_registry') || '{}');

        scenarioKeys.forEach(key => {
            const scenarioData = registry[key];
            if (!scenarioData) {
                console.warn(`Scenario not found: ${key}`);
                return;
            }

            // Load scenario actions from file
            const actions = scenarioData.actions || [];
            const scenarioName = scenarioData.name || key;

            // Create and add block
            const block = this.createScenarioBlock(key, scenarioName, actions);
            this.scenarioBlocks.push(block);
        });

        // Render the blocks
        this.renderScenarioBlocks();
    }

    // Remove scenario block by ID
    removeScenarioBlock(blockId) {
        const index = this.scenarioBlocks.findIndex(b => b.id === blockId);
        if (index !== -1) {
            this.scenarioBlocks.splice(index, 1);
            this.renderScenarioBlocks();
        }
    }

    // Toggle block expansion (accordion behavior - only one expanded at a time)
    toggleBlockExpansion(blockId) {
        const block = this.scenarioBlocks.find(b => b.id === blockId);
        if (!block) return;

        if (this.expandedBlockId === blockId) {
            // Collapse currently expanded block
            block.expanded = false;
            this.expandedBlockId = null;
        } else {
            // Collapse all others and expand this one
            this.scenarioBlocks.forEach(b => b.expanded = false);
            block.expanded = true;
            this.expandedBlockId = blockId;
        }

        this.renderScenarioBlocks();
    }

    // Move block up/down (for reordering)
    moveScenarioBlock(blockId, direction) {
        const index = this.scenarioBlocks.findIndex(b => b.id === blockId);
        if (index === -1) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= this.scenarioBlocks.length) return;

        // Swap blocks
        [this.scenarioBlocks[index], this.scenarioBlocks[newIndex]] =
        [this.scenarioBlocks[newIndex], this.scenarioBlocks[index]];

        this.renderScenarioBlocks();
    }

    // Update block status during execution
    updateBlockStatus(blockId, status, executedActions = 0, errorMessage = null) {
        const block = this.scenarioBlocks.find(b => b.id === blockId);
        if (!block) return;

        block.status = status;
        block.executedActions = executedActions;
        block.errorMessage = errorMessage;

        // Update just this block's visual state without full re-render
        this.updateBlockVisual(blockId);
    }

    // Update block visual state (for real-time execution feedback)
    updateBlockVisual(blockId) {
        const block = this.scenarioBlocks.find(b => b.id === blockId);
        if (!block) return;

        const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
        if (!blockElement) return;

        // Update status icon and color
        const statusIcon = blockElement.querySelector('.block-status-icon');
        const statusText = blockElement.querySelector('.block-status-text');

        if (statusIcon && statusText) {
            const { icon, text, color } = this.getBlockStatusDisplay(block);
            statusIcon.innerHTML = icon;
            statusIcon.className = `block-status-icon ${color}`;
            statusText.textContent = text;
        }
    }

    // Get status icon and color for display
    getBlockStatusDisplay(block) {
        const displays = {
            'pending': {
                icon: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2"/></svg>',
                text: '대기',
                color: 'text-slate-400'
            },
            'running': {
                icon: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
                text: `실행 중 (${block.executedActions}/${block.totalActions})`,
                color: 'text-blue-500 animate-pulse'
            },
            'success': {
                icon: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
                text: '성공',
                color: 'text-green-500'
            },
            'failed': {
                icon: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
                text: '실패',
                color: 'text-red-500'
            }
        };

        return displays[block.status] || displays['pending'];
    }

    // Render scenario blocks in the main panel
    renderScenarioBlocks() {
        const container = document.getElementById('action-sequence-list');
        if (!container) return;

        // Update button visibility based on blocks
        const runAllBtn = document.getElementById('btn-run-all-blocks');
        if (runAllBtn) {
            runAllBtn.style.display = this.scenarioBlocks.length > 0 ? 'flex' : 'none';
        }

        // If no blocks, show empty state
        if (this.scenarioBlocks.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="display: flex;">
                    <svg class="empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                    </svg>
                    <p class="empty-title">시나리오 블록이 없습니다</p>
                    <p class="empty-description">"목록 보기"에서 시나리오를 선택하여 추가하세요</p>
                </div>
            `;
            return;
        }

        // Render blocks
        const blocksHTML = this.scenarioBlocks.map(block => this.renderScenarioBlock(block)).join('');
        container.innerHTML = blocksHTML;

        // Attach event listeners
        this.attachBlockEventListeners();
    }

    // Render a single scenario block
    renderScenarioBlock(block) {
        const { icon, text, color } = this.getBlockStatusDisplay(block);
        const expandIcon = block.expanded ? '▼' : '▶';
        const actionsHTML = block.expanded ? this.renderBlockActions(block) : '';

        return `
            <div class="scenario-block"
                 data-block-id="${block.id}"
                 draggable="true"
                 ondragstart="window.macroApp.handleDragStart(event)"
                 ondragover="window.macroApp.handleDragOver(event)"
                 ondrop="window.macroApp.handleDrop(event)"
                 ondragend="window.macroApp.handleDragEnd(event)"
                 ondragenter="window.macroApp.handleDragEnter(event)"
                 ondragleave="window.macroApp.handleDragLeave(event)">
                <div class="scenario-block-header" onclick="window.macroApp.toggleBlockExpansion('${block.id}')">
                    <span class="block-drag-handle" title="드래그하여 순서 변경">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 16px; height: 16px;">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/>
                        </svg>
                    </span>
                    <span class="block-expand-icon">${expandIcon}</span>
                    <div class="block-status-icon ${color}">
                        ${icon}
                    </div>
                    <span class="block-name">${block.scenarioName}</span>
                    <span class="block-status-text ${color}">${text}</span>
                    <div class="block-actions">
                        <button class="btn-icon-sm" onclick="event.stopPropagation(); window.macroApp.moveScenarioBlock('${block.id}', 'up')" title="위로 이동">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
                            </svg>
                        </button>
                        <button class="btn-icon-sm" onclick="event.stopPropagation(); window.macroApp.moveScenarioBlock('${block.id}', 'down')" title="아래로 이동">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                            </svg>
                        </button>
                        <button class="btn-icon-sm btn-danger" onclick="event.stopPropagation(); window.macroApp.removeScenarioBlock('${block.id}')" title="삭제">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                </div>
                ${actionsHTML}
            </div>
        `;
    }

    // Render actions within an expanded block
    renderBlockActions(block) {
        if (!block.actions || block.actions.length === 0) {
            return `
                <div class="scenario-block-content">
                    <div class="block-empty-actions">
                        <p>이 시나리오에는 액션이 없습니다</p>
                    </div>
                </div>
            `;
        }

        const actionsHTML = block.actions.map((action, index) => {
            const statusIcon = this.getActionStatusIcon(action, index, block);
            return `
                <div class="block-action-item" data-action-index="${index}">
                    <span class="action-status-icon">${statusIcon}</span>
                    <span class="action-type-badge">${action.type}</span>
                    <span class="action-label">${action.label || `액션 ${index + 1}`}</span>
                </div>
            `;
        }).join('');

        return `
            <div class="scenario-block-content">
                ${actionsHTML}
            </div>
        `;
    }

    // Get action status icon based on block execution state
    getActionStatusIcon(action, index, block) {
        if (block.status === 'pending') {
            return '<svg style="width: 16px; height: 16px;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2"/></svg>';
        } else if (block.status === 'running') {
            if (index < block.executedActions) {
                return '<svg style="width: 16px; height: 16px; color: #16a34a;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
            } else if (index === block.executedActions) {
                return '<svg style="width: 16px; height: 16px; color: #2563eb;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>';
            }
            return '<svg style="width: 16px; height: 16px;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2"/></svg>';
        } else if (block.status === 'success') {
            return '<svg style="width: 16px; height: 16px; color: #16a34a;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
        } else if (block.status === 'failed') {
            if (index < block.executedActions) {
                return '<svg style="width: 16px; height: 16px; color: #16a34a;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
            } else if (index === block.executedActions) {
                return '<svg style="width: 16px; height: 16px; color: #dc2626;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
            }
            return '<svg style="width: 16px; height: 16px; color: #94a3b8;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2"/></svg>';
        }
        return '<svg style="width: 16px; height: 16px;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2"/></svg>';
    }

    // Attach event listeners to block elements
    attachBlockEventListeners() {
        // Event listeners are handled inline via onclick for simplicity
        // Could be improved with proper event delegation
    }

    // ==================== Drag and Drop Event Handlers ====================

    handleDragStart(event) {
        const blockElement = event.target.closest('.scenario-block');
        if (!blockElement) return;

        const blockId = blockElement.dataset.blockId;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', blockId);

        // Add visual feedback
        blockElement.classList.add('dragging');

        console.log('Drag started:', blockId);
    }

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';

        const blockElement = event.target.closest('.scenario-block');
        if (!blockElement) return;

        // Don't show drop indicator on the dragged element itself
        if (blockElement.classList.contains('dragging')) return;

        // Show drop indicator
        const rect = blockElement.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const isAfter = event.clientY > midpoint;

        blockElement.classList.remove('drop-before', 'drop-after');
        blockElement.classList.add(isAfter ? 'drop-after' : 'drop-before');
    }

    handleDragEnter(event) {
        event.preventDefault();
        const blockElement = event.target.closest('.scenario-block');
        if (!blockElement || blockElement.classList.contains('dragging')) return;
    }

    handleDragLeave(event) {
        const blockElement = event.target.closest('.scenario-block');
        if (!blockElement) return;

        // Only remove drop indicator if leaving the block entirely
        const rect = blockElement.getBoundingClientRect();
        if (
            event.clientX < rect.left ||
            event.clientX >= rect.right ||
            event.clientY < rect.top ||
            event.clientY >= rect.bottom
        ) {
            blockElement.classList.remove('drop-before', 'drop-after');
        }
    }

    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();

        const draggedBlockId = event.dataTransfer.getData('text/plain');
        const targetBlockElement = event.target.closest('.scenario-block');

        if (!targetBlockElement || !draggedBlockId) return;

        const targetBlockId = targetBlockElement.dataset.blockId;

        // Don't drop on itself
        if (draggedBlockId === targetBlockId) return;

        // Determine if dropping before or after
        const rect = targetBlockElement.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const isAfter = event.clientY > midpoint;

        // Find indices
        const draggedIndex = this.scenarioBlocks.findIndex(b => b.id === draggedBlockId);
        const targetIndex = this.scenarioBlocks.findIndex(b => b.id === targetBlockId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        // Find dragged block and its pair if exists
        const draggedBlock = this.scenarioBlocks[draggedIndex];
        let blocksToMove = [draggedBlock];
        let pairBlock = null;

        if (draggedBlock.pairId) {
            pairBlock = this.scenarioBlocks.find(b =>
                b.pairId === draggedBlock.pairId && b.id !== draggedBlock.id
            );
            if (pairBlock) {
                blocksToMove.push(pairBlock);
            }
        }

        // Find the range of blocks to move (from start to end, including everything in between)
        const startIndex = Math.min(...blocksToMove.map(b => this.scenarioBlocks.findIndex(sb => sb.id === b.id)));
        const endIndex = Math.max(...blocksToMove.map(b => this.scenarioBlocks.findIndex(sb => sb.id === b.id)));

        // Extract ALL blocks in the range (including any actions between pair blocks)
        const movingBlocks = this.scenarioBlocks.slice(startIndex, endIndex + 1);
        const blockCount = endIndex - startIndex + 1;

        // Remove all blocks in the range from current position
        this.scenarioBlocks.splice(startIndex, blockCount);

        // Recalculate target index after removal
        let insertIndex = this.scenarioBlocks.findIndex(b => b.id === targetBlockId);
        if (insertIndex === -1) return;

        if (isAfter) {
            insertIndex++;
        }

        // Insert all blocks at new position (maintaining their order)
        this.scenarioBlocks.splice(insertIndex, 0, ...movingBlocks);

        console.log(`Reordered: moved ${blockCount} block(s) (entire range) to position ${insertIndex}`);

        // Re-render
        this.renderScenarioBlocks();
    }

    handleDragEnd(event) {
        // Clean up all visual feedback
        const allBlocks = document.querySelectorAll('.scenario-block');
        allBlocks.forEach(block => {
            block.classList.remove('dragging', 'drop-before', 'drop-after');
        });

        console.log('Drag ended');
    }

    // ========================================
    // HELPER FUNCTIONS - Multi-scenario File Support
    // ========================================

    /**
     * Sanitize scenario name to create filesystem-safe filename
     * Korean/special characters -> transliteration/removal
     */
    sanitizeFilename(scenarioName) {
        // Remove or replace special characters
        let filename = scenarioName
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Replace illegal chars
            .replace(/\s+/g, '_') // Replace spaces with underscore
            .trim();

        // Limit length to 100 characters
        if (filename.length > 100) {
            filename = filename.substring(0, 100);
        }

        return filename || 'untitled';
    }

    /**
     * Generate unique scenario ID within a file
     * Format: scenario_<timestamp>_<random>
     */
    generateScenarioId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `scenario_${timestamp}_${random}`;
    }

    /**
     * Generate unique file path
     * Format: <sanitized_name>.json or <sanitized_name>_<number>.json if duplicate exists
     */
    generateFilePath(scenarioName) {
        // Use the same logic as generateUniqueFilename to ensure consistency
        return this.generateUniqueFilename(scenarioName);
    }

    /**
     * Migrate existing scenarios to new multi-scenario file structure
     * Old structure: scenario_registry[key] = { name, actions, timestamp }
     * New structure:
     *   - scenario_data[filePath] = { name, scenarios: [{ id, name, actions }] }
     *   - scenario_registry[filePath] = { name, timestamp, scenarioCount }
     *   - scenario_index[scenarioId] = { filePath, scenarioId }
     */
    migrateExistingScenarios() {
        console.log('[Migration] Starting scenario migration...');

        try {
            // Load existing scenario_registry
            const oldRegistryRaw = localStorage.getItem('scenario_registry');
            if (!oldRegistryRaw) {
                console.log('[Migration] No existing scenarios found');
                return;
            }

            const oldRegistry = JSON.parse(oldRegistryRaw);
            const oldKeys = Object.keys(oldRegistry);

            if (oldKeys.length === 0) {
                console.log('[Migration] No scenarios to migrate');
                return;
            }

            console.log(`[Migration] Found ${oldKeys.length} scenarios to migrate`);

            // Initialize new storage structures
            const newScenarioData = {};
            const newRegistry = {};
            const newIndex = {};

            // Migrate each old scenario
            for (const oldKey of oldKeys) {
                const oldScenario = oldRegistry[oldKey];

                // Load full scenario data from scenario_data
                const oldDataRaw = localStorage.getItem('scenario_data');
                const oldData = oldDataRaw ? JSON.parse(oldDataRaw) : {};
                const scenarioActions = oldData[oldKey]?.actions || oldScenario.actions || [];

                // Generate new identifiers
                const scenarioName = oldScenario.name || oldKey;
                const filePath = this.generateFilePath(scenarioName);
                const scenarioId = this.generateScenarioId();

                // Create new file structure
                newScenarioData[filePath] = {
                    name: scenarioName,
                    scenarios: [{
                        id: scenarioId,
                        name: scenarioName,
                        actions: scenarioActions
                    }]
                };

                // Create registry entry
                newRegistry[filePath] = {
                    name: scenarioName,
                    filename: filePath, // Add filename for display
                    timestamp: oldScenario.timestamp || Date.now(),
                    scenarioCount: 1
                };

                // Create index entry
                newIndex[scenarioId] = {
                    filePath: filePath,
                    scenarioId: scenarioId
                };

                console.log(`[Migration] Migrated: ${oldKey} -> ${filePath} (${scenarioId})`);
            }

            // Backup old data
            localStorage.setItem('scenario_registry_backup', oldRegistryRaw);
            localStorage.setItem('scenario_data_backup', localStorage.getItem('scenario_data') || '{}');
            console.log('[Migration] Backed up old data');

            // Save new structures
            localStorage.setItem('scenario_data', JSON.stringify(newScenarioData));
            localStorage.setItem('scenario_registry', JSON.stringify(newRegistry));
            localStorage.setItem('scenario_index', JSON.stringify(newIndex));

            console.log('[Migration] Migration completed successfully');
            console.log(`[Migration] Migrated ${oldKeys.length} scenarios into ${Object.keys(newScenarioData).length} files`);

        } catch (error) {
            console.error('[Migration] Migration failed:', error);
            alert('시나리오 마이그레이션 중 오류가 발생했습니다. 콘솔을 확인하세요.');
        }
    }

    /**
     * Save scenario by scenarioId
     * Updates the scenario within its file
     * @param {string} scenarioId - The unique scenario ID
     */
    saveToRegistry(scenarioId) {
        console.log('[saveToRegistry] Saving scenario:', scenarioId);

        if (!scenarioId || !this.currentFilePath) {
            console.error('[saveToRegistry] Missing scenarioId or filePath');
            return false;
        }

        try {
            // Load current file data
            const scenarioData = JSON.parse(localStorage.getItem('scenario_data') || '{}');
            const fileData = scenarioData[this.currentFilePath];

            if (!fileData) {
                console.error('[saveToRegistry] File not found:', this.currentFilePath);
                return false;
            }

            // Find and update the scenario
            const scenarioIndex = fileData.scenarios.findIndex(s => s.id === scenarioId);

            if (scenarioIndex === -1) {
                console.error('[saveToRegistry] Scenario not found in file:', scenarioId);
                return false;
            }

            // Update scenario data
            fileData.scenarios[scenarioIndex] = {
                id: scenarioId,
                name: this.macroName || 'Untitled',
                actions: this.actions,
                description: this.macroDescription || ''
            };

            // Save back to localStorage
            localStorage.setItem('scenario_data', JSON.stringify(scenarioData));

            // Update registry timestamp, filename, and action count
            const registry = JSON.parse(localStorage.getItem('scenario_registry') || '{}');
            if (registry[this.currentFilePath]) {
                registry[this.currentFilePath].timestamp = Date.now();
                registry[this.currentFilePath].filename = this.currentFilePath; // Ensure filename is set
                // Count only meaningful actions (exclude structural markers like else, endif)
                const meaningfulActionsCount = this.actions.filter(action =>
                    action.type !== 'else' && action.type !== 'endif'
                ).length;
                registry[this.currentFilePath].actionsCount = meaningfulActionsCount;
                localStorage.setItem('scenario_registry', JSON.stringify(registry));
            }

            console.log('[saveToRegistry] Scenario saved successfully');
            this.markAsSaved();
            return true;

        } catch (error) {
            console.error('[saveToRegistry] Failed to save scenario:', error);
            return false;
        }
    }

    /**
     * Select audio file for sound-check action
     */
    async selectAudioFile(actionId) {
        try {
            const result = await api.file.showOpenDialog({
                title: 'Select Audio File',
                filters: [
                    { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac'] },
                    { name: 'All Files', extensions: ['*'] }
                ],
                properties: ['openFile']
            });

            if (!result.canceled && result.filePaths.length > 0) {
                const filePath = result.filePaths[0];
                const action = this.actions.find(a => a.id === actionId);

                if (action) {
                    action.audioFile = filePath;
                    this.renderActionSettings(action);
                    this.saveMacro();
                }
            }
        } catch (error) {
            console.error('[selectAudioFile] Failed to select audio file:', error);
            this.addLog('error', `Failed to select audio file: ${error.message}`);
        }
    }

    /**
     * Remove audio file from sound-check action
     */
    removeAudioFile(actionId) {
        const action = this.actions.find(a => a.id === actionId);

        if (action) {
            delete action.audioFile;
            this.renderActionSettings(action);
            this.saveMacro();
        }
    }

    /**
     * Handle drop on condition-capable blocks (image-match, get-volume, etc.)
     * Adds dropped action to thenActions or elseActions
     */
    handleSimpleConditionDrop(event, parentActionId, branch) {
        const draggedActionId = event.dataTransfer.getData('actionId');
        if (!draggedActionId) return;

        const draggedAction = this.actions.find(a => a.id === draggedActionId);
        if (!draggedAction) return;

        const parentAction = this.actions.find(a => a.id === parentActionId);
        if (!parentAction) return;

        // Check if parent supports nested actions (isControl or isSimpleCondition)
        const config = ActionConfigProvider.getActionConfig(parentAction.type);
        if (!config?.isControl && !config?.isSimpleCondition) return;

        // Create a copy of the action for nesting
        const nestedAction = JSON.parse(JSON.stringify(draggedAction));
        nestedAction.id = `${parentActionId}-${branch}-${Date.now()}`;

        // Add to the appropriate branch
        if (branch === 'then') {
            if (!parentAction.thenActions) parentAction.thenActions = [];
            parentAction.thenActions.push(nestedAction);
        } else if (branch === 'else') {
            if (!parentAction.elseActions) parentAction.elseActions = [];
            parentAction.elseActions.push(nestedAction);
        }

        // Re-render and save
        this.renderActionSettings(parentAction);
        this.saveMacro();

        console.log(`[handleSimpleConditionDrop] Added action to ${branch} branch of ${parentActionId}`);
    }

    /**
     * Remove action from simple condition block's thenActions or elseActions
     */
    removeSimpleConditionAction(parentActionId, branch, index) {
        const parentAction = this.actions.find(a => a.id === parentActionId);
        if (!parentAction) return;

        if (branch === 'then' && parentAction.thenActions) {
            parentAction.thenActions.splice(index, 1);
        } else if (branch === 'else' && parentAction.elseActions) {
            parentAction.elseActions.splice(index, 1);
        }

        // Re-render and save
        this.renderActionSettings(parentAction);
        this.saveMacro();

        console.log(`[removeSimpleConditionAction] Removed action at index ${index} from ${branch} branch`);
    }

    /**
     * Add filename field to existing registry entries
     * This is a one-time migration to fix undefined filenames
     */
    addFilenameToRegistry() {
        try {
            const registry = JSON.parse(localStorage.getItem('scenario_registry') || '{}');
            let updated = false;

            for (const [filePath, data] of Object.entries(registry)) {
                if (!data.filename) {
                    data.filename = filePath;
                    updated = true;
                    console.log('[addFilenameToRegistry] Added filename to:', filePath);
                }
            }

            if (updated) {
                localStorage.setItem('scenario_registry', JSON.stringify(registry));
                console.log('[addFilenameToRegistry] Registry updated successfully');
            } else {
                console.log('[addFilenameToRegistry] No updates needed');
            }
        } catch (error) {
            console.error('[addFilenameToRegistry] Failed to update registry:', error);
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.macroApp = new MacroBuilderApp();
});
