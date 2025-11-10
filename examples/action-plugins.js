/**
 * Example Action Plugins
 * Demonstrates how to extend Vision Auto with custom action types
 */

// ===== Example 1: Screenshot Action Plugin =====
const screenshotPlugin = {
    type: 'screenshot',
    name: 'Take Screenshot',
    category: 'advanced',
    description: 'Capture and save screenshot',
    icon: '📸',
    color: '#8b5cf6',
    requiresCoordinates: false,

    fields: [
        {
            name: 'filename',
            type: 'text',
            label: 'File Name',
            required: true
        },
        {
            name: 'format',
            type: 'select',
            label: 'Format',
            required: true,
            options: ['png', 'jpeg'],
            default: 'png'
        },
        {
            name: 'quality',
            type: 'number',
            label: 'Quality (JPEG only)',
            required: false,
            min: 1,
            max: 100,
            default: 90
        }
    ],

    defaultParams: {
        filename: 'screenshot',
        format: 'png',
        quality: 90
    },

    executionTime: 500,

    // Executor function
    async executor(action, context) {
        const { deviceId, protocolManager } = context;

        // Capture screenshot using active protocol
        const imageData = await protocolManager.captureScreen({
            format: action.format,
            quality: action.quality,
            returnBuffer: true
        });

        // Save to file
        const fs = require('fs').promises;
        const path = `./screenshots/${action.filename}.${action.format}`;
        await fs.writeFile(path, imageData);

        return {
            message: `Screenshot saved to ${path}`,
            data: { path, size: imageData.length }
        };
    }
};

// ===== Example 2: OCR Text Recognition Plugin =====
const ocrPlugin = {
    type: 'ocr',
    name: 'OCR Text Recognition',
    category: 'vision',
    description: 'Extract text from screen using OCR',
    icon: '🔤',
    color: '#ec4899',
    requiresCoordinates: false,

    fields: [
        {
            name: 'region',
            type: 'region',
            label: 'Search Region',
            required: false
        },
        {
            name: 'language',
            type: 'select',
            label: 'Language',
            required: true,
            options: ['eng', 'kor', 'jpn', 'chi'],
            default: 'eng'
        },
        {
            name: 'saveText',
            type: 'checkbox',
            label: 'Save to Variable',
            required: false,
            default: false
        },
        {
            name: 'variableName',
            type: 'text',
            label: 'Variable Name',
            required: false
        }
    ],

    defaultParams: {
        region: null,
        language: 'eng',
        saveText: false,
        variableName: ''
    },

    executionTime: 2000,

    async executor(action, context) {
        const { protocolManager, ocrEngine } = context;

        // Capture screenshot
        const imageData = await protocolManager.captureScreen({
            format: 'png',
            region: action.region,
            returnBuffer: true
        });

        // Run OCR
        const result = await ocrEngine.recognize(imageData, {
            language: action.language
        });

        // Save to variable if requested
        if (action.saveText && action.variableName) {
            context.variables = context.variables || {};
            context.variables[action.variableName] = result.text;
        }

        return {
            message: `Recognized ${result.words.length} words`,
            data: {
                text: result.text,
                confidence: result.confidence,
                words: result.words
            }
        };
    }
};

// ===== Example 3: Accessibility Action Plugin =====
const accessibilityPlugin = {
    type: 'accessibility',
    name: 'Accessibility Action',
    category: 'advanced',
    description: 'Interact with elements using accessibility features',
    icon: '♿',
    color: '#0891b2',
    requiresCoordinates: false,

    fields: [
        {
            name: 'selector',
            type: 'text',
            label: 'Accessibility ID',
            required: true
        },
        {
            name: 'action',
            type: 'select',
            label: 'Action',
            required: true,
            options: ['tap', 'longpress', 'scroll', 'focus'],
            default: 'tap'
        }
    ],

    defaultParams: {
        selector: '',
        action: 'tap'
    },

    executionTime: 300,

    async executor(action, context) {
        const { protocolManager } = context;

        // Find element by accessibility ID
        const element = await protocolManager.findElement({
            by: 'accessibility',
            value: action.selector
        });

        if (!element) {
            throw new Error(`Element not found: ${action.selector}`);
        }

        // Perform action
        switch (action.action) {
            case 'tap':
                await protocolManager.tap(element.x, element.y);
                break;
            case 'longpress':
                await protocolManager.longPress(element.x, element.y, 1000);
                break;
            case 'scroll':
                await element.scroll();
                break;
            case 'focus':
                await element.focus();
                break;
        }

        return {
            message: `Performed ${action.action} on ${action.selector}`,
            data: { element }
        };
    }
};

// ===== Example 4: Performance Monitoring Plugin =====
const performancePlugin = {
    type: 'performance',
    name: 'Performance Monitor',
    category: 'testing',
    description: 'Monitor app performance metrics',
    icon: '📊',
    color: '#f59e0b',
    requiresCoordinates: false,

    fields: [
        {
            name: 'duration',
            type: 'number',
            label: 'Monitor Duration (ms)',
            required: true,
            min: 1000,
            max: 60000,
            default: 5000
        },
        {
            name: 'metrics',
            type: 'multiselect',
            label: 'Metrics to Monitor',
            required: true,
            options: ['cpu', 'memory', 'fps', 'network'],
            default: ['cpu', 'memory']
        }
    ],

    defaultParams: {
        duration: 5000,
        metrics: ['cpu', 'memory']
    },

    executionTime: null, // Variable based on duration

    async executor(action, context) {
        const { protocolManager } = context;

        const startTime = Date.now();
        const samples = [];

        // Collect samples
        const interval = setInterval(async () => {
            const sample = {
                timestamp: Date.now()
            };

            if (action.metrics.includes('cpu')) {
                sample.cpu = await protocolManager.getCpuUsage();
            }

            if (action.metrics.includes('memory')) {
                sample.memory = await protocolManager.getMemoryUsage();
            }

            if (action.metrics.includes('fps')) {
                sample.fps = await protocolManager.getFps();
            }

            if (action.metrics.includes('network')) {
                sample.network = await protocolManager.getNetworkStats();
            }

            samples.push(sample);
        }, 500);

        // Wait for duration
        await new Promise(resolve =>
            setTimeout(() => {
                clearInterval(interval);
                resolve();
            }, action.duration)
        );

        // Calculate statistics
        const stats = this._calculateStats(samples, action.metrics);

        return {
            message: `Monitored for ${action.duration}ms`,
            data: {
                samples,
                statistics: stats
            }
        };
    },

    _calculateStats(samples, metrics) {
        const stats = {};

        metrics.forEach(metric => {
            const values = samples.map(s => s[metric]).filter(v => v !== undefined);

            stats[metric] = {
                avg: values.reduce((a, b) => a + b, 0) / values.length,
                min: Math.min(...values),
                max: Math.max(...values)
            };
        });

        return stats;
    }
};

// ===== Example 5: Gesture Recorder Plugin =====
const gestureRecorderPlugin = {
    type: 'gesture-record',
    name: 'Record Gesture',
    category: 'advanced',
    description: 'Record and replay complex gestures',
    icon: '✍️',
    color: '#10b981',
    requiresCoordinates: false,

    fields: [
        {
            name: 'gestureName',
            type: 'text',
            label: 'Gesture Name',
            required: true
        },
        {
            name: 'duration',
            type: 'number',
            label: 'Recording Duration (ms)',
            required: true,
            min: 1000,
            max: 30000,
            default: 5000
        }
    ],

    defaultParams: {
        gestureName: 'custom_gesture',
        duration: 5000
    },

    metadata: {
        requiresUserInteraction: true
    },

    async executor(action, context) {
        const { eventBus } = context;

        // Start recording
        const touchPoints = [];
        let recording = true;

        eventBus.on('touch:down', (point) => {
            if (recording) {
                touchPoints.push({
                    type: 'down',
                    x: point.x,
                    y: point.y,
                    timestamp: Date.now()
                });
            }
        });

        eventBus.on('touch:move', (point) => {
            if (recording) {
                touchPoints.push({
                    type: 'move',
                    x: point.x,
                    y: point.y,
                    timestamp: Date.now()
                });
            }
        });

        eventBus.on('touch:up', (point) => {
            if (recording) {
                touchPoints.push({
                    type: 'up',
                    x: point.x,
                    y: point.y,
                    timestamp: Date.now()
                });
            }
        });

        // Wait for duration
        await new Promise(resolve => setTimeout(resolve, action.duration));

        recording = false;

        // Save gesture
        const gesture = {
            name: action.gestureName,
            touchPoints,
            duration: action.duration
        };

        context.gestures = context.gestures || {};
        context.gestures[action.gestureName] = gesture;

        return {
            message: `Recorded gesture: ${action.gestureName}`,
            data: {
                gesture,
                pointCount: touchPoints.length
            }
        };
    }
};

// Export plugins
module.exports = {
    screenshotPlugin,
    ocrPlugin,
    accessibilityPlugin,
    performancePlugin,
    gestureRecorderPlugin
};
