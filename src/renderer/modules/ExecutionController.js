/**
 * ExecutionController - Handles macro/scenario execution
 * ES6 Module version
 */

export class ExecutionController {
    constructor(app) {
        this.app = app;

        // Execution state
        this.isRunning = false;
        this.shouldStop = false;
        this.currentActionIndex = 0;
        this.totalActions = 0;

        // Running scenarios tracking
        this.runningScenarios = new Map(); // scenarioKey -> { status, progress, cancelFn }
        this.scenarioCancelFlag = false;
    }

    // ==================== Execution Control ====================

    /**
     * Run macro/scenario
     */
    async runMacro(scenarioKey = null) {
        if (this.isRunning) {
            this.app.logger.warn('Already running');
            return;
        }

        const actions = this.app.actions;
        if (!actions || actions.length === 0) {
            this.app.logger.warn('No actions to execute');
            return;
        }

        // Reset state
        this.isRunning = true;
        this.shouldStop = false;
        this.app.scenarioResult = null;

        // Track scenario execution
        if (scenarioKey) {
            this.runningScenarios.set(scenarioKey, {
                status: 'running',
                progress: { current: 0, total: actions.length },
                cancelFn: () => this.cancelScenario(scenarioKey)
            });

            if (this.app.scenarioManager && this.app.scenarioManager.isScenarioListVisible()) {
                this.app.renderScenarioListInPanel(true);
            }
        }

        // Update UI
        this.updateRunButtonState(true);
        this.app.logger.info(`Starting execution: ${actions.length} actions`);

        try {
            await this.executeActionsRange(0, actions.length - 1, scenarioKey);

            // Execution completed
            if (!this.shouldStop) {
                this.app.scenarioResult = { status: 'pass', message: 'All actions completed' };

                if (scenarioKey) {
                    this.saveExecutionResult(scenarioKey, 'pass', 'Completed successfully');
                }

                this.app.logger.success('Execution completed');
            } else {
                this.app.scenarioResult = { status: 'stopped', message: 'Stopped by user' };

                if (scenarioKey) {
                    this.saveExecutionResult(scenarioKey, 'stopped', 'Stopped by user');
                }

                this.app.logger.warn('Execution stopped');
            }

        } catch (error) {
            this.app.scenarioResult = { status: 'fail', message: error.message };

            if (scenarioKey) {
                this.saveExecutionResult(scenarioKey, 'fail', error.message);
            }

            this.app.logger.error(`Execution failed: ${error.message}`);

        } finally {
            this.isRunning = false;
            this.shouldStop = false;

            if (scenarioKey) {
                this.runningScenarios.delete(scenarioKey);
            }

            this.updateRunButtonState(false);
            this.app.renderActionSequence();
        }
    }

    /**
     * Stop current execution
     */
    stopMacro() {
        if (this.isRunning) {
            this.shouldStop = true;
            this.app.logger.info('Stopping execution...');
        }
    }

    /**
     * Cancel specific scenario
     */
    cancelScenario(scenarioKey) {
        this.scenarioCancelFlag = true;

        if (this.runningScenarios.has(scenarioKey)) {
            this.runningScenarios.delete(scenarioKey);
            this.saveExecutionResult(scenarioKey, 'stopped', 'Cancelled by user');

            if (this.app.scenarioManager && this.app.scenarioManager.isScenarioListVisible()) {
                this.app.renderScenarioListInPanel(true);
            }
        }
    }

    // ==================== Execution Logic ====================

    /**
     * Execute actions in range
     */
    async executeActionsRange(startIndex, endIndex, scenarioKey = null) {
        const actions = this.app.actions;

        for (let i = startIndex; i <= endIndex && i < actions.length; i++) {
            if (this.shouldStop || this.scenarioCancelFlag) {
                throw new Error('Execution cancelled');
            }

            const action = actions[i];
            this.currentActionIndex = i;
            this.totalActions = actions.length;

            // Update progress
            if (scenarioKey) {
                const runningState = this.runningScenarios.get(scenarioKey);
                if (runningState) {
                    runningState.progress = { current: i + 1, total: actions.length };

                    if (this.app.scenarioManager && this.app.scenarioManager.isScenarioListVisible()) {
                        this.app.renderScenarioListInPanel(true);
                    }
                }
            }

            // Update UI to show current action
            if (!this.app.scenarioManager || !this.app.scenarioManager.isScenarioListVisible()) {
                this.highlightCurrentAction(action.id);
            }

            try {
                // Check if action has conditions
                if (action.conditions && action.conditions.length > 0) {
                    const conditionResult = await this.evaluateConditions(action.conditions);

                    if (!conditionResult.passed) {
                        this.app.logger.info(`Skipping action ${i + 1}: conditions not met`);
                        continue;
                    }
                }

                // Execute action
                await this.executeAction(action);

            } catch (error) {
                // Handle action error
                this.app.logger.error(`Action ${i + 1} failed: ${error.message}`);

                // Check error handling strategy
                if (action.onError === 'stop') {
                    throw error;
                } else if (action.onError === 'skip') {
                    continue;
                }
                // Default: continue
            }

            // Handle paired actions (loops)
            if (action.type === 'loop-start' && action.pairId) {
                const loopEndIndex = actions.findIndex(a => a.pairId === action.pairId && a.type === 'loop-end');
                if (loopEndIndex > i) {
                    const loopCount = action.count || 1;
                    for (let loop = 0; loop < loopCount - 1; loop++) {
                        if (this.shouldStop) break;
                        await this.executeActionsRange(i + 1, loopEndIndex - 1, scenarioKey);
                    }
                    i = loopEndIndex;
                }
            }
        }
    }

    /**
     * Execute single action
     */
    async executeAction(action) {
        this.app.logger.info(`Executing: ${action.type}`);

        const actionService = this.app.controller.getService('actionService');

        switch (action.type) {
            case 'click':
            case 'tap':
                await actionService.tap(action.x, action.y);
                break;

            case 'long-press':
                await actionService.longPress(action.x, action.y, action.duration || 1000);
                break;

            case 'drag':
            case 'swipe':
                await actionService.swipe(
                    action.startX || action.x,
                    action.startY || action.y,
                    action.endX,
                    action.endY,
                    action.duration || 300
                );
                break;

            case 'input-text':
                await actionService.inputText(action.text);
                break;

            case 'key-event':
                await actionService.keyEvent(action.keyCode);
                break;

            case 'wait':
                await this.wait(action.duration || 1000);
                break;

            case 'image-match':
                await this.executeImageMatchAction(action);
                break;

            case 'tap-matched-image':
                await this.executeTapMatchedImage(action);
                break;

            case 'sound-check':
                await this.executeSoundCheckAction(action);
                break;

            case 'get-volume':
                await this.executeGetVolumeAction(action);
                break;

            case 'set-volume':
                await actionService.setVolume(action.volumeType, action.volume);
                break;

            case 'shell':
                await actionService.shell(action.command);
                break;

            case 'loop-start':
            case 'loop-end':
            case 'if-start':
            case 'if-end':
                // Control flow - handled by executeActionsRange
                break;

            default:
                this.app.logger.warn(`Unknown action type: ${action.type}`);
        }
    }

    /**
     * Execute image match action
     */
    async executeImageMatchAction(action) {
        if (!action.region || !action.imageData) {
            throw new Error('Image match action missing region or image data');
        }

        const imageMatcher = window.imageMatcher || this.app.controller.getService('imageMatcher');
        if (!imageMatcher) {
            throw new Error('Image matcher not available');
        }

        // Capture current screen
        const screenResult = await window.api.screen.capture();
        if (!screenResult.success) {
            throw new Error('Failed to capture screen');
        }

        // Perform matching
        const matchResult = await imageMatcher.findMatch(
            screenResult.data,
            action.imageData,
            action.region,
            action.threshold || { min: 40, max: 80 }
        );

        if (matchResult.found) {
            this.app.lastMatchedCoordinate = matchResult.center;
            this.app.logger.success(`Image matched at (${matchResult.center.x}, ${matchResult.center.y})`);
        } else {
            this.app.lastMatchedCoordinate = null;

            if (action.expectation === 'present') {
                throw new Error('Image not found');
            }
        }

        return matchResult;
    }

    /**
     * Execute tap on matched image
     */
    async executeTapMatchedImage(action) {
        if (!this.app.lastMatchedCoordinate) {
            throw new Error('No matched image coordinate available');
        }

        const { x, y } = this.app.lastMatchedCoordinate;
        const actionService = this.app.controller.getService('actionService');
        await actionService.tap(x, y);

        this.app.logger.success(`Tapped matched image at (${x}, ${y})`);
    }

    /**
     * Execute sound check action
     */
    async executeSoundCheckAction(action) {
        // Implementation depends on audio service
        const threshold = action.threshold || 50;
        const duration = action.duration || 3000;

        this.app.logger.info(`Checking sound (threshold: ${threshold}, duration: ${duration}ms)`);

        // Simplified implementation
        await this.wait(duration);

        return { detected: true };
    }

    /**
     * Execute get volume action
     */
    async executeGetVolumeAction(action) {
        const actionService = this.app.controller.getService('actionService');
        const volume = await actionService.getVolume(action.volumeType || 'media');
        this.app.logger.info(`Current volume: ${volume}`);
        return volume;
    }

    // ==================== Condition Evaluation ====================

    /**
     * Evaluate conditions for an action
     */
    async evaluateConditions(conditions) {
        if (!conditions || conditions.length === 0) {
            return { passed: true };
        }

        for (const condition of conditions) {
            const result = await this.evaluateCondition(condition);
            if (!result.passed) {
                return result;
            }
        }

        return { passed: true };
    }

    /**
     * Evaluate single condition
     */
    async evaluateCondition(condition) {
        switch (condition.actionType) {
            case 'image-match':
                return await this.evaluateImageMatchCondition(condition);

            case 'wait':
                await this.wait(condition.params?.duration || 1000);
                return { passed: true };

            case 'get-volume':
                return await this.evaluateVolumeCondition(condition);

            default:
                return { passed: true };
        }
    }

    /**
     * Evaluate image match condition
     */
    async evaluateImageMatchCondition(condition) {
        const params = condition.params || {};

        if (!params.region || !params.imageData) {
            return { passed: false, reason: 'Missing image data' };
        }

        try {
            const imageMatcher = window.imageMatcher || this.app.controller.getService('imageMatcher');
            if (!imageMatcher) {
                return { passed: false, reason: 'Image matcher not available' };
            }

            const screenResult = await window.api.screen.capture();
            if (!screenResult.success) {
                return { passed: false, reason: 'Failed to capture screen' };
            }

            const matchResult = await imageMatcher.findMatch(
                screenResult.data,
                params.imageData,
                params.region,
                params.threshold || { min: 40, max: 80 }
            );

            if (matchResult.found) {
                this.app.lastMatchedCoordinate = matchResult.center;
            }

            const expectation = params.expectation || 'present';
            const passed = expectation === 'present' ? matchResult.found : !matchResult.found;

            return { passed, matchResult };

        } catch (error) {
            return { passed: false, reason: error.message };
        }
    }

    /**
     * Evaluate volume condition
     */
    async evaluateVolumeCondition(condition) {
        const params = condition.params || {};
        const actionService = this.app.controller.getService('actionService');

        try {
            const volume = await actionService.getVolume(params.volumeType || 'media');
            const targetVolume = params.targetVolume || 50;
            const comparison = params.comparison || 'equals';

            let passed = false;
            switch (comparison) {
                case 'equals':
                    passed = volume === targetVolume;
                    break;
                case 'greater':
                    passed = volume > targetVolume;
                    break;
                case 'less':
                    passed = volume < targetVolume;
                    break;
            }

            return { passed, volume };

        } catch (error) {
            return { passed: false, reason: error.message };
        }
    }

    // ==================== Helpers ====================

    /**
     * Wait for specified duration
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Highlight current action in UI
     */
    highlightCurrentAction(actionId) {
        // Remove previous highlight
        document.querySelectorAll('.action-block.executing').forEach(el => {
            el.classList.remove('executing');
        });

        // Add highlight to current action
        const actionElement = document.querySelector(`[data-action-id="${actionId}"]`);
        if (actionElement) {
            actionElement.classList.add('executing');
            actionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    /**
     * Update run button state
     */
    updateRunButtonState(isRunning) {
        const runBtn = document.getElementById('btn-run');
        if (runBtn) {
            if (isRunning) {
                runBtn.innerHTML = '<span class="spinner"></span> Running...';
                runBtn.classList.add('running');
            } else {
                runBtn.innerHTML = 'Run';
                runBtn.classList.remove('running');
            }
        }
    }

    /**
     * Save execution result
     */
    saveExecutionResult(scenarioKey, status, message) {
        const results = JSON.parse(localStorage.getItem('scenario_execution_results') || '{}');
        results[scenarioKey] = {
            status,
            message,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('scenario_execution_results', JSON.stringify(results));
    }

    /**
     * Run multiple scenarios in sequence
     */
    async runSelectedScenarios(scenarioKeys) {
        if (!scenarioKeys || scenarioKeys.length === 0) {
            this.app.logger.warn('No scenarios selected');
            return;
        }

        this.app.logger.info(`Running ${scenarioKeys.length} scenarios...`);

        for (const key of scenarioKeys) {
            if (this.shouldStop) break;

            try {
                await this.runSingleScenario(key);
            } catch (error) {
                this.app.logger.error(`Scenario ${key} failed: ${error.message}`);
            }
        }

        this.app.logger.info('All selected scenarios completed');
    }

    /**
     * Run single scenario by key
     */
    async runSingleScenario(scenarioKey) {
        // Load scenario
        const scenarioManager = this.app.scenarioManager;
        if (!scenarioManager) {
            throw new Error('ScenarioManager not available');
        }

        const scenarioData = scenarioManager.loadScenarioFromRegistry(scenarioKey);
        if (!scenarioData) {
            throw new Error(`Scenario not found: ${scenarioKey}`);
        }

        // Temporarily set actions
        const originalActions = this.app.actions;
        this.app.actions = scenarioData.actions || [];

        try {
            await this.runMacro(scenarioKey);
        } finally {
            this.app.actions = originalActions;
        }
    }

    /**
     * Get execution progress
     */
    getProgress(scenarioKey = null) {
        if (scenarioKey && this.runningScenarios.has(scenarioKey)) {
            return this.runningScenarios.get(scenarioKey).progress;
        }

        return {
            current: this.currentActionIndex,
            total: this.totalActions,
            isRunning: this.isRunning
        };
    }
}

export default ExecutionController;
