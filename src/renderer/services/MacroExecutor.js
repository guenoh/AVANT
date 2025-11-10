/**
 * MacroExecutor
 * Handles macro execution flow with control structures (if/while/loop)
 */

class MacroExecutor {
    constructor(actionService, eventBus, options = {}) {
        this.actionService = actionService;
        this.eventBus = eventBus;
        this.options = options;

        this.isRunning = false;
        this.shouldStop = false;
        this.currentActionIndex = -1;
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
     * Execute a range of actions
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
                const actionResult = await this._executeAction(action, context, result);

                if (actionResult.skip) {
                    result.skippedActions++;
                    this.eventBus.emit('execution:action-skipped', { index: i, action });
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
     * Execute a single action with control flow handling
     */
    async _executeAction(action, context, result) {
        // Handle control flow actions
        switch (action.type) {
            case 'if':
                return await this._handleIf(action, context, result);

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
     * Handle if-then-else control structure
     */
    async _handleIf(action, context, result) {
        const conditionMet = await this._evaluateCondition(action.condition, context);

        this.eventBus.emit('execution:condition-evaluated', {
            action,
            condition: action.condition,
            result: conditionMet
        });

        if (conditionMet && action.thenActions && action.thenActions.length > 0) {
            await this._executeRange(action.thenActions, 0, action.thenActions.length, context, result);
        } else if (!conditionMet && action.elseActions && action.elseActions.length > 0) {
            await this._executeRange(action.elseActions, 0, action.elseActions.length, context, result);
        }

        return { success: true };
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

        if (condition.type === 'image-match') {
            try {
                const screenImage = await this._captureScreen(context.deviceId);
                const result = await this.actionService.executeImageMatchAction(
                    condition,
                    screenImage,
                    context
                );
                return result.success;
            } catch (error) {
                return false;
            }
        }

        // Other condition types can be added here
        return true;
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
