import { mock } from 'node:test';

/**
 * Create a mock object for Transformer service
 */
export default class TransformerServiceMock {
  listManifest = mock.fn();
  getManifest = mock.fn();
  search = mock.fn();
  findAll = mock.fn();
  findById = mock.fn();
  create = mock.fn();
  update = mock.fn();
  delete = mock.fn();
  test = mock.fn();
  generateTemplate = mock.fn();
}
