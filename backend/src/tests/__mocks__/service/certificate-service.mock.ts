import { mock } from 'node:test';

/**
 * Create a mock object for Certificate Service
 */
export default class CertificateServiceMock {
  list = mock.fn();
  findById = mock.fn();
  create = mock.fn();
  update = mock.fn();
  delete = mock.fn();
}
