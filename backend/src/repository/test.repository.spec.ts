import { Database } from 'better-sqlite3';
import SubscriptionRepository from './subscription.repository';
import ScanModeRepository from './scan-mode.repository';
import { emptyDatabase, initDatabase } from '../tests/utils/test-utils';
import testData from '../tests/utils/test-data';
import { generateRandomId } from '../service/utils';
import IpFilterRepository from './ip-filter.repository';
import EngineRepository from './engine.repository';
import { EngineSettings } from '../model/engine.model';
import { version } from '../../package.json';
import OianalyticsRegistrationRepository from './oianalytics-registration.repository';
import { OIAnalyticsRegistration } from '../model/oianalytics-registration.model';
import OIAnalyticsCommandRepository from './oianalytics-command.repository';
import { createPageFromArray } from '../../../shared/model/types';
import {
  OIAnalyticsFetchDeleteNorthConnectorCommandDTO,
  OIAnalyticsFetchDeleteScanModeCommandDTO,
  OIAnalyticsFetchDeleteSouthConnectorCommandDTO,
  OIAnalyticsFetchRestartEngineCommandDTO,
  OIAnalyticsFetchUpdateEngineSettingsCommandDTO,
  OIAnalyticsFetchUpdateNorthConnectorCommandDTO,
  OIAnalyticsFetchUpdateScanModeCommandDTO,
  OIAnalyticsFetchUpdateSouthConnectorCommandDTO,
  OIAnalyticsFetchUpdateVersionCommandDTO
} from '../service/oia/oianalytics.model';
import OIAnalyticsMessageRepository from './oianalytics-message.repository';

jest.mock('../service/utils');

let database: Database;
describe('Repository with populated database', () => {
  beforeAll(async () => {
    database = await initDatabase();
  });

  afterAll(async () => {
    await emptyDatabase();
  });

  describe('Engine', () => {
    let repository: EngineRepository;
    beforeEach(() => {
      jest.clearAllMocks();
      repository = new EngineRepository(database);
    });

    it('should properly get the engine settings', () => {
      expect(repository.get()).toEqual(testData.engine.settings);
    });

    it('should update engine settings', () => {
      repository.update({ ...testData.engine.command, name: 'updated engine' });
      expect(repository.get()).toEqual({
        ...testData.engine.command,
        id: testData.engine.settings.id,
        version: testData.engine.settings.version,
        name: 'updated engine'
      });
    });

    it('should update version', () => {
      repository.updateVersion('3.4.0');
      expect(repository.get()!.version).toEqual('3.4.0');
    });
  });

  describe('OIAnalytics Registration', () => {
    let repository: OianalyticsRegistrationRepository;

    beforeEach(() => {
      jest.clearAllMocks();
      repository = new OianalyticsRegistrationRepository(database);
    });

    it('should properly get the registration settings', () => {
      expect(repository.get()).toEqual(testData.oIAnalytics.registration.completed);
    });

    it('should properly register', () => {
      const expectedResult: OIAnalyticsRegistration = JSON.parse(JSON.stringify(testData.oIAnalytics.registration.completed));
      expectedResult.status = 'PENDING';
      expectedResult.activationCode = '123ABC';
      expectedResult.checkUrl = 'http://localhost:4200/api/oianalytics/oibus/registration?id=id';
      expectedResult.activationExpirationDate = testData.constants.dates.FAKE_NOW;
      expectedResult.token = '';

      repository.register(
        testData.oIAnalytics.registration.command,
        '123ABC',
        'http://localhost:4200/api/oianalytics/oibus/registration?id=id',
        testData.constants.dates.FAKE_NOW
      );

      expect(repository.get()).toEqual(expectedResult);
    });

    it('should activate registration', () => {
      const expectedResult: OIAnalyticsRegistration = JSON.parse(JSON.stringify(testData.oIAnalytics.registration.completed));
      expectedResult.status = 'REGISTERED';
      expectedResult.activationExpirationDate = '';
      expectedResult.checkUrl = '';
      expectedResult.activationDate = testData.constants.dates.FAKE_NOW;
      expectedResult.activationCode = '';
      expectedResult.token = 'token';

      repository.activate(testData.constants.dates.FAKE_NOW, 'token');

      expect(repository.get()).toEqual(expectedResult);
    });

    it('should unregister', () => {
      const expectedResult: OIAnalyticsRegistration = JSON.parse(JSON.stringify(testData.oIAnalytics.registration.completed));
      expectedResult.status = 'NOT_REGISTERED';
      expectedResult.activationExpirationDate = '';
      expectedResult.checkUrl = '';
      expectedResult.activationDate = '';
      expectedResult.activationCode = '';
      expectedResult.token = '';

      repository.unregister();

      expect(repository.get()).toEqual(expectedResult);
    });

    it('should update registration', () => {
      const specificCommand = {
        ...testData.oIAnalytics.registration.command,
        acceptUnauthorized: false,
        useProxy: true,
        proxyUrl: 'http://localhost:9000',
        proxyUsername: 'oibus',
        proxyPassword: 'pass'
      };
      repository.update(specificCommand);

      const result = repository.get()!;
      expect(result.useProxy).toEqual(specificCommand.useProxy);
      expect(result.proxyUrl).toEqual(specificCommand.proxyUrl);
      expect(result.proxyUsername).toEqual(specificCommand.proxyUsername);
      expect(result.proxyPassword).toEqual(specificCommand.proxyPassword);
    });
  });

  describe('OIAnalytics Command', () => {
    let repository: OIAnalyticsCommandRepository;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

      repository = new OIAnalyticsCommandRepository(database);
    });

    it('should properly list commands', () => {
      expect(repository.findAll()).toEqual(testData.oIAnalytics.commands.oIBusList);
    });

    it('should properly search commands and page them', () => {
      expect(
        repository.search(
          {
            types: ['UPGRADE', 'update-version'],
            status: ['RUNNING'],
            ack: false
          },
          0
        )
      ).toEqual(
        createPageFromArray(
          testData.oIAnalytics.commands.oIBusList.filter(
            element => ['UPGRADE', 'update-version'].includes(element.type) && ['RUNNING'].includes(element.status)
          ),
          50,
          0
        )
      );
    });

    it('should properly search commands and list them', () => {
      expect(
        repository.list({
          types: ['UPGRADE', 'update-version'],
          status: ['RUNNING'],
          ack: false
        })
      ).toEqual(
        testData.oIAnalytics.commands.oIBusList.filter(
          element => ['UPGRADE', 'update-version'].includes(element.type) && ['RUNNING'].includes(element.status)
        )
      );
    });

    it('should properly find by id', () => {
      expect(repository.findById(testData.oIAnalytics.commands.oIBusList[2].id)).toEqual(testData.oIAnalytics.commands.oIBusList[2]);
      expect(repository.findById('badId')).toEqual(null);
    });

    it('should create an update version command', () => {
      const command: OIAnalyticsFetchUpdateVersionCommandDTO = testData.oIAnalytics.commands
        .oIAnalyticsList[0] as OIAnalyticsFetchUpdateVersionCommandDTO;
      repository.create(command);

      expect(repository.findById(command.id)).toEqual({
        id: command.id,
        type: command.type,
        status: 'RETRIEVED',
        ack: false,
        retrievedDate: testData.constants.dates.FAKE_NOW,
        completedDate: null,
        result: null,
        version: command.version,
        assetId: command.assetId
      });
    });

    it('should create an update engine settings command', () => {
      const command: OIAnalyticsFetchUpdateEngineSettingsCommandDTO = testData.oIAnalytics.commands
        .oIAnalyticsList[1] as OIAnalyticsFetchUpdateEngineSettingsCommandDTO;
      repository.create(command);

      expect(repository.findById(command.id)).toEqual({
        id: command.id,
        type: command.type,
        status: 'RETRIEVED',
        ack: false,
        retrievedDate: testData.constants.dates.FAKE_NOW,
        completedDate: null,
        result: null,
        targetVersion: command.targetVersion,
        commandContent: command.commandContent
      });
    });

    it('should create a restart command', () => {
      const command: OIAnalyticsFetchRestartEngineCommandDTO = testData.oIAnalytics.commands
        .oIAnalyticsList[2] as OIAnalyticsFetchRestartEngineCommandDTO;
      repository.create(command);

      expect(repository.findById(command.id)).toEqual({
        id: command.id,
        type: command.type,
        status: 'RETRIEVED',
        ack: false,
        retrievedDate: testData.constants.dates.FAKE_NOW,
        completedDate: null,
        result: null
      });
    });

    it('should create an update scan mode command', () => {
      const command: OIAnalyticsFetchUpdateScanModeCommandDTO = testData.oIAnalytics.commands
        .oIAnalyticsList[3] as OIAnalyticsFetchUpdateScanModeCommandDTO;
      repository.create(command);

      expect(repository.findById(command.id)).toEqual({
        id: command.id,
        type: command.type,
        status: 'RETRIEVED',
        ack: false,
        retrievedDate: testData.constants.dates.FAKE_NOW,
        completedDate: null,
        result: null,
        targetVersion: command.targetVersion,
        commandContent: command.commandContent,
        scanModeId: command.scanModeId
      });
    });

    it('should create an update south command', () => {
      const command: OIAnalyticsFetchUpdateSouthConnectorCommandDTO = testData.oIAnalytics.commands
        .oIAnalyticsList[4] as OIAnalyticsFetchUpdateSouthConnectorCommandDTO;
      repository.create(command);

      expect(repository.findById(command.id)).toEqual({
        id: command.id,
        type: command.type,
        status: 'RETRIEVED',
        ack: false,
        retrievedDate: testData.constants.dates.FAKE_NOW,
        completedDate: null,
        result: null,
        targetVersion: command.targetVersion,
        commandContent: command.commandContent,
        southConnectorId: command.southConnectorId
      });
    });

    it('should create an update north command', () => {
      const command: OIAnalyticsFetchUpdateNorthConnectorCommandDTO = testData.oIAnalytics.commands
        .oIAnalyticsList[5] as OIAnalyticsFetchUpdateNorthConnectorCommandDTO;
      repository.create(command);

      expect(repository.findById(command.id)).toEqual({
        id: command.id,
        type: command.type,
        status: 'RETRIEVED',
        ack: false,
        retrievedDate: testData.constants.dates.FAKE_NOW,
        completedDate: null,
        result: null,
        targetVersion: command.targetVersion,
        commandContent: command.commandContent,
        northConnectorId: command.northConnectorId
      });
    });

    it('should create a delete scan mode command', () => {
      const command: OIAnalyticsFetchDeleteScanModeCommandDTO = testData.oIAnalytics.commands
        .oIAnalyticsList[6] as OIAnalyticsFetchDeleteScanModeCommandDTO;
      repository.create(command);

      expect(repository.findById(command.id)).toEqual({
        id: command.id,
        type: command.type,
        status: 'RETRIEVED',
        ack: false,
        retrievedDate: testData.constants.dates.FAKE_NOW,
        completedDate: null,
        result: null,
        targetVersion: command.targetVersion,
        scanModeId: command.scanModeId
      });
    });

    it('should create a delete south command', () => {
      const command: OIAnalyticsFetchDeleteSouthConnectorCommandDTO = testData.oIAnalytics.commands
        .oIAnalyticsList[7] as OIAnalyticsFetchDeleteSouthConnectorCommandDTO;
      repository.create(command);

      expect(repository.findById(command.id)).toEqual({
        id: command.id,
        type: command.type,
        status: 'RETRIEVED',
        ack: false,
        retrievedDate: testData.constants.dates.FAKE_NOW,
        completedDate: null,
        result: null,
        targetVersion: command.targetVersion,
        southConnectorId: command.southConnectorId
      });
    });

    it('should create a delete north command', () => {
      const command: OIAnalyticsFetchDeleteNorthConnectorCommandDTO = testData.oIAnalytics.commands
        .oIAnalyticsList[8] as OIAnalyticsFetchDeleteNorthConnectorCommandDTO;
      repository.create(command);

      expect(repository.findById(command.id)).toEqual({
        id: command.id,
        type: command.type,
        status: 'RETRIEVED',
        ack: false,
        retrievedDate: testData.constants.dates.FAKE_NOW,
        completedDate: null,
        result: null,
        targetVersion: command.targetVersion,
        northConnectorId: command.northConnectorId
      });
    });

    it('should mark a command as COMPLETED', () => {
      repository.markAsCompleted(testData.oIAnalytics.commands.oIBusList[0].id, testData.constants.dates.FAKE_NOW, 'ok');

      expect(repository.findById(testData.oIAnalytics.commands.oIBusList[0].id)).toEqual({
        ...JSON.parse(JSON.stringify(testData.oIAnalytics.commands.oIBusList[0])),
        completedDate: testData.constants.dates.FAKE_NOW,
        result: 'ok',
        status: 'COMPLETED',
        ack: false
      });
    });

    it('should mark a command as ERRORED', () => {
      repository.markAsErrored(testData.oIAnalytics.commands.oIBusList[1].id, 'not ok');

      expect(repository.findById(testData.oIAnalytics.commands.oIBusList[1].id)).toEqual({
        ...JSON.parse(JSON.stringify(testData.oIAnalytics.commands.oIBusList[1])),
        result: 'not ok',
        status: 'ERRORED'
      });
    });

    it('should mark a command as RUNNING', () => {
      repository.markAsRunning(testData.oIAnalytics.commands.oIBusList[2].id);

      expect(repository.findById(testData.oIAnalytics.commands.oIBusList[2].id)).toEqual({
        ...JSON.parse(JSON.stringify(testData.oIAnalytics.commands.oIBusList[2])),
        status: 'RUNNING'
      });
    });

    it('should mark a command as Acknowledged', () => {
      repository.markAsAcknowledged(testData.oIAnalytics.commands.oIBusList[3].id);

      expect(repository.findById(testData.oIAnalytics.commands.oIBusList[3].id)).toEqual({
        ...JSON.parse(JSON.stringify(testData.oIAnalytics.commands.oIBusList[3])),
        ack: true
      });
    });

    it('should mark a command as CANCELLED', () => {
      repository.cancel(testData.oIAnalytics.commands.oIBusList[4].id);

      expect(repository.findById(testData.oIAnalytics.commands.oIBusList[4].id)).toEqual({
        ...JSON.parse(JSON.stringify(testData.oIAnalytics.commands.oIBusList[4])),
        status: 'CANCELLED'
      });
    });

    it('should delete a command', () => {
      repository.delete(testData.oIAnalytics.commands.oIBusList[5].id);

      expect(repository.findById(testData.oIAnalytics.commands.oIBusList[5].id)).toEqual(null);
    });
  });

  describe('OIAnalytics Message', () => {
    let repository: OIAnalyticsMessageRepository;

    beforeEach(() => {
      jest.clearAllMocks();
      repository = new OIAnalyticsMessageRepository(database);
    });

    it('should properly find by id', () => {
      expect(repository.findById(testData.oIAnalytics.messages.oIBusList[0].id)).toEqual(testData.oIAnalytics.messages.oIBusList[0]);
      expect(repository.findById('badId')).toEqual(null);
    });

    it('should properly get messages page by search criteria', () => {
      expect(
        repository.search(
          {
            types: ['full-config'],
            status: ['PENDING'],
            start: testData.constants.dates.JANUARY_1ST_2020_UTC,
            end: testData.constants.dates.FAKE_NOW_IN_FUTURE
          },
          0
        )
      ).toEqual(
        createPageFromArray(
          testData.oIAnalytics.messages.oIBusList.filter(
            element => ['full-config'].includes(element.type) && ['PENDING'].includes(element.status)
          ),
          50,
          0
        )
      );
    });

    it('should properly get messages list by search criteria', () => {
      expect(
        repository.list({
          types: ['full-config'],
          status: ['PENDING'],
          start: testData.constants.dates.JANUARY_1ST_2020_UTC,
          end: testData.constants.dates.FAKE_NOW_IN_FUTURE
        })
      ).toEqual(
        testData.oIAnalytics.messages.oIBusList.filter(
          element => ['full-config'].includes(element.type) && ['PENDING'].includes(element.status)
        )
      );
    });

    it('should create full-config message', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('newId');

      repository.create({
        type: 'full-config'
      });

      expect(repository.findById('newId')).toEqual({
        id: 'newId',
        type: 'full-config',
        status: 'PENDING',
        error: null,
        completedDate: null
      });
    });

    it('should mark a command as COMPLETED', () => {
      repository.markAsCompleted(testData.oIAnalytics.messages.oIBusList[0].id, testData.constants.dates.FAKE_NOW);

      expect(repository.findById(testData.oIAnalytics.messages.oIBusList[0].id)).toEqual({
        ...JSON.parse(JSON.stringify(testData.oIAnalytics.messages.oIBusList[0])),
        status: 'COMPLETED',
        completedDate: testData.constants.dates.FAKE_NOW
      });
    });

    it('should mark a command as ERRORED', () => {
      repository.markAsErrored(testData.oIAnalytics.messages.oIBusList[0].id, testData.constants.dates.FAKE_NOW, 'not ok');

      expect(repository.findById(testData.oIAnalytics.messages.oIBusList[0].id)).toEqual({
        ...JSON.parse(JSON.stringify(testData.oIAnalytics.messages.oIBusList[0])),
        status: 'ERRORED',
        completedDate: testData.constants.dates.FAKE_NOW,
        error: 'not ok'
      });
    });
  });

  describe('Subscription', () => {
    let repository: SubscriptionRepository;

    beforeEach(() => {
      jest.clearAllMocks();
      repository = new SubscriptionRepository(database);
    });

    it('listSouthByNorth() should properly list subscriptions for a North', () => {
      expect(repository.listSouthByNorth(testData.north.list[0].id)).toEqual(testData.subscriptions.list);
      expect(repository.listSouthByNorth(testData.north.list[1].id)).toEqual([]);
    });

    it('listNorthBySouth() should properly list subscribed North for a South', () => {
      expect(repository.listNorthBySouth(testData.south.list[0].id)).toEqual([testData.north.list[0].id]);
    });

    it('create() should create and check a subscription', () => {
      expect(repository.checkSubscription(testData.north.list[1].id, testData.south.list[0].id)).toEqual(false);
      repository.create(testData.north.list[1].id, testData.south.list[0].id);
      expect(repository.checkSubscription(testData.north.list[1].id, testData.south.list[0].id)).toEqual(true);
    });

    it('delete() should delete and check a subscription', () => {
      expect(repository.checkSubscription(testData.north.list[0].id, testData.south.list[0].id)).toEqual(true);
      expect(repository.checkSubscription(testData.north.list[0].id, testData.south.list[1].id)).toEqual(true);
      repository.delete(testData.north.list[0].id, testData.south.list[0].id);
      expect(repository.checkSubscription(testData.north.list[0].id, testData.south.list[1].id)).toEqual(true);
      expect(repository.checkSubscription(testData.north.list[0].id, testData.south.list[0].id)).toEqual(false);
      repository.deleteAllByNorth(testData.north.list[0].id);
      expect(repository.checkSubscription(testData.north.list[0].id, testData.south.list[1].id)).toEqual(false);
    });
  });

  describe('Scan Mode', () => {
    let repository: ScanModeRepository;

    beforeEach(() => {
      jest.clearAllMocks();
      repository = new ScanModeRepository(database);
    });

    it('should properly get all scan modes', () => {
      expect(repository.findAll().length).toEqual(2);
    });

    it('should properly get a scan mode', () => {
      expect(repository.findById(testData.scanMode.list[0].id)).toEqual(testData.scanMode.list[0]);
      expect(repository.findById('badId')).toEqual(null);
    });

    it('should create a scan mode', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('newId');
      expect(repository.create(testData.scanMode.command)).toEqual({ ...testData.scanMode.command, id: 'newId' });
    });

    it('should update a scan mode', () => {
      repository.update('newId', testData.scanMode.command);
      expect(repository.findById('newId')).toEqual({ ...testData.scanMode.command, id: 'newId' });
    });

    it('should delete a scan mode', () => {
      expect(repository.findById('newId')).not.toEqual(null);
      repository.delete('newId');
      expect(repository.findById('newId')).toEqual(null);
    });
  });

  describe('IP Filter', () => {
    let repository: IpFilterRepository;

    beforeEach(() => {
      jest.clearAllMocks();
      repository = new IpFilterRepository(database);
    });

    it('findAll() should properly get all IP filters', () => {
      expect(repository.findAll()).toEqual(testData.ipFilters.list);
    });

    it('findById() should properly get an IP filter', () => {
      expect(repository.findById(testData.ipFilters.list[0].id)).toEqual(testData.ipFilters.list[0]);
      expect(repository.findById('badId')).toEqual(null);
    });

    it('create() should create an IP filter', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('newId');
      expect(repository.create(testData.ipFilters.command)).toEqual({ ...testData.ipFilters.command, id: 'newId' });
    });

    it('update() should update an IP filter', () => {
      repository.update('newId', testData.ipFilters.command);
      expect(repository.findById('newId')).toEqual({ ...testData.ipFilters.command, id: 'newId' });
    });

    it('delete() should delete an IP filter', () => {
      expect(repository.findById('newId')).not.toEqual(null);
      repository.delete('newId');
      expect(repository.findById('newId')).toEqual(null);
    });
  });
});

describe('Repository with empty database', () => {
  beforeAll(async () => {
    await initDatabase(false);
  });

  describe('Engine', () => {
    let repository: EngineRepository;
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should properly init engine settings table', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('engineId1');
      repository = new EngineRepository(database);

      const expectedResult: EngineSettings = {
        id: 'engineId1',
        version,
        name: 'OIBus',
        port: 2223,
        proxyEnabled: false,
        proxyPort: 9000,
        logParameters: {
          console: {
            level: 'silent'
          },
          file: {
            level: 'info',
            maxFileSize: 50,
            numberOfFiles: 5
          },
          database: {
            level: 'info',
            maxNumberOfLogs: 100_000
          },
          loki: {
            level: 'silent',
            interval: 60,
            address: '',
            username: '',
            password: ''
          },
          oia: {
            level: 'silent',
            interval: 10
          }
        }
      };
      expect(repository.get()).toEqual(expectedResult);
    });
  });

  describe('OIAnalytics Registration', () => {
    let repository: OianalyticsRegistrationRepository;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should properly init registration settings table', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('registrationId1');
      repository = new OianalyticsRegistrationRepository(database);

      expect(repository.get()).toEqual({
        id: 'registrationId1',
        host: '',
        activationCode: null,
        token: null,
        checkUrl: null,
        status: 'NOT_REGISTERED',
        activationExpirationDate: null,
        activationDate: null,
        acceptUnauthorized: false,
        useProxy: false,
        proxyUrl: null,
        proxyUsername: null,
        proxyPassword: null
      });
    });
  });

  describe('Scan Mode', () => {
    let repository: ScanModeRepository;
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should properly init scan mode table', () => {
      (generateRandomId as jest.Mock)
        .mockReturnValueOnce('id1')
        .mockReturnValueOnce('id2')
        .mockReturnValueOnce('id3')
        .mockReturnValueOnce('id4')
        .mockReturnValueOnce('id5')
        .mockReturnValueOnce('id6');

      repository = new ScanModeRepository(database);
      expect(generateRandomId).toHaveBeenCalledTimes(6);
      expect(repository.findAll().length).toEqual(7);
    });
  });
});
