/**
 * ActionService
 * Handles action CRUD operations and execution logic
 */

class ActionService {
    constructor(actionStore, ipcService) {
        this.actionStore = actionStore;
        this.ipc = ipcService;
    }

    /**
     * Create a new action with default parameters
     */
    createAction(type, params = {}) {
        const action = {
            id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            ...this._getDefaultParams(type),
            ...params
        };

        return action;
    }

    /**
     * Get default parameters for action type
     */
    _getDefaultParams(type) {
        const defaults = {
            'click': { x: 0, y: 0 },
            'long-press': { x: 0, y: 0, duration: 1000 },
            'drag': { x: 0, y: 0, endX: 0, endY: 0, duration: 300 },
            'input': { text: '' },
            'wait': { duration: 1000 },
            'back': {},
            'home': {},
            'recent': {},
            'image-match': {
                imagePath: '',
                threshold: 0.8,
                region: null,
                action: 'click',
                timeout: 10000
            },
            'if': {
                condition: null,
                thenActions: [],
                elseActions: []
            },
            'while': {
                condition: null,
                actions: [],
                maxIterations: 100
            },
            'loop': {
                count: 1,
                actions: []
            },
            'skip': {},
            'fail': { message: '' },
            'test': { name: '', expectedResult: '' },
            'sound-check': {
                duration: 5000,
                expectation: 'present',
                threshold: { min: 40, max: 80 },
                audioDeviceId: null
            }
        };

        return defaults[type] || {};
    }

    /**
     * Execute a single action via Protocol API
     */
    async executeAction(action, options = {}) {
        const { deviceId } = options;

        try {
            switch (action.type) {
                case 'click':
                    await window.api.protocol.tap(action.x, action.y);
                    return { success: true };

                case 'long-press':
                    await window.api.protocol.longPress(action.x, action.y, action.duration);
                    return { success: true };

                case 'drag':
                    await window.api.protocol.drag(
                        action.x,
                        action.y,
                        action.endX,
                        action.endY,
                        action.duration
                    );
                    return { success: true };

                case 'input':
                    await window.api.protocol.inputText(action.text);
                    return { success: true };

                case 'wait':
                    await this._sleep(action.duration);
                    return { success: true };

                case 'back':
                    await window.api.protocol.pressKey('KEYCODE_BACK');
                    return { success: true };

                case 'home':
                    await window.api.protocol.pressKey('KEYCODE_HOME');
                    return { success: true };

                case 'recent':
                    await window.api.protocol.pressKey('KEYCODE_APP_SWITCH');
                    return { success: true };

                default:
                    throw new Error(`Unknown action type: ${action.type}`);
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Execute image match action
     */
    async executeImageMatchAction(action, screenImage, options = {}) {
        const { imageMatcher, coordinateService } = options;

        if (!action.imagePath) {
            throw new Error('Image path is required for image-match action');
        }

        try {
            // Load template image
            const templateImg = await this._loadImage(action.imagePath);

            // Perform matching
            const matchResult = await imageMatcher.match(
                screenImage,
                templateImg,
                {
                    threshold: action.threshold || 0.8,
                    region: action.region
                }
            );

            if (!matchResult.found) {
                return {
                    success: false,
                    message: `Image not found (confidence: ${matchResult.confidence.toFixed(2)})`,
                    data: matchResult
                };
            }

            // Perform action at matched location
            const coords = matchResult.location;

            if (action.action === 'click') {
                await window.api.protocol.tap(coords.x, coords.y);
            } else if (action.action === 'long-press') {
                await window.api.protocol.longPress(coords.x, coords.y, 1000);
            }

            return {
                success: true,
                message: `Image matched (confidence: ${matchResult.confidence.toFixed(2)})`,
                data: {
                    ...matchResult,
                    actionPerformed: action.action
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Execute sound check action
     */
    async executeSoundCheckAction(action, options = {}) {
        const { AudioCapture } = options;

        if (!AudioCapture) {
            throw new Error('AudioCapture not available');
        }

        const duration = action.duration || 5000;
        const expectation = action.expectation || 'present';
        const threshold = action.threshold || { min: 40, max: 80 };
        const audioDeviceId = action.audioDeviceId || null;

        const audioCapture = new AudioCapture();

        try {
            await audioCapture.init(audioDeviceId);

            const samples = [];
            const startTime = Date.now();

            await new Promise((resolve) => {
                const interval = setInterval(() => {
                    const elapsed = Date.now() - startTime;

                    if (elapsed >= duration) {
                        clearInterval(interval);
                        resolve();
                        return;
                    }

                    const db = audioCapture.getDecibel();
                    samples.push(db);
                }, 100);
            });

            audioCapture.cleanup();

            // Calculate statistics
            const avgDb = samples.reduce((a, b) => a + b, 0) / samples.length;
            const maxDb = Math.max(...samples);
            const minDb = Math.min(...samples);

            // Validate based on expectation
            let success = false;
            let message = '';

            if (expectation === 'present') {
                success = maxDb >= (threshold.min || 40);
                message = success
                    ? `Sound detected (max: ${maxDb.toFixed(1)}dB)`
                    : `No sound detected (max: ${maxDb.toFixed(1)}dB, expected: >=${threshold.min}dB)`;
            } else if (expectation === 'silent') {
                success = maxDb <= (threshold.max || 30);
                message = success
                    ? `Silent confirmed (max: ${maxDb.toFixed(1)}dB)`
                    : `Sound detected when expecting silence (max: ${maxDb.toFixed(1)}dB, expected: <=${threshold.max}dB)`;
            } else if (expectation === 'level') {
                success = avgDb >= threshold.min && avgDb <= threshold.max;
                message = success
                    ? `Sound level correct (avg: ${avgDb.toFixed(1)}dB)`
                    : `Sound level out of range (avg: ${avgDb.toFixed(1)}dB, expected: ${threshold.min}-${threshold.max}dB)`;
            }

            return {
                success,
                message,
                error: success ? undefined : message,
                data: {
                    average: avgDb,
                    max: maxDb,
                    min: minDb,
                    samples: samples.length
                }
            };
        } catch (error) {
            audioCapture.cleanup();
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Helper: Load image from path
     */
    async _loadImage(path) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = path;
        });
    }

    /**
     * Helper: Sleep for specified duration
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Validate action parameters
     */
    validateAction(action) {
        if (!action.type) {
            return { valid: false, error: 'Action type is required' };
        }

        switch (action.type) {
            case 'click':
            case 'long-press':
                if (typeof action.x !== 'number' || typeof action.y !== 'number') {
                    return { valid: false, error: 'Coordinates are required' };
                }
                break;

            case 'drag':
                if (typeof action.x !== 'number' || typeof action.y !== 'number' ||
                    typeof action.endX !== 'number' || typeof action.endY !== 'number') {
                    return { valid: false, error: 'Start and end coordinates are required' };
                }
                break;

            case 'input':
                if (!action.text) {
                    return { valid: false, error: 'Text is required' };
                }
                break;

            case 'image-match':
                if (!action.imagePath) {
                    return { valid: false, error: 'Image path is required' };
                }
                break;
        }

        return { valid: true };
    }

    /**
     * Clone action with new ID
     */
    cloneAction(action) {
        return {
            ...action,
            id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
    }
}

// Export for use in renderer process
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ActionService;
}

if (typeof window !== 'undefined') {
    window.ActionService = ActionService;
}
