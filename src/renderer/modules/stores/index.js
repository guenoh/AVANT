/**
 * Stores Entry Point
 * ES6 Module exports for all store modules
 */

export { ActionStore, actionStore } from './ActionStore.js';
export { DeviceStore, deviceStore } from './DeviceStore.js';
export { ScreenStore, screenStore } from './ScreenStore.js';
export { MacroStore, macroStore } from './MacroStore.js';

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
