/**
 * Services Entry Point
 * ES6 Module exports for all service modules
 */

export { EventBus, eventBus } from './EventBus.js';
export { LoggerService, logger } from './LoggerService.js';

export default {
    EventBus,
    LoggerService,
    // Singleton instances
    eventBus,
    logger
};
