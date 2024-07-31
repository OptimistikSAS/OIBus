import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { generateRandomId } from '../service/utils';
import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../shared/model/engine.model';
import { Database } from 'better-sqlite3';
import OianalyticsRegistrationRepository from './oianalytics-registration.repository';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));

let database: Database;
let repository: OianalyticsRegistrationRepository;
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
    repository = new OianalyticsRegistrationRepository(database);
  });

  it('should properly init registration settings table', () => {
    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false,
      proxyUrl: '',
      proxyUsername: '',
      proxyPassword: ''
    };

    repository.createDefault(command);
    expect(generateRandomId).toHaveBeenCalledWith();
    expect(database.prepare).toHaveBeenCalledWith('INSERT INTO registrations (id, host, status) VALUES (?, ?, ?);');
    expect(run).toHaveBeenCalledWith('123456', command.host, 'NOT_REGISTERED');

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('should update registration settings', () => {
    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false
    };
    repository.register(command, '1234', 'http://localhost:4200/api/oianalytics/oibus/registration?id=id', '2020-01-01T00:00:00Z');
    expect(database.prepare).toHaveBeenCalledWith(
      `UPDATE registrations SET host = ?, status = 'PENDING', token = '', activation_code = ?, check_url = ?, ` +
        `activation_expiration_date = ?, use_proxy = ?, proxy_url = ?, proxy_username = ?, proxy_password = ?, ` +
        `accept_unauthorized = ? WHERE rowid=(SELECT MIN(rowid) FROM registrations);`
    );
    expect(run).toHaveBeenCalledWith(
      command.host,
      '1234',
      'http://localhost:4200/api/oianalytics/oibus/registration?id=id',
      '2020-01-01T00:00:00Z',
      +command.useProxy,
      command.proxyUrl,
      command.proxyUsername,
      command.proxyPassword,
      +command.acceptUnauthorized
    );
  });
});

it('should edit registration settings', () => {
  const command: RegistrationSettingsCommandDTO = {
    host: 'http://localhost:4200',
    acceptUnauthorized: false,
    useProxy: false
  };
  repository.update(command);
  expect(database.prepare).toHaveBeenCalledWith(
    `UPDATE registrations SET ` +
      `use_proxy = ?, proxy_url = ?, proxy_username = ?, proxy_password = ?, ` +
      `accept_unauthorized = ? WHERE rowid=(SELECT MIN(rowid) FROM registrations);`
  );
  expect(run).toHaveBeenCalledWith(
    +command.useProxy,
    command.proxyUrl,
    command.proxyUsername,
    command.proxyPassword,
    +command.acceptUnauthorized
  );
});

describe('Non-empty Registration repository', () => {
  const existingSettings: RegistrationSettingsDTO = {
    id: 'id1',
    host: 'http://localhost:4200',
    acceptUnauthorized: false,
    useProxy: false,
    proxyUrl: '',
    proxyUsername: '',
    proxyPassword: '',
    token: 'token',
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
    repository = new OianalyticsRegistrationRepository(database);
  });

  it('should properly get the registration settings', () => {
    const expectedValue: RegistrationSettingsDTO = {
      id: 'id1',
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false,
      proxyUrl: '',
      proxyUsername: '',
      proxyPassword: '',
      token: 'token',
      activationCode: '1234',
      status: 'NOT_REGISTERED',
      activationDate: '2020-20-20T00:00:00.000Z',
      activationExpirationDate: '2020-20-20T00:00:00.000Z'
    };
    const registration = repository.get();
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, host, token, activation_code AS activationCode, status, activation_date AS activationDate, ' +
        'check_url AS checkUrl, activation_expiration_date AS activationExpirationDate, use_proxy AS useProxy, ' +
        `proxy_url AS proxyUrl, proxy_username AS proxyUsername, proxy_password AS proxyPassword, ` +
        'accept_unauthorized AS acceptUnauthorized FROM registrations;'
    );
    expect(all).toHaveBeenCalledTimes(2);
    expect(registration).toEqual(expectedValue);
  });

  it('should not create registration settings if they already exist', () => {
    const command: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false,
      proxyUrl: '',
      proxyUsername: '',
      proxyPassword: ''
    };
    repository.createDefault(command);
    expect(generateRandomId).not.toHaveBeenCalled();
  });

  it('should unregister', () => {
    repository.unregister();
    expect(database.prepare).toHaveBeenCalledWith(
      `UPDATE registrations SET status = 'NOT_REGISTERED', activation_expiration_date = '', check_url = '', ` +
        `activation_date = '', activation_code = '', token = '' WHERE rowid=(SELECT MIN(rowid) FROM registrations);`
    );
    expect(run).toHaveBeenCalledWith();
  });

  it('should activate registration', () => {
    repository.activate('2020-01-01T00:00:00.000Z', 'token');
    expect(database.prepare).toHaveBeenCalledWith(
      `UPDATE registrations SET status = 'REGISTERED', activation_expiration_date = '', activation_code = '', ` +
        `check_url = '', activation_date = ?, token = ? WHERE rowid=(SELECT MIN(rowid) FROM registrations);`
    );
    expect(run).toHaveBeenCalledWith('2020-01-01T00:00:00.000Z', 'token');
  });
});
