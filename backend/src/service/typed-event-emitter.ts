import { EventEmitter } from 'node:events';

/**
 * Thin, fully-typed wrapper around Node's {@link EventEmitter}.
 *
 * `T` is an event map (an `interface`/`type` whose keys are event names and whose
 * values are the single payload type for that event). Each event carries exactly
 * one payload argument — which matches OIBus's event conventions
 * (`emit('run-end', { ... })`) — so `emit`, `on`, `once` and `off` are all checked
 * against the map. This turns payload-shape mismatches and event-name typos into
 * compile errors instead of silent `undefined`s at runtime.
 */
export default class TypedEventEmitter<T extends object> extends EventEmitter {
  override on<K extends keyof T & string>(event: K, listener: (payload: T[K]) => void): this {
    return super.on(event, listener);
  }

  override once<K extends keyof T & string>(event: K, listener: (payload: T[K]) => void): this {
    return super.once(event, listener);
  }

  override off<K extends keyof T & string>(event: K, listener: (payload: T[K]) => void): this {
    return super.off(event, listener);
  }

  override emit<K extends keyof T & string>(event: K, payload: T[K]): boolean {
    return super.emit(event, payload);
  }
}
