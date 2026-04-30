import { mock } from 'node:test';

/**
 * Create a mock object for Crypto repository
 */
export default class CryptoRepositoryMock {
  getCryptoSettings = mock.fn();
  createCryptoSettings = mock.fn();
}
