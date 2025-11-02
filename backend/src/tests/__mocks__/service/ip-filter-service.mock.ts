import { EventEmitter } from 'node:events';

/**
 * Create a mock object for IP Filter Service
 */
export default jest.fn().mockImplementation(() => ({
  list: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  whiteListEvent: new EventEmitter()
}));
