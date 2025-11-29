/**
 * Event Bus - Global event communication between components
 * ES6 Module version
 */

export class EventBus {
    constructor() {
        this._events = new Map();
        this._debugMode = false;
    }

    /**
     * Subscribe to an event
     * @param {string} eventName - Event name
     * @param {Function} handler - Event handler
     * @returns {Function} Unsubscribe function
     */
    on(eventName, handler) {
        if (!this._events.has(eventName)) {
            this._events.set(eventName, new Set());
        }

        this._events.get(eventName).add(handler);

        if (this._debugMode) {
            console.log(`[EventBus] Subscribed to "${eventName}" (total: ${this._events.get(eventName).size})`);
        }

        // Return unsubscribe function
        return () => this.off(eventName, handler);
    }

    /**
     * Subscribe to an event (one-time)
     * Handler is automatically removed after first call
     */
    once(eventName, handler) {
        const onceHandler = (...args) => {
            handler(...args);
            this.off(eventName, onceHandler);
        };

        return this.on(eventName, onceHandler);
    }

    /**
     * Unsubscribe from an event
     */
    off(eventName, handler) {
        if (!this._events.has(eventName)) {
            return;
        }

        this._events.get(eventName).delete(handler);

        if (this._debugMode) {
            console.log(`[EventBus] Unsubscribed from "${eventName}" (remaining: ${this._events.get(eventName).size})`);
        }

        // Clean up empty event sets
        if (this._events.get(eventName).size === 0) {
            this._events.delete(eventName);
        }
    }

    /**
     * Emit an event
     */
    emit(eventName, data = null) {
        if (!this._events.has(eventName)) {
            if (this._debugMode) {
                console.log(`[EventBus] No listeners for "${eventName}"`);
            }
            return;
        }

        const handlers = this._events.get(eventName);

        if (this._debugMode) {
            console.log(`[EventBus] Emitting "${eventName}" to ${handlers.size} listeners`, data);
        }

        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                console.error(`[EventBus] Error in handler for "${eventName}":`, error);
            }
        });
    }

    /**
     * Clear all listeners for an event
     */
    clear(eventName) {
        if (eventName) {
            this._events.delete(eventName);
            if (this._debugMode) {
                console.log(`[EventBus] Cleared all listeners for "${eventName}"`);
            }
        } else {
            this._events.clear();
            if (this._debugMode) {
                console.log('[EventBus] Cleared all listeners');
            }
        }
    }

    /**
     * Get list of all event names
     */
    getEventNames() {
        return Array.from(this._events.keys());
    }

    /**
     * Get listener count for an event
     */
    getListenerCount(eventName) {
        return this._events.has(eventName) ? this._events.get(eventName).size : 0;
    }

    /**
     * Enable/disable debug mode
     */
    setDebugMode(enabled) {
        this._debugMode = enabled;
    }

    /**
     * Get debug info
     */
    getDebugInfo() {
        const info = {};
        this._events.forEach((handlers, eventName) => {
            info[eventName] = handlers.size;
        });
        return info;
    }
}

// Singleton instance
export const eventBus = new EventBus();

export default EventBus;
