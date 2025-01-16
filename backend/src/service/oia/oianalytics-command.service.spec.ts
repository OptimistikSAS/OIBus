import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import ScanModeServiceMock from '../../tests/__mocks__/service/scan-mode-service.mock';

import EncryptionService from '../encryption.service';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import OIAnalyticsCommandService from './oianalytics-command.service';
import { version } from '../../../package.json';
import ScanModeService from '../scan-mode.service';
import OIBusService from '../oibus.service';
import OibusServiceMock from '../../tests/__mocks__/service/oibus-service.mock';
import OIAnalyticsCommandRepository from '../../repository/config/oianalytics-command.repository';
import OIAnalyticsCommandRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-command-repository.mock';
import testData from '../../tests/utils/test-data';
import { flushPromises } from '../../tests/utils/test-utils';
import { delay, getOIBusInfo, unzip } from '../utils';
import fs from 'node:fs/promises';
import {
  OIBusCreateCertificateCommand,
  OIBusCreateIPFilterCommand,
  OIBusCreateNorthConnectorCommand,
  OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand,
  OIBusCreateScanModeCommand,
  OIBusCreateSouthConnectorCommand,
  OIBusDeleteCertificateCommand,
  OIBusDeleteIPFilterCommand,
  OIBusDeleteNorthConnectorCommand,
  OIBusDeleteScanModeCommand,
  OIBusDeleteSouthConnectorCommand,
  OIBusUpdateCertificateCommand,
  OIBusUpdateEngineSettingsCommand,
  OIBusUpdateIPFilterCommand,
  OIBusUpdateNorthConnectorCommand,
  OIBusUpdateRegistrationSettingsCommand,
  OIBusUpdateScanModeCommand,
  OIBusUpdateSouthConnectorCommand,
  OIBusUpdateVersionCommand
} from '../../model/oianalytics-command.model';
import { createPageFromArray } from '../../../shared/model/types';
import SouthService from '../south.service';
import NorthService from '../north.service';
import SouthServiceMock from '../../tests/__mocks__/service/south-service.mock';
import NorthServiceMock from '../../tests/__mocks__/service/north-service.mock';
import OIAnalyticsClient from './oianalytics-client.service';
import OianalyticsClientMock from '../../tests/__mocks__/service/oia/oianalytics-client.mock';
import os from 'node:os';
import OIAnalyticsMessageService from './oianalytics-message.service';
import OIAnalyticsMessageServiceMock from '../../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import crypto from 'node:crypto';
import OIAnalyticsRegistrationService from './oianalytics-registration.service';
import OIAnalyticsRegistrationServiceMock from '../../tests/__mocks__/service/oia/oianalytics-registration-service.mock';
import { EngineSettings } from '../../model/engine.model';
import IpFilterServiceMock from '../../tests/__mocks__/service/ip-filter-service.mock';
import CertificateServiceMock from '../../tests/__mocks__/service/certificate-service.mock';
import IPFilterService from '../ip-filter.service';
import CertificateService from '../certificate.service';
import { IPFilterCommandDTO } from '../../../shared/model/ip-filter.model';
import { CertificateCommandDTO } from '../../../shared/model/certificate.model';

jest.mock('node:crypto');
jest.mock('node:fs/promises');
jest.mock('node-fetch');
jest.mock('../../web-server/controllers/validators/joi.validator');
jest.mock('../utils');

jest.spyOn(process, 'exit').mockImplementation();

const oIAnalyticsCommandRepository: OIAnalyticsCommandRepository = new OIAnalyticsCommandRepositoryMock();
const oIAnalyticsRegistrationService: OIAnalyticsRegistrationService = new OIAnalyticsRegistrationServiceMock();
const oIAnalyticsMessageService: OIAnalyticsMessageService = new OIAnalyticsMessageServiceMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const oIBusService: OIBusService = new OibusServiceMock();
const scanModeService: ScanModeService = new ScanModeServiceMock();
const ipFilterService: IPFilterService = new IpFilterServiceMock();
const certificateService: CertificateService = new CertificateServiceMock();
const southService: SouthService = new SouthServiceMock();
const northService: NorthService = new NorthServiceMock();
const oIAnalyticsClient: OIAnalyticsClient = new OianalyticsClientMock();

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

let service: OIAnalyticsCommandService;
describe('OIAnalytics Command Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (oIBusService.getEngineSettings as jest.Mock).mockReturnValue(testData.engine.settings);
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.commands.oIBusList).mockReturnValue([]);
    (oIAnalyticsRegistrationService.getRegistrationSettings as jest.Mock).mockReturnValue(testData.oIAnalytics.registration.completed);
    (getOIBusInfo as jest.Mock).mockReturnValue(testData.engine.oIBusInfo);

    service = new OIAnalyticsCommandService(
      oIAnalyticsCommandRepository,
      oIAnalyticsRegistrationService,
      oIAnalyticsMessageService,
      encryptionService,
      oIAnalyticsClient,
      oIBusService,
      scanModeService,
      ipFilterService,
      certificateService,
      southService,
      northService,
      logger,
      'binaryFolder',
      false,
      testData.engine.settings.launcherVersion
    );
  });

  it('should properly start and stop service', async () => {
    expect(oIBusService.getEngineSettings).toHaveBeenCalledTimes(1);
    expect(oIBusService.updateOIBusVersion).toHaveBeenCalledWith(
      (testData.oIAnalytics.commands.oIBusList[0] as OIBusUpdateVersionCommand).commandContent.version.slice(1),
      testData.engine.settings.launcherVersion
    );
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[0].id,
      testData.constants.dates.FAKE_NOW,
      `OIBus updated to version ${(testData.oIAnalytics.commands.oIBusList[0] as OIBusUpdateVersionCommand).commandContent.version.slice(1)}, launcher updated to version ${testData.engine.settings.launcherVersion}`
    );

    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await service.start();
    await service.stop();

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);

    oIAnalyticsRegistrationService.registrationEvent.emit('updated');
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);

    (oIAnalyticsRegistrationService.getRegistrationSettings as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.registration.pending);

    oIAnalyticsRegistrationService.registrationEvent.emit('updated');
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(3);
  });

  it('should search commands', () => {
    const page = createPageFromArray(testData.oIAnalytics.commands.oIBusList, 1, 25);
    (oIAnalyticsCommandRepository.search as jest.Mock).mockReturnValueOnce(page);

    expect(service.search({ types: [], status: [] }, 1)).toEqual(page);
  });

  it('should check commands', async () => {
    service.sendAckCommands = jest.fn();
    service.checkRetrievedCommands = jest.fn();
    service.retrieveCommands = jest.fn();
    (oIAnalyticsRegistrationService.getRegistrationSettings as jest.Mock)
      .mockReturnValueOnce(testData.oIAnalytics.registration.completed)
      .mockReturnValueOnce(testData.oIAnalytics.registration.completed)
      .mockReturnValueOnce(testData.oIAnalytics.registration.pending);

    service.checkCommands();
    await service.checkCommands();
    expect(logger.trace).toHaveBeenCalledWith('OIBus is already retrieving commands from OIAnalytics');
    await service.checkCommands();
    expect(logger.trace).toHaveBeenCalledWith("OIAnalytics not registered. OIBus won't retrieve commands");

    await flushPromises();
  });

  it('should fail to check commands and retry', async () => {
    service.retrieveCommands = jest.fn().mockImplementationOnce(() => {
      throw new Error('retrieve command error');
    });
    service.checkRetrievedCommands = jest.fn();
    service.sendAckCommands = jest.fn().mockImplementationOnce(() => {
      throw new Error('ack command error');
    });
    (oIAnalyticsRegistrationService.getRegistrationSettings as jest.Mock)
      .mockReturnValueOnce(testData.oIAnalytics.registration.completed)
      .mockReturnValueOnce(testData.oIAnalytics.registration.completed);

    await service.checkCommands();
    expect(service.sendAckCommands).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('retrieve command error');

    jest.advanceTimersByTime(testData.oIAnalytics.registration.completed.commandRetryInterval * 1000);
    await flushPromises();
    expect(service.sendAckCommands).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith('ack command error');
    expect(service.sendAckCommands).toHaveBeenCalledTimes(1);
  });

  it('should send ack', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.commands.oIBusList);
    await service.sendAckCommands(testData.oIAnalytics.registration.completed);

    expect(oIAnalyticsClient.updateCommandStatus).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsCommandRepository.markAsAcknowledged).toHaveBeenCalledTimes(testData.oIAnalytics.commands.oIBusList.length);
    expect(logger.trace).toHaveBeenCalledWith(`${testData.oIAnalytics.commands.oIBusList.length} commands acknowledged`);

    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.commands.oIBusList);
    (oIAnalyticsClient.updateCommandStatus as jest.Mock).mockImplementationOnce(() => {
      throw new Error('error');
    });
    await expect(service.sendAckCommands(testData.oIAnalytics.registration.completed)).rejects.toThrow(
      `Error while acknowledging ${testData.oIAnalytics.commands.oIBusList.length} commands: error`
    );

    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([]);
    await service.sendAckCommands(testData.oIAnalytics.registration.completed);

    expect(logger.trace).toHaveBeenCalledWith(`No command to ack`);
  });

  it('should check retrieved command', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.commands.oIBusList);
    (oIAnalyticsClient.retrieveCancelledCommands as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.commands.oIBusList);

    await service.checkRetrievedCommands(testData.oIAnalytics.registration.completed);

    expect(oIAnalyticsClient.retrieveCancelledCommands).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsCommandRepository.cancel).toHaveBeenCalledTimes(testData.oIAnalytics.commands.oIBusList.length);
    expect(logger.trace).toHaveBeenCalledWith(
      `${testData.oIAnalytics.commands.oIBusList.length} commands cancelled among the ${testData.oIAnalytics.commands.oIBusList.length} pending commands`
    );

    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.commands.oIBusList);
    (oIAnalyticsClient.retrieveCancelledCommands as jest.Mock).mockImplementationOnce(() => {
      throw new Error('error');
    });
    await expect(service.checkRetrievedCommands(testData.oIAnalytics.registration.completed)).rejects.toThrow(
      `Error while checking PENDING commands status: error`
    );

    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([]);
    await service.checkRetrievedCommands(testData.oIAnalytics.registration.completed);
    expect(logger.trace).toHaveBeenCalledWith(`No command retrieved to check`);
  });

  it('should retrieve commands', async () => {
    (oIAnalyticsClient.retrievePendingCommands as jest.Mock).mockReturnValueOnce(testData.oIAnalytics.commands.oIAnalyticsList);

    await service.retrieveCommands(testData.oIAnalytics.registration.completed);

    expect(oIAnalyticsClient.retrievePendingCommands).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsCommandRepository.create).toHaveBeenCalledTimes(testData.oIAnalytics.commands.oIAnalyticsList.length);
    expect(logger.trace).toHaveBeenCalledWith(`${testData.oIAnalytics.commands.oIAnalyticsList.length} commands to add`);

    (oIAnalyticsClient.retrievePendingCommands as jest.Mock).mockImplementationOnce(() => {
      throw new Error('error');
    });
    await expect(service.retrieveCommands(testData.oIAnalytics.registration.completed)).rejects.toThrow(
      `Error while retrieving commands: error`
    );
  });

  it('should execute update-version command without updating launcher', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([testData.oIAnalytics.commands.oIBusList[0]]); // update-version
    const processExitSpy = jest.spyOn(process, 'exit');

    await service.executeCommand();

    expect(oIAnalyticsRegistrationService.getRegistrationSettings).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsCommandRepository.list).toHaveBeenCalled();
    expect(oIAnalyticsCommandRepository.markAsRunning).toHaveBeenCalledTimes(1);
    expect(oIBusService.getEngineSettings).toHaveBeenCalled();
    expect(oIAnalyticsClient.downloadFile).toHaveBeenCalledTimes(1);
    expect(unzip).toHaveBeenCalledTimes(1);
    expect(fs.unlink).toHaveBeenCalledTimes(1);
    expect(fs.rename).not.toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('update.json'),
      JSON.stringify({
        version: 'v3.5.0-beta',
        assetId: 'assetId',
        backupFolders: 'cache/*',
        updateLauncher: false
      })
    );
    expect(delay).toHaveBeenCalledTimes(1);
    expect(processExitSpy).toHaveBeenCalledTimes(1);
  });

  it('should execute update-version command with launcher update', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([
      {
        ...testData.oIAnalytics.commands.oIBusList[0],
        commandContent: {
          version: 'v3.5.0-beta',
          assetId: 'assetId',
          backupFolders: 'cache/*',
          updateLauncher: true
        }
      }
    ]); // update-version
    const processKillSpy = jest.spyOn(process, 'kill').mockImplementation(() => {
      return true;
    });
    const osTypeSpy = jest.spyOn(os, 'type').mockReturnValueOnce('linux').mockReturnValueOnce('Windows_NT');

    await service.executeCommand();

    expect(oIAnalyticsRegistrationService.getRegistrationSettings).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsCommandRepository.list).toHaveBeenCalled();
    expect(oIBusService.getEngineSettings).toHaveBeenCalled();
    expect(oIAnalyticsClient.downloadFile).toHaveBeenCalledTimes(1);
    expect(unzip).toHaveBeenCalledTimes(1);
    expect(fs.unlink).toHaveBeenCalledTimes(1);
    expect(fs.rename).toHaveBeenCalledTimes(2);
    expect(fs.rename).toHaveBeenCalledWith(expect.stringContaining('oibus-launcher'), expect.stringContaining('oibus-launcher_backup'));
    expect(osTypeSpy).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('update.json'),
      JSON.stringify({
        version: 'v3.5.0-beta',
        assetId: 'assetId',
        backupFolders: 'cache/*',
        updateLauncher: true
      })
    );
    expect(delay).toHaveBeenCalledTimes(1);
    expect(processKillSpy).toHaveBeenCalledTimes(1);

    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([
      {
        ...testData.oIAnalytics.commands.oIBusList[0],
        commandContent: {
          version: 'v3.5.0-beta',
          assetId: 'assetId',
          backupFolders: 'cache/*',
          updateLauncher: true
        }
      }
    ]); // update-version
    await service.executeCommand();
    expect(fs.rename).toHaveBeenCalledWith(
      expect.stringContaining('oibus-launcher.exe'),
      expect.stringContaining('oibus-launcher_backup.exe')
    );
  });

  it('should not execute update-version command if a command is already being executed', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([testData.oIAnalytics.commands.oIBusList[0]]); // update-version
    jest.spyOn(process, 'exit');
    (delay as jest.Mock).mockImplementationOnce(() => {
      return new Promise(resolve => setTimeout(() => resolve(null), 1000));
    });

    service.executeCommand();
    await service.executeCommand();

    expect(logger.trace).toHaveBeenCalledWith('A command is already being executed');

    await flushPromises();
  });

  it('should not execute a command if not registered', async () => {
    (oIAnalyticsRegistrationService.getRegistrationSettings as jest.Mock).mockReturnValueOnce({
      ...JSON.parse(JSON.stringify(testData.oIAnalytics.registration.completed)),
      status: 'PENDING'
    });

    await service.executeCommand();

    expect(logger.trace).toHaveBeenCalledWith("OIAnalytics not registered. OIBus won't retrieve commands");
  });

  it('should not execute a command if no command found', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([]);

    await service.executeCommand();

    expect(logger.trace).toHaveBeenCalledWith('No command to execute');
  });

  it('should execute update-engine-settings command', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([testData.oIAnalytics.commands.oIBusList[1]]); // update-engine-settings

    await service.executeCommand();

    expect(encryptionService.decryptTextWithPrivateKey).not.toHaveBeenCalled();
    expect(oIBusService.updateEngineSettings).toHaveBeenCalledWith(
      (testData.oIAnalytics.commands.oIBusList[1] as OIBusUpdateEngineSettingsCommand).commandContent
    );
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[1].id,
      testData.constants.dates.FAKE_NOW,
      'Engine settings updated successfully'
    );
  });

  it('should execute update-engine-settings command without loki password', async () => {
    const command: OIBusUpdateEngineSettingsCommand = JSON.parse(JSON.stringify(testData.oIAnalytics.commands.oIBusList[1]));
    command.commandContent.logParameters.loki.password = 'test';

    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([command]); // update-engine-settings

    await service.executeCommand();

    expect(oIBusService.updateEngineSettings).toHaveBeenCalledWith((command as OIBusUpdateEngineSettingsCommand).commandContent);
    expect(encryptionService.decryptTextWithPrivateKey).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[1].id,
      testData.constants.dates.FAKE_NOW,
      'Engine settings updated successfully'
    );
  });

  it('should execute update-registration-settings command', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([testData.oIAnalytics.commands.oIBusList[15]]); // update-engine-settings

    await service.executeCommand();

    expect(oIAnalyticsRegistrationService.editConnectionSettings).toHaveBeenCalledWith({
      host: testData.oIAnalytics.registration.completed.host,
      useProxy: testData.oIAnalytics.registration.completed.useProxy,
      proxyUrl: testData.oIAnalytics.registration.completed.proxyUrl,
      proxyUsername: testData.oIAnalytics.registration.completed.proxyUsername,
      proxyPassword: '',
      acceptUnauthorized: testData.oIAnalytics.registration.completed.acceptUnauthorized,
      commandRefreshInterval: (testData.oIAnalytics.commands.oIBusList[15] as OIBusUpdateRegistrationSettingsCommand).commandContent
        .commandRefreshInterval,
      commandRetryInterval: (testData.oIAnalytics.commands.oIBusList[15] as OIBusUpdateRegistrationSettingsCommand).commandContent
        .commandRetryInterval,
      messageRetryInterval: (testData.oIAnalytics.commands.oIBusList[15] as OIBusUpdateRegistrationSettingsCommand).commandContent
        .messageRetryInterval,
      commandPermissions: testData.oIAnalytics.registration.completed.commandPermissions
    });
    expect(oIAnalyticsRegistrationService.editConnectionSettings).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[15].id,
      testData.constants.dates.FAKE_NOW,
      'Registration settings updated successfully'
    );
  });

  it('should execute restart-engine command', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([testData.oIAnalytics.commands.oIBusList[2]]); // restart-engine
    const processExitSpy = jest.spyOn(process, 'exit');

    await service.executeCommand();

    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[2].id,
      testData.constants.dates.FAKE_NOW,
      'OIBus restarted'
    );
    expect(delay).toHaveBeenCalledTimes(1);
    expect(processExitSpy).toHaveBeenCalledTimes(1);
  });

  it('should execute update-scan-mode command', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([testData.oIAnalytics.commands.oIBusList[3]]); // update-scan-mode

    await service.executeCommand();

    expect(scanModeService.update).toHaveBeenCalledWith(
      (testData.oIAnalytics.commands.oIBusList[3] as OIBusUpdateScanModeCommand).scanModeId,
      (testData.oIAnalytics.commands.oIBusList[3] as OIBusUpdateScanModeCommand).commandContent
    );
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[3].id,
      testData.constants.dates.FAKE_NOW,
      'Scan mode updated successfully'
    );
  });

  it('should execute update-south command', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([testData.oIAnalytics.commands.oIBusList[4]]); // update-south
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.south.manifest,
        id: (testData.oIAnalytics.commands.oIBusList[4] as OIBusUpdateSouthConnectorCommand).commandContent.type
      }
    ]);
    // update-south

    await service.executeCommand();

    expect(southService.updateSouth).toHaveBeenCalledWith(
      (testData.oIAnalytics.commands.oIBusList[4] as OIBusUpdateSouthConnectorCommand).southConnectorId,
      (testData.oIAnalytics.commands.oIBusList[4] as OIBusUpdateSouthConnectorCommand).commandContent
    );
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[4].id,
      testData.constants.dates.FAKE_NOW,
      'South connector updated successfully'
    );
  });

  it('should execute update-north command', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([testData.oIAnalytics.commands.oIBusList[5]]); // update-north
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.south.manifest,
        id: (testData.oIAnalytics.commands.oIBusList[5] as OIBusUpdateNorthConnectorCommand).commandContent.type
      }
    ]);
    await service.executeCommand();

    expect(northService.updateNorth).toHaveBeenCalledWith(
      (testData.oIAnalytics.commands.oIBusList[5] as OIBusUpdateNorthConnectorCommand).northConnectorId,
      (testData.oIAnalytics.commands.oIBusList[5] as OIBusUpdateNorthConnectorCommand).commandContent
    );
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[5].id,
      testData.constants.dates.FAKE_NOW,
      'North connector updated successfully'
    );
  });

  it('should execute delete-scan-mode command', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([testData.oIAnalytics.commands.oIBusList[6]]); // delete-scan-mode

    await service.executeCommand();

    expect(scanModeService.delete).toHaveBeenCalledWith(
      (testData.oIAnalytics.commands.oIBusList[6] as OIBusDeleteScanModeCommand).scanModeId
    );
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[6].id,
      testData.constants.dates.FAKE_NOW,
      'Scan mode deleted successfully'
    );
  });

  it('should execute delete-south command', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([testData.oIAnalytics.commands.oIBusList[7]]); // delete-south

    await service.executeCommand();

    expect(southService.deleteSouth).toHaveBeenCalledWith(
      (testData.oIAnalytics.commands.oIBusList[7] as OIBusDeleteSouthConnectorCommand).southConnectorId
    );
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[7].id,
      testData.constants.dates.FAKE_NOW,
      'South connector deleted successfully'
    );
  });

  it('should execute delete-north command', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([testData.oIAnalytics.commands.oIBusList[8]]); // delete-north

    await service.executeCommand();

    expect(northService.deleteNorth).toHaveBeenCalledWith(
      (testData.oIAnalytics.commands.oIBusList[8] as OIBusDeleteNorthConnectorCommand).northConnectorId
    );
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[8].id,
      testData.constants.dates.FAKE_NOW,
      'North connector deleted successfully'
    );
  });

  it('should execute create-scan-mode command', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([testData.oIAnalytics.commands.oIBusList[9]]); // create-scan-mode

    await service.executeCommand();

    expect(scanModeService.create).toHaveBeenCalledWith(
      (testData.oIAnalytics.commands.oIBusList[9] as OIBusCreateScanModeCommand).commandContent
    );
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[9].id,
      testData.constants.dates.FAKE_NOW,
      'Scan mode created successfully'
    );
  });

  it('should execute create-south command', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([testData.oIAnalytics.commands.oIBusList[10]]); // create-south
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.south.manifest,
        id: (testData.oIAnalytics.commands.oIBusList[10] as OIBusCreateSouthConnectorCommand).commandContent.type
      }
    ]);

    await service.executeCommand();

    expect(southService.createSouth).toHaveBeenCalledWith(
      (testData.oIAnalytics.commands.oIBusList[10] as OIBusCreateSouthConnectorCommand).commandContent,
      null
    );
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[10].id,
      testData.constants.dates.FAKE_NOW,
      'South connector created successfully'
    );
  });

  it('should execute create-north command', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([testData.oIAnalytics.commands.oIBusList[11]]); // create-north
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.south.manifest,
        id: (testData.oIAnalytics.commands.oIBusList[11] as OIBusCreateNorthConnectorCommand).commandContent.type
      }
    ]);

    await service.executeCommand();

    expect(northService.createNorth).toHaveBeenCalledWith(
      (testData.oIAnalytics.commands.oIBusList[11] as OIBusCreateNorthConnectorCommand).commandContent,
      null
    );
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[11].id,
      testData.constants.dates.FAKE_NOW,
      'North connector created successfully'
    );
  });

  it('should execute create-or-update-south-items-from-csv command', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([testData.oIAnalytics.commands.oIBusList[14]]); // create-or-update-south-items-from-csv
    (southService.findById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (southService.checkCsvContentImport as jest.Mock).mockReturnValueOnce({ items: [{}, {}], errors: [] });

    await service.executeCommand();

    expect(southService.findById).toHaveBeenCalledWith(
      (testData.oIAnalytics.commands.oIBusList[14] as OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand).southConnectorId
    );
    expect(southService.checkCsvContentImport).toHaveBeenCalledWith(
      testData.south.list[0].type,
      (testData.oIAnalytics.commands.oIBusList[14] as OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand).commandContent.csvContent,
      (testData.oIAnalytics.commands.oIBusList[14] as OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand).commandContent.delimiter,
      testData.south.list[0].items
    );
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[14].id,
      testData.constants.dates.FAKE_NOW,
      `2 items imported on South connector ${testData.south.list[0].name}`
    );
  });

  it('should execute create-or-update-south-items-from-csv command and throw an error if south not found', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([testData.oIAnalytics.commands.oIBusList[14]]); // create-or-update-south-items-from-csv
    (southService.findById as jest.Mock).mockReturnValueOnce(null);

    await service.executeCommand();

    expect(oIAnalyticsCommandRepository.markAsErrored).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[14].id,
      `South connector ${(testData.oIAnalytics.commands.oIBusList[14] as OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand).southConnectorId} not found`
    );
  });

  it('should execute create-or-update-south-items-from-csv command', async () => {
    const command: OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand = JSON.parse(
      JSON.stringify(testData.oIAnalytics.commands.oIBusList[14])
    ); // create-or-update-south-items-from-csv
    command.commandContent.deleteItemsNotPresent = true;
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([command]);
    (southService.findById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (southService.checkCsvContentImport as jest.Mock).mockReturnValueOnce({
      items: [{}, {}],
      errors: [
        { item: { name: 'item1' }, error: 'error1' },
        { item: { name: 'item2' }, error: 'error2' }
      ]
    });

    await service.executeCommand();

    expect(southService.checkCsvContentImport).toHaveBeenCalledWith(
      testData.south.list[0].type,
      (testData.oIAnalytics.commands.oIBusList[14] as OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand).commandContent.csvContent,
      (testData.oIAnalytics.commands.oIBusList[14] as OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand).commandContent.delimiter,
      []
    );
    expect(oIAnalyticsCommandRepository.markAsErrored).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[14].id,
      `Error when checking csv items:\nitem1: error1\nitem2: error2`
    );
  });

  it('should catch error when execution fails', async () => {
    const command = testData.oIAnalytics.commands.oIBusList[11];
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([command]); // create-north
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.south.manifest,
        id: (testData.oIAnalytics.commands.oIBusList[11] as OIBusCreateNorthConnectorCommand).commandContent.type
      }
    ]);
    (northService.createNorth as jest.Mock).mockImplementationOnce(() => {
      throw new Error('command execution error');
    });

    await service.executeCommand();

    expect(logger.error).toHaveBeenCalledWith(
      `Error while executing command ${command.id} (retrieved ${command.retrievedDate}) of type ${command.type}. Error: command execution error`
    );
    expect(oIAnalyticsCommandRepository.markAsErrored).toHaveBeenCalledWith(command.id, 'command execution error');
  });

  it('should not execute command if target version is not the same', async () => {
    const command = testData.oIAnalytics.commands.oIBusList[11];
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([command]); // create-north
    (oIBusService.getEngineSettings as jest.Mock).mockReturnValueOnce({
      ...testData.engine.settings,
      version: 'bad version'
    });

    await service.executeCommand();

    expect(oIAnalyticsCommandRepository.markAsErrored).toHaveBeenCalledWith(
      command.id,
      `Wrong target version: ${command.targetVersion} for OIBus version bad version`
    );
  });

  it('should not execute command if permission is not right', async () => {
    const command = testData.oIAnalytics.commands.oIBusList[11];
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([command]); // create-north
    (oIAnalyticsRegistrationService.getRegistrationSettings as jest.Mock).mockReturnValueOnce({
      ...testData.oIAnalytics.registration.completed,
      commandPermissions: {
        ...testData.oIAnalytics.registration.completed.commandPermissions,
        createNorth: false
      }
    });

    await service.executeCommand();

    expect(oIAnalyticsCommandRepository.markAsErrored).toHaveBeenCalledWith(
      command.id,
      `Command ${command.id} of type ${command.type} is not authorized`
    );
  });

  it('should execute regenerate-cipher-keys command', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([testData.oIAnalytics.commands.oIBusList[12]]); // regenerate-cipher-keys
    (crypto.generateKeyPairSync as jest.Mock).mockReturnValueOnce({ publicKey: 'public key', privateKey: 'private key' });

    await service.executeCommand();

    expect(oIAnalyticsRegistrationService.updateKeys).toHaveBeenCalledWith('private key', 'public key');
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[12].id,
      testData.constants.dates.FAKE_NOW,
      'OIAnalytics keys reloaded'
    );
  });

  it('should execute create-ip-filter command', async () => {
    const command: OIBusCreateIPFilterCommand = {
      id: 'createIpFilterId',
      type: 'create-ip-filter',
      targetVersion: testData.engine.settings.version,
      commandContent: {} as IPFilterCommandDTO
    } as OIBusCreateIPFilterCommand;
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([command]);

    await service.executeCommand();

    expect(ipFilterService.create).toHaveBeenCalledWith(command.commandContent);
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      command.id,
      testData.constants.dates.FAKE_NOW,
      'IP Filter created successfully'
    );
  });

  it('should execute update-ip-filter command', async () => {
    const command: OIBusUpdateIPFilterCommand = {
      id: 'updateIpFilterId',
      type: 'update-ip-filter',
      targetVersion: testData.engine.settings.version,
      ipFilterId: 'ipFilterId',
      commandContent: {} as IPFilterCommandDTO
    } as OIBusUpdateIPFilterCommand;
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([command]);

    await service.executeCommand();

    expect(ipFilterService.update).toHaveBeenCalledWith(command.ipFilterId, command.commandContent);
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      command.id,
      testData.constants.dates.FAKE_NOW,
      'IP Filter updated successfully'
    );
  });

  it('should execute delete-ip-filter command', async () => {
    const command: OIBusDeleteIPFilterCommand = {
      id: 'deleteIpFilterId',
      type: 'delete-ip-filter',
      targetVersion: testData.engine.settings.version,
      ipFilterId: 'ipFilterId'
    } as OIBusDeleteIPFilterCommand;
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([command]);

    await service.executeCommand();

    expect(ipFilterService.delete).toHaveBeenCalledWith(command.ipFilterId);
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      command.id,
      testData.constants.dates.FAKE_NOW,
      'IP Filter deleted successfully'
    );
  });

  it('should execute create-certificate command', async () => {
    const command: OIBusCreateCertificateCommand = {
      id: 'createCertificateId',
      type: 'create-certificate',
      targetVersion: testData.engine.settings.version,
      commandContent: {} as CertificateCommandDTO
    } as OIBusCreateCertificateCommand;
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([command]);

    await service.executeCommand();

    expect(certificateService.create).toHaveBeenCalledWith(command.commandContent);
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      command.id,
      testData.constants.dates.FAKE_NOW,
      'Certificate created successfully'
    );
  });

  it('should execute update-certificate command', async () => {
    const command: OIBusUpdateCertificateCommand = {
      id: 'updateCertificateId',
      type: 'update-certificate',
      targetVersion: testData.engine.settings.version,
      certificateId: 'certificateId',
      commandContent: {} as CertificateCommandDTO
    } as OIBusUpdateCertificateCommand;
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([command]);

    await service.executeCommand();

    expect(certificateService.update).toHaveBeenCalledWith(command.certificateId, command.commandContent);
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      command.id,
      testData.constants.dates.FAKE_NOW,
      'Certificate updated successfully'
    );
  });

  it('should execute delete-certificate command', async () => {
    const command: OIBusDeleteCertificateCommand = {
      id: 'deleteCertificateId',
      type: 'delete-certificate',
      targetVersion: testData.engine.settings.version,
      certificateId: 'certificateId'
    } as OIBusDeleteCertificateCommand;
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([command]);

    await service.executeCommand();

    expect(certificateService.delete).toHaveBeenCalledWith(command.certificateId);
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      command.id,
      testData.constants.dates.FAKE_NOW,
      'Certificate deleted successfully'
    );
  });
});

describe('OIAnalytics Command service with update error', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (oIBusService.getEngineSettings as jest.Mock).mockReturnValue({
      ...JSON.parse(JSON.stringify(testData.engine.settings)),
      version: (testData.oIAnalytics.commands.oIBusList[0] as OIBusUpdateVersionCommand).commandContent.version.slice(1)
    });
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValue([
      {
        ...testData.oIAnalytics.commands.oIBusList[0],
        commandContent: {
          ...(testData.oIAnalytics.commands.oIBusList[0] as OIBusUpdateVersionCommand).commandContent,
          version: (testData.oIAnalytics.commands.oIBusList[0] as OIBusUpdateVersionCommand).commandContent.version.slice(1)
        }
      }
    ]);

    service = new OIAnalyticsCommandService(
      oIAnalyticsCommandRepository,
      oIAnalyticsRegistrationService,
      oIAnalyticsMessageService,
      encryptionService,
      oIAnalyticsClient,
      oIBusService,
      scanModeService,
      ipFilterService,
      certificateService,
      southService,
      northService,
      logger,
      'binaryFolder',
      false,
      testData.engine.settings.launcherVersion
    );
  });

  it('should properly start and stop service', async () => {
    expect(oIBusService.getEngineSettings).toHaveBeenCalledTimes(1);
    expect(oIBusService.updateOIBusVersion).not.toHaveBeenCalled();
    expect(oIAnalyticsCommandRepository.markAsErrored).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[0].id,
      `OIBus has not been updated. Rollback to version ${version}`
    );
  });
});

describe('OIAnalytics Command service with ignoreRemoteUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (oIBusService.getEngineSettings as jest.Mock).mockReturnValue(testData.engine.settings);
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValue(testData.oIAnalytics.commands.oIBusList);
    (oIAnalyticsRegistrationService.getRegistrationSettings as jest.Mock).mockReturnValue(testData.oIAnalytics.registration.completed);

    service = new OIAnalyticsCommandService(
      oIAnalyticsCommandRepository,
      oIAnalyticsRegistrationService,
      oIAnalyticsMessageService,
      encryptionService,
      oIAnalyticsClient,
      oIBusService,
      scanModeService,
      ipFilterService,
      certificateService,
      southService,
      northService,
      logger,
      'binaryFolder',
      true,
      '3.4.0'
    );
  });

  // it('should properly start when not registered', () => {
  //   expect(oIBusService.getEngineSettings).toHaveBeenCalled();
  //   expect(oIAnalyticsCommandRepository.list).toHaveBeenCalled();
  //   expect(oIBusService.updateOIBusVersion).toHaveBeenCalledWith(version, '3.4.0');
  //   expect(oIAnalyticsCommandRepository.markAsCompleted).not.toHaveBeenCalled();
  // });

  it('should change logger', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    service.setLogger(anotherLogger);
    await service.stop();

    expect(logger.debug).not.toHaveBeenCalled();
    expect(anotherLogger.debug).toHaveBeenCalledTimes(2);
    expect(clearIntervalSpy).not.toHaveBeenCalled();
  });

  it('should not run an update', async () => {
    await service.executeCommand();
    expect(logger.error).toHaveBeenCalledWith(
      `Error while executing command ${testData.oIAnalytics.commands.oIBusList[0].id} (retrieved ${testData.oIAnalytics.commands.oIBusList[0].retrievedDate}) of type ${testData.oIAnalytics.commands.oIBusList[0].type}. Error: OIBus is not set up to execute remote update`
    );
  });
});

describe('OIAnalytics Command service with no commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (oIBusService.getEngineSettings as jest.Mock).mockReturnValue(testData.engine.settings);
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValue([]);

    service = new OIAnalyticsCommandService(
      oIAnalyticsCommandRepository,
      oIAnalyticsRegistrationService,
      oIAnalyticsMessageService,
      encryptionService,
      oIAnalyticsClient,
      oIBusService,
      scanModeService,
      southService,
      northService,
      logger,
      'binaryFolder',
      true,
      '3.4.0'
    );
  });

  it('should properly start when not registered', () => {
    expect(oIBusService.getEngineSettings).toHaveBeenCalled();
    expect(oIAnalyticsCommandRepository.list).toHaveBeenCalled();
    expect(oIBusService.updateOIBusVersion).toHaveBeenCalledWith(version, '3.4.0');
    expect(oIAnalyticsCommandRepository.markAsCompleted).not.toHaveBeenCalled();
  });
});

describe('OIAnalytics Command service with no commands and without update', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValue([]);
    const engineSettings: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    engineSettings.version = version;
    (oIBusService.getEngineSettings as jest.Mock).mockReturnValue(engineSettings);
    service = new OIAnalyticsCommandService(
      oIAnalyticsCommandRepository,
      oIAnalyticsRegistrationService,
      oIAnalyticsMessageService,
      encryptionService,
      oIAnalyticsClient,
      oIBusService,
      scanModeService,
      ipFilterService,
      certificateService,
      southService,
      northService,
      logger,
      'binaryFolder',
      true,
      engineSettings.launcherVersion
    );
  });

  it('should properly start when not registered', () => {
    expect(oIBusService.updateOIBusVersion).not.toHaveBeenCalled();
    expect(oIAnalyticsCommandRepository.markAsCompleted).not.toHaveBeenCalled();
  });
});
