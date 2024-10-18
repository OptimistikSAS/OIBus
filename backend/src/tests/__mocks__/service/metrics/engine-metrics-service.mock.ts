import { EventEmitter } from 'node:events';

/**
 * Create a mock object for Engine Metrics Service
 */
export default jest.fn().mockImplementation(() => ({
  setLogger: jest.fn(),
  resetMetrics: jest.fn(),
  updateMetrics: jest.fn(),
  stream: new EventEmitter()
}));
