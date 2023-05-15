/**
 * Create a mock object for Value Cache Service
 */
export default class ValueCacheServiceMock {
  triggerRun = {
    on: jest.fn(),
    emit: jest.fn()
  };
  start = jest.fn();
  stop = jest.fn();
  cacheValues = jest.fn();
  getValuesToSend = jest.fn();
  removeSentValues = jest.fn();
  manageErroredValues = jest.fn();
  isEmpty = jest.fn();
  setLogger = jest.fn();
}
