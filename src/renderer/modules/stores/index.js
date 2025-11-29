/**
 * Stores Entry Point
 * ES6 Module exports for all store modules
 */

// Named exports (re-export)
export { ActionStore, actionStore } from './ActionStore.js';
export { DeviceStore, deviceStore } from './DeviceStore.js';
export { ScreenStore, screenStore } from './ScreenStore.js';
export { MacroStore, macroStore } from './MacroStore.js';

// Import for default export
import { ActionStore, actionStore } from './ActionStore.js';
import { DeviceStore, deviceStore } from './DeviceStore.js';
import { ScreenStore, screenStore } from './ScreenStore.js';
import { MacroStore, macroStore } from './MacroStore.js';

export default {
    ActionStore,
    DeviceStore,
    ScreenStore,
    MacroStore,
    // Singleton instances
    actionStore,
    deviceStore,
    screenStore,
    macroStore
};
