import { mock } from 'node:test';

/**
 * Create a mock object for OIBus Transformer
 */
export default class OIBusTransformerMock {
  northConnector = {};
  transformer = {};
  logger = {};
  transform = mock.fn();
}
