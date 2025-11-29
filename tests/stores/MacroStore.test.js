/**
 * MacroStore Unit Tests
 */

const MacroStoreClass = require('../../src/renderer/stores/MacroStore');

describe('MacroStore', () => {
  let store;

  beforeEach(() => {
    store = new MacroStoreClass();
  });

  describe('Initialization', () => {
    test('should initialize with default state', () => {
      const state = store.getState();
      expect(state).toEqual({
        macros: [],
        selectedMacro: null,
        isRunning: false,
        runningMacroId: null,
        currentActionIndex: -1,
        isEditMode: false,
        editingMacroId: null
      });
    });

    test('should have empty listener set', () => {
      const debugInfo = store.getDebugInfo();
      expect(debugInfo.listenerCount).toBe(0);
    });
  });

  describe('State Management', () => {
    test('should get specific state property', () => {
      expect(store.get('macros')).toEqual([]);
      expect(store.get('isRunning')).toBe(false);
    });

    test('should update state immutably', () => {
      const oldState = store.getState();
      store.setState({ isRunning: true });
      const newState = store.getState();

      expect(newState).not.toBe(oldState);
      expect(newState.isRunning).toBe(true);
      expect(oldState.isRunning).toBe(false);
    });

    test('should notify listeners on state change', () => {
      const listener = jest.fn();
      store.subscribe(listener);

      store.setState({ isRunning: true });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'state-change',
          changes: { isRunning: true }
        })
      );
    });
  });

  describe('Subscription', () => {
    test('should add listener', () => {
      const listener = jest.fn();
      store.subscribe(listener);

      expect(store.getDebugInfo().listenerCount).toBe(1);
    });

    test('should return unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe = store.subscribe(listener);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
      expect(store.getDebugInfo().listenerCount).toBe(0);
    });

    test('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = jest.fn();

      console.error = jest.fn();

      store.subscribe(errorListener);
      store.subscribe(normalListener);

      store.setState({ isRunning: true });

      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Macro Management', () => {
    test('should set macros array', () => {
      const macros = [
        { id: 'macro1', name: 'Test Macro 1', actions: [] },
        { id: 'macro2', name: 'Test Macro 2', actions: [] }
      ];

      store.setMacros(macros);

      expect(store.get('macros')).toEqual(macros);
    });

    test('should add macro to list', () => {
      const macro = { id: 'macro1', name: 'Test Macro', actions: [] };

      store.addMacro(macro);

      expect(store.get('macros')).toHaveLength(1);
      expect(store.get('macros')[0]).toEqual(macro);
    });

    test('should add multiple macros', () => {
      store.addMacro({ id: 'macro1', name: 'Test 1', actions: [] });
      store.addMacro({ id: 'macro2', name: 'Test 2', actions: [] });

      expect(store.get('macros')).toHaveLength(2);
    });

    test('should update macro by ID', () => {
      store.addMacro({ id: 'macro1', name: 'Test Macro', actions: [] });
      store.updateMacro('macro1', { name: 'Updated Macro' });

      const macro = store.get('macros')[0];
      expect(macro.name).toBe('Updated Macro');
      expect(macro.id).toBe('macro1');
    });

    test('should not affect other macros when updating', () => {
      store.addMacro({ id: 'macro1', name: 'Test 1', actions: [] });
      store.addMacro({ id: 'macro2', name: 'Test 2', actions: [] });

      store.updateMacro('macro1', { name: 'Updated 1' });

      const macros = store.get('macros');
      expect(macros[0].name).toBe('Updated 1');
      expect(macros[1].name).toBe('Test 2');
    });

    test('should remove macro by ID', () => {
      store.addMacro({ id: 'macro1', name: 'Test 1', actions: [] });
      store.addMacro({ id: 'macro2', name: 'Test 2', actions: [] });

      store.removeMacro('macro1');

      expect(store.get('macros')).toHaveLength(1);
      expect(store.get('macros')[0].id).toBe('macro2');
    });

    test('should get macro by ID', () => {
      const macro = { id: 'macro1', name: 'Test Macro', actions: [] };
      store.addMacro(macro);

      const found = store.getMacroById('macro1');
      expect(found).toEqual(macro);
    });

    test('should return undefined for non-existent macro ID', () => {
      const found = store.getMacroById('nonexistent');
      expect(found).toBeUndefined();
    });
  });

  describe('Macro Selection', () => {
    beforeEach(() => {
      store.addMacro({ id: 'macro1', name: 'Test 1', actions: [] });
      store.addMacro({ id: 'macro2', name: 'Test 2', actions: [] });
    });

    test('should select macro by ID', () => {
      store.selectMacro('macro1');

      const selected = store.get('selectedMacro');
      expect(selected).toBeDefined();
      expect(selected.id).toBe('macro1');
    });

    test('should clear selection', () => {
      store.selectMacro('macro1');
      store.clearSelection();

      expect(store.get('selectedMacro')).toBeNull();
    });

    test('should select different macro', () => {
      store.selectMacro('macro1');
      store.selectMacro('macro2');

      const selected = store.get('selectedMacro');
      expect(selected.id).toBe('macro2');
    });
  });

  describe('Running State', () => {
    test('should set running state with macro ID', () => {
      store.setRunning(true, 'macro1');

      expect(store.get('isRunning')).toBe(true);
      expect(store.get('runningMacroId')).toBe('macro1');
      expect(store.get('currentActionIndex')).toBe(0);
    });

    test('should clear running state', () => {
      store.setRunning(true, 'macro1');
      store.setRunning(false);

      expect(store.get('isRunning')).toBe(false);
      expect(store.get('runningMacroId')).toBeNull();
      expect(store.get('currentActionIndex')).toBe(-1);
    });

    test('should update current action index', () => {
      store.setCurrentActionIndex(5);

      expect(store.get('currentActionIndex')).toBe(5);
    });

    test('should reset action index when stopping execution', () => {
      store.setRunning(true, 'macro1');
      store.setCurrentActionIndex(5);
      store.setRunning(false);

      expect(store.get('currentActionIndex')).toBe(-1);
    });
  });

  describe('Edit Mode', () => {
    test('should enable edit mode with macro ID', () => {
      store.setEditMode(true, 'macro1');

      expect(store.get('isEditMode')).toBe(true);
      expect(store.get('editingMacroId')).toBe('macro1');
    });

    test('should disable edit mode', () => {
      store.setEditMode(true, 'macro1');
      store.setEditMode(false);

      expect(store.get('isEditMode')).toBe(false);
      expect(store.get('editingMacroId')).toBeNull();
    });

    test('should switch to editing different macro', () => {
      store.setEditMode(true, 'macro1');
      store.setEditMode(true, 'macro2');

      expect(store.get('editingMacroId')).toBe('macro2');
    });
  });

  describe('Reset', () => {
    test('should reset to initial state', () => {
      // Modify state
      store.addMacro({ id: 'macro1', name: 'Test', actions: [] });
      store.selectMacro('macro1');
      store.setRunning(true, 'macro1');
      store.setEditMode(true, 'macro1');

      // Reset
      store.reset();

      // Check reset state
      const state = store.getState();
      expect(state).toEqual({
        macros: [],
        selectedMacro: null,
        isRunning: false,
        runningMacroId: null,
        currentActionIndex: -1,
        isEditMode: false,
        editingMacroId: null
      });
    });

    test('should notify listeners on reset', () => {
      const listener = jest.fn();
      store.subscribe(listener);

      store.reset();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'reset'
        })
      );
    });
  });

  describe('Immutability', () => {
    test('should not mutate macros array on add', () => {
      const macro1 = { id: 'macro1', name: 'Test 1', actions: [] };
      store.addMacro(macro1);

      const originalMacros = store.get('macros');
      store.addMacro({ id: 'macro2', name: 'Test 2', actions: [] });
      const updatedMacros = store.get('macros');

      expect(updatedMacros).not.toBe(originalMacros);
    });

    test('should not mutate macros array on update', () => {
      store.addMacro({ id: 'macro1', name: 'Test', actions: [] });

      const originalMacros = store.get('macros');
      store.updateMacro('macro1', { name: 'Updated' });
      const updatedMacros = store.get('macros');

      expect(updatedMacros).not.toBe(originalMacros);
    });

    test('should not mutate macros array on remove', () => {
      store.addMacro({ id: 'macro1', name: 'Test 1', actions: [] });
      store.addMacro({ id: 'macro2', name: 'Test 2', actions: [] });

      const originalMacros = store.get('macros');
      store.removeMacro('macro1');
      const updatedMacros = store.get('macros');

      expect(updatedMacros).not.toBe(originalMacros);
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle running macro that does not exist', () => {
      store.setRunning(true, 'nonexistent');

      expect(store.get('runningMacroId')).toBe('nonexistent');
    });

    test('should handle editing macro that does not exist', () => {
      store.setEditMode(true, 'nonexistent');

      expect(store.get('editingMacroId')).toBe('nonexistent');
    });

    test('should handle selecting macro that does not exist', () => {
      store.selectMacro('nonexistent');

      expect(store.get('selectedMacro')).toBeUndefined();
    });

    test('should handle concurrent operations', () => {
      store.addMacro({ id: 'macro1', name: 'Test', actions: [] });
      store.selectMacro('macro1');
      store.setRunning(true, 'macro1');
      store.setEditMode(true, 'macro1');

      expect(store.get('selectedMacro').id).toBe('macro1');
      expect(store.get('runningMacroId')).toBe('macro1');
      expect(store.get('editingMacroId')).toBe('macro1');
    });
  });

  describe('Debug Info', () => {
    test('should return debug information', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      store.subscribe(listener1);
      store.subscribe(listener2);

      const debugInfo = store.getDebugInfo();

      expect(debugInfo).toHaveProperty('state');
      expect(debugInfo).toHaveProperty('listenerCount');
      expect(debugInfo.listenerCount).toBe(2);
    });
  });
});
