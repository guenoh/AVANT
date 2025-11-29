/**
 * Module Bridge - Connects ES6 modules to global window scope
 * This allows gradual migration from global variables to ES6 modules
 *
 * Usage: Include this script with type="module" in index.html
 * After full migration, this bridge can be removed
 */

// Import all modules
import {
    ScenarioManager,
    DragDropManager,
    ExecutionController,
    CoordinatePickerUI,
    EventBus,
    eventBus,
    LoggerService,
    logger,
    ActionStore,
    actionStore,
    DeviceStore,
    deviceStore,
    ScreenStore,
    screenStore,
    MacroStore,
    macroStore
} from './index.js';

// Expose classes to global scope for backward compatibility
window.ScenarioManager = ScenarioManager;
window.DragDropManager = DragDropManager;
window.ExecutionController = ExecutionController;
window.CoordinatePickerUI = CoordinatePickerUI;
window.EventBus = eventBus;  // Singleton instance
window.LoggerService = LoggerService;

// Expose store instances (singletons)
window.ActionStore = actionStore;
window.DeviceStore = deviceStore;
window.ScreenStore = screenStore;
window.MacroStore = macroStore;

// Also expose singleton logger
window.logger = logger;

// Dispatch event to signal modules are ready
window.dispatchEvent(new CustomEvent('modulesReady', {
    detail: {
        managers: { ScenarioManager, DragDropManager, ExecutionController, CoordinatePickerUI },
        services: { EventBus, LoggerService, eventBus, logger },
        stores: { ActionStore, DeviceStore, ScreenStore, MacroStore, actionStore, deviceStore, screenStore, macroStore }
    }
}));

console.log('[ModuleBridge] ES6 modules loaded and exposed to global scope');
