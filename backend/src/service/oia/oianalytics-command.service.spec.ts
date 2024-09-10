import RepositoryService from '../repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/service/repository-service.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import OIAnalyticsMessageServiceMock from '../../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import ScanModeServiceMock from '../../tests/__mocks__/service/scan-mode-service.mock';
import SouthConnectorConfigServiceMock from '../../tests/__mocks__/service/south-connector-config-service.mock';
import NorthConnectorConfigServiceMock from '../../tests/__mocks__/service/north-connector-config-service.mock';
import OianalyticsCommandClientMock from '../../tests/__mocks__/service/oia/oianalytics-command-client.mock';
import ReloadServiceMock from '../../tests/__mocks__/service/reload-service.mock';

import EncryptionService from '../encryption.service';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import OIAnalyticsCommandService from './oianalytics-command.service';
import { downloadFile, getNetworkSettingsFromRegistration, getOIBusInfo, unzip } from '../utils';
import { RegistrationSettingsDTO } from '../../../../shared/model/engine.model';
import fs from 'node:fs/promises';
import path from 'node:path';
import { version } from '../../../package.json';
import OIAnalyticsMessageService from './oianalytics-message.service';
import {
  OIBusRestartEngineCommand,
  OIBusUpdateEngineSettingsCommand,
  OIBusUpdateVersionCommand
} from '../../../../shared/model/command.model';
import ReloadService from '../reload.service';
import ScanModeService from '../scan-mode.service';
import SouthConnectorConfigService from '../south-connector-config.service';
import NorthConnectorConfigService from '../north-connector-config.service';
import OIAnalyticsCommandClient from './oianalytics-command.client';

jest.mock('node:fs/promises');
jest.mock('node-fetch');
jest.mock('../utils');

// @ts-ignore
jest.spyOn(process, 'exit').mockImplementation(() => {});

const repositoryService: RepositoryService = new RepositoryServiceMock('', '');
const reloadService: ReloadService = new ReloadServiceMock('', '');
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const oianalyticsMessageService: OIAnalyticsMessageService = new OIAnalyticsMessageServiceMock('', '');
const scanModeService: ScanModeService = new ScanModeServiceMock('', '');
const southConnectorConfigService: SouthConnectorConfigService = new SouthConnectorConfigServiceMock('', '');
const northConnectorConfigService: NorthConnectorConfigService = new NorthConnectorConfigServiceMock('', '');
const oianalyticsCommandClient: OIAnalyticsCommandClient = new OianalyticsCommandClientMock('', '');

const nowDateString = '2020-02-02T02:02:02.222Z';
const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

const command: OIBusUpdateVersionCommand = {
  id: 'id1',
  type: 'update-version',
  ack: false,
  completedDate: '2020-02-02T02:02:02.222Z',
  retrievedDate: '2020-02-02T02:02:02.222Z',
  status: 'RUNNING',
  result: null,
  version: '3.2.0',
  assetId: 'assetId'
};

let service: OIAnalyticsCommandService;
describe('Command service with running command', () => {
  const registration: RegistrationSettingsDTO = {
    id: 'id',
    host: 'http://localhost:4200',
    acceptUnauthorized: false,
    useProxy: false,
    token: 'token',
    activationCode: '1234',
    status: 'REGISTERED',
    activationDate: '2020-20-20T00:00:00.000Z',
    activationExpirationDate: ''
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    (repositoryService.engineRepository.get as jest.Mock).mockReturnValue({ version: '3.2.0' });
    (repositoryService.oianalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(registration);
    (repositoryService.oianalyticsCommandRepository.list as jest.Mock).mockReturnValue([command]);
    service = new OIAnalyticsCommandService(
      repositoryService,
      reloadService,
      encryptionService,
      oianalyticsMessageService,
      scanModeService,
      southConnectorConfigService,
      northConnectorConfigService,
      oianalyticsCommandClient,
      logger,
      'binaryFolder'
    );
  });

  it('should properly start and stop after an update', async () => {
    expect(repositoryService.engineRepository.get).toHaveBeenCalledTimes(1);
    expect(repositoryService.oianalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      command.id,
      nowDateString,
      `OIBus updated to version ${version}`
    );
    expect(repositoryService.engineRepository.updateVersion).toHaveBeenCalledWith(version);
    service.run = jest.fn();
    service.start();
    expect(service.run).toHaveBeenCalledTimes(1);
    expect(repositoryService.oianalyticsCommandRepository.list).toHaveBeenCalledWith({ status: ['RETRIEVED', 'RUNNING'], types: [] });

    await service.stop();
    expect(logger.debug).toHaveBeenCalledWith(`Stopping command service...`);
    expect(logger.debug).toHaveBeenCalledWith(`Command service stopped`);
  });

  it('should properly run command and wait for it to finish before stopping', async () => {
    service.executeCommand = jest.fn().mockImplementation(() => {
      return new Promise<void>(resolve => {
        setTimeout(resolve, 1000);
      });
    });

    service.start();
    service.start();

    service.stop();

    jest.advanceTimersByTime(1000);
    await service.stop();
    service.removeCommandFromQueue(command.id);

    expect(service.executeCommand).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith('Waiting for command to finish');
    service.addCommandToQueue(command);
  });

  it('should properly run command and trigger timeout', async () => {
    service.executeCommand = jest.fn().mockImplementation(() => {
      return new Promise<void>(resolve => {
        setTimeout(resolve, 100_000);
      });
    });

    service.start();
    service.stop();
    jest.advanceTimersByTime(10_000);

    service.stop();

    expect(logger.debug).toHaveBeenCalledWith('Waiting for command to finish');
    jest.advanceTimersByTime(20_000);

    await service.stop();
    expect(logger.debug).toHaveBeenCalledWith(`Command service stopped`);
  });

  it('should properly catch command exception', async () => {
    service.executeCommand = jest.fn().mockImplementation(() => {
      return new Promise<void>((resolve, reject) => {
        setTimeout(() => reject(new Error('exception')), 1000);
      });
    });

    service.start();
    service.stop();

    jest.advanceTimersByTime(1000);

    await service.stop();
    expect(logger.error).toHaveBeenCalledWith(
      `Error while executing command ${command.id} (retrieved ${command.retrievedDate}) of type ${command.type}. Error: exception`
    );
    expect(service.executeCommand).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith('Waiting for command to finish');
  });
});

describe('Command service without command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (repositoryService.oianalyticsCommandRepository.list as jest.Mock).mockReturnValue([]);
    (repositoryService.engineRepository.get as jest.Mock).mockReturnValue({ version: '3.2.0' });
    service = new OIAnalyticsCommandService(
      repositoryService,
      reloadService,
      encryptionService,
      oianalyticsMessageService,
      scanModeService,
      southConnectorConfigService,
      northConnectorConfigService,
      oianalyticsCommandClient,
      logger,
      'binaryFolder'
    );
  });

  it('should properly start when not registered', () => {
    const registration: RegistrationSettingsDTO = {
      id: 'id',
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false,
      token: 'token',
      activationCode: '1234',
      status: 'NOT_REGISTERED',
      activationDate: '2020-20-20T00:00:00.000Z',
      activationExpirationDate: ''
    };
    (repositoryService.oianalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(registration);

    expect(getOIBusInfo).not.toHaveBeenCalled();
    expect(repositoryService.oianalyticsCommandRepository.markAsCompleted).not.toHaveBeenCalled();
    expect(repositoryService.engineRepository.updateVersion).toHaveBeenCalledTimes(1);

    service.run = jest.fn();
    service.start();
    expect(logger.debug).toHaveBeenCalledWith(`Command service not started: OIAnalytics not registered`);
    expect(service.run).not.toHaveBeenCalled();
  });

  it('should properly start when registered', () => {
    const registration: RegistrationSettingsDTO = {
      id: 'id',
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false,
      token: 'token',
      activationCode: '1234',
      status: 'REGISTERED',
      activationDate: '2020-20-20T00:00:00.000Z',
      activationExpirationDate: ''
    };
    (repositoryService.oianalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(registration);

    service.run = jest.fn();
    service.start();
    expect(service.run).not.toHaveBeenCalled();
  });

  it('should execute UPGRADE command', async () => {
    const registration: RegistrationSettingsDTO = {
      id: 'id',
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false,
      token: 'token',
      activationCode: '1234',
      status: 'REGISTERED',
      activationDate: '2020-20-20T00:00:00.000Z',
      activationExpirationDate: ''
    };
    const connectionSettings = {
      host: 'http://localhost:4200',
      agent: undefined,
      headers: { authorization: `Bearer token` }
    };
    const oibusInfo = { version: 'v3.2.0', platform: 'linux', architecture: 'x64' };
    (repositoryService.oianalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(registration);
    (getNetworkSettingsFromRegistration as jest.Mock).mockReturnValue(connectionSettings);
    (getOIBusInfo as jest.Mock).mockReturnValue(oibusInfo);

    await service.executeCommand(command);
    const expectedFilename = `oibus-${oibusInfo.platform}_${oibusInfo.architecture}.zip`;
    const expectedEndpoint = `/api/oianalytics/oibus/upgrade/asset?assetId=${command.assetId}`;
    expect(downloadFile).toHaveBeenCalledWith(connectionSettings, expectedEndpoint, expectedFilename, 600_000);
    expect(unzip).toHaveBeenCalledWith(expectedFilename, path.resolve('binaryFolder', '..', 'update'));
    expect(fs.unlink).toHaveBeenCalledWith(expectedFilename);
  });

  it('should execute restart-engine command', async () => {
    const restartCommand: OIBusRestartEngineCommand = {
      type: 'restart-engine'
    } as OIBusRestartEngineCommand;
    await service.executeCommand(restartCommand);

    expect(logger.info).toHaveBeenCalledWith(`Restart OIBus...`);
  });

  it('should execute update-engine-settings command', async () => {
    const fullConfigCommand: OIBusUpdateEngineSettingsCommand = {
      id: 'id',
      type: 'update-engine-settings',
      commandContent: {}
    } as OIBusUpdateEngineSettingsCommand;
    await service.executeCommand(fullConfigCommand);
    expect(repositoryService.oianalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      fullConfigCommand.id,
      nowDateString,
      'Engine settings updated successfully'
    );
  });

  it('should change logger', () => {
    service.setLogger(anotherLogger);
  });
});

describe('Command service with running command', () => {
  const registration: RegistrationSettingsDTO = {
    id: 'id',
    host: 'http://localhost:4200',
    acceptUnauthorized: false,
    useProxy: false,
    token: 'token',
    activationCode: '1234',
    status: 'REGISTERED',
    activationDate: '2020-20-20T00:00:00.000Z',
    activationExpirationDate: ''
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    (repositoryService.engineRepository.get as jest.Mock).mockReturnValue({ version });
    (repositoryService.oianalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(registration);
    (repositoryService.oianalyticsCommandRepository.list as jest.Mock).mockReturnValue([command]);
    service = new OIAnalyticsCommandService(
      repositoryService,
      reloadService,
      encryptionService,
      oianalyticsMessageService,
      scanModeService,
      southConnectorConfigService,
      northConnectorConfigService,
      oianalyticsCommandClient,
      logger,
      'binaryFolder'
    );
  });

  it('should properly start and stop after a failed update', async () => {
    expect(repositoryService.engineRepository.get).toHaveBeenCalledTimes(1);
    expect(repositoryService.engineRepository.updateVersion).not.toHaveBeenCalled();
    expect(repositoryService.oianalyticsCommandRepository.markAsErrored).toHaveBeenCalledWith(
      command.id,
      `OIBus has not been updated. Rollback to version ${version}`
    );
  });
});
