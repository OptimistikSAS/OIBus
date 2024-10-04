/**
 * Create a mock object for Connector Cache Service
 */
export default class ConnectorCacheServiceMock {
  updateMetrics = jest.fn();
  metrics = {
    numberOfValues: 1,
    numberOfFiles: 1
  };
}
