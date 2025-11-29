/**
 * ServiceContainer - Dependency Injection Container
 * Manages service registration, resolution, and lifecycle
 *
 * Usage:
 *   container.register('logger', LoggerService);
 *   container.registerSingleton('eventBus', EventBus);
 *   const logger = container.resolve('logger');
 */

export class ServiceContainer {
    constructor() {
        this._services = new Map();
        this._singletons = new Map();
        this._instances = new Map();
        this._factories = new Map();
    }

    /**
     * Register a service class (new instance each time)
     * @param {string} name - Service name
     * @param {Function} ServiceClass - Service class constructor
     * @param {Array} dependencies - Array of dependency names
     */
    register(name, ServiceClass, dependencies = []) {
        this._services.set(name, {
            class: ServiceClass,
            dependencies,
            singleton: false
        });
        return this;
    }

    /**
     * Register a singleton service (same instance always)
     * @param {string} name - Service name
     * @param {Function} ServiceClass - Service class constructor
     * @param {Array} dependencies - Array of dependency names
     */
    registerSingleton(name, ServiceClass, dependencies = []) {
        this._singletons.set(name, {
            class: ServiceClass,
            dependencies,
            singleton: true
        });
        return this;
    }

    /**
     * Register an existing instance
     * @param {string} name - Service name
     * @param {Object} instance - Service instance
     */
    registerInstance(name, instance) {
        this._instances.set(name, instance);
        return this;
    }

    /**
     * Register a factory function
     * @param {string} name - Service name
     * @param {Function} factory - Factory function that creates the service
     */
    registerFactory(name, factory) {
        this._factories.set(name, factory);
        return this;
    }

    /**
     * Resolve a service by name
     * @param {string} name - Service name
     * @returns {Object} Service instance
     */
    resolve(name) {
        // Check instances first
        if (this._instances.has(name)) {
            return this._instances.get(name);
        }

        // Check factories
        if (this._factories.has(name)) {
            const instance = this._factories.get(name)(this);
            return instance;
        }

        // Check singletons
        if (this._singletons.has(name)) {
            const config = this._singletons.get(name);
            if (!this._instances.has(name)) {
                const instance = this._createInstance(config);
                this._instances.set(name, instance);
            }
            return this._instances.get(name);
        }

        // Check regular services
        if (this._services.has(name)) {
            const config = this._services.get(name);
            return this._createInstance(config);
        }

        throw new Error(`Service not found: ${name}`);
    }

    /**
     * Check if a service is registered
     * @param {string} name - Service name
     * @returns {boolean}
     */
    has(name) {
        return this._instances.has(name) ||
               this._factories.has(name) ||
               this._singletons.has(name) ||
               this._services.has(name);
    }

    /**
     * Create instance with resolved dependencies
     * @private
     */
    _createInstance(config) {
        const dependencies = config.dependencies.map(dep => this.resolve(dep));
        return new config.class(...dependencies);
    }

    /**
     * Get all registered service names
     * @returns {Array<string>}
     */
    getRegisteredServices() {
        const names = new Set([
            ...this._instances.keys(),
            ...this._factories.keys(),
            ...this._singletons.keys(),
            ...this._services.keys()
        ]);
        return Array.from(names);
    }

    /**
     * Clear all registrations (useful for testing)
     */
    clear() {
        this._services.clear();
        this._singletons.clear();
        this._instances.clear();
        this._factories.clear();
    }
}

// Singleton container instance
export const container = new ServiceContainer();

export default ServiceContainer;
