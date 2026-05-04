import { mock } from 'node:test';
import { CryptoSettings } from '../../../../../shared/model/engine.model';

/**
 * Create a mock object for Crypto repository
 */
export default class CryptoRepositoryMock {
  getCryptoSettings = mock.fn((_oibusId: string): CryptoSettings | null => null);
  createCryptoSettings = mock.fn((_oibusId: string): void => undefined);
}
