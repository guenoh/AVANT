/**
 * ActionPluginSystem
 * Extensible action type system using plugin architecture
 * Allows adding new action types without modifying core code
 */

class ActionPluginSystem {
    constructor(actionConfigProvider) {
        this.actionConfig = actionConfigProvider;
        this.plugins = new Map();
        this.executors = new Map();
    }

    /**
     * Register an action plugin
     * @param {Object} plugin - Action plugin definition
     */
    registerPlugin(plugin) {
        this._validatePlugin(plugin);

        const actionType = plugin.type;

        if (this.plugins.has(actionType)) {
            throw new Error(`Action type ${actionType} is already registered`);
        }

        // Register action configuration
        this.actionConfig.actionTypes[actionType] = {
            id: actionType,
            name: plugin.name,
            category: plugin.category,
            description: plugin.description,
            icon: plugin.icon,
            color: plugin.color,
            requiresCoordinates: plugin.requiresCoordinates || false,
            fields: plugin.fields || [],
            defaultParams: plugin.defaultParams || {},
            executionTime: plugin.executionTime || null,
            ...plugin.metadata
        };

        // Store plugin
        this.plugins.set(actionType, plugin);

        // Register executor if provided
        if (plugin.executor) {
            this.executors.set(actionType, plugin.executor);
        }

        console.log(`[ActionPluginSystem] Registered plugin: ${actionType}`);

        return this;
    }

    /**
     * Validate plugin structure
     * @private
     */
    _validatePlugin(plugin) {
        const required = ['type', 'name', 'category', 'description'];

        for (const field of required) {
            if (!plugin[field]) {
                throw new Error(`Plugin must have '${field}' property`);
            }
        }

        // Validate fields structure
        if (plugin.fields) {
            if (!Array.isArray(plugin.fields)) {
                throw new Error('Plugin fields must be an array');
            }

            plugin.fields.forEach((field, index) => {
                if (!field.name || !field.type || !field.label) {
                    throw new Error(`Field at index ${index} must have name, type, and label`);
                }
            });
        }

        // Validate executor if provided
        if (plugin.executor && typeof plugin.executor !== 'function') {
            throw new Error('Plugin executor must be a function');
        }
    }

    /**
     * Execute action using registered executor
     * @param {Object} action - Action to execute
     * @param {Object} context - Execution context
     * @returns {Promise<Object>} Execution result
     */
    async execute(action, context) {
        const executor = this.executors.get(action.type);

        if (!executor) {
            throw new Error(`No executor registered for action type: ${action.type}`);
        }

        try {
            const result = await executor(action, context);
            return {
                success: true,
                ...result
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check if action type has executor
     */
    hasExecutor(actionType) {
        return this.executors.has(actionType);
    }

    /**
     * Get plugin by type
     */
    getPlugin(actionType) {
        return this.plugins.get(actionType);
    }

    /**
     * List all registered plugins
     */
    listPlugins() {
        return Array.from(this.plugins.values());
    }

    /**
     * Get plugins by category
     */
    getPluginsByCategory(category) {
        return Array.from(this.plugins.values()).filter(
            p => p.category === category
        );
    }

    /**
     * Unregister plugin
     */
    unregisterPlugin(actionType) {
        this.plugins.delete(actionType);
        this.executors.delete(actionType);
        delete this.actionConfig.actionTypes[actionType];

        console.log(`[ActionPluginSystem] Unregistered plugin: ${actionType}`);
    }
}

// Export for use in renderer process
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ActionPluginSystem;
}

if (typeof window !== 'undefined') {
    window.ActionPluginSystem = ActionPluginSystem;
}
