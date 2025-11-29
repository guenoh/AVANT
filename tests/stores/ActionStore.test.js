/**
 * ActionStore Unit Tests
 */

const ActionStoreClass = require('../../src/renderer/stores/ActionStore');

describe('ActionStore', () => {
  let store;

  beforeEach(() => {
    store = new ActionStoreClass();
  });

  describe('Initialization', () => {
    test('should initialize with default state', () => {
      const state = store.getState();
      expect(state).toEqual({
        actions: [],
        isRecording: false,
        isExecuting: false,
        executingActionIndex: -1,
        isClickMode: false,
        clickModeType: null,
        clickModePoints: []
      });
    });

    test('should have empty listener set', () => {
      const debugInfo = store.getDebugInfo();
      expect(debugInfo.listenerCount).toBe(0);
    });
  });

  describe('State Management', () => {
    test('should get specific state property', () => {
      expect(store.get('actions')).toEqual([]);
      expect(store.get('isRecording')).toBe(false);
    });

    test('should update state immutably', () => {
      const oldState = store.getState();
      store.setState({ isRecording: true });
      const newState = store.getState();

      expect(newState).not.toBe(oldState); // Different reference
      expect(newState.isRecording).toBe(true);
      expect(oldState.isRecording).toBe(false); // Old state unchanged
    });

    test('should notify listeners on state change', () => {
      const listener = jest.fn();
      store.subscribe(listener);

      store.setState({ isRecording: true });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'state-change',
          changes: { isRecording: true }
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
      expect(store.getDebugInfo().listenerCount).toBe(1);

      unsubscribe();
      expect(store.getDebugInfo().listenerCount).toBe(0);
    });

    test('should handle multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      store.subscribe(listener1);
      store.subscribe(listener2);

      store.setState({ isRecording: true });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    test('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = jest.fn();

      console.error = jest.fn(); // Mock console.error

      store.subscribe(errorListener);
      store.subscribe(normalListener);

      store.setState({ isRecording: true });

      // Both should be called despite error
      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Action Management', () => {
    test('should set actions array', () => {
      const actions = [
        { id: '1', type: 'tap', x: 100, y: 200 },
        { id: '2', type: 'swipe', x1: 0, y1: 0, x2: 100, y2: 100 }
      ];

      store.setActions(actions);

      expect(store.get('actions')).toEqual(actions);
    });

    test('should add action to list', () => {
      const action = { id: '1', type: 'tap', x: 100, y: 200 };

      store.addAction(action);

      expect(store.get('actions')).toHaveLength(1);
      expect(store.get('actions')[0]).toEqual(action);
    });

    test('should add multiple actions', () => {
      store.addAction({ id: '1', type: 'tap', x: 100, y: 200 });
      store.addAction({ id: '2', type: 'swipe', x1: 0, y1: 0, x2: 100, y2: 100 });

      expect(store.get('actions')).toHaveLength(2);
    });

    test('should update action by index', () => {
      store.addAction({ id: '1', type: 'tap', x: 100, y: 200 });
      store.updateAction(0, { x: 150, y: 250 });

      const action = store.get('actions')[0];
      expect(action.x).toBe(150);
      expect(action.y).toBe(250);
      expect(action.type).toBe('tap'); // Other properties unchanged
    });

    test('should remove action by index', () => {
      store.addAction({ id: '1', type: 'tap', x: 100, y: 200 });
      store.addAction({ id: '2', type: 'swipe', x1: 0, y1: 0, x2: 100, y2: 100 });

      store.removeAction(0);

      expect(store.get('actions')).toHaveLength(1);
      expect(store.get('actions')[0].id).toBe('2');
    });

    test('should clear all actions', () => {
      store.addAction({ id: '1', type: 'tap', x: 100, y: 200 });
      store.addAction({ id: '2', type: 'swipe', x1: 0, y1: 0, x2: 100, y2: 100 });

      store.clearActions();

      expect(store.get('actions')).toEqual([]);
    });

    test('should get action by index', () => {
      const action = { id: '1', type: 'tap', x: 100, y: 200 };
      store.addAction(action);

      expect(store.getAction(0)).toEqual(action);
    });
  });

  describe('Recording State', () => {
    test('should set recording state', () => {
      store.setRecording(true);
      expect(store.get('isRecording')).toBe(true);

      store.setRecording(false);
      expect(store.get('isRecording')).toBe(false);
    });

    test('should notify listeners on recording state change', () => {
      const listener = jest.fn();
      store.subscribe(listener);

      store.setRecording(true);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: { isRecording: true }
        })
      );
    });
  });

  describe('Execution State', () => {
    test('should set executing state', () => {
      store.setExecuting(true, 0);

      expect(store.get('isExecuting')).toBe(true);
      expect(store.get('executingActionIndex')).toBe(0);
    });

    test('should set executing state with default index', () => {
      store.setExecuting(true);

      expect(store.get('isExecuting')).toBe(true);
      expect(store.get('executingActionIndex')).toBe(-1);
    });

    test('should update executing action index', () => {
      store.setExecutingActionIndex(5);

      expect(store.get('executingActionIndex')).toBe(5);
    });
  });

  describe('Click Mode', () => {
    test('should enable click mode with type', () => {
      store.setClickMode(true, 'tap');

      expect(store.get('isClickMode')).toBe(true);
      expect(store.get('clickModeType')).toBe('tap');
      expect(store.get('clickModePoints')).toEqual([]);
    });

    test('should disable click mode', () => {
      store.setClickMode(true, 'tap');
      store.addClickModePoint({ x: 100, y: 200 });

      store.setClickMode(false);

      expect(store.get('isClickMode')).toBe(false);
      expect(store.get('clickModeType')).toBe(null);
      // Points should be preserved when disabling
      expect(store.get('clickModePoints')).toEqual([{ x: 100, y: 200 }]);
    });

    test('should add click mode point', () => {
      store.setClickMode(true, 'swipe');
      store.addClickModePoint({ x: 100, y: 200 });
      store.addClickModePoint({ x: 300, y: 400 });

      const points = store.get('clickModePoints');
      expect(points).toHaveLength(2);
      expect(points[0]).toEqual({ x: 100, y: 200 });
      expect(points[1]).toEqual({ x: 300, y: 400 });
    });

    test('should clear click mode points', () => {
      store.addClickModePoint({ x: 100, y: 200 });
      store.clearClickModePoints();

      expect(store.get('clickModePoints')).toEqual([]);
    });

    test('should reset points when entering new click mode', () => {
      store.setClickMode(true, 'tap');
      store.addClickModePoint({ x: 100, y: 200 });

      store.setClickMode(true, 'swipe');

      expect(store.get('clickModePoints')).toEqual([]);
    });
  });

  describe('Reset', () => {
    test('should reset to initial state', () => {
      // Modify state
      store.addAction({ id: '1', type: 'tap', x: 100, y: 200 });
      store.setRecording(true);
      store.setExecuting(true, 0);
      store.setClickMode(true, 'tap');

      // Reset
      store.reset();

      // Check reset state
      const state = store.getState();
      expect(state).toEqual({
        actions: [],
        isRecording: false,
        isExecuting: false,
        executingActionIndex: -1,
        isClickMode: false,
        clickModeType: null,
        clickModePoints: []
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

  describe('Immutability', () => {
    test('should not mutate actions array on update', () => {
      const action1 = { id: '1', type: 'tap', x: 100, y: 200 };
      const action2 = { id: '2', type: 'swipe', x1: 0, y1: 0, x2: 100, y2: 100 };

      store.addAction(action1);
      store.addAction(action2);

      const originalActions = store.get('actions');
      store.updateAction(0, { x: 150 });
      const updatedActions = store.get('actions');

      expect(updatedActions).not.toBe(originalActions);
    });

    test('should not mutate actions array on remove', () => {
      store.addAction({ id: '1', type: 'tap', x: 100, y: 200 });
      store.addAction({ id: '2', type: 'swipe', x1: 0, y1: 0, x2: 100, y2: 100 });

      const originalActions = store.get('actions');
      store.removeAction(0);
      const updatedActions = store.get('actions');

      expect(updatedActions).not.toBe(originalActions);
    });
  });
});
