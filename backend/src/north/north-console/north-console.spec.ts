import fs from 'node:fs/promises';

import NorthConsole from './north-console';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import ProxyService from '../../service/proxy.service';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';

jest.mock('node:fs/promises');
// Spy on console table and info
jest.spyOn(global.console, 'table').mockImplementation(() => {});
jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const proxyService: ProxyService = new ProxyService(repositoryService.proxyRepository, encryptionService);

const nowDateString = '2020-02-02T02:02:02.222Z';
const configuration: NorthConnectorDTO = {
  id: 'id',
  name: 'north',
  type: 'test',
  description: 'my test connector',
  enabled: true,
  settings: {
    verbose: true
  },
  caching: {
    scanModeId: 'id1',
    retryInterval: 5000,
    groupCount: 10000,
    maxSendCount: 10000,
    retryCount: 2,
    maxSize: 1000
  },
  archive: {
    enabled: true,
    retentionDuration: 720
  }
};
let north: NorthConsole;

describe('NorthConsole with verbose mode', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    north = new NorthConsole(configuration, encryptionService, proxyService, repositoryService, logger, 'baseFolder');
  });

  it('should properly handle values in verbose mode', async () => {
    const values = [
      {
        pointId: 'pointId',
        timestamp: nowDateString,
        data: { value: 666, quality: 'good' }
      }
    ];
    await north.handleValues(values);

    expect(console.table).toHaveBeenCalledWith(values, ['pointId', 'timestamp', 'data']);
    expect(process.stdout.write).not.toHaveBeenCalled();
  });

  it('should properly handle values in verbose mode', async () => {
    const filePath = '/path/to/file/example.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    await north.handleFile(filePath);
    expect(fs.stat).toHaveBeenCalledWith(filePath);
    expect(console.table).toHaveBeenCalledWith([{ filePath, fileSize: 666 }]);
    expect(process.stdout.write).not.toHaveBeenCalled();
  });
});

describe('NorthConsole without verbose mode', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    configuration.settings.verbose = false;
    north = new NorthConsole(configuration, encryptionService, proxyService, repositoryService, logger, 'baseFolder');
  });

  it('should properly handle values in non verbose mode', async () => {
    const values = [
      {
        pointId: 'pointId',
        timestamp: nowDateString,
        data: { value: 666, quality: 'good' }
      }
    ];
    await north.handleValues(values);

    expect(process.stdout.write).toHaveBeenCalledWith('North Console sent 1 values.\r\n');
    expect(console.table).not.toHaveBeenCalled();
  });

  it('should properly handle file in non verbose mode', async () => {
    const filePath = '/path/to/file/example.file';

    await north.handleFile(filePath);

    expect(fs.stat).not.toHaveBeenCalled();
    expect(process.stdout.write).toHaveBeenCalledWith('North Console sent 1 file.\r\n');
    expect(console.table).not.toHaveBeenCalled();
  });
});
