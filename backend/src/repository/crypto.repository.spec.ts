import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { Database } from 'better-sqlite3';
import CryptoRepository from './crypto.repository';

jest.mock('node:crypto', () => ({
  randomBytes: () => {
    return Buffer.from('0123456789abcdef');
  }
}));
jest.mock('../tests/__mocks__/database.mock');

let database: Database;
let repository: CryptoRepository;
describe('Crypto repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    all.mockReturnValue([]);
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new CryptoRepository(database);
  });

  it('should properly init crypto settings table', () => {
    repository.createCryptoSettings('id1');
    expect(database.prepare).toHaveBeenCalledWith('INSERT INTO crypto VALUES (?,?,?,?);');
    expect(run).toHaveBeenCalledWith(
      'id1',
      'aes-256-cbc',
      Buffer.from('0123456789abcdef').toString('base64'),
      Buffer.from('0123456789abcdef').toString('base64')
    );

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('should not create crypto if already init', () => {
    get.mockReturnValueOnce({});

    repository.createCryptoSettings('id1');
    expect(database.prepare).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(0);
  });

  it('should properly get crypto settings', () => {
    repository.getCryptoSettings('id1');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT algorithm, init_vector AS initVector, security_key AS securityKey FROM crypto WHERE id = ?;'
    );
    expect(get).toHaveBeenCalledWith('id1');
  });
});
