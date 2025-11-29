/**
 * ES6 Modules Entry Point
 * Exports all modules for the renderer process
 */

// Managers
export { ScenarioManager } from './ScenarioManager.js';
export { DragDropManager } from './DragDropManager.js';
export { ExecutionController } from './ExecutionController.js';
export { CoordinatePickerUI } from './CoordinatePickerUI.js';

// Services
export { EventBus, eventBus } from './services/EventBus.js';
export { LoggerService, logger } from './services/LoggerService.js';

// Stores
export { ActionStore, actionStore } from './stores/ActionStore.js';
export { DeviceStore, deviceStore } from './stores/DeviceStore.js';
export { ScreenStore, screenStore } from './stores/ScreenStore.js';
export { MacroStore, macroStore } from './stores/MacroStore.js';

// Re-export submodule index files
export * as services from './services/index.js';
export * as stores from './stores/index.js';

// Default export with all modules
import { ScenarioManager } from './ScenarioManager.js';
import { DragDropManager } from './DragDropManager.js';
import { ExecutionController } from './ExecutionController.js';
import { CoordinatePickerUI } from './CoordinatePickerUI.js';
import { EventBus, eventBus } from './services/EventBus.js';
import { LoggerService, logger } from './services/LoggerService.js';
import { ActionStore, actionStore } from './stores/ActionStore.js';
import { DeviceStore, deviceStore } from './stores/DeviceStore.js';
import { ScreenStore, screenStore } from './stores/ScreenStore.js';
import { MacroStore, macroStore } from './stores/MacroStore.js';

export default {
    // Managers
    ScenarioManager,
    DragDropManager,
    ExecutionController,
    CoordinatePickerUI,

    // Services
    EventBus,
    LoggerService,

    // Stores
    ActionStore,
    DeviceStore,
    ScreenStore,
    MacroStore,

    // Singleton instances
    eventBus,
    logger,
    actionStore,
    deviceStore,
    screenStore,
    macroStore
};
