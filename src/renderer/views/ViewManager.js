/**
 * ViewManager - Manages view lifecycle and transitions
 * Handles view registration, switching, and history
 */
class ViewManager {
    constructor(options = {}) {
        this.eventBus = options.eventBus || window.eventBus;
        this.views = new Map();           // name -> ViewClass
        this.instances = new Map();       // name -> instance
        this.activeViews = new Map();     // containerSelector -> activeViewName
        this.history = [];                // Navigation history
        this.maxHistory = options.maxHistory || 50;
    }

    // ============================================
    // View Registration
    // ============================================

    /**
     * Register a view class
     * @param {string} name - View name
     * @param {Function} ViewClass - View class constructor
     */
    register(name, ViewClass) {
        if (this.views.has(name)) {
            console.warn(`ViewManager: View "${name}" already registered, overwriting`);
        }
        this.views.set(name, ViewClass);
        return this;
    }

    /**
     * Register multiple views
     * @param {Object} viewMap - { name: ViewClass }
     */
    registerAll(viewMap) {
        Object.entries(viewMap).forEach(([name, ViewClass]) => {
            this.register(name, ViewClass);
        });
        return this;
    }

    /**
     * Check if view is registered
     * @param {string} name - View name
     * @returns {boolean}
     */
    isRegistered(name) {
        return this.views.has(name);
    }

    // ============================================
    // View Instance Management
    // ============================================

    /**
     * Get or create view instance
     * @param {string} name - View name
     * @param {Object} options - Options to pass to constructor
     * @returns {BaseView} View instance
     */
    getInstance(name, options = {}) {
        if (!this.views.has(name)) {
            throw new Error(`ViewManager: View "${name}" not registered`);
        }

        // Create new instance if not exists or if forceNew is true
        if (!this.instances.has(name) || options.forceNew) {
            const ViewClass = this.views.get(name);
            const instance = new ViewClass({
                eventBus: this.eventBus,
                viewManager: this,
                ...options
            });
            this.instances.set(name, instance);
        }

        return this.instances.get(name);
    }

    /**
     * Destroy view instance
     * @param {string} name - View name
     */
    destroyInstance(name) {
        const instance = this.instances.get(name);
        if (instance) {
            if (instance.isMounted()) {
                instance.unmount();
            }
            this.instances.delete(name);
        }
    }

    /**
     * Destroy all view instances
     */
    destroyAll() {
        this.instances.forEach((instance, name) => {
            this.destroyInstance(name);
        });
        this.activeViews.clear();
        this.history = [];
    }

    // ============================================
    // View Switching
    // ============================================

    /**
     * Switch view in a container
     * @param {string} containerSelector - Container CSS selector
     * @param {string} viewName - View name to switch to
     * @param {Object} options - Switch options
     * @returns {BaseView} Activated view instance
     */
    switchView(containerSelector, viewName, options = {}) {
        const container = document.querySelector(containerSelector);
        if (!container) {
            throw new Error(`ViewManager: Container "${containerSelector}" not found`);
        }

        const {
            state = {},
            pushHistory = true,
            transition = 'none',  // 'none', 'fade', 'slide-left', 'slide-right'
            forceNew = false
        } = options;

        // Get current view in this container
        const currentViewName = this.activeViews.get(containerSelector);
        let currentView = null;

        if (currentViewName) {
            currentView = this.instances.get(currentViewName);
        }

        // Don't switch if same view (unless forceNew)
        if (currentViewName === viewName && !forceNew) {
            // Just update state if provided
            if (Object.keys(state).length > 0) {
                currentView.setState(state);
            }
            return currentView;
        }

        // Get or create new view instance
        const newView = this.getInstance(viewName, { forceNew });

        // Set initial state if provided
        if (Object.keys(state).length > 0) {
            newView.setState(state, false);  // Don't render yet
        }

        // Perform transition
        this._performTransition(container, currentView, newView, transition);

        // Update active view tracking
        this.activeViews.set(containerSelector, viewName);

        // Push to history
        if (pushHistory && currentViewName) {
            this._pushHistory(containerSelector, currentViewName, currentView?.getState());
        }

        // Emit event
        this.emit('view:switched', {
            container: containerSelector,
            from: currentViewName,
            to: viewName,
            view: newView
        });

        return newView;
    }

    /**
     * Perform view transition
     */
    _performTransition(container, currentView, newView, transition) {
        // Deactivate current view
        if (currentView) {
            currentView.onDeactivate();
            currentView.unmount();
        }

        // Apply transition class if needed
        if (transition !== 'none') {
            container.classList.add(`transition-${transition}`);
        }

        // Mount and activate new view
        newView.mount(container);
        newView.onActivate();

        // Remove transition class after animation
        if (transition !== 'none') {
            setTimeout(() => {
                container.classList.remove(`transition-${transition}`);
            }, 300);
        }
    }

    // ============================================
    // Navigation History
    // ============================================

    /**
     * Push to history
     */
    _pushHistory(containerSelector, viewName, state) {
        this.history.push({
            container: containerSelector,
            view: viewName,
            state: state,
            timestamp: Date.now()
        });

        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }

    /**
     * Go back in history for a container
     * @param {string} containerSelector - Container CSS selector
     * @returns {BaseView|null} Previous view or null if no history
     */
    goBack(containerSelector) {
        // Find last history entry for this container
        for (let i = this.history.length - 1; i >= 0; i--) {
            const entry = this.history[i];
            if (entry.container === containerSelector) {
                // Remove this entry
                this.history.splice(i, 1);

                // Switch to previous view
                return this.switchView(containerSelector, entry.view, {
                    state: entry.state,
                    pushHistory: false
                });
            }
        }

        return null;
    }

    /**
     * Check if can go back for a container
     * @param {string} containerSelector - Container CSS selector
     * @returns {boolean}
     */
    canGoBack(containerSelector) {
        return this.history.some(entry => entry.container === containerSelector);
    }

    /**
     * Clear history for a container
     * @param {string} containerSelector - Container CSS selector (optional, clears all if not provided)
     */
    clearHistory(containerSelector = null) {
        if (containerSelector) {
            this.history = this.history.filter(entry => entry.container !== containerSelector);
        } else {
            this.history = [];
        }
    }

    // ============================================
    // Query Methods
    // ============================================

    /**
     * Get active view for a container
     * @param {string} containerSelector - Container CSS selector
     * @returns {BaseView|null}
     */
    getActiveView(containerSelector) {
        const viewName = this.activeViews.get(containerSelector);
        return viewName ? this.instances.get(viewName) : null;
    }

    /**
     * Get active view name for a container
     * @param {string} containerSelector - Container CSS selector
     * @returns {string|null}
     */
    getActiveViewName(containerSelector) {
        return this.activeViews.get(containerSelector) || null;
    }

    /**
     * Get all active views
     * @returns {Map<string, string>} Container -> ViewName map
     */
    getAllActiveViews() {
        return new Map(this.activeViews);
    }

    /**
     * Check if a view is active in any container
     * @param {string} viewName - View name
     * @returns {boolean}
     */
    isViewActive(viewName) {
        return Array.from(this.activeViews.values()).includes(viewName);
    }

    // ============================================
    // Event Helpers
    // ============================================

    /**
     * Emit event through EventBus
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        if (this.eventBus) {
            this.eventBus.emit(event, data);
        }
    }

    /**
     * Subscribe to event
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    on(event, handler) {
        if (this.eventBus) {
            this.eventBus.on(event, handler);
        }
    }

    // ============================================
    // Lifecycle
    // ============================================

    /**
     * Initialize view manager
     * Sets up default views in containers
     * @param {Object} initialViews - { containerSelector: viewName }
     */
    init(initialViews = {}) {
        Object.entries(initialViews).forEach(([container, viewName]) => {
            this.switchView(container, viewName, { pushHistory: false });
        });
        return this;
    }

    /**
     * Cleanup
     */
    cleanup() {
        this.destroyAll();
        this.views.clear();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ViewManager;
}

if (typeof window !== 'undefined') {
    window.ViewManager = ViewManager;
}
