import crypto from 'node:crypto';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import CryptoRepository from './crypto.repository';
import testData from '../../tests/utils/test-data';

jest.mock('node:crypto');

let database: Database;
describe('Repository with populated database', () => {
  beforeAll(async () => {
    database = await initDatabase('crypto');
  });

  afterAll(async () => {
    await emptyDatabase('crypto');
  });

  describe('Crypto', () => {
    let repository: CryptoRepository;

    beforeEach(() => {
      jest.clearAllMocks();

      repository = new CryptoRepository(database);
    });

    it('should not create crypto if already init', () => {
      (crypto.randomBytes as jest.Mock).mockReturnValueOnce('init vector').mockReturnValueOnce('security key');

      repository.createCryptoSettings(testData.engine.settings.id);
      expect(crypto.randomBytes).not.toHaveBeenCalled();
    });

    it('should properly get crypto settings', () => {
      expect(repository.getCryptoSettings(testData.engine.settings.id)).toEqual(testData.engine.crypto);
    });
  });
});

describe('Repository with empty database', () => {
  beforeAll(async () => {
    database = await initDatabase('crypto', false);
  });

  afterAll(async () => {
    await emptyDatabase('crypto');
  });
  describe('Crypto', () => {
    let repository: CryptoRepository;

    beforeEach(() => {
      jest.clearAllMocks();

      repository = new CryptoRepository(database);
    });

    it('should properly init crypto settings table', () => {
      (crypto.randomBytes as jest.Mock).mockReturnValueOnce('init vector').mockReturnValueOnce('security key');

      repository.createCryptoSettings('id1');
      expect(crypto.randomBytes).toHaveBeenCalledTimes(2);
      expect(crypto.randomBytes).toHaveBeenCalledWith(16);
      expect(crypto.randomBytes).toHaveBeenCalledWith(32);

      expect(repository.getCryptoSettings('id1')).toEqual({
        algorithm: 'aes-256-cbc',
        initVector: 'init vector',
        securityKey: 'security key'
      });
    });
  });
});
