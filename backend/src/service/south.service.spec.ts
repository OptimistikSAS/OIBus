import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import pino from 'pino';
import SouthService, {
  copySouthItemCommandToSouthItemEntity,
  southManifestList,
  toSouthConnectorDTO,
  toSouthConnectorItemDTO,
  toSouthConnectorLightDTO,
  toSouthItemGroupDTO
} from './south.service';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../tests/__mocks__/repository/config/scan-mode-repository.mock';
import LogRepository from '../repository/logs/log.repository';
import LogRepositoryMock from '../tests/__mocks__/repository/log/log-repository.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import OIAnalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import SouthConnectorMetricsRepository from '../repository/metrics/south-connector-metrics.repository';
import SouthMetricsRepositoryMock from '../tests/__mocks__/repository/metrics/south-metrics-repository.mock';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../tests/__mocks__/repository/cache/south-cache-repository.mock';
import testData from '../tests/utils/test-data';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import OIAnalyticsRegistrationRepositoryMock from '../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import CertificateRepositoryMock from '../tests/__mocks__/repository/config/certificate-repository.mock';
import DataStreamEngine from '../engine/data-stream-engine';
import DataStreamEngineMock from '../tests/__mocks__/data-stream-engine.mock';
import SouthConnectorMock from '../tests/__mocks__/south-connector.mock';
import { buildSouth } from '../south/south-connector-factory';
import { NotFoundError, OIBusValidationError } from '../model/types';
import csv from 'papaparse';
import { stringToBoolean } from './utils';
import { SouthConnectorEntityLight, SouthItemGroupEntity, SouthConnectorItemEntity } from '../model/south-connector.model';
import { SouthConnectorItemDTO, SouthItemGroupCommandDTO, SouthConnectorItemCommandDTO } from '../../shared/model/south-connector.model';
import { SouthItemSettings } from '../../shared/model/south-settings.model';
import SouthItemGroupRepository from '../repository/config/south-item-group.repository';
import SouthItemGroupRepositoryMock from '../tests/__mocks__/repository/config/south-item-group-repository.mock';

jest.mock('../south/south-opcua/south-opcua');
jest.mock('./metrics/south-connector-metrics.service');
jest.mock('node:fs/promises');
jest.mock('papaparse');
jest.mock('./utils');
jest.mock('../south/south-connector-factory');
jest.mock('../web-server/controllers/validators/joi.validator');
jest.mock('./encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

const validator = new JoiValidator();
const logger: pino.Logger = new PinoLogger();
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const logRepository: LogRepository = new LogRepositoryMock();
const southMetricsRepository: SouthConnectorMetricsRepository = new SouthMetricsRepositoryMock();
const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository = new OIAnalyticsRegistrationRepositoryMock();
const certificateRepository: CertificateRepository = new CertificateRepositoryMock();
const oIAnalyticsMessageService: OIAnalyticsMessageService = new OIAnalyticsMessageServiceMock();
const engine: DataStreamEngine = new DataStreamEngineMock(logger);
const southItemGroupRepository: SouthItemGroupRepository = new SouthItemGroupRepositoryMock();

const mockedSouth1 = new SouthConnectorMock(testData.south.list[0]);
let service: SouthService;

describe('South Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (buildSouth as jest.Mock).mockReturnValue(mockedSouth1);
    (southConnectorRepository.findAllSouth as jest.Mock).mockReturnValue([]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(testData.south.list[0]);
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValue(testData.south.list[0].items[0]);
    (scanModeRepository.findAll as jest.Mock).mockReturnValue(testData.scanMode.list);
    (stringToBoolean as jest.Mock).mockReturnValue(true);

    service = new SouthService(
      validator,
      southConnectorRepository,
      logRepository,
      southMetricsRepository,
      southCacheRepository,
      scanModeRepository,
      oIAnalyticsRegistrationRepository,
      certificateRepository,
      oIAnalyticsMessageService,
      engine,
      southItemGroupRepository
    );
  });

  it('should retrieve a list of north manifest', () => {
    const list = service.listManifest();
    expect(list).toBeDefined();
  });

  it('should retrieve a manifest', () => {
    const consoleManifest = service.getManifest('folder-scanner');
    expect(consoleManifest).toEqual(southManifestList[0]);
  });

  it('should throw an error if manifest is not found', () => {
    expect(() => service.getManifest('bad')).toThrow(new NotFoundError(`South manifest "bad" not found`));
  });

  it('should get all south connector settings', () => {
    service.list();
    expect(southConnectorRepository.findAllSouth).toHaveBeenCalledTimes(1);
  });

  it('should get a south connector', () => {
    service.findById(testData.south.list[0].id);

    expect(southConnectorRepository.findSouthById).toHaveBeenCalledTimes(1);
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(testData.south.list[0].id);
  });

  it('should throw an error when south connector does not exist', () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(null);

    expect(() => service.findById(testData.south.list[0].id)).toThrow(new NotFoundError(`South "${testData.south.list[0].id}" not found`));

    expect(southConnectorRepository.findSouthById).toHaveBeenCalledTimes(1);
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(testData.south.list[0].id);
  });

  it('should create a south connector', async () => {
    service.retrieveSecretsFromSouth = jest.fn().mockReturnValue(testData.south.list[0]);

    await service.create(testData.south.command, testData.south.list[0].id);

    expect(southConnectorRepository.saveSouth).toHaveBeenCalledTimes(2);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(service.retrieveSecretsFromSouth).toHaveBeenCalledTimes(1);
    expect(engine.createSouth).toHaveBeenCalledTimes(1);
    expect(engine.startSouth).toHaveBeenCalledTimes(1);
    // Verify that items have their IDs reset when retrieveSecretsFromSouth is true
    // Check the second call (final save with items)
    const savedSouthCall = (southConnectorRepository.saveSouth as jest.Mock).mock.calls[1];
    const savedSouth = savedSouthCall[0];
    if (savedSouth.items && savedSouth.items.length > 0) {
      // When retrieveSecretsFromSouth is true, item IDs should be reset (empty string)
      savedSouth.items.forEach((item: { id: string }) => {
        expect(item.id).toBe('');
      });
    }
  });

  it('should create a south connector with items having groupName and create group when it does not exist', async () => {
    service.retrieveSecretsFromSouth = jest.fn();

    const newGroup: SouthItemGroupEntity = {
      id: 'newGroupId',
      name: 'New Group',
      southId: 'newSouthId',
      scanMode: testData.scanMode.list[0],
      shareTrackedInstant: false,
      overlap: null
    };

    (southItemGroupRepository.findByNameAndSouthId as jest.Mock).mockReturnValue(null);
    (southItemGroupRepository.create as jest.Mock).mockReturnValue(newGroup);
    // Mock findById to return the group when called with the new group's ID
    (southItemGroupRepository.findById as jest.Mock).mockImplementation((id: string) => {
      if (id === 'newGroupId') {
        return newGroup;
      }
      return null;
    });

    let callCount = 0;
    (southConnectorRepository.saveSouth as jest.Mock).mockImplementation((south: Record<string, unknown>) => {
      // Set the ID on first save
      if (callCount === 0 && !south.id) {
        south.id = 'newSouthId';
      }
      callCount++;
      return south;
    });

    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.items[0].groupName = 'New Group';
    command.items[0].groupId = null;

    await service.create(command, null);

    expect(southConnectorRepository.saveSouth).toHaveBeenCalledTimes(2);
    expect(southItemGroupRepository.findByNameAndSouthId).toHaveBeenCalledWith('New Group', 'newSouthId');
    expect(southItemGroupRepository.create).toHaveBeenCalled();
    // Verify that the item has the group assigned
    const savedSouthCall = (southConnectorRepository.saveSouth as jest.Mock).mock.calls[1];
    const savedSouth = savedSouthCall[0];
    expect(savedSouth.items[0].groups).toEqual([newGroup]);
  });

  it('should create a south connector with items having groupName and use existing group when it already exists', async () => {
    service.retrieveSecretsFromSouth = jest.fn();

    const existingGroup: SouthItemGroupEntity = {
      id: 'existingGroupId',
      name: 'Existing Group',
      southId: 'newSouthId',
      scanMode: testData.scanMode.list[0],
      shareTrackedInstant: false,
      overlap: null
    };

    let callCount = 0;
    (southConnectorRepository.saveSouth as jest.Mock).mockImplementation((south: Record<string, unknown>) => {
      // Set the ID on first save
      if (callCount === 0 && !south.id) {
        south.id = 'newSouthId';
      }
      callCount++;
      return south;
    });

    // Mock to return existing group when searched
    (southItemGroupRepository.findByNameAndSouthId as jest.Mock).mockReturnValue(existingGroup);
    (southItemGroupRepository.findById as jest.Mock).mockReturnValue(existingGroup);

    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.items[0].groupName = 'Existing Group';
    command.items[0].groupId = null;

    await service.create(command, null);

    expect(southConnectorRepository.saveSouth).toHaveBeenCalledTimes(2);
    expect(southItemGroupRepository.findByNameAndSouthId).toHaveBeenCalledWith('Existing Group', 'newSouthId');
    // Group should NOT be created since it already exists
    expect(southItemGroupRepository.create).not.toHaveBeenCalled();
    // Verify that the item has the existing group assigned
    const savedSouthCall = (southConnectorRepository.saveSouth as jest.Mock).mock.calls[1];
    const savedSouth = savedSouthCall[0];
    expect(savedSouth.items[0].groups).toEqual([existingGroup]);
  });

  it('should create a south connector with retrieveSecretsFromSouth when item has no id', async () => {
    service.retrieveSecretsFromSouth = jest.fn().mockReturnValue(testData.south.list[0]);

    const command = JSON.parse(JSON.stringify(testData.south.command));
    // Set item id to null to test the branch where command.id is falsy
    command.items[0].id = null;

    await service.create(command, testData.south.list[0].id);

    expect(southConnectorRepository.saveSouth).toHaveBeenCalledTimes(2);
    expect(service.retrieveSecretsFromSouth).toHaveBeenCalledTimes(1);
    // Verify that items have their IDs reset to empty string when retrieveSecretsFromSouth is true
    // Check the second call (final save with items)
    const savedSouthCall = (southConnectorRepository.saveSouth as jest.Mock).mock.calls[1];
    const savedSouth = savedSouthCall[0];
    if (savedSouth.items && savedSouth.items.length > 0) {
      savedSouth.items.forEach((item: { id: string; groups?: Array<unknown> }) => {
        expect(item.id).toBe('');
        // When retrieveSecretsFromSouth is true, southItemGroupRepository is now provided,
        // so groups should be set to an empty array when no groupId is specified
        expect(item.groups).toEqual([]);
      });
    }
  });

  it('should not create south connector if disabled', async () => {
    service.retrieveSecretsFromSouth = jest.fn();

    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.enabled = false;
    await service.create(command, null);
    expect(southConnectorRepository.saveSouth).toHaveBeenCalledTimes(2);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.createSouth).toHaveBeenCalledTimes(1);
    expect(engine.startSouth).not.toHaveBeenCalled();
    // Verify that when retrieveSecretsFromSouth is false and command.id is null, id is set to empty string
    // Check the second call (final save with items)
    const savedSouthCall = (southConnectorRepository.saveSouth as jest.Mock).mock.calls[1];
    const savedSouth = savedSouthCall[0];
    if (savedSouth.items && savedSouth.items.length > 0) {
      savedSouth.items.forEach((item: { id: string }) => {
        expect(item.id).toBe('');
      });
    }
  });

  it('should not create a south connector with duplicate name', async () => {
    service.retrieveSecretsFromSouth = jest.fn();
    (southConnectorRepository.findAllSouth as jest.Mock).mockReturnValue([{ id: 'existing-id', name: testData.south.command.name }]);

    await expect(service.create(testData.south.command, null)).rejects.toThrow(
      new OIBusValidationError(`South connector name "${testData.south.command.name}" already exists`)
    );
  });

  it('should update a south connector', async () => {
    (southConnectorRepository.findAllSouth as jest.Mock).mockReturnValue(testData.south.list);
    await service.update(testData.south.list[0].id, testData.south.command);

    expect(southConnectorRepository.saveSouth).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouth).toHaveBeenCalledTimes(1);
  });

  it('should update a south connector with a new unique name', async () => {
    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.name = 'Updated South Name';
    (southConnectorRepository.findAllSouth as jest.Mock).mockReturnValue(testData.south.list);

    await service.update(testData.south.list[0].id, command);

    expect(southConnectorRepository.saveSouth).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouth).toHaveBeenCalledTimes(1);
  });

  it('should not update a south connector with duplicate name', async () => {
    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.name = 'Duplicate Name';
    (southConnectorRepository.findAllSouth as jest.Mock).mockReturnValue([{ id: 'other-id', name: 'Duplicate Name' }]);

    await expect(service.update(testData.south.list[0].id, command)).rejects.toThrow(
      new OIBusValidationError(`South connector name "Duplicate Name" already exists`)
    );
  });

  it('should delete a south connector', async () => {
    await service.delete(testData.south.list[0].id);

    expect(engine.deleteSouth).toHaveBeenCalledWith(testData.south.list[0]);
    expect(southConnectorRepository.deleteSouth).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(logRepository.deleteLogsByScopeId).toHaveBeenCalledWith('south', testData.south.list[0].id);
    expect(southMetricsRepository.removeMetrics).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('should start south', async () => {
    await service.start(testData.south.list[0].id);

    expect(southConnectorRepository.start).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(engine.startSouth).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('should stop south', async () => {
    await service.stop(testData.south.list[0].id);

    expect(southConnectorRepository.stop).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(engine.stopSouth).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('should get a south data stream for metrics', () => {
    service.getSouthDataStream(testData.south.list[0].id);
    expect(engine.getSouthDataStream).toHaveBeenCalledWith(testData.south.list[0].id);
  });

  it('should test a south connector in creation mode', async () => {
    await service.testSouth('create', testData.south.command.type, testData.south.command.settings);

    expect(buildSouth).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.testConnection).toHaveBeenCalled();
  });

  it('should test a south connector in edit mode', async () => {
    await service.testSouth(testData.south.list[0].id, testData.south.command.type, testData.south.command.settings);

    expect(buildSouth).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.testConnection).toHaveBeenCalled();
  });

  it('should test item in creation mode', async () => {
    await service.testItem(
      'create',
      testData.south.command.type,
      testData.south.itemCommand.name,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings
    );

    expect(buildSouth).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.testItem).toHaveBeenCalled();
  });

  it('should test item in edit mode', async () => {
    await service.testItem(
      testData.south.list[0].id,
      testData.south.command.type,
      testData.south.itemCommand.name,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings
    );

    expect(buildSouth).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.testItem).toHaveBeenCalled();
  });

  it('should list items', () => {
    service.listItems(testData.south.list[0].id);
    expect(southConnectorRepository.findAllItemsForSouth).toHaveBeenCalledWith(testData.south.list[0].id);
  });

  it('should search items', () => {
    service.searchItems(testData.south.list[0].id, { name: undefined, scanModeId: undefined, enabled: undefined, page: 0 });
    expect(southConnectorRepository.searchItems).toHaveBeenCalledWith(testData.south.list[0].id, {
      name: undefined,
      scanModeId: undefined,
      enabled: undefined,
      page: 0
    });
  });

  it('should find an item', () => {
    service.findItemById(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
  });

  it('should throw not found error if item does not exist', async () => {
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(null);

    expect(() => service.findItemById(testData.south.list[0].id, testData.south.list[0].items[0].id)).toThrow(
      new NotFoundError(`Item "${testData.south.list[0].items[0].id}" not found`)
    );

    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
  });

  it('should create an item', async () => {
    await service.createItem(testData.south.list[0].id, testData.south.itemCommand);

    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(southConnectorRepository.saveItem).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('should create an item with null id', async () => {
    const commandWithNullId: SouthConnectorItemCommandDTO = {
      ...testData.south.itemCommand,
      id: null
    };

    await service.createItem(testData.south.list[0].id, commandWithNullId);

    expect(southConnectorRepository.saveItem).toHaveBeenCalledTimes(1);
    // Verify that when retrieveSecretsFromSouth is false and command.id is null, id is set to empty string
    const savedItemCall = (southConnectorRepository.saveItem as jest.Mock).mock.calls[0];
    expect(savedItemCall[1].id).toBe('');
  });

  it('should create item with group', async () => {
    const group: SouthItemGroupEntity = {
      id: 'group1',
      name: 'Test Group',
      southId: testData.south.list[0].id,
      scanMode: testData.scanMode.list[0],
      shareTrackedInstant: false,
      overlap: null
    };

    (southItemGroupRepository.findById as jest.Mock).mockReturnValue(group);

    const commandWithGroup: SouthConnectorItemCommandDTO = {
      ...testData.south.itemCommand,
      groupId: 'group1'
    };

    await service.createItem(testData.south.list[0].id, commandWithGroup);

    expect(southItemGroupRepository.findById).toHaveBeenCalledWith('group1');
    expect(southConnectorRepository.saveItem).toHaveBeenCalledTimes(1);
    const savedItemCall = (southConnectorRepository.saveItem as jest.Mock).mock.calls[0];
    expect(savedItemCall[1].groups).toEqual([group]);
  });

  it('should create item without group when groupId is null', async () => {
    const commandWithoutGroup: SouthConnectorItemCommandDTO = {
      ...testData.south.itemCommand,
      groupId: null
    };

    await service.createItem(testData.south.list[0].id, commandWithoutGroup);

    expect(southConnectorRepository.saveItem).toHaveBeenCalledTimes(1);
    const savedItemCall = (southConnectorRepository.saveItem as jest.Mock).mock.calls[0];
    expect(savedItemCall[1].groups).toEqual([]);
  });

  it('should create item with non-existent groupId (should set groups to empty array)', async () => {
    (southItemGroupRepository.findById as jest.Mock).mockReturnValue(null);

    const commandWithNonExistentGroup: SouthConnectorItemCommandDTO = {
      ...testData.south.itemCommand,
      groupId: 'non-existent-group-id'
    };

    await service.createItem(testData.south.list[0].id, commandWithNonExistentGroup);

    expect(southItemGroupRepository.findById).toHaveBeenCalledWith('non-existent-group-id');
    expect(southConnectorRepository.saveItem).toHaveBeenCalledTimes(1);
    const savedItemCall = (southConnectorRepository.saveItem as jest.Mock).mock.calls[0];
    expect(savedItemCall[1].groups).toEqual([]);
  });

  it('should update an item', async () => {
    await service.updateItem(testData.south.list[0].id, testData.south.list[0].items[0].id, testData.south.itemCommand);

    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(southConnectorRepository.saveItem).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
    // Verify that when retrieveSecretsFromSouth is false and command.id is truthy, id is set to command.id
    const savedItemCall = (southConnectorRepository.saveItem as jest.Mock).mock.calls[0];
    expect(savedItemCall[1].id).toBe(testData.south.itemCommand.id);
  });

  it('should update item with group', async () => {
    const group: SouthItemGroupEntity = {
      id: 'group2',
      name: 'Update Group',
      southId: testData.south.list[0].id,
      scanMode: testData.scanMode.list[0],
      shareTrackedInstant: false,
      overlap: null
    };

    (southItemGroupRepository.findById as jest.Mock).mockReturnValue(group);

    const commandWithGroup: SouthConnectorItemCommandDTO = {
      ...testData.south.itemCommand,
      groupId: 'group2'
    };

    await service.updateItem(testData.south.list[0].id, testData.south.list[0].items[0].id, commandWithGroup);

    expect(southItemGroupRepository.findById).toHaveBeenCalledWith('group2');
    expect(southConnectorRepository.saveItem).toHaveBeenCalledTimes(1);
    const savedItemCall = (southConnectorRepository.saveItem as jest.Mock).mock.calls[0];
    expect(savedItemCall[1].groups).toEqual([group]);
  });

  it('should update item without group when groupId is null', async () => {
    const commandWithoutGroup: SouthConnectorItemCommandDTO = {
      ...testData.south.itemCommand,
      groupId: null
    };

    await service.updateItem(testData.south.list[0].id, testData.south.list[0].items[0].id, commandWithoutGroup);

    expect(southConnectorRepository.saveItem).toHaveBeenCalledTimes(1);
    const savedItemCall = (southConnectorRepository.saveItem as jest.Mock).mock.calls[0];
    expect(savedItemCall[1].groups).toEqual([]);
  });

  it('should enable an item', async () => {
    await service.enableItem(testData.south.list[0].id, testData.south.list[0].items[0].id);

    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(southConnectorRepository.enableItem).toHaveBeenCalledWith(testData.south.list[0].items[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('should disable an item', async () => {
    await service.disableItem(testData.south.list[0].id, testData.south.list[0].items[0].id);

    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(southConnectorRepository.disableItem).toHaveBeenCalledWith(testData.south.list[0].items[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('should enable multiple south items', async () => {
    const southConnectorId = testData.south.list[0].id;
    const itemIds = [testData.south.list[0].items[0].id, testData.south.list[0].items[1].id];

    (southConnectorRepository.findItemById as jest.Mock)
      .mockReturnValueOnce(testData.south.list[0].items[0])
      .mockReturnValueOnce(testData.south.list[0].items[1]);

    await service.enableItems(southConnectorId, itemIds);

    expect(southConnectorRepository.enableItem).toHaveBeenCalledWith(testData.south.list[0].items[0].id);
    expect(southConnectorRepository.enableItem).toHaveBeenCalledWith(testData.south.list[0].items[1].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('should disable multiple south items', async () => {
    const southConnectorId = testData.south.list[0].id;
    const itemIds = [testData.south.list[0].items[0].id, testData.south.list[0].items[1].id];

    (southConnectorRepository.findItemById as jest.Mock)
      .mockReturnValueOnce(testData.south.list[0].items[0])
      .mockReturnValueOnce(testData.south.list[0].items[1]);

    await service.disableItems(southConnectorId, itemIds);

    expect(southConnectorRepository.disableItem).toHaveBeenCalledWith(testData.south.list[0].items[0].id);
    expect(southConnectorRepository.disableItem).toHaveBeenCalledWith(testData.south.list[0].items[1].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('should delete an item', async () => {
    await service.deleteItem(testData.south.list[0].id, testData.south.list[0].items[0].id);

    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(southConnectorRepository.deleteItem).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('should delete multiple south items', async () => {
    const southConnectorId = testData.south.list[0].id;
    const itemIds = [testData.south.list[0].items[0].id, testData.south.list[0].items[1].id];

    (southConnectorRepository.findItemById as jest.Mock)
      .mockReturnValueOnce(testData.south.list[0].items[0])
      .mockReturnValueOnce(testData.south.list[0].items[1]);

    await service.deleteItems(southConnectorId, itemIds);

    expect(southConnectorRepository.deleteItem).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(southConnectorRepository.deleteItem).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[1].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('should delete all items', async () => {
    await service.deleteAllItems(testData.south.list[0].id);

    expect(southConnectorRepository.deleteAllItemsBySouth).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(southCacheRepository.deleteAllBySouthConnector).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('should properly check items', async () => {
    const csvData = [
      {
        name: 'item1',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        scanMode: testData.scanMode.list[0].name
      },
      {
        name: 'item2bis',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        scanMode: 'bad scan mode'
      },
      {
        name: 'item3',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        settings_badItem: 100,
        scanMode: testData.scanMode.list[0].name
      },
      {
        name: 'item4',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 12, // bad type
        settings_minAge: 100,
        scanMode: testData.scanMode.list[0].name
      },
      {
        name: 'item5',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        scanMode: testData.scanMode.list[0].name
      }
    ];
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ',' },
      data: csvData
    });
    (validator.validateSettings as jest.Mock).mockImplementationOnce(() => {
      throw new Error(`validation error`);
    });

    const result = await service.checkImportItems(
      testData.south.list[0].type,
      'file content',
      ',',
      testData.south.list[0].items.map(item => ({ ...item, group: null })) as Array<SouthConnectorItemDTO>
    );
    expect(result).toEqual({
      items: [
        {
          id: '',
          name: csvData[4].name,
          enabled: true,
          scanMode: testData.scanMode.list[0],
          settings: {
            ignoreModifiedDate: true,
            minAge: 100,
            preserveFiles: true,
            regex: '*'
          },
          group: null
        }
      ],
      errors: [
        {
          error: 'Item name "item1" already used',
          item: {
            name: csvData[0].name,
            enabled: 'true',
            scanMode: testData.scanMode.list[0].name,
            settings_ignoreModifiedDate: 'false',
            settings_minAge: 100,
            settings_preserveFiles: 'true',
            settings_regex: '*'
          }
        },
        {
          error: 'Scan mode "bad scan mode" not found for item "item2bis"',
          item: {
            name: csvData[1].name,
            enabled: 'true',
            scanMode: 'bad scan mode',
            settings_ignoreModifiedDate: 'false',
            settings_minAge: 100,
            settings_preserveFiles: 'true',
            settings_regex: '*'
          }
        },
        {
          error: 'Settings "badItem" not accepted in manifest',
          item: {
            name: csvData[2].name,
            enabled: 'true',
            scanMode: testData.scanMode.list[0].name,
            settings_badItem: 100,
            settings_ignoreModifiedDate: 'false',
            settings_minAge: 100,
            settings_preserveFiles: 'true',
            settings_regex: '*'
          }
        },
        {
          error: 'validation error',
          item: {
            name: csvData[3].name,
            enabled: 'true',
            scanMode: testData.scanMode.list[0].name,
            settings_ignoreModifiedDate: 12,
            settings_minAge: 100,
            settings_preserveFiles: 'true',
            settings_regex: '*'
          }
        }
      ]
    });
  });

  it('should properly check items with array or object', async () => {
    const csvData = [
      {
        name: 'item',
        enabled: 'true',
        settings_query: 'query',
        settings_dateTimeFields: '[]',
        settings_serialization: JSON.stringify({
          type: 'csv',
          filename: 'filename',
          delimiter: 'SEMI_COLON',
          compression: true,
          outputTimestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
          outputTimezone: 'Europe/Paris'
        }),
        scanMode: testData.scanMode.list[0].name
      }
    ];
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ',' },
      data: csvData
    });
    const result = await service.checkImportItems(
      testData.south.list[1].type,
      'file content',
      ',',
      testData.south.list[1].items.map(item => ({ ...item, group: null })) as Array<SouthConnectorItemDTO>
    );
    expect(result).toEqual({
      items: [
        {
          id: '',
          name: csvData[0].name,
          scanMode: testData.scanMode.list[0],
          enabled: true,
          settings: {
            query: 'query',
            dateTimeFields: [],
            serialization: {
              type: 'csv',
              filename: 'filename',
              delimiter: 'SEMI_COLON',
              compression: true,
              outputTimestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
              outputTimezone: 'Europe/Paris'
            }
          },
          group: null
        }
      ],
      errors: []
    });
  });

  it('should properly check items with group name from CSV', async () => {
    const csvData = [
      {
        name: 'itemWithGroup',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        scanMode: testData.scanMode.list[0].name,
        group: 'Test Group'
      }
    ];
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ',' },
      data: csvData
    });
    const result = await service.checkImportItems(
      testData.south.list[0].type,
      'file content',
      ',',
      testData.south.list[0].items.map(item => ({ ...item, group: null })) as Array<SouthConnectorItemDTO>
    );
    expect(result).toEqual({
      items: [
        {
          id: '',
          name: csvData[0].name,
          enabled: true,
          scanMode: testData.scanMode.list[0],
          settings: {
            ignoreModifiedDate: true,
            minAge: 100,
            preserveFiles: true,
            regex: '*'
          },
          group: {
            id: '',
            name: 'Test Group',
            scanMode: testData.scanMode.list[0],
            shareTrackedInstant: false,
            overlap: null
          }
        }
      ],
      errors: []
    });
  });

  it('should throw error if delimiter does not match', async () => {
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ';' },
      data: []
    });

    await expect(service.checkImportItems(testData.south.command.type, '', ',', [])).rejects.toThrow(
      new OIBusValidationError(`The entered delimiter "," does not correspond to the file delimiter ";"`)
    );
  });

  it('should import items', async () => {
    await service.importItems(testData.south.list[0].id, [testData.south.itemCommand]);

    expect(southConnectorRepository.saveAllItems).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('should import items with groupName and create group when it does not exist', async () => {
    const newGroup: SouthItemGroupEntity = {
      id: 'newGroupId',
      name: 'New Import Group',
      southId: testData.south.list[0].id,
      scanMode: testData.scanMode.list[0],
      shareTrackedInstant: false,
      overlap: null
    };

    (southItemGroupRepository.findByNameAndSouthId as jest.Mock).mockReturnValue(null);
    (southItemGroupRepository.create as jest.Mock).mockReturnValue(newGroup);
    // Mock findById to return the group when called with the new group's ID
    (southItemGroupRepository.findById as jest.Mock).mockImplementation((id: string) => {
      if (id === 'newGroupId') {
        return newGroup;
      }
      return null;
    });

    const itemCommandWithGroupName: SouthConnectorItemCommandDTO = {
      ...testData.south.itemCommand,
      groupName: 'New Import Group',
      groupId: null
    };

    await service.importItems(testData.south.list[0].id, [itemCommandWithGroupName]);

    expect(southItemGroupRepository.findByNameAndSouthId).toHaveBeenCalledWith('New Import Group', testData.south.list[0].id);
    expect(southItemGroupRepository.create).toHaveBeenCalled();
    expect(southConnectorRepository.saveAllItems).toHaveBeenCalledTimes(1);
    // Verify that the item command was updated to use groupId instead of groupName
    const saveAllItemsCall = (southConnectorRepository.saveAllItems as jest.Mock).mock.calls[0];
    const savedItems = saveAllItemsCall[1];
    expect(savedItems[0].groups).toEqual([newGroup]);
  });

  it('should import items with groupName and use existing group when it exists', async () => {
    const existingGroup: SouthItemGroupEntity = {
      id: 'existingGroupId',
      name: 'Existing Import Group',
      southId: testData.south.list[0].id,
      scanMode: testData.scanMode.list[0],
      shareTrackedInstant: false,
      overlap: null
    };

    (southItemGroupRepository.findByNameAndSouthId as jest.Mock).mockReturnValue(existingGroup);

    const itemCommandWithGroupName: SouthConnectorItemCommandDTO = {
      ...testData.south.itemCommand,
      groupName: 'Existing Import Group',
      groupId: null
    };

    await service.importItems(testData.south.list[0].id, [itemCommandWithGroupName]);

    expect(southItemGroupRepository.findByNameAndSouthId).toHaveBeenCalledWith('Existing Import Group', testData.south.list[0].id);
    expect(southItemGroupRepository.create).not.toHaveBeenCalled();
    expect(southConnectorRepository.saveAllItems).toHaveBeenCalledTimes(1);
  });

  it('should retrieve secrets from south', () => {
    const manifest = JSON.parse(JSON.stringify(testData.south.manifest));
    manifest.id = testData.south.list[0].type;
    expect(service.retrieveSecretsFromSouth('southId', manifest)).toEqual(testData.south.list[0]);
  });

  it('should not retrieve secrets from south', () => {
    expect(service.retrieveSecretsFromSouth(null, testData.south.manifest)).toEqual(null);
  });

  it('should throw error if connector not found when retrieving secrets from bad south type', () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[1]);
    expect(() => service.retrieveSecretsFromSouth('southId', testData.south.manifest)).toThrow(
      `South connector "southId" (type "${testData.south.list[1].type}") must be of the type "${testData.south.manifest.id}"`
    );
  });

  it('should properly convert to DTO', () => {
    const southEntity = testData.south.list[0];
    const southLight: SouthConnectorEntityLight = {
      id: southEntity.id,
      name: southEntity.name,
      type: southEntity.type,
      description: southEntity.description,
      enabled: southEntity.enabled
    };
    expect(toSouthConnectorLightDTO(southLight)).toEqual({
      id: southLight.id,
      name: southLight.name,
      type: southLight.type,
      description: southLight.description,
      enabled: southLight.enabled
    });
    expect(toSouthConnectorDTO(southEntity)).toEqual({
      id: southEntity.id,
      name: southEntity.name,
      type: southEntity.type,
      description: southEntity.description,
      enabled: southEntity.enabled,
      settings: southEntity.settings,
      items: southEntity.items.map(item => toSouthConnectorItemDTO(item, southEntity.type))
    });
  });

  describe('Group operations', () => {
    it('should get groups for a south connector', () => {
      const mockGroups: Array<SouthItemGroupEntity> = [
        {
          id: 'group1',
          name: 'Group 1',
          southId: testData.south.list[0].id,
          scanMode: testData.scanMode.list[0],
          shareTrackedInstant: false,
          overlap: null
        },
        {
          id: 'group2',
          name: 'Group 2',
          southId: testData.south.list[0].id,
          scanMode: testData.scanMode.list[1],
          shareTrackedInstant: true,
          overlap: 10
        }
      ];

      (southItemGroupRepository.findBySouthId as jest.Mock).mockReturnValue(mockGroups);

      const groups = service.getGroups(testData.south.list[0].id);
      expect(groups).toHaveLength(2);
      expect(groups[0].id).toEqual('group1');
      expect(groups[1].id).toEqual('group2');
      expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(testData.south.list[0].id);
    });

    it('should get a specific group by id', () => {
      const mockGroup: SouthItemGroupEntity = {
        id: 'group1',
        name: 'Group 1',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };

      (southItemGroupRepository.findById as jest.Mock).mockReturnValue(mockGroup);

      const group = service.getGroup(testData.south.list[0].id, 'group1');
      expect(group.id).toEqual('group1');
      expect(group.name).toEqual('Group 1');
      expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(testData.south.list[0].id);
      expect(southItemGroupRepository.findById).toHaveBeenCalledWith('group1');
    });

    it('should throw NotFoundError when group not found', () => {
      (southItemGroupRepository.findById as jest.Mock).mockReturnValue(null);

      expect(() => service.getGroup(testData.south.list[0].id, 'nonExistentGroup')).toThrow(
        new NotFoundError('South item group "nonExistentGroup" not found')
      );
    });

    it('should throw NotFoundError when group belongs to different south connector', () => {
      const mockGroup: SouthItemGroupEntity = {
        id: 'group1',
        name: 'Group 1',
        southId: 'differentSouthId',
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };

      (southItemGroupRepository.findById as jest.Mock).mockReturnValue(mockGroup);

      expect(() => service.getGroup(testData.south.list[0].id, 'group1')).toThrow(
        new NotFoundError(`South item group "group1" does not belong to south connector "${testData.south.list[0].id}"`)
      );
    });

    it('should create a group', () => {
      const command: SouthItemGroupCommandDTO = {
        name: 'New Group',
        scanModeId: testData.scanMode.list[0].id,
        shareTrackedInstant: true,
        overlap: 5
      };

      const createdGroup: SouthItemGroupEntity = {
        id: 'newGroupId',
        name: 'New Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: true,
        overlap: 5
      };

      (southItemGroupRepository.findBySouthId as jest.Mock).mockReturnValue([]);
      (southItemGroupRepository.create as jest.Mock).mockReturnValue(createdGroup);

      const result = service.createGroup(testData.south.list[0].id, command);
      expect(result.id).toEqual('newGroupId');
      expect(result.name).toEqual('New Group');
      expect(southItemGroupRepository.create).toHaveBeenCalled();
    });

    it('should throw error when creating group with duplicate name', () => {
      const command: SouthItemGroupCommandDTO = {
        name: 'Existing Group',
        scanModeId: testData.scanMode.list[0].id,
        shareTrackedInstant: false,
        overlap: null
      };

      const existingGroup: SouthItemGroupEntity = {
        id: 'existingGroupId',
        name: 'Existing Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };

      (southItemGroupRepository.findBySouthId as jest.Mock).mockReturnValue([existingGroup]);

      expect(() => service.createGroup(testData.south.list[0].id, command)).toThrow(
        new OIBusValidationError('A group with name "Existing Group" already exists for this south connector')
      );
    });

    it('should update a group', () => {
      const command: SouthItemGroupCommandDTO = {
        name: 'Updated Group',
        scanModeId: testData.scanMode.list[1].id,
        shareTrackedInstant: true,
        overlap: 15
      };

      const existingGroup: SouthItemGroupEntity = {
        id: 'groupToUpdate',
        name: 'Original Name',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };

      const updatedGroup: SouthItemGroupEntity = {
        ...existingGroup,
        name: 'Updated Group',
        scanMode: testData.scanMode.list[1],
        shareTrackedInstant: true,
        overlap: 15
      };

      (southItemGroupRepository.findById as jest.Mock)
        .mockReturnValueOnce(existingGroup) // First call for validation
        .mockReturnValueOnce(updatedGroup); // Second call after update
      (southItemGroupRepository.findBySouthId as jest.Mock).mockReturnValue([existingGroup]);

      const result = service.updateGroup(testData.south.list[0].id, 'groupToUpdate', command);
      expect(result.name).toEqual('Updated Group');
      expect(result.scanMode.id).toEqual(testData.scanMode.list[1].id);
      expect(southItemGroupRepository.update).toHaveBeenCalled();
    });

    it('should throw error when updating non-existent group', () => {
      const command: SouthItemGroupCommandDTO = {
        name: 'Updated Group',
        scanModeId: testData.scanMode.list[0].id,
        shareTrackedInstant: false,
        overlap: null
      };

      (southItemGroupRepository.findById as jest.Mock).mockReturnValue(null);

      expect(() => service.updateGroup(testData.south.list[0].id, 'nonExistentGroup', command)).toThrow(
        new NotFoundError('South item group "nonExistentGroup" not found')
      );
    });

    it('should throw error when updating group that belongs to different south connector', () => {
      const command: SouthItemGroupCommandDTO = {
        name: 'Updated Group',
        scanModeId: testData.scanMode.list[0].id,
        shareTrackedInstant: false,
        overlap: null
      };

      const groupFromDifferentSouth: SouthItemGroupEntity = {
        id: 'groupFromOtherSouth',
        name: 'Group From Other South',
        southId: 'differentSouthId',
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };

      (southItemGroupRepository.findById as jest.Mock).mockReturnValue(groupFromDifferentSouth);

      expect(() => service.updateGroup(testData.south.list[0].id, 'groupFromOtherSouth', command)).toThrow(
        new NotFoundError(`South item group "groupFromOtherSouth" does not belong to south connector "${testData.south.list[0].id}"`)
      );
    });

    it('should throw error when update fails to find updated group', () => {
      const command: SouthItemGroupCommandDTO = {
        name: 'Updated Group',
        scanModeId: testData.scanMode.list[0].id,
        shareTrackedInstant: false,
        overlap: null
      };

      const existingGroup: SouthItemGroupEntity = {
        id: 'groupToUpdate',
        name: 'Original Name',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };

      (southItemGroupRepository.findById as jest.Mock)
        .mockReturnValueOnce(existingGroup) // First call for validation
        .mockReturnValueOnce(null); // Second call after update returns null
      (southItemGroupRepository.findBySouthId as jest.Mock).mockReturnValue([existingGroup]);

      expect(() => service.updateGroup(testData.south.list[0].id, 'groupToUpdate', command)).toThrow(
        new NotFoundError('Failed to update south item group "groupToUpdate"')
      );
    });

    it('should throw error when updating group with duplicate name', () => {
      const command: SouthItemGroupCommandDTO = {
        name: 'Existing Group',
        scanModeId: testData.scanMode.list[0].id,
        shareTrackedInstant: false,
        overlap: null
      };

      const existingGroup: SouthItemGroupEntity = {
        id: 'groupToUpdate',
        name: 'Original Name',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };

      const otherGroup: SouthItemGroupEntity = {
        id: 'otherGroup',
        name: 'Existing Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };

      (southItemGroupRepository.findById as jest.Mock).mockReturnValue(existingGroup);
      (southItemGroupRepository.findBySouthId as jest.Mock).mockReturnValue([existingGroup, otherGroup]);

      expect(() => service.updateGroup(testData.south.list[0].id, 'groupToUpdate', command)).toThrow(
        new OIBusValidationError('A group with name "Existing Group" already exists for this south connector')
      );
    });

    it('should delete a group', async () => {
      const groupToDelete: SouthItemGroupEntity = {
        id: 'groupToDelete',
        name: 'Group To Delete',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };

      (southItemGroupRepository.findById as jest.Mock).mockReturnValue(groupToDelete);
      (engine.reloadSouthItems as jest.Mock).mockResolvedValue(undefined);

      await service.deleteGroup(testData.south.list[0].id, 'groupToDelete');
      expect(southItemGroupRepository.delete).toHaveBeenCalledWith('groupToDelete');
      expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
    });

    it('should throw error when deleting non-existent group', async () => {
      (southItemGroupRepository.findById as jest.Mock).mockReturnValue(null);

      await expect(service.deleteGroup(testData.south.list[0].id, 'nonExistentGroup')).rejects.toThrow(
        new NotFoundError('South item group "nonExistentGroup" not found')
      );
    });

    it('should throw error when deleting group that belongs to different south connector', async () => {
      const groupFromDifferentSouth: SouthItemGroupEntity = {
        id: 'groupFromOtherSouth',
        name: 'Group From Other South',
        southId: 'differentSouthId',
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };

      (southItemGroupRepository.findById as jest.Mock).mockReturnValue(groupFromDifferentSouth);

      await expect(service.deleteGroup(testData.south.list[0].id, 'groupFromOtherSouth')).rejects.toThrow(
        new NotFoundError(`South item group "groupFromOtherSouth" does not belong to south connector "${testData.south.list[0].id}"`)
      );
    });

    it('should move items to a group', async () => {
      const group: SouthItemGroupEntity = {
        id: 'targetGroup',
        name: 'Target Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };

      (southItemGroupRepository.findById as jest.Mock).mockReturnValue(group);
      (southConnectorRepository.findItemById as jest.Mock).mockReturnValue(testData.south.list[0].items[0]);
      (engine.reloadSouthItems as jest.Mock).mockResolvedValue(undefined);

      const itemIds = [testData.south.list[0].items[0].id];
      await service.moveItemsToGroup(testData.south.list[0].id, itemIds, 'targetGroup');

      expect(southItemGroupRepository.findById).toHaveBeenCalledWith('targetGroup');
      expect(southConnectorRepository.moveItemsToGroup).toHaveBeenCalledWith(itemIds, 'targetGroup');
      expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
      expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
    });

    it('should throw error when moving items to group that belongs to different south connector', async () => {
      const groupFromDifferentSouth: SouthItemGroupEntity = {
        id: 'groupFromOtherSouth',
        name: 'Group From Other South',
        southId: 'differentSouthId',
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };

      (southItemGroupRepository.findById as jest.Mock).mockReturnValue(groupFromDifferentSouth);

      const itemIds = [testData.south.list[0].items[0].id];
      await expect(service.moveItemsToGroup(testData.south.list[0].id, itemIds, 'groupFromOtherSouth')).rejects.toThrow(
        new NotFoundError(`South item group "groupFromOtherSouth" does not belong to south connector "${testData.south.list[0].id}"`)
      );
    });

    it('should remove items from groups when groupId is null', async () => {
      (southConnectorRepository.findItemById as jest.Mock).mockReturnValue(testData.south.list[0].items[0]);
      (engine.reloadSouthItems as jest.Mock).mockResolvedValue(undefined);

      const itemIds = [testData.south.list[0].items[0].id];
      await service.moveItemsToGroup(testData.south.list[0].id, itemIds, null);

      expect(southConnectorRepository.moveItemsToGroup).toHaveBeenCalledWith(itemIds, null);
      expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
    });

    it('should throw error when moving items to non-existent group', async () => {
      (southItemGroupRepository.findById as jest.Mock).mockReturnValue(null);

      const itemIds = [testData.south.list[0].items[0].id];
      await expect(service.moveItemsToGroup(testData.south.list[0].id, itemIds, 'nonExistentGroup')).rejects.toThrow(
        new NotFoundError('South item group "nonExistentGroup" not found')
      );
    });

    it('should throw error when moving non-existent item', async () => {
      (southConnectorRepository.findItemById as jest.Mock).mockReturnValue(null);

      const itemIds = ['nonExistentItem'];
      await expect(service.moveItemsToGroup(testData.south.list[0].id, itemIds, null)).rejects.toThrow(
        new NotFoundError('South item "nonExistentItem" not found')
      );
    });

    describe('DTO conversion functions', () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      it('should convert SouthItemGroupEntity to SouthItemGroupDTO', () => {
        const entity: SouthItemGroupEntity = {
          id: 'group1',
          name: 'Test Group',
          southId: testData.south.list[0].id,
          scanMode: testData.scanMode.list[0],
          shareTrackedInstant: true,
          overlap: 10
        };

        const dto = toSouthItemGroupDTO(entity);
        expect(dto.id).toEqual('group1');
        expect(dto.name).toEqual('Test Group');
        expect(dto.scanMode.id).toEqual(testData.scanMode.list[0].id);
        expect(dto.shareTrackedInstant).toEqual(true);
        expect(dto.overlap).toEqual(10);
      });

      it('should convert SouthItemGroupEntity with null overlap to DTO', () => {
        const entity: SouthItemGroupEntity = {
          id: 'group2',
          name: 'Test Group 2',
          southId: testData.south.list[0].id,
          scanMode: testData.scanMode.list[0],
          shareTrackedInstant: false,
          overlap: null
        };

        const dto = toSouthItemGroupDTO(entity);
        expect(dto.overlap).toBeNull();
      });

      it('should convert item with group to DTO using toSouthConnectorItemCommandDTO', async () => {
        const group: SouthItemGroupEntity = {
          id: 'group1',
          name: 'Test Group',
          southId: testData.south.list[0].id,
          scanMode: testData.scanMode.list[0],
          shareTrackedInstant: false,
          overlap: null
        };

        (southItemGroupRepository.findById as jest.Mock).mockReturnValue(group);

        // Test the DTO conversion that uses groups
        const itemWithGroup: SouthConnectorItemEntity<SouthItemSettings> = {
          id: 'item1',
          name: 'Test Item',
          enabled: true,
          scanMode: testData.scanMode.list[0],
          settings: {} as SouthItemSettings,
          groups: [group]
        };

        const itemDTO = toSouthConnectorItemDTO(itemWithGroup, testData.south.list[0].type);
        expect(itemDTO.group).toBeDefined();
        expect(itemDTO.group!.id).toEqual('group1');
        expect(itemDTO.group!.name).toEqual('Test Group');
      });

      it('should convert item without group to DTO', () => {
        const itemWithoutGroup: SouthConnectorItemEntity<SouthItemSettings> = {
          id: 'item2',
          name: 'Test Item 2',
          enabled: true,
          scanMode: testData.scanMode.list[0],
          settings: {} as SouthItemSettings,
          groups: []
        };

        const itemDTO = toSouthConnectorItemDTO(itemWithoutGroup, testData.south.list[0].type);
        expect(itemDTO.group).toBeNull();
      });

      describe('copySouthItemCommandToSouthItemEntity', () => {
        beforeEach(() => {
          jest.clearAllMocks();
          // Reset default mocks
          (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(testData.south.list[0]);
          (scanModeRepository.findAll as jest.Mock).mockReturnValue(testData.scanMode.list);
        });

        it('should use default value for retrieveSecretsFromSouth when undefined is passed', async () => {
          const southItemEntity = {} as SouthConnectorItemEntity<SouthItemSettings>;
          const command: SouthConnectorItemCommandDTO = {
            ...testData.south.itemCommand,
            id: 'testItemId'
          };

          // Pass undefined for retrieveSecretsFromSouth to exercise the default value (retrieveSecretsFromSouth = false)
          await copySouthItemCommandToSouthItemEntity(
            southItemEntity,
            command,
            null,
            testData.south.list[0].type,
            testData.scanMode.list,
            undefined, // retrieveSecretsFromSouth - should default to false
            undefined // southItemGroupRepository
          );

          // When retrieveSecretsFromSouth is false (default) and command.id is truthy, id should be set to command.id
          expect(southItemEntity.id).toBe('testItemId');
          expect(southItemEntity.name).toBe(testData.south.itemCommand.name);
          expect(southItemEntity.enabled).toBe(testData.south.itemCommand.enabled);
        });

        it('should find existing group by name when groupName is provided', async () => {
          const southItemEntity = {} as SouthConnectorItemEntity<SouthItemSettings>;
          const existingGroup: SouthItemGroupEntity = {
            id: 'existingGroupId',
            name: 'Existing Group',
            southId: testData.south.list[0].id,
            scanMode: testData.scanMode.list[0],
            shareTrackedInstant: false,
            overlap: null
          };

          (southItemGroupRepository.findByNameAndSouthId as jest.Mock).mockReturnValue(existingGroup);

          const command: SouthConnectorItemCommandDTO = {
            ...testData.south.itemCommand,
            groupName: 'Existing Group',
            groupId: null
          };

          await copySouthItemCommandToSouthItemEntity(
            southItemEntity,
            command,
            null,
            testData.south.list[0].type,
            testData.scanMode.list,
            false,
            southItemGroupRepository,
            testData.south.list[0].id
          );

          expect(southItemGroupRepository.findByNameAndSouthId).toHaveBeenCalledWith('Existing Group', testData.south.list[0].id);
          expect(southItemGroupRepository.create).not.toHaveBeenCalled();
          expect(southItemEntity.groups).toEqual([existingGroup]);
        });

        it('should create new group by name when groupName is provided and group does not exist', async () => {
          const southItemEntity = {} as SouthConnectorItemEntity<SouthItemSettings>;
          const newGroup: SouthItemGroupEntity = {
            id: 'newGroupId',
            name: 'New Group',
            southId: testData.south.list[0].id,
            scanMode: testData.scanMode.list[0],
            shareTrackedInstant: false,
            overlap: null
          };

          (southItemGroupRepository.findByNameAndSouthId as jest.Mock).mockReturnValue(null);
          (southItemGroupRepository.create as jest.Mock).mockReturnValue(newGroup);

          const command: SouthConnectorItemCommandDTO = {
            ...testData.south.itemCommand,
            groupName: 'New Group',
            groupId: null
          };

          await copySouthItemCommandToSouthItemEntity(
            southItemEntity,
            command,
            null,
            testData.south.list[0].type,
            testData.scanMode.list,
            false,
            southItemGroupRepository,
            testData.south.list[0].id
          );

          expect(southItemGroupRepository.findByNameAndSouthId).toHaveBeenCalledWith('New Group', testData.south.list[0].id);
          expect(southItemGroupRepository.create).toHaveBeenCalled();
          expect(southItemEntity.groups).toEqual([newGroup]);
        });

        it('should use legacy support when southItemGroupRepository is provided but southId is not', async () => {
          const southItemEntity = {} as SouthConnectorItemEntity<SouthItemSettings>;
          const existingGroup: SouthItemGroupEntity = {
            id: 'groupId',
            name: 'Test Group',
            southId: testData.south.list[0].id,
            scanMode: testData.scanMode.list[0],
            shareTrackedInstant: false,
            overlap: null
          };

          (southItemGroupRepository.findById as jest.Mock).mockReturnValue(existingGroup);

          const command: SouthConnectorItemCommandDTO = {
            ...testData.south.itemCommand,
            groupId: 'groupId',
            groupName: null
          };

          await copySouthItemCommandToSouthItemEntity(
            southItemEntity,
            command,
            null,
            testData.south.list[0].type,
            testData.scanMode.list,
            false,
            southItemGroupRepository,
            undefined // southId is not provided - legacy support
          );

          expect(southItemGroupRepository.findById).toHaveBeenCalledWith('groupId');
          expect(southItemGroupRepository.findByNameAndSouthId).not.toHaveBeenCalled();
          expect(southItemEntity.groups).toEqual([existingGroup]);
        });

        it('should set empty groups array in legacy support when groupId is not found', async () => {
          const southItemEntity = {} as SouthConnectorItemEntity<SouthItemSettings>;

          (southItemGroupRepository.findById as jest.Mock).mockReturnValue(null);

          const command: SouthConnectorItemCommandDTO = {
            ...testData.south.itemCommand,
            groupId: 'nonExistentGroupId',
            groupName: null
          };

          await copySouthItemCommandToSouthItemEntity(
            southItemEntity,
            command,
            null,
            testData.south.list[0].type,
            testData.scanMode.list,
            false,
            southItemGroupRepository,
            undefined // southId is not provided - legacy support
          );

          expect(southItemGroupRepository.findById).toHaveBeenCalledWith('nonExistentGroupId');
          expect(southItemEntity.groups).toEqual([]);
        });

        describe('Edge cases for group creation', () => {
          beforeEach(() => {
            jest.clearAllMocks();
            // Reset default mocks
            (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(testData.south.list[0]);
            (scanModeRepository.findAll as jest.Mock).mockReturnValue(testData.scanMode.list);
            (southConnectorRepository.findAllSouth as jest.Mock).mockReturnValue([]);
          });

          it('should handle case where itemWithGroup is not found when creating group in create method', async () => {
            service.retrieveSecretsFromSouth = jest.fn();

            const command = JSON.parse(JSON.stringify(testData.south.command));
            // Set groupName with whitespace - when trimmed it becomes 'Test Group', but the find compares the original
            // This creates a scenario where the groupName is in uniqueGroupNames but the find might not match
            command.items[0].groupName = '  Test Group  '; // Has whitespace
            command.items[0].groupId = null;

            // Mock findByNameAndSouthId to return null (group doesn't exist)
            (southItemGroupRepository.findByNameAndSouthId as jest.Mock).mockReturnValue(null);

            let callCount = 0;
            (southConnectorRepository.saveSouth as jest.Mock).mockImplementation((south: unknown) => {
              // Provide a stricter type if known, e.g. SouthConnectorEntity, instead of unknown.
              const typedSouth = south as { id?: string };
              if (callCount === 0 && !typedSouth.id) {
                typedSouth.id = 'newSouthId';
              }
              callCount++;
            });

            // The find will compare '  Test Group  ' === 'Test Group' which will fail
            // This triggers the continue statement on line 177, so group is not created in first loop
            // However, copySouthItemCommandToSouthItemEntity will still create it because it trims groupName
            await service.create(command, null);

            expect(southConnectorRepository.saveSouth).toHaveBeenCalledTimes(2);
            // Group will be created in copySouthItemCommandToSouthItemEntity even though first loop skipped it
            // This is because copySouthItemCommandToSouthItemEntity trims groupName before creating
            expect(southItemGroupRepository.create).toHaveBeenCalled();
          });

          it('should trim whitespace from groupName before searching in create method', async () => {
            const commandWithWhitespace: typeof testData.south.command = JSON.parse(JSON.stringify(testData.south.command));
            commandWithWhitespace.items[0].groupName = '  Test Group  ';
            commandWithWhitespace.items[0].groupId = null;

            let callCount = 0;
            (southConnectorRepository.saveSouth as jest.Mock).mockImplementation((south: unknown) => {
              const typedSouth = south as { id?: string };
              if (callCount === 0 && !typedSouth.id) {
                typedSouth.id = 'newSouthId';
              }
              callCount++;
            });

            (southItemGroupRepository.findByNameAndSouthId as jest.Mock).mockReturnValue(null);

            await service.create(commandWithWhitespace, null);

            // Ensure whitespace is trimmed in find logic
            // First call may have undefined southId (before save), second call will have the ID
            expect(southItemGroupRepository.findByNameAndSouthId).toHaveBeenCalledWith('Test Group', expect.anything());
          });

          it('should handle case where itemWithGroup is not found when creating group in importItems method', async () => {
            // Set groupName with whitespace - when trimmed it becomes 'Test Import Group', but the find compares the original
            const itemCommandWithGroupName: SouthConnectorItemCommandDTO = {
              ...testData.south.itemCommand,
              groupName: '  Test Import Group  ', // Has whitespace
              groupId: null
            };

            // Mock findByNameAndSouthId to return null (group doesn't exist)
            (southItemGroupRepository.findByNameAndSouthId as jest.Mock).mockReturnValue(null);

            // The find will compare '  Test Import Group  ' === 'Test Import Group' which will fail
            // This triggers the continue statement on line 648
            await service.importItems(testData.south.list[0].id, [itemCommandWithGroupName]);

            expect(southItemGroupRepository.findByNameAndSouthId).toHaveBeenCalled();
            // Group should not be created if itemWithGroup is not found
            expect(southItemGroupRepository.create).not.toHaveBeenCalled();
          });
        });
      });
    });
  });
});
