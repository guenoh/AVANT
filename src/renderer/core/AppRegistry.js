/**
 * AppRegistry - Central registry for application components
 * Provides a clean way to access services without global variables
 *
 * This is a facade over ServiceContainer that provides
 * type-safe accessors for common services.
 */

import { container } from './ServiceContainer.js';

export class AppRegistry {
    constructor() {
        this._container = container;
        this._initialized = false;
    }

    /**
     * Initialize the registry with all required services
     */
    async init() {
        if (this._initialized) {
            console.warn('[AppRegistry] Already initialized');
            return;
        }

        // Import and register ES6 modules
        const modules = await import('../modules/index.js');

        // Register singleton stores
        this._container.registerInstance('actionStore', modules.actionStore);
        this._container.registerInstance('deviceStore', modules.deviceStore);
        this._container.registerInstance('screenStore', modules.screenStore);
        this._container.registerInstance('macroStore', modules.macroStore);

        // Register singleton services
        this._container.registerInstance('eventBus', modules.eventBus);
        this._container.registerInstance('logger', modules.logger);

        // Register manager classes (not instances - they need app reference)
        this._container.register('ScenarioManager', modules.ScenarioManager);
        this._container.register('DragDropManager', modules.DragDropManager);
        this._container.register('ExecutionController', modules.ExecutionController);
        this._container.register('CoordinatePickerUI', modules.CoordinatePickerUI);

        this._initialized = true;
        console.log('[AppRegistry] Initialized with services:', this._container.getRegisteredServices());
    }

    /**
     * Get the service container
     */
    get container() {
        return this._container;
    }

    /**
     * Check if registry is initialized
     */
    get isInitialized() {
        return this._initialized;
    }

    // ==================== Store Accessors ====================

    get actionStore() {
        return this._container.resolve('actionStore');
    }

    get deviceStore() {
        return this._container.resolve('deviceStore');
    }

    get screenStore() {
        return this._container.resolve('screenStore');
    }

    get macroStore() {
        return this._container.resolve('macroStore');
    }

    // ==================== Service Accessors ====================

    get eventBus() {
        return this._container.resolve('eventBus');
    }

    get logger() {
        return this._container.resolve('logger');
    }

    // ==================== Manager Factory Methods ====================

    /**
     * Create a ScenarioManager instance
     * @param {Object} app - Application instance
     */
    createScenarioManager(app) {
        const Manager = this._container.resolve('ScenarioManager');
        return new Manager(app);
    }

    /**
     * Create a DragDropManager instance
     * @param {Object} app - Application instance
     */
    createDragDropManager(app) {
        const Manager = this._container.resolve('DragDropManager');
        return new Manager(app);
    }

    /**
     * Create an ExecutionController instance
     * @param {Object} app - Application instance
     */
    createExecutionController(app) {
        const Manager = this._container.resolve('ExecutionController');
        return new Manager(app);
    }

    /**
     * Create a CoordinatePickerUI instance
     * @param {Object} app - Application instance
     */
    createCoordinatePickerUI(app) {
        const Manager = this._container.resolve('CoordinatePickerUI');
        return new Manager(app);
    }

    // ==================== Utility Methods ====================

    /**
     * Register an additional service
     */
    registerService(name, service) {
        this._container.registerInstance(name, service);
    }

    /**
     * Get a service by name
     */
    getService(name) {
        if (this._container.has(name)) {
            return this._container.resolve(name);
        }
        return null;
    }

    /**
     * Check if a service exists
     */
    hasService(name) {
        return this._container.has(name);
    }
}

// Singleton registry instance
export const registry = new AppRegistry();

export default AppRegistry;
