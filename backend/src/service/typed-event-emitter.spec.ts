import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import TypedEventEmitter from './typed-event-emitter';

interface TestEvents {
  'test-event': { value: number };
}

describe('TypedEventEmitter', () => {
  it('should register and trigger a listener with on', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const listener = mock.fn();

    emitter.on('test-event', listener);
    emitter.emit('test-event', { value: 1 });

    assert.strictEqual(listener.mock.calls.length, 1);
    assert.deepStrictEqual(listener.mock.calls[0].arguments[0], { value: 1 });
  });

  it('should register and trigger a listener only once with once', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const listener = mock.fn();

    emitter.once('test-event', listener);
    emitter.emit('test-event', { value: 1 });
    emitter.emit('test-event', { value: 2 });

    assert.strictEqual(listener.mock.calls.length, 1);
    assert.deepStrictEqual(listener.mock.calls[0].arguments[0], { value: 1 });
  });

  it('should remove a listener with off', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const listener = mock.fn();

    emitter.on('test-event', listener);
    emitter.off('test-event', listener);
    emitter.emit('test-event', { value: 1 });

    assert.strictEqual(listener.mock.calls.length, 0);
  });
});
