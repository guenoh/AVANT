/**
 * MacroExecutor
 * Handles macro execution flow with control structures (if/while/loop)
 *
 * New flat condition block structure:
 * [condition-starter] (image-match, get-volume, if, etc.)
 *   [action1]         <- executed if condition is true
 *   [action2]
 * [else]              <- optional else block
 *   [action3]         <- executed if condition is false
 * [endif]             <- required end marker
 */

class MacroExecutor {
    constructor(actionService, eventBus, options = {}) {
        this.actionService = actionService;
        this.eventBus = eventBus;
        this.options = options;

        this.isRunning = false;
        this.shouldStop = false;
        this.currentActionIndex = -1;

        // Stack to track condition block state during execution
        // Each entry: { conditionMet: boolean, startIndex: number }
        this.conditionStack = [];
    }

    /**
     * Execute a sequence of actions
     */
    async execute(actions, context = {}) {
        if (this.isRunning) {
            throw new Error('Executor is already running');
        }

        this.isRunning = true;
        this.shouldStop = false;
        this.currentActionIndex = -1;
        this.conditionStack = []; // Reset condition stack

        this.eventBus.emit('execution:start', {
            totalActions: actions.length,
            timestamp: Date.now()
        });

        const result = {
            success: true,
            completedActions: 0,
            failedActions: 0,
            skippedActions: 0,
            startTime: Date.now(),
            endTime: null,
            logs: []
        };

        try {
            await this._executeRange(actions, 0, actions.length, context, result);

            result.success = result.failedActions === 0;
            result.endTime = Date.now();
            result.duration = result.endTime - result.startTime;

            this.eventBus.emit('execution:complete', result);

            return result;
        } catch (error) {
            result.success = false;
            result.error = error.message;
            result.endTime = Date.now();
            result.duration = result.endTime - result.startTime;

            this.eventBus.emit('execution:error', { error, result });

            throw error;
        } finally {
            this.isRunning = false;
            this.currentActionIndex = -1;
        }
    }

    /**
     * Stop execution
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        this.shouldStop = true;
        this.eventBus.emit('execution:stop-requested', {
            currentActionIndex: this.currentActionIndex
        });
    }

    /**
     * Execute a range of actions with flat condition block handling
     * Handles condition starters (if, image-match, get-volume), else, and endif
     */
    async _executeRange(actions, start, end, context, result) {
        for (let i = start; i < end; i++) {
            if (this.shouldStop) {
                this.eventBus.emit('execution:stopped', {
                    index: i,
                    completedActions: result.completedActions
                });
                break;
            }

            this.currentActionIndex = i;
            const action = actions[i];

            this.eventBus.emit('execution:action-start', {
                index: i,
                action,
                progress: ((i + 1) / actions.length * 100).toFixed(1)
            });

            try {
                // Handle else block - skip to endif if condition was true
                if (action.type === 'else') {
                    const currentCondition = this.conditionStack[this.conditionStack.length - 1];
                    if (currentCondition && currentCondition.conditionMet) {
                        // Condition was true, skip to endif
                        const endifIndex = this._findMatchingEndif(actions, i);
                        if (endifIndex !== -1) {
                            result.skippedActions++;
                            this.eventBus.emit('execution:action-skipped', {
                                index: i,
                                action,
                                reason: 'else branch skipped (condition was true)'
                            });
                            i = endifIndex - 1; // -1 because loop will increment
                            continue;
                        }
                    }
                    // Else: condition was false, continue executing else branch
                    result.completedActions++;
                    this.eventBus.emit('execution:action-complete', {
                        index: i,
                        action,
                        result: { success: true, message: 'Entering else branch' }
                    });
                    continue;
                }

                // Handle endif block - pop condition stack
                if (action.type === 'endif') {
                    this.conditionStack.pop();
                    result.completedActions++;
                    this.eventBus.emit('execution:action-complete', {
                        index: i,
                        action,
                        result: { success: true, message: 'Condition block ended' }
                    });
                    continue;
                }

                // Execute the action
                const actionResult = await this._executeAction(action, actions, i, context, result);

                if (actionResult.skip) {
                    result.skippedActions++;
                    this.eventBus.emit('execution:action-skipped', { index: i, action });
                    continue;
                }

                // Handle condition starter results
                if (actionResult.isConditionStarter) {
                    // Push condition state to stack
                    this.conditionStack.push({
                        conditionMet: actionResult.conditionMet,
                        startIndex: i
                    });

                    // If condition is false, skip to else or endif
                    if (!actionResult.conditionMet) {
                        const elseIndex = this._findMatchingElse(actions, i);
                        const endifIndex = this._findMatchingEndif(actions, i);

                        if (elseIndex !== -1 && elseIndex < endifIndex) {
                            // Jump to else block (else will be processed, which will continue execution)
                            i = elseIndex - 1; // -1 because loop will increment
                        } else if (endifIndex !== -1) {
                            // No else block, jump to endif
                            i = endifIndex - 1; // -1 because loop will increment
                        }
                    }

                    result.completedActions++;
                    this.eventBus.emit('execution:action-complete', {
                        index: i,
                        action,
                        result: actionResult
                    });
                    continue;
                }

                if (actionResult.success) {
                    result.completedActions++;
                    this.eventBus.emit('execution:action-complete', {
                        index: i,
                        action,
                        result: actionResult
                    });
                } else {
                    result.failedActions++;
                    this.eventBus.emit('execution:action-failed', {
                        index: i,
                        action,
                        error: actionResult.error
                    });

                    // Stop on failure if configured
                    if (this.options.stopOnFailure) {
                        throw new Error(`Action ${i} failed: ${actionResult.error}`);
                    }
                }

                // Check for termination
                if (actionResult.terminateExecution) {
                    this.eventBus.emit('execution:terminated', {
                        index: i,
                        reason: actionResult.terminationReason
                    });
                    break;
                }

                // Check for jump
                if (actionResult.jumpTo !== undefined) {
                    i = actionResult.jumpTo - 1; // -1 because loop will increment
                    continue;
                }
            } catch (error) {
                result.failedActions++;
                this.eventBus.emit('execution:action-error', {
                    index: i,
                    action,
                    error: error.message
                });

                if (this.options.stopOnFailure) {
                    throw error;
                }
            }
        }
    }

    /**
     * Find the matching else block for a condition starter at given index
     * Returns -1 if no else block found before endif
     */
    _findMatchingElse(actions, startIndex) {
        let depth = 0;
        for (let i = startIndex + 1; i < actions.length; i++) {
            const action = actions[i];

            // Check if this action is a condition starter (increases depth)
            if (this._isConditionStarter(action)) {
                depth++;
            } else if (action.type === 'endif') {
                if (depth === 0) {
                    // Found our matching endif before any else
                    return -1;
                }
                depth--;
            } else if (action.type === 'else' && depth === 0) {
                // Found our matching else at the same level
                return i;
            }
        }
        return -1;
    }

    /**
     * Find the matching endif block for a condition starter at given index
     * Returns -1 if no endif found
     */
    _findMatchingEndif(actions, startIndex) {
        let depth = 0;
        for (let i = startIndex + 1; i < actions.length; i++) {
            const action = actions[i];

            // Check if this action is a condition starter (increases depth)
            if (this._isConditionStarter(action)) {
                depth++;
            } else if (action.type === 'endif') {
                if (depth === 0) {
                    // Found our matching endif
                    return i;
                }
                depth--;
            }
        }
        return -1;
    }

    /**
     * Check if an action is a condition starter (starts a condition block)
     */
    _isConditionStarter(action) {
        // Check for explicit flag or known condition starter types
        const conditionTypes = ['if', 'image-match', 'get-volume', 'sound-check'];
        return conditionTypes.includes(action.type);
    }

    /**
     * Execute a single action with control flow handling
     * @param {Object} action - The action to execute
     * @param {Array} actions - The full actions array (for finding else/endif)
     * @param {number} index - Current action index
     * @param {Object} context - Execution context
     * @param {Object} result - Execution result accumulator
     */
    async _executeAction(action, actions, index, context, result) {
        // Handle condition starter blocks (new flat structure)
        switch (action.type) {
            case 'if':
                return await this._handleIfCondition(action, context);

            case 'image-match':
                return await this._handleImageMatchCondition(action, context);

            case 'get-volume':
                return await this._handleVolumeCondition(action, context);

            case 'sound-check':
                return await this._handleSoundCheckCondition(action, context);

            case 'while':
                return await this._handleWhile(action, context, result);

            case 'loop':
                return await this._handleLoop(action, context, result);

            case 'skip':
                return { success: true, skip: true };

            case 'fail':
                return {
                    success: false,
                    terminateExecution: true,
                    terminationReason: action.message || 'Test failed'
                };

            case 'test':
                return await this._handleTest(action, context);

            default:
                // Regular action execution
                return await this._executeRegularAction(action, context);
        }
    }

    /**
     * Execute regular (non-control) action
     */
    async _executeRegularAction(action, context) {
        const { deviceId, imageMatcher, AudioCapture, coordinateService } = context;

        if (action.type === 'image-match') {
            const screenImage = await this._captureScreen(deviceId);
            return await this.actionService.executeImageMatchAction(action, screenImage, {
                deviceId,
                imageMatcher,
                coordinateService
            });
        }

        if (action.type === 'sound-check') {
            return await this.actionService.executeSoundCheckAction(action, {
                AudioCapture
            });
        }

        return await this.actionService.executeAction(action, { deviceId });
    }

    /**
     * Handle if condition starter (new flat structure)
     * Evaluates conditions and returns isConditionStarter flag
     */
    async _handleIfCondition(action, context) {
        try {
            // Evaluate all conditions with AND/OR logic
            const conditions = action.conditions || [];
            const conditionOperator = action.conditionOperator || 'AND';

            let conditionMet = conditionOperator === 'AND'; // Start with true for AND, false for OR

            for (const condition of conditions) {
                const result = await this._evaluateCondition(condition, context);

                if (conditionOperator === 'AND') {
                    conditionMet = conditionMet && result;
                    if (!conditionMet) break; // Short circuit
                } else { // OR
                    conditionMet = conditionMet || result;
                    if (conditionMet) break; // Short circuit
                }
            }

            // If no conditions, consider it true
            if (conditions.length === 0) {
                conditionMet = true;
            }

            this.eventBus.emit('execution:condition-evaluated', {
                action,
                conditionType: 'if',
                conditions,
                conditionOperator,
                result: conditionMet
            });

            return {
                success: true,
                isConditionStarter: true,
                conditionMet
            };
        } catch (error) {
            console.error('[if] Condition evaluation failed:', error);
            return {
                success: false,
                isConditionStarter: true,
                conditionMet: false,
                error: error.message
            };
        }
    }

    /**
     * Handle image-match condition starter (new flat structure)
     * Evaluates image matching and returns isConditionStarter flag
     */
    async _handleImageMatchCondition(action, context) {
        const { deviceId, imageMatcher, coordinateService } = context;

        try {
            // Capture current screen
            const screenImage = await this._captureScreen(deviceId);

            // Execute image match
            const imageResult = await this.actionService.executeImageMatchAction(
                action,
                screenImage,
                { deviceId, imageMatcher, coordinateService }
            );

            // Get comparison params
            const comparison = action.comparison || { operator: '>=', value: action.threshold || 0.95 };
            const matchScore = imageResult.matchScore || (imageResult.success ? 1.0 : 0);

            // Evaluate the condition
            const conditionMet = this._evaluateComparison(
                matchScore,
                comparison.operator,
                comparison.value
            );

            this.eventBus.emit('execution:condition-evaluated', {
                action,
                conditionType: 'image-match',
                matchScore,
                comparison,
                result: conditionMet
            });

            return {
                success: true,
                isConditionStarter: true,
                conditionMet,
                matchScore
            };
        } catch (error) {
            console.error('[image-match] Condition evaluation failed:', error);
            return {
                success: false,
                isConditionStarter: true,
                conditionMet: false,
                error: error.message
            };
        }
    }

    /**
     * Handle get-volume condition starter (new flat structure)
     * Evaluates device volume and returns isConditionStarter flag
     */
    async _handleVolumeCondition(action, context) {
        try {
            // Get volume from device
            const volumeResult = await window.visionAuto.action.execute({
                type: 'get-volume',
                streamType: action.streamType || 'music'
            });

            if (!volumeResult.success) {
                console.error('[get-volume] Failed to get volume:', volumeResult.error);
                return {
                    success: false,
                    isConditionStarter: true,
                    conditionMet: false,
                    error: volumeResult.error
                };
            }

            // Get comparison params
            const comparison = action.comparison || { operator: '>=', value: 50 };
            const volume = volumeResult.volume;

            // Evaluate the condition
            const conditionMet = this._evaluateComparison(
                volume,
                comparison.operator,
                comparison.value
            );

            this.eventBus.emit('execution:condition-evaluated', {
                action,
                conditionType: 'get-volume',
                volume,
                comparison,
                result: conditionMet
            });

            return {
                success: true,
                isConditionStarter: true,
                conditionMet,
                volume
            };
        } catch (error) {
            console.error('[get-volume] Condition evaluation failed:', error);
            return {
                success: false,
                isConditionStarter: true,
                conditionMet: false,
                error: error.message
            };
        }
    }

    /**
     * Handle sound-check condition starter (new flat structure)
     * Evaluates sound similarity and returns isConditionStarter flag
     */
    async _handleSoundCheckCondition(action, context) {
        try {
            const soundResult = await this.actionService.executeSoundCheckAction(action, context);

            if (!soundResult.success) {
                return {
                    success: false,
                    isConditionStarter: true,
                    conditionMet: false,
                    error: soundResult.error
                };
            }

            // Get comparison params
            const comparison = action.comparison || { operator: '>=', value: action.threshold || 0.8 };

            // Evaluate the condition
            const conditionMet = this._evaluateComparison(
                soundResult.similarity,
                comparison.operator,
                comparison.value
            );

            this.eventBus.emit('execution:condition-evaluated', {
                action,
                conditionType: 'sound-check',
                similarity: soundResult.similarity,
                comparison,
                result: conditionMet
            });

            return {
                success: true,
                isConditionStarter: true,
                conditionMet,
                similarity: soundResult.similarity
            };
        } catch (error) {
            console.error('[sound-check] Condition evaluation failed:', error);
            return {
                success: false,
                isConditionStarter: true,
                conditionMet: false,
                error: error.message
            };
        }
    }

    /**
     * Handle while loop control structure
     */
    async _handleWhile(action, context, result) {
        const maxIterations = action.maxIterations || 100;
        let iterations = 0;

        while (iterations < maxIterations) {
            if (this.shouldStop) break;

            const conditionMet = await this._evaluateCondition(action.condition, context);

            if (!conditionMet) break;

            this.eventBus.emit('execution:loop-iteration', {
                action,
                iteration: iterations + 1
            });

            if (action.actions && action.actions.length > 0) {
                await this._executeRange(action.actions, 0, action.actions.length, context, result);
            }

            iterations++;
        }

        return { success: true };
    }

    /**
     * Handle fixed loop control structure
     */
    async _handleLoop(action, context, result) {
        const count = action.count || 1;

        for (let i = 0; i < count; i++) {
            if (this.shouldStop) break;

            this.eventBus.emit('execution:loop-iteration', {
                action,
                iteration: i + 1,
                total: count
            });

            if (action.actions && action.actions.length > 0) {
                await this._executeRange(action.actions, 0, action.actions.length, context, result);
            }
        }

        return { success: true };
    }

    /**
     * Handle test assertion
     */
    async _handleTest(action, context) {
        // Test assertions would be implemented here
        // For now, just pass
        return {
            success: true,
            message: `Test: ${action.name}`
        };
    }

    /**
     * Evaluate a condition
     */
    async _evaluateCondition(condition, context) {
        if (!condition) {
            return true;
        }

        try {
            // Handle different condition types
            switch (condition.type) {
                case 'image-match':
                    const screenImage = await this._captureScreen(context.deviceId);
                    const imageResult = await this.actionService.executeImageMatchAction(
                        condition,
                        screenImage,
                        context
                    );
                    return imageResult.success;

                case 'get-volume':
                    // Execute get-volume action and evaluate condition
                    const volumeResult = await window.visionAuto.action.execute(condition);
                    if (!volumeResult.success) {
                        return false;
                    }
                    // Evaluate the comparison operator
                    return this._evaluateComparison(
                        volumeResult.volume,
                        condition.operator || '>=',
                        condition.value || 0
                    );

                case 'sound-check':
                    // Execute sound-check action and evaluate condition
                    const soundResult = await this.actionService.executeSoundCheckAction(condition, context);
                    if (!soundResult.success) {
                        return false;
                    }
                    // Evaluate the comparison operator
                    return this._evaluateComparison(
                        soundResult.similarity,
                        condition.operator || '>=',
                        condition.threshold || 0.8
                    );

                default:
                    console.warn(`Unknown condition type: ${condition.type}`);
                    return true;
            }
        } catch (error) {
            console.error(`Condition evaluation failed:`, error);
            return false;
        }
    }

    /**
     * Evaluate comparison operator
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

    /**
     * Capture current screen
     */
    async _captureScreen(deviceId) {
        // This should use the screen service or IPC
        // Placeholder implementation
        const canvas = document.getElementById('screen-canvas');
        if (canvas) {
            return canvas.toDataURL();
        }
        return null;
    }

    /**
     * Get execution state
     */
    getState() {
        return {
            isRunning: this.isRunning,
            shouldStop: this.shouldStop,
            currentActionIndex: this.currentActionIndex
        };
    }
}

// Export for use in renderer process
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MacroExecutor;
}

if (typeof window !== 'undefined') {
    window.MacroExecutor = MacroExecutor;
}
