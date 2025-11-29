/**
 * EventBus Unit Tests
 */

const EventBusClass = require('../../src/renderer/services/EventBus');

describe('EventBus', () => {
  let eventBus;

  beforeEach(() => {
    eventBus = new EventBusClass();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  describe('Initialization', () => {
    test('should initialize with empty events map', () => {
      expect(eventBus.getEventNames()).toEqual([]);
    });

    test('should initialize with debug mode off', () => {
      const debugInfo = eventBus.getDebugInfo();
      expect(Object.keys(debugInfo)).toHaveLength(0);
    });
  });

  describe('Subscribe (on)', () => {
    test('should subscribe to event', () => {
      const handler = jest.fn();
      eventBus.on('test-event', handler);

      expect(eventBus.getListenerCount('test-event')).toBe(1);
    });

    test('should return unsubscribe function', () => {
      const handler = jest.fn();
      const unsubscribe = eventBus.on('test-event', handler);

      expect(typeof unsubscribe).toBe('function');
      expect(eventBus.getListenerCount('test-event')).toBe(1);

      unsubscribe();
      expect(eventBus.getListenerCount('test-event')).toBe(0);
    });

    test('should allow multiple handlers for same event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.on('test-event', handler1);
      eventBus.on('test-event', handler2);

      expect(eventBus.getListenerCount('test-event')).toBe(2);
    });

    test('should allow subscribing to multiple events', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.on('event1', handler1);
      eventBus.on('event2', handler2);

      expect(eventBus.getEventNames()).toContain('event1');
      expect(eventBus.getEventNames()).toContain('event2');
    });

    test('should log subscription in debug mode', () => {
      eventBus.setDebugMode(true);
      const handler = jest.fn();

      eventBus.on('test-event', handler);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Subscribed to "test-event"')
      );
    });
  });

  describe('Subscribe once', () => {
    test('should subscribe and auto-unsubscribe after first emit', () => {
      const handler = jest.fn();
      eventBus.once('test-event', handler);

      expect(eventBus.getListenerCount('test-event')).toBe(1);

      eventBus.emit('test-event', 'data');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(eventBus.getListenerCount('test-event')).toBe(0);
    });

    test('should only call handler once even with multiple emits', () => {
      const handler = jest.fn();
      eventBus.once('test-event', handler);

      eventBus.emit('test-event', 'data1');
      eventBus.emit('test-event', 'data2');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('data1');
    });

    test('should return unsubscribe function', () => {
      const handler = jest.fn();
      const unsubscribe = eventBus.once('test-event', handler);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
      expect(eventBus.getListenerCount('test-event')).toBe(0);

      eventBus.emit('test-event');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Unsubscribe (off)', () => {
    test('should unsubscribe from event', () => {
      const handler = jest.fn();
      eventBus.on('test-event', handler);
      eventBus.off('test-event', handler);

      expect(eventBus.getListenerCount('test-event')).toBe(0);
    });

    test('should only remove specific handler', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.on('test-event', handler1);
      eventBus.on('test-event', handler2);
      eventBus.off('test-event', handler1);

      expect(eventBus.getListenerCount('test-event')).toBe(1);

      eventBus.emit('test-event');
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    test('should handle unsubscribing non-existent event', () => {
      expect(() => {
        eventBus.off('non-existent', jest.fn());
      }).not.toThrow();
    });

    test('should clean up empty event sets', () => {
      const handler = jest.fn();
      eventBus.on('test-event', handler);
      eventBus.off('test-event', handler);

      expect(eventBus.getEventNames()).not.toContain('test-event');
    });

    test('should log unsubscription in debug mode', () => {
      eventBus.setDebugMode(true);
      const handler = jest.fn();

      eventBus.on('test-event', handler);
      console.log.mockClear();

      eventBus.off('test-event', handler);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Unsubscribed from "test-event"')
      );
    });
  });

  describe('Emit', () => {
    test('should call all handlers for event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.on('test-event', handler1);
      eventBus.on('test-event', handler2);

      eventBus.emit('test-event', 'data');

      expect(handler1).toHaveBeenCalledWith('data');
      expect(handler2).toHaveBeenCalledWith('data');
    });

    test('should pass data to handlers', () => {
      const handler = jest.fn();
      const testData = { foo: 'bar', count: 123 };

      eventBus.on('test-event', handler);
      eventBus.emit('test-event', testData);

      expect(handler).toHaveBeenCalledWith(testData);
    });

    test('should emit with null data when not provided', () => {
      const handler = jest.fn();

      eventBus.on('test-event', handler);
      eventBus.emit('test-event');

      expect(handler).toHaveBeenCalledWith(null);
    });

    test('should handle emitting to non-existent event', () => {
      expect(() => {
        eventBus.emit('non-existent', 'data');
      }).not.toThrow();
    });

    test('should handle handler errors gracefully', () => {
      const errorHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = jest.fn();

      eventBus.on('test-event', errorHandler);
      eventBus.on('test-event', normalHandler);

      eventBus.emit('test-event', 'data');

      expect(errorHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in handler'),
        expect.any(Error)
      );
    });

    test('should log emission in debug mode', () => {
      eventBus.setDebugMode(true);
      const handler = jest.fn();

      eventBus.on('test-event', handler);
      console.log.mockClear();

      eventBus.emit('test-event', 'data');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Emitting "test-event"'),
        'data'
      );
    });

    test('should log when no listeners in debug mode', () => {
      eventBus.setDebugMode(true);

      eventBus.emit('no-listeners');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No listeners for "no-listeners"')
      );
    });
  });

  describe('Clear', () => {
    test('should clear all listeners for specific event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.on('event1', handler1);
      eventBus.on('event2', handler2);

      eventBus.clear('event1');

      expect(eventBus.getListenerCount('event1')).toBe(0);
      expect(eventBus.getListenerCount('event2')).toBe(1);
    });

    test('should clear all listeners when no event specified', () => {
      eventBus.on('event1', jest.fn());
      eventBus.on('event2', jest.fn());
      eventBus.on('event3', jest.fn());

      eventBus.clear();

      expect(eventBus.getEventNames()).toHaveLength(0);
    });

    test('should log clear action in debug mode', () => {
      eventBus.setDebugMode(true);
      eventBus.on('test-event', jest.fn());

      eventBus.clear('test-event');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Cleared all listeners for "test-event"')
      );
    });

    test('should log clear all action in debug mode', () => {
      eventBus.setDebugMode(true);
      eventBus.on('event1', jest.fn());

      eventBus.clear();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Cleared all listeners')
      );
    });
  });

  describe('Utility Methods', () => {
    test('should get event names', () => {
      eventBus.on('event1', jest.fn());
      eventBus.on('event2', jest.fn());
      eventBus.on('event3', jest.fn());

      const names = eventBus.getEventNames();
      expect(names).toContain('event1');
      expect(names).toContain('event2');
      expect(names).toContain('event3');
      expect(names).toHaveLength(3);
    });

    test('should get listener count', () => {
      eventBus.on('test-event', jest.fn());
      eventBus.on('test-event', jest.fn());

      expect(eventBus.getListenerCount('test-event')).toBe(2);
    });

    test('should return 0 for non-existent event listener count', () => {
      expect(eventBus.getListenerCount('non-existent')).toBe(0);
    });

    test('should get debug info', () => {
      eventBus.on('event1', jest.fn());
      eventBus.on('event1', jest.fn());
      eventBus.on('event2', jest.fn());

      const debugInfo = eventBus.getDebugInfo();
      expect(debugInfo).toEqual({
        event1: 2,
        event2: 1
      });
    });

    test('should toggle debug mode', () => {
      eventBus.setDebugMode(true);
      eventBus.on('test-event', jest.fn());
      expect(console.log).toHaveBeenCalled();

      console.log.mockClear();
      eventBus.setDebugMode(false);
      eventBus.on('test-event-2', jest.fn());
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle rapid subscribe/unsubscribe', () => {
      const handler = jest.fn();

      eventBus.on('test', handler);
      eventBus.off('test', handler);
      eventBus.on('test', handler);
      eventBus.off('test', handler);

      eventBus.emit('test');
      expect(handler).not.toHaveBeenCalled();
    });

    test('should handle emitting during handler execution', () => {
      const results = [];
      const handler1 = () => {
        results.push('handler1');
        eventBus.emit('event2');
      };
      const handler2 = () => {
        results.push('handler2');
      };

      eventBus.on('event1', handler1);
      eventBus.on('event2', handler2);

      eventBus.emit('event1');

      expect(results).toEqual(['handler1', 'handler2']);
    });

    test('should handle unsubscribing during emission', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn(() => {
        eventBus.off('test-event', handler2);
      });
      const handler3 = jest.fn();

      eventBus.on('test-event', handler1);
      eventBus.on('test-event', handler2);
      eventBus.on('test-event', handler3);

      eventBus.emit('test-event');

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled();
      expect(eventBus.getListenerCount('test-event')).toBe(2);
    });

    test('should handle same handler subscribed multiple times', () => {
      const handler = jest.fn();

      eventBus.on('test-event', handler);
      eventBus.on('test-event', handler);

      eventBus.emit('test-event');

      // Should be called twice (Set allows duplicate adds in this implementation)
      expect(handler).toHaveBeenCalledTimes(1); // Actually Set deduplicates
    });

    test('should handle multiple event types simultaneously', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      eventBus.on('event1', handler1);
      eventBus.on('event2', handler2);
      eventBus.on('event3', handler3);

      eventBus.emit('event1', 'data1');
      eventBus.emit('event2', 'data2');
      eventBus.emit('event3', 'data3');

      expect(handler1).toHaveBeenCalledWith('data1');
      expect(handler2).toHaveBeenCalledWith('data2');
      expect(handler3).toHaveBeenCalledWith('data3');
    });
  });

  describe('Memory Management', () => {
    test('should clean up empty event sets after unsubscribe', () => {
      const handler = jest.fn();

      eventBus.on('test-event', handler);
      expect(eventBus.getEventNames()).toContain('test-event');

      eventBus.off('test-event', handler);
      expect(eventBus.getEventNames()).not.toContain('test-event');
    });

    test('should not leave orphaned events after clear', () => {
      eventBus.on('event1', jest.fn());
      eventBus.on('event2', jest.fn());

      eventBus.clear();

      expect(eventBus.getEventNames()).toHaveLength(0);
      expect(Object.keys(eventBus.getDebugInfo())).toHaveLength(0);
    });
  });
});
