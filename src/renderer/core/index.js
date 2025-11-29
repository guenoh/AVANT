/**
 * Core Module Entry Point
 * Exports dependency injection and application registry
 */

export { ServiceContainer, container } from './ServiceContainer.js';
export { AppRegistry, registry } from './AppRegistry.js';

export default {
    ServiceContainer,
    container,
    AppRegistry,
    registry
};
