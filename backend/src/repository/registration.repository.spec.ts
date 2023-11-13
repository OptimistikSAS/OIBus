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
      host: 'http://localhost:4200'
    };

    repository.createRegistrationSettings(command);
    expect(generateRandomId).toHaveBeenCalledWith();
    expect(database.prepare).toHaveBeenCalledWith('INSERT INTO registrations (id, host, status) VALUES (?, ?, ?);');
    expect(run).toHaveBeenCalledWith('123456', command.host, 'NOT_REGISTERED');

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('should update registration settings', () => {
    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200'
    };
    repository.updateRegistration(
      command,
      '1234',
      'http://localhost:4200/api/oianalytics/oibus/registration?id=id',
      '2020-01-01T00:00:00Z'
    );
    expect(database.prepare).toHaveBeenCalledWith(
      `UPDATE registrations SET host = ?, status = ?, activation_code = ?, check_url = ?, activation_expiration_date = ?` +
        ` WHERE rowid=(SELECT MIN(rowid) FROM registrations);`
    );
    expect(run).toHaveBeenCalledWith(
      command.host,
      'PENDING',
      '1234',
      'http://localhost:4200/api/oianalytics/oibus/registration?id=id',
      '2020-01-01T00:00:00Z'
    );
  });
});

describe('Non-empty Registration repository', () => {
  const existingSettings: RegistrationSettingsDTO = {
    id: 'id1',
    host: 'http://localhost:4200',
    activationCode: '1234',
    status: 'NOT_REGISTERED',
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
      host: 'http://localhost:4200',
      activationCode: '1234',
      status: 'NOT_REGISTERED',
      activationDate: '2020-20-20T00:00:00.000Z',
      activationExpirationDate: '2020-20-20T00:00:00.000Z'
    };
    const registration = repository.getRegistrationSettings();
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, host, activation_code AS activationCode, status, activation_date AS activationDate, ' +
        'check_url AS checkUrl, activation_expiration_date AS activationExpirationDate FROM registrations;'
    );
    expect(all).toHaveBeenCalledTimes(2);
    expect(registration).toEqual(expectedValue);
  });

  it('should not create registration settings if they already exist', () => {
    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200'
    };
    repository.createRegistrationSettings(command);
    expect(generateRandomId).not.toHaveBeenCalled();
  });

  it('should unregister', () => {
    repository.unregister();
    expect(database.prepare).toHaveBeenCalledWith(
      `UPDATE registrations SET status = 'NOT_REGISTERED', activation_expiration_date = '', check_url = '', ` +
        `activation_date = '', activation_code = '' WHERE rowid=(SELECT MIN(rowid) FROM registrations);`
    );
    expect(run).toHaveBeenCalledWith();
  });

  it('should activate registration', () => {
    repository.activateRegistration('2020-01-01T00:00:00.000Z');
    expect(database.prepare).toHaveBeenCalledWith(
      `UPDATE registrations SET status = 'REGISTERED', activation_expiration_date = '', activation_code = '', ` +
        `check_url = '', activation_date = ? WHERE rowid=(SELECT MIN(rowid) FROM registrations);`
    );
    expect(run).toHaveBeenCalledWith('2020-01-01T00:00:00.000Z');
  });
});
