import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { generateRandomId } from '../service/utils';
import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../shared/model/engine.model';
import { Database } from 'better-sqlite3';
import RegistrationRepository from './registration.repository';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));

let database: Database;
let repository: RegistrationRepository;
describe('Empty registration repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    all.mockReturnValue([]);
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new RegistrationRepository(database);
  });

  it('should properly init registration settings table', () => {
    const command: RegistrationSettingsCommandDTO = {
      enabled: false,
      host: 'http://localhost:4200'
    };

    repository.createRegistrationSettings(command);
    expect(generateRandomId).toHaveBeenCalledWith();
    expect(database.prepare).toHaveBeenCalledWith('INSERT INTO registrations (id, enabled, host) VALUES (?, ?, ?);');
    expect(run).toHaveBeenCalledWith('123456', +command.enabled, command.host);

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('should update registration settings', () => {
    const command: RegistrationSettingsCommandDTO = {
      enabled: false,
      host: 'http://localhost:4200'
    };
    repository.updateRegistrationSettings(command);
    expect(database.prepare).toHaveBeenCalledWith(
      'UPDATE registrations SET enabled = ?, host = ? WHERE rowid=(SELECT MIN(rowid) FROM registrations);'
    );
    expect(run).toHaveBeenCalledWith(+command.enabled, command.host);
  });
});

describe('Non-empty Registration repository', () => {
  const existingSettings: RegistrationSettingsDTO = {
    id: 'id1',
    enabled: false,
    host: 'http://localhost:4200',
    activationCode: '1234',
    activated: false,
    activationDate: '2020-20-20T00:00:00.000Z',
    activationExpirationDate: '2020-20-20T00:00:00.000Z'
  };
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    all.mockReturnValue([existingSettings]);
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new RegistrationRepository(database);
  });

  it('should properly get the registration settings', () => {
    const expectedValue: RegistrationSettingsDTO = {
      id: 'id1',
      enabled: false,
      host: 'http://localhost:4200',
      activationCode: '1234',
      activated: false,
      activationDate: '2020-20-20T00:00:00.000Z',
      activationExpirationDate: '2020-20-20T00:00:00.000Z'
    };
    const registration = repository.getRegistrationSettings();
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, enabled, host, activation_code AS activationCode, activated, activation_date AS activationDate, ' +
        'activation_expiration_date AS activationExpirationDate FROM registrations;'
    );
    expect(all).toHaveBeenCalledTimes(2);
    expect(registration).toEqual(expectedValue);
  });

  it('should not create registration settings if they already exist', () => {
    const command: RegistrationSettingsCommandDTO = {
      enabled: false,
      host: 'http://localhost:4200'
    };
    repository.createRegistrationSettings(command);
    expect(generateRandomId).not.toHaveBeenCalled();
  });

  it('should create activation code', () => {
    repository.createActivationCode('1234', '2020-01-01T00:00:00.000Z');
    expect(database.prepare).toHaveBeenCalledWith(
      `UPDATE registrations SET activationCode = ?, activation_expiration_date = ?, activated = 0, ` +
        `activation_date = '' WHERE rowid=(SELECT MIN(rowid) FROM registrations);`
    );
    expect(run).toHaveBeenCalledWith('1234', '2020-01-01T00:00:00.000Z');
  });

  it('should activate registration', () => {
    repository.activateRegistration('2020-01-01T00:00:00.000Z');
    expect(database.prepare).toHaveBeenCalledWith(
      `UPDATE registrations SET activated = 1, activation_expiration_date = '', activation_date = ? ` +
        `WHERE rowid=(SELECT MIN(rowid) FROM registrations);`
    );
    expect(run).toHaveBeenCalledWith('2020-01-01T00:00:00.000Z');
  });
});
