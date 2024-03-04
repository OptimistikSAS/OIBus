import RepositoryService from './repository.service';
import RepositoryServiceMock from '../tests/__mocks__/repository-service.mock';
import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import EncryptionService from './encryption.service';
import pino from 'pino';
import PinoLogger from '../tests/__mocks__/logger.mock';
import { OIBusCommandDTO } from '../../../shared/model/command.model';
import CommandService from './command.service';
import { downloadFile, getNetworkSettingsFromRegistration, getOIBusInfo, unzip } from './utils';
import { RegistrationSettingsDTO } from '../../../shared/model/engine.model';
import fs from 'node:fs/promises';
import path from 'node:path';

jest.mock('node:fs/promises');
jest.mock('node-fetch');
jest.mock('./utils');
jest.mock('./proxy.service');

// @ts-ignore
jest.spyOn(process, 'exit').mockImplementation(() => {});

const repositoryService: RepositoryService = new RepositoryServiceMock('', '');
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');

const nowDateString = '2020-02-02T02:02:02.222Z';
const logger: pino.Logger = new PinoLogger();

const command: OIBusCommandDTO = {
  id: 'id1',
  type: 'UPGRADE',
  status: 'RUNNING',
  ack: true,
  creationDate: '2023-01-01T10:00:00Z',
  completedDate: '2023-01-01T12:00:00Z',
  retrievedDate: '2023-01-01T10:00:00Z',
  result: 'ok',
  version: '3.2.0',
  assetId: 'assetId'
};

let service: CommandService;
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
    (getOIBusInfo as jest.Mock).mockReturnValue({ version: 'v3.2.0' });

    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(registration);
    (repositoryService.commandRepository.searchCommandsList as jest.Mock).mockReturnValue([command]);
    service = new CommandService('oibusId', repositoryService, encryptionService, logger, 'binaryFolder');
  });

  it('should properly start and stop', async () => {
    expect(getOIBusInfo).toHaveBeenCalledTimes(1);
    expect(repositoryService.commandRepository.markAsCompleted).toHaveBeenCalledWith(
      command.id,
      nowDateString,
      `OIBus updated to version v3.2.0`
    );

    service.run = jest.fn();
    service.start();
    expect(service.run).toHaveBeenCalledTimes(1);
    expect(repositoryService.commandRepository.searchCommandsList).toHaveBeenCalledWith({ status: ['RETRIEVED', 'RUNNING'], types: [] });

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

    // await flushPromises();
    jest.advanceTimersByTime(1000);
    await service.stop();
    service.removeCommandFromQueue(command.id);

    expect(service.executeCommand).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith('Waiting for command to finish');
    service.addCommandToQueue(command);
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

    (repositoryService.commandRepository.searchCommandsList as jest.Mock).mockReturnValue([]);
    service = new CommandService('oibusId', repositoryService, encryptionService, logger, 'binaryFolder');
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
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(registration);

    expect(getOIBusInfo).not.toHaveBeenCalled();
    expect(repositoryService.commandRepository.markAsCompleted).not.toHaveBeenCalled();

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
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(registration);

    service.run = jest.fn();
    service.start();
    expect(logger.trace).toHaveBeenCalledWith('No command to run');
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
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue(registration);
    (getNetworkSettingsFromRegistration as jest.Mock).mockReturnValue(connectionSettings);
    (getOIBusInfo as jest.Mock).mockReturnValue(oibusInfo);

    await service.executeCommand(command);
    const expectedFilename = `oibus-${oibusInfo.platform}_${oibusInfo.architecture}.zip`;
    const expectedEndpoint = `/api/oianalytics/oibus/upgrade/asset?assetId=${command.assetId}`;
    expect(downloadFile).toHaveBeenCalledWith(connectionSettings, expectedEndpoint, expectedFilename, 600_000);
    expect(unzip).toHaveBeenCalledWith(expectedFilename, path.resolve('binaryFolder', '..', 'update'));
    expect(fs.unlink).toHaveBeenCalledWith(expectedFilename);
  });
});
