import { mock } from 'node:test';

/**
 * Create a mock object for Certificate repository
 */
export default class CertificateRepositoryMock {
  list = mock.fn();
  findById = mock.fn();
  create = mock.fn();
  update = mock.fn();
  updateNameAndDescription = mock.fn();
  delete = mock.fn();
}
