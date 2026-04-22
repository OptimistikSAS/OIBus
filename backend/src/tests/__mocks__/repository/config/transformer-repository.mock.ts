import { mock } from 'node:test';

/**
 * Create a mock object for Transformer repository
 */
export default class TransformerRepositoryMock {
  list = mock.fn();
  search = mock.fn();
  save = mock.fn();
  findById = mock.fn();
  delete = mock.fn();
}
