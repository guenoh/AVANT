/**
 * BaseView - Base class for all views
 * Provides lifecycle management, event handling, and state management
 */
class BaseView {
    constructor(options = {}) {
        this.container = options.container || null;
        this.eventBus = options.eventBus || window.eventBus;
        this.state = options.initialState || {};
        this._mounted = false;
        this._eventHandlers = [];
        this._subscriptions = [];
    }

    // ============================================
    // Lifecycle Methods
    // ============================================

    /**
     * Mount view to a container element
     * @param {HTMLElement|string} container - Container element or selector
     */
    mount(container) {
        if (typeof container === 'string') {
            this.container = document.querySelector(container);
        } else {
            this.container = container || this.container;
        }

        if (!this.container) {
            throw new Error(`BaseView: Container not found`);
        }

        this.onBeforeMount();
        this.render();
        this.bindEvents();
        this._mounted = true;
        this.onMounted();

        return this;
    }

    /**
     * Unmount view from container
     */
    unmount() {
        if (!this._mounted) return;

        this.onBeforeUnmount();
        this.unbindEvents();
        this.unsubscribeAll();

        if (this.container) {
            this.container.innerHTML = '';
        }

        this._mounted = false;
        this.onUnmounted();

        return this;
    }

    /**
     * Render view content
     */
    render() {
        if (!this.container) return;

        const html = this.template();
        this.container.innerHTML = html;
        this.onRendered();

        return this;
    }

    /**
     * Update view (re-render with current state)
     */
    update() {
        if (!this._mounted) return;

        this.unbindEvents();
        this.render();
        this.bindEvents();

        return this;
    }

    // ============================================
    // Template Method (Override in subclasses)
    // ============================================

    /**
     * Return HTML template string
     * @returns {string} HTML template
     */
    template() {
        return '';
    }

    // ============================================
    // Event Binding (Override in subclasses)
    // ============================================

    /**
     * Bind DOM events
     */
    bindEvents() {
        // Override in subclasses
    }

    /**
     * Unbind all DOM events
     */
    unbindEvents() {
        this._eventHandlers.forEach(({ element, type, handler }) => {
            element.removeEventListener(type, handler);
        });
        this._eventHandlers = [];
    }

    // ============================================
    // Lifecycle Hooks (Override as needed)
    // ============================================

    onBeforeMount() {}
    onMounted() {}
    onRendered() {}
    onBeforeUnmount() {}
    onUnmounted() {}
    onActivate() {}
    onDeactivate() {}
    onStateChange(oldState, newState) {}

    // ============================================
    // State Management
    // ============================================

    /**
     * Update state and optionally re-render
     * @param {Object} updates - State updates
     * @param {boolean} shouldRender - Whether to re-render (default: true)
     */
    setState(updates, shouldRender = true) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };
        this.onStateChange(oldState, this.state);

        if (shouldRender && this._mounted) {
            this.update();
        }

        return this;
    }

    /**
     * Get current state
     * @returns {Object} Current state
     */
    getState() {
        return { ...this.state };
    }

    // ============================================
    // Helper Methods
    // ============================================

    /**
     * Add event listener with automatic cleanup
     * @param {HTMLElement} element - Target element
     * @param {string} type - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event listener options
     */
    addEvent(element, type, handler, options = {}) {
        if (!element) return;

        const boundHandler = handler.bind(this);
        element.addEventListener(type, boundHandler, options);
        this._eventHandlers.push({ element, type, handler: boundHandler });
    }

    /**
     * Add delegated event listener
     * @param {string} selector - CSS selector for delegation
     * @param {string} type - Event type
     * @param {Function} handler - Event handler
     */
    delegate(selector, type, handler) {
        const delegatedHandler = (e) => {
            const target = e.target.closest(selector);
            if (target && this.container.contains(target)) {
                handler.call(this, e, target);
            }
        };

        this.addEvent(this.container, type, delegatedHandler);
    }

    /**
     * Subscribe to EventBus events
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    subscribe(event, handler) {
        if (!this.eventBus) return;

        const boundHandler = handler.bind(this);
        this.eventBus.on(event, boundHandler);
        this._subscriptions.push({ event, handler: boundHandler });
    }

    /**
     * Unsubscribe from all EventBus events
     */
    unsubscribeAll() {
        if (!this.eventBus) return;

        this._subscriptions.forEach(({ event, handler }) => {
            this.eventBus.off(event, handler);
        });
        this._subscriptions = [];
    }

    /**
     * Query element within container
     * @param {string} selector - CSS selector
     * @returns {HTMLElement|null}
     */
    $(selector) {
        return this.container?.querySelector(selector);
    }

    /**
     * Query all elements within container
     * @param {string} selector - CSS selector
     * @returns {NodeList}
     */
    $$(selector) {
        return this.container?.querySelectorAll(selector) || [];
    }

    /**
     * Check if view is mounted
     * @returns {boolean}
     */
    isMounted() {
        return this._mounted;
    }

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
     * Show loading state
     * @param {string} message - Loading message
     */
    showLoading(message = 'Loading...') {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p class="loading-message">${message}</p>
            </div>
        `;
    }

    /**
     * Show error state
     * @param {string} message - Error message
     * @param {Function} retryHandler - Optional retry handler
     */
    showError(message, retryHandler = null) {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="error-state">
                <svg class="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p class="error-message">${message}</p>
                ${retryHandler ? '<button class="btn-primary btn-retry">Retry</button>' : ''}
            </div>
        `;

        if (retryHandler) {
            const retryBtn = this.$('.btn-retry');
            if (retryBtn) {
                this.addEvent(retryBtn, 'click', retryHandler);
            }
        }
    }

    /**
     * Show empty state
     * @param {string} title - Empty state title
     * @param {string} description - Empty state description
     * @param {string} icon - Optional icon SVG
     */
    showEmpty(title, description, icon = null) {
        if (!this.container) return;

        const defaultIcon = `
            <svg class="empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
        `;

        this.container.innerHTML = `
            <div class="empty-state">
                ${icon || defaultIcon}
                <p class="empty-title">${title}</p>
                <p class="empty-description">${description}</p>
            </div>
        `;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseView;
}

if (typeof window !== 'undefined') {
    window.BaseView = BaseView;
}
