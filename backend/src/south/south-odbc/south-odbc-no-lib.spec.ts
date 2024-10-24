import SouthODBC from './south-odbc';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import { SouthODBCItemSettings, SouthODBCItemSettingsDateTimeFields, SouthODBCSettings } from '../../../shared/model/south-settings.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/south-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import { SouthConnectorEntity } from '../../model/south-connector.model';

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const southCacheService = new SouthCacheServiceMock();

jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return southCacheService;
    }
);

const logger: pino.Logger = new PinoLogger();
const addContentCallback = jest.fn();

// Spy on console info and error
jest.spyOn(global.console, 'info').mockImplementation(() => null);
jest.spyOn(global.console, 'error').mockImplementation(() => null);

describe('SouthODBC without ODBC Library', () => {
  jest.mock('../../service/utils');
  jest.mock(
    'odbc',
    () => {
      throw new Error('bad');
    },
    { virtual: true }
  );
  jest.mock('node-fetch');
  jest.mock('node:fs/promises');
  jest.mock('../../service/utils');

  let south: SouthODBC;
  const configuration: SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'odbc',
    description: 'my test connector',
    enabled: true,
    settings: {
      throttling: {
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0
      },
      remoteAgent: false,
      connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
      password: 'password',
      connectionTimeout: 1000,
      retryInterval: 1000,
      requestTimeout: 1000
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          query: 'SELECT * FROM table',
          dateTimeFields: [
            {
              fieldName: 'anotherTimestamp',
              useAsReference: false,
              type: 'unix-epoch-ms',
              timezone: null,
              format: null,
              locale: null
            } as unknown as SouthODBCItemSettingsDateTimeFields,
            {
              fieldName: 'timestamp',
              useAsReference: true,
              type: 'string',
              timezone: 'Europe/Paris',
              format: 'yyyy-MM-dd HH:mm:ss.SSS',
              locale: 'en-US'
            }
          ],
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          query: 'SELECT * FROM table',
          dateTimeFields: null,
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          query: 'SELECT * FROM table',
          dateTimeFields: [
            {
              fieldName: 'anotherTimestamp',
              useAsReference: false,
              type: 'unix-epoch-ms',
              timezone: null,
              format: null,
              locale: null
            } as unknown as SouthODBCItemSettingsDateTimeFields,
            {
              fieldName: 'timestamp',
              useAsReference: true,
              type: 'string',
              timezone: 'Europe/Paris',
              format: 'yyyy-MM-dd HH:mm:ss.SSS',
              locale: 'en-US'
            }
          ],
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanModeId: 'scanModeId2'
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    south = new SouthODBC(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      'baseFolder'
    );
  });

  it('should throw error if library not loaded', async () => {
    await expect(south.testOdbcConnection()).rejects.toThrow(new Error('odbc library not loaded'));

    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';
    await expect(south.queryOdbcData(configuration.items[0], startTime, endTime)).rejects.toThrow(new Error('odbc library not loaded'));
  });
});
