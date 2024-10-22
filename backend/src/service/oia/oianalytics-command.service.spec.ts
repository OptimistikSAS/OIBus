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
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import OIAnalyticsRegistrationRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import OIAnalyticsCommandRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-command-repository.mock';
import testData from '../../tests/utils/test-data';
import { flushPromises } from '../../tests/utils/test-utils';
import { delay, getOIBusInfo, unzip } from '../utils';
import fs from 'node:fs/promises';
import {
  OIBusCreateNorthConnectorCommand,
  OIBusCreateScanModeCommand,
  OIBusDeleteNorthConnectorCommand,
  OIBusDeleteScanModeCommand,
  OIBusDeleteSouthConnectorCommand,
  OIBusUpdateEngineSettingsCommand,
  OIBusUpdateNorthConnectorCommand,
  OIBusUpdateScanModeCommand,
  OIBusUpdateSouthConnectorCommand
} from '../../model/oianalytics-command.model';
import { createPageFromArray } from '../../../../shared/model/types';
import SouthService from '../south.service';
import NorthService from '../north.service';
import SouthServiceMock from '../../tests/__mocks__/service/south-service.mock';
import NorthServiceMock from '../../tests/__mocks__/service/north-service.mock';
import OIAnalyticsClient from './oianalytics-client.service';
import OianalyticsClientMock from '../../tests/__mocks__/service/oia/oianalytics-client.mock';

jest.mock('node:fs/promises');
jest.mock('node-fetch');
jest.mock('../../web-server/controllers/validators/joi.validator');
jest.mock('../utils');

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
jest.spyOn(process, 'exit').mockImplementation(() => Promise.resolve());

const oIAnalyticsCommandRepository: OIAnalyticsCommandRepository = new OIAnalyticsCommandRepositoryMock();
const oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository = new OIAnalyticsRegistrationRepositoryMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const oIBusService: OIBusService = new OibusServiceMock();
const scanModeService: ScanModeService = new ScanModeServiceMock();
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
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValue(testData.oIAnalytics.commands.oIBusList);
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(testData.oIAnalytics.registration.completed);
    (getOIBusInfo as jest.Mock).mockReturnValue(testData.engine.oIBusInfo);

    service = new OIAnalyticsCommandService(
      oIAnalyticsCommandRepository,
      oIAnalyticsRegistrationRepository,
      encryptionService,
      oIAnalyticsClient,
      oIBusService,
      scanModeService,
      southService,
      northService,
      logger,
      'binaryFolder',
      false
    );
  });

  it('should properly start and stop service', async () => {
    expect(oIBusService.getEngineSettings).toHaveBeenCalledTimes(1);
    expect(oIBusService.updateOIBusVersion).toHaveBeenCalledWith(version);
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[0].id,
      testData.constants.dates.FAKE_NOW,
      `OIBus updated to version ${version}`
    );

    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    service.start();
    await service.stop();

    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
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
    (oIAnalyticsRegistrationRepository.get as jest.Mock)
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
    await service.sendAckCommands(testData.oIAnalytics.registration.completed);

    expect(logger.error).toHaveBeenCalledWith(
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
    await service.checkRetrievedCommands(testData.oIAnalytics.registration.completed);
    expect(logger.error).toHaveBeenCalledWith(`Error while checking PENDING commands status: error`);

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
    await service.retrieveCommands(testData.oIAnalytics.registration.completed);
    expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(`Error while retrieving commands: error`));
  });

  it('should execute update-version command', async () => {
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValueOnce([testData.oIAnalytics.commands.oIBusList[0]]); // update-version
    const processExitSpy = jest.spyOn(process, 'exit');

    await service.executeCommand();

    expect(oIAnalyticsRegistrationRepository.get).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsCommandRepository.list).toHaveBeenCalled();
    expect(oIBusService.getEngineSettings).toHaveBeenCalled();
    expect(oIAnalyticsClient.downloadFile).toHaveBeenCalledTimes(1);
    expect(unzip).toHaveBeenCalledTimes(1);
    expect(fs.unlink).toHaveBeenCalledTimes(1);
    expect(delay).toHaveBeenCalledTimes(1);
    expect(processExitSpy).toHaveBeenCalledTimes(1);
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
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce({
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
        id: (testData.oIAnalytics.commands.oIBusList[10] as OIBusUpdateSouthConnectorCommand).commandContent.type
      }
    ]);

    await service.executeCommand();

    expect(southService.createSouth).toHaveBeenCalledWith(
      (testData.oIAnalytics.commands.oIBusList[10] as OIBusUpdateSouthConnectorCommand).commandContent
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
      (testData.oIAnalytics.commands.oIBusList[11] as OIBusCreateNorthConnectorCommand).commandContent
    );
    expect(oIAnalyticsCommandRepository.markAsCompleted).toHaveBeenCalledWith(
      testData.oIAnalytics.commands.oIBusList[11].id,
      testData.constants.dates.FAKE_NOW,
      'North connector created successfully'
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
});

describe('OIAnalytics Command service with update error', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (oIBusService.getEngineSettings as jest.Mock).mockReturnValue({ ...JSON.parse(JSON.stringify(testData.engine.settings)), version });
    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValue(testData.oIAnalytics.commands.oIBusList);

    service = new OIAnalyticsCommandService(
      oIAnalyticsCommandRepository,
      oIAnalyticsRegistrationRepository,
      encryptionService,
      oIAnalyticsClient,
      oIBusService,
      scanModeService,
      southService,
      northService,
      logger,
      'binaryFolder',
      false
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

describe('OIAnalytics Command service with no commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (oIAnalyticsCommandRepository.list as jest.Mock).mockReturnValue([]);
    (oIBusService.getEngineSettings as jest.Mock).mockReturnValue(testData.engine.settings);
    service = new OIAnalyticsCommandService(
      oIAnalyticsCommandRepository,
      oIAnalyticsRegistrationRepository,
      encryptionService,
      oIAnalyticsClient,
      oIBusService,
      scanModeService,
      southService,
      northService,
      logger,
      'binaryFolder',
      true
    );
  });

  it('should properly start when not registered', () => {
    expect(oIBusService.getEngineSettings).toHaveBeenCalled();
    expect(oIAnalyticsCommandRepository.list).toHaveBeenCalled();
    expect(oIBusService.updateOIBusVersion).toHaveBeenCalledWith(version);
    expect(oIAnalyticsCommandRepository.markAsCompleted).not.toHaveBeenCalled();
  });

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
    expect(logger.error).toHaveBeenCalledWith('OIBus is not set up to execute remote');
  });
});
