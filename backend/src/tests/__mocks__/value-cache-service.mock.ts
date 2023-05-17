import { EventEmitter } from 'node:events';

/**
 * Create a mock object for Value Cache Service
 */
export default class ValueCacheServiceMock {
  triggerRun: EventEmitter = {
    on: jest.fn(),
    emit: jest.fn()
  } as unknown as EventEmitter;
  start = jest.fn();
  stop = jest.fn();
  cacheValues = jest.fn();
  getValuesToSend = jest.fn();
  removeSentValues = jest.fn();
  manageErroredValues = jest.fn();
  isEmpty = jest.fn();
  setLogger = jest.fn();
}
