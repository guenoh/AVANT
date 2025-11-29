/**
 * Services Entry Point
 * ES6 Module exports for all service modules
 */

// Named exports (re-export)
export { EventBus, eventBus } from './EventBus.js';
export { LoggerService, logger } from './LoggerService.js';

// Import for default export
import { EventBus, eventBus } from './EventBus.js';
import { LoggerService, logger } from './LoggerService.js';

export default {
    EventBus,
    LoggerService,
    // Singleton instances
    eventBus,
    logger
};
