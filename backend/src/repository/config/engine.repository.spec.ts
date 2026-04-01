import { Database } from 'better-sqlite3';
import { emptyDatabase, flushPromises, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import { generateRandomId } from '../../service/utils';
import EngineRepository from './engine.repository';
import { EngineSettings } from '../../model/engine.model';
import { version } from '../../../package.json';
import argon2 from 'argon2';
import UserRepository from './user.repository';

jest.mock('../../service/utils');
jest.mock('argon2');

const TEST_DB_PATH = 'src/tests/test-config-engine.db';

let database: Database;
describe('EngineRepository with populated database', () => {
  beforeAll(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  describe('Engine', () => {
    let repository: EngineRepository;
    beforeEach(() => {
      jest.resetAllMocks();
      repository = new EngineRepository(database, '3.5.0');
    });

    it('should properly get the engine settings', () => {
      expect(repository.get()).toEqual(testData.engine.settings);
    });

    it('should update engine settings', () => {
      repository.update({ ...testData.engine.command, name: 'updated engine' }, testData.users.list[0].id);
      expect(stripAuditFields(repository.get())).toEqual({
        ...testData.engine.command,
        id: testData.engine.settings.id,
        version: testData.engine.settings.version,
        launcherVersion: testData.engine.settings.launcherVersion,
        name: 'updated engine'
      });
    });

    it('should update version', () => {
      repository.updateVersion('9.9.99', '9.9.99');
      expect(repository.get()!.version).toEqual('9.9.99');
    });
  });
});

describe('EngineRepository with empty database', () => {
  beforeAll(async () => {
    database = await initDatabase('config', false, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  describe('Engine', () => {
    let repository: EngineRepository;
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should properly init engine settings table', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('engineId1');
      repository = new EngineRepository(database, '3.5.0');

      const expectedResult: Omit<EngineSettings, 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'> = {
        id: 'engineId1',
        version,
        launcherVersion: '3.5.0',
        name: 'OIBus',
        port: 2223,
        proxyEnabled: false,
        proxyPort: 9000,
        logParameters: {
          console: {
            level: 'silent'
          },
          file: {
            level: 'info',
            maxFileSize: 50,
            numberOfFiles: 5
          },
          database: {
            level: 'info',
            maxNumberOfLogs: 100_000
          },
          loki: {
            level: 'silent',
            interval: 60,
            address: '',
            username: '',
            password: ''
          },
          oia: {
            level: 'silent',
            interval: 10
          }
        }
      };
      expect(stripAuditFields(repository.get())).toEqual(expectedResult);
    });
  });

  describe('User', () => {
    let repository: UserRepository;
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should not create a default admin user on hash error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementationOnce(() => null);

      (argon2.hash as jest.Mock).mockImplementationOnce(() => {
        throw new Error('hash error');
      });
      (generateRandomId as jest.Mock).mockReturnValueOnce('defaultUser');
      repository = new UserRepository(database);

      await flushPromises();
      expect(repository.findById('defaultUser')).toEqual(null);
      expect(consoleErrorSpy).toHaveBeenCalledWith('hash error');

      consoleErrorSpy.mockRestore();
    });

    it('should create a default admin user', async () => {
      (argon2.hash as jest.Mock).mockImplementationOnce(password => password);
      (generateRandomId as jest.Mock).mockReturnValueOnce('defaultUser');
      repository = new UserRepository(database);

      await flushPromises();
      expect(argon2.hash).toHaveBeenCalledWith('pass');
      expect(stripAuditFields(repository.findById('defaultUser'))).toEqual({
        id: 'defaultUser',
        login: 'admin',
        firstName: null,
        lastName: null,
        email: null,
        language: 'en',
        timezone: 'Europe/Paris'
      });
      expect(repository.getHashedPasswordByLogin('admin')).toEqual('pass'); //default password
    });
  });
});
