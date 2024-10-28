import { Database } from 'better-sqlite3';
import ScanModeRepository from './scan-mode.repository';
import { emptyDatabase, flushPromises, initDatabase } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import { generateRandomId } from '../../service/utils';
import IpFilterRepository from './ip-filter.repository';
import EngineRepository from './engine.repository';
import { EngineSettings } from '../../model/engine.model';
import { version } from '../../../package.json';
import OianalyticsRegistrationRepository from './oianalytics-registration.repository';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
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
} from '../../service/oia/oianalytics.model';
import OIAnalyticsMessageRepository from './oianalytics-message.repository';
import SouthConnectorRepository from './south-connector.repository';
import NorthConnectorRepository from './north-connector.repository';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import CertificateRepository from './certificate.repository';
import { Certificate } from '../../model/certificate.model';
import UserRepository from './user.repository';
import { User } from '../../model/user.model';
import argon2 from 'argon2';
import HistoryQueryRepository from './history-query.repository';
import { HistoryQueryEntity, HistoryQueryItemEntity } from '../../model/histor-query.model';

jest.mock('../../service/utils');
jest.mock('argon2');

let database: Database;
describe('Repository with populated database', () => {
  beforeAll(async () => {
    database = await initDatabase('config');
  });

  afterAll(async () => {
    await emptyDatabase('config');
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

  describe('Certificate', () => {
    let repository: CertificateRepository;
    beforeEach(() => {
      jest.clearAllMocks();
      repository = new CertificateRepository(database);
    });

    it('should properly find all certificates', () => {
      expect(repository.findAll()).toEqual(testData.certificates.list);
    });

    it('should properly find a certificate by its ID', () => {
      expect(repository.findById(testData.certificates.list[0].id)).toEqual(testData.certificates.list[0]);
      expect(repository.findById('bad id')).toEqual(null);
    });

    it('should create a certificate', () => {
      repository.create(testData.certificates.command);
      expect(repository.findById('new id')).toEqual(testData.certificates.command);
    });

    it('should update a certificate', () => {
      const newCommand: Certificate = JSON.parse(JSON.stringify(testData.certificates.command));
      newCommand.expiry = testData.constants.dates.DATE_2;
      newCommand.publicKey = 'new public key';
      newCommand.privateKey = 'new private key';
      repository.update(newCommand);
      const result = repository.findById(newCommand.id)!;
      expect(result.expiry).toEqual(newCommand.expiry);
      expect(result.publicKey).toEqual(newCommand.publicKey);
      expect(result.privateKey).toEqual(newCommand.privateKey);
    });

    it('should update name and description certificate', () => {
      repository.updateNameAndDescription(testData.certificates.command.id, 'new name', 'new description');
      const result = repository.findById(testData.certificates.command.id)!;
      expect(result.name).toEqual('new name');
      expect(result.description).toEqual('new description');
    });

    it('should delete certificate', () => {
      repository.delete(testData.certificates.command.id);
      expect(repository.findById(testData.certificates.command.id)).toEqual(null);
    });
  });

  describe('User', () => {
    let repository: UserRepository;
    beforeEach(() => {
      jest.clearAllMocks();

      (argon2.hash as jest.Mock).mockImplementation(password => password);

      repository = new UserRepository(database);
    });

    it('should properly find all certificates', () => {
      expect(repository.findAll()).toEqual(testData.users.list);
    });

    it('should search users', () => {
      expect(
        repository.search({
          login: 'second',
          page: 0
        })
      ).toEqual(createPageFromArray([testData.users.list[1]], 50, 0));

      expect(
        repository.search({
          login: '',
          page: 0
        }).totalElements
      ).toEqual(2);
    });

    it('should properly find a user by its ID', () => {
      expect(repository.findById(testData.users.list[0].id)).toEqual(testData.users.list[0]);
      expect(repository.findById('bad id')).toEqual(null);
    });

    it('should properly find a user by its login', () => {
      expect(repository.findByLogin(testData.users.list[0].login)).toEqual(testData.users.list[0]);
      expect(repository.findByLogin('bad login')).toEqual(null);
    });

    it('should properly get hashed password by a user login', () => {
      expect(repository.getHashedPasswordByLogin(testData.users.list[0].login)).toEqual('password'); // default password populated in tests
      expect(repository.getHashedPasswordByLogin('bad login')).toEqual(null);
    });

    it('should create a user', async () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('newId');

      const result = await repository.create(testData.users.command, 'password');

      expect(argon2.hash).toHaveBeenCalledWith('password');
      expect(result).toEqual({ ...testData.users.command, id: 'newId' });
    });

    it('should update a user', async () => {
      const newCommand: User = JSON.parse(JSON.stringify(testData.users.command));
      newCommand.login = 'new login';
      newCommand.timezone = 'UTC';
      repository.update('newId', newCommand);
      const result = repository.findById('newId')!;
      expect(result.login).toEqual(newCommand.login);
      expect(result.timezone).toEqual(newCommand.timezone);

      await repository.updatePassword('newId', 'new password');

      expect(argon2.hash).toHaveBeenCalledWith('new password');

      const newPassword = repository.getHashedPasswordByLogin(newCommand.login)!;
      expect(newPassword).toEqual('new password');
    });

    it('should delete a user', () => {
      repository.delete(testData.users.list[1].id);
      expect(repository.findById(testData.users.list[1].id)).toEqual(null);
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
        testData.constants.dates.FAKE_NOW,
        'public key',
        'private key'
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
        targetVersion: command.targetVersion,
        retrievedDate: testData.constants.dates.FAKE_NOW,
        completedDate: null,
        result: null,
        commandContent: command.commandContent
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
        targetVersion: command.targetVersion,
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

  describe('Scan Mode', () => {
    let repository: ScanModeRepository;

    beforeEach(() => {
      jest.clearAllMocks();
      repository = new ScanModeRepository(database);
    });

    it('should properly get all scan modes', () => {
      expect(repository.findAll().length).toEqual(testData.scanMode.list.length);
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

  describe('South connector', () => {
    let repository: SouthConnectorRepository;

    beforeEach(() => {
      jest.clearAllMocks();
      repository = new SouthConnectorRepository(database);
    });

    it('should properly get south connectors', () => {
      expect(repository.findAllSouth()).toEqual(
        testData.south.list.map(element => ({
          id: element.id,
          name: element.name,
          type: element.type,
          description: element.description,
          enabled: element.enabled
        }))
      );
    });

    it('should properly get a south connector', () => {
      expect(repository.findSouthById(testData.south.list[0].id)).toEqual(testData.south.list[0]);
      expect(repository.findSouthById('badId')).toEqual(null);
    });

    it('should save a new south connector', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('newId');

      const newSouthConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
      newSouthConnector.id = '';
      newSouthConnector.name = 'new connector';
      newSouthConnector.items = [];
      repository.saveSouthConnector(newSouthConnector);

      expect(newSouthConnector.id).toEqual('newId');
      const createdConnector = repository.findSouthById('newId')!;

      expect(createdConnector.id).toEqual('newId');
      expect(createdConnector.name).toEqual('new connector');
      expect(createdConnector.items.length).toEqual(0);
    });

    it('should update a south connector', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('newItemId');

      const newSouthConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[1]));
      newSouthConnector.items = [
        ...testData.south.list[1].items,
        {
          id: '',
          name: 'new item',
          enabled: true,
          scanModeId: testData.scanMode.list[0].id,
          settings: {} as SouthItemSettings
        }
      ];
      repository.saveSouthConnector(newSouthConnector);

      const updatedConnector = repository.findSouthById(newSouthConnector.id)!;

      expect(updatedConnector.items.length).toEqual(2);
    });

    it('should delete a south connector', () => {
      repository.deleteSouth('newId');
      expect(repository.findSouthById('newId')).toEqual(null);
    });

    it('should stop south connector', () => {
      repository.stop(testData.south.list[0].id);
      expect(repository.findSouthById(testData.south.list[0].id)!.enabled).toEqual(false);
    });

    it('should start south connector', () => {
      repository.start(testData.south.list[0].id);
      expect(repository.findSouthById(testData.south.list[0].id)!.enabled).toEqual(true);
    });

    it('should list items', () => {
      const results = repository.listItems(testData.south.list[1].id, {
        scanModeId: testData.scanMode.list[0].id,
        enabled: true,
        name: 'item'
      });
      expect(results.length).toEqual(2);
    });

    it('should search items', () => {
      const results = repository.searchItems(testData.south.list[1].id, {
        scanModeId: testData.scanMode.list[0].id,
        enabled: true,
        name: 'item',
        page: 0
      });
      expect(results.totalElements).toEqual(2);

      expect(
        repository.searchItems(testData.south.list[1].id, {
          scanModeId: testData.scanMode.list[0].id,
          enabled: true,
          name: 'item'
        }).totalElements
      ).toEqual(2);
    });

    it('should find items', () => {
      const results = repository.findAllItemsForSouth(testData.south.list[1].id);
      expect(results.length).toEqual(2);
    });

    it('should find item', () => {
      const result = repository.findItemById(testData.south.list[1].id, testData.south.list[1].items[0].id);
      expect(result).toEqual(testData.south.list[1].items[0]);
      expect(repository.findItemById(testData.south.list[0].id, testData.south.list[1].items[0].id)).toEqual(null);
    });

    it('should delete item', () => {
      repository.deleteItem(testData.south.list[1].items[0].id);
      expect(repository.findItemById(testData.south.list[1].id, testData.south.list[1].items[0].id)).toEqual(null);
    });

    it('should delete all item by south', () => {
      repository.deleteAllItemsBySouth(testData.south.list[1].id);
      expect(repository.findAllItemsForSouth(testData.south.list[1].id).length).toEqual(0);
    });

    it('should disable and enable item', () => {
      repository.disableItem(testData.south.list[0].items[0].id);
      expect(repository.findItemById(testData.south.list[0].id, testData.south.list[0].items[0].id)!.enabled).toEqual(false);
      repository.enableItem(testData.south.list[0].items[0].id);
      expect(repository.findItemById(testData.south.list[0].id, testData.south.list[0].items[0].id)!.enabled).toEqual(true);
    });

    it('should save all items', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('newItemIdSouth1');

      const itemsToSave: Array<SouthConnectorItemEntity<SouthItemSettings>> = JSON.parse(JSON.stringify(testData.south.list[0].items));
      itemsToSave.push({
        id: '',
        name: 'new item',
        enabled: false,
        scanModeId: testData.scanMode.list[0].id,
        settings: {} as SouthItemSettings
      });
      itemsToSave[0].name = 'updated name';

      repository.saveAllItems(testData.south.list[0].id, itemsToSave);

      const results = repository.findAllItemsForSouth(testData.south.list[0].id);
      expect(results.length).toEqual(3);

      expect(repository.findItemById(testData.south.list[0].id, testData.south.list[0].items[0].id)!.name).toEqual(itemsToSave[0].name);
      expect(repository.findItemById(testData.south.list[0].id, 'newItemIdSouth1')!.id).toEqual('newItemIdSouth1');
    });
  });

  describe('North connector', () => {
    let repository: NorthConnectorRepository;

    beforeEach(() => {
      jest.clearAllMocks();
      repository = new NorthConnectorRepository(database);
    });

    it('should properly get north connectors', () => {
      expect(repository.findAllNorth()).toEqual(
        testData.north.list.map(element => ({
          id: element.id,
          name: element.name,
          type: element.type,
          description: element.description,
          enabled: element.enabled
        }))
      );
    });

    it('should properly get a north connector', () => {
      expect(repository.findNorthById(testData.north.list[0].id)).toEqual(testData.north.list[0]);
      expect(repository.findNorthById('badId')).toEqual(null);
    });

    it('should save a new north connector', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('newId');

      const newNorthConnector: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[0]));
      newNorthConnector.id = '';
      newNorthConnector.name = 'new connector';
      newNorthConnector.subscriptions = [];
      repository.saveNorthConnector(newNorthConnector);

      expect(newNorthConnector.id).toEqual('newId');
      const createdConnector = repository.findNorthById('newId')!;

      expect(createdConnector.id).toEqual('newId');
      expect(createdConnector.name).toEqual('new connector');
      expect(createdConnector.subscriptions.length).toEqual(0);
    });

    it('should update a north connector', () => {
      const newNorthConnector: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[1]));
      newNorthConnector.caching.maxSize = 999;
      newNorthConnector.subscriptions = [
        ...testData.north.list[1].subscriptions,
        {
          id: testData.south.list[1].id,
          name: testData.south.list[1].name,
          type: testData.south.list[1].type,
          description: testData.south.list[1].description,
          enabled: testData.south.list[1].enabled
        }
      ];
      repository.saveNorthConnector(newNorthConnector);

      const updatedConnector = repository.findNorthById(newNorthConnector.id)!;

      expect(updatedConnector.caching.maxSize).toEqual(newNorthConnector.caching.maxSize);
      expect(updatedConnector.subscriptions.length).toEqual(2);
    });

    it('should delete a north connector', () => {
      repository.deleteNorth('newId');
      expect(repository.findNorthById('newId')).toEqual(null);
    });

    it('should stop north connector', () => {
      repository.stopNorth(testData.north.list[0].id);
      expect(repository.findNorthById(testData.north.list[0].id)!.enabled).toEqual(false);
    });

    it('should start north connector', () => {
      repository.startNorth(testData.north.list[0].id);
      expect(repository.findNorthById(testData.north.list[0].id)!.enabled).toEqual(true);
    });

    it('should check subscription', () => {
      expect(repository.checkSubscription(testData.north.list[1].id, testData.south.list[0].id)).toEqual(true);
      expect(repository.checkSubscription(testData.north.list[1].id, 'bad id')).toEqual(false);
    });

    it('should delete and create subscription', () => {
      repository.deleteSubscription(testData.north.list[1].id, testData.south.list[0].id);
      expect(repository.checkSubscription(testData.north.list[1].id, testData.south.list[0].id)).toEqual(false);
      repository.createSubscription(testData.north.list[1].id, testData.south.list[0].id);

      expect(repository.checkSubscription(testData.north.list[1].id, testData.south.list[0].id)).toEqual(true);

      repository.deleteAllSubscriptionsByNorth(testData.north.list[1].id);
      expect(repository.checkSubscription(testData.north.list[1].id, testData.south.list[0].id)).toEqual(false);
    });
  });

  describe('History query', () => {
    let repository: HistoryQueryRepository;

    beforeEach(() => {
      jest.clearAllMocks();
      repository = new HistoryQueryRepository(database);
    });

    it('should properly get history queries', () => {
      expect(repository.findAllHistoryQueries()).toEqual(
        testData.historyQueries.list.map(element => ({
          id: element.id,
          name: element.name,
          description: element.description,
          status: element.status,
          startTime: element.startTime,
          endTime: element.endTime,
          southType: element.southType,
          northType: element.northType
        }))
      );
    });

    it('should properly get a history query', () => {
      expect(repository.findHistoryQueryById(testData.historyQueries.list[0].id)).toEqual(testData.historyQueries.list[0]);
      expect(repository.findHistoryQueryById('badId')).toEqual(null);
    });

    it('should save a new history query', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('newId');

      const newHistoryQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = JSON.parse(
        JSON.stringify(testData.historyQueries.list[0])
      );
      newHistoryQuery.id = '';
      newHistoryQuery.name = 'new history query';
      newHistoryQuery.items = [];
      repository.saveHistoryQuery(newHistoryQuery);

      expect(newHistoryQuery.id).toEqual('newId');
      const createdHistoryQuery = repository.findHistoryQueryById('newId')!;

      expect(createdHistoryQuery.id).toEqual('newId');
      expect(createdHistoryQuery.name).toEqual('new history query');
      expect(createdHistoryQuery.items.length).toEqual(0);
    });

    it('should update a history query', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('newItemId');

      const newHistoryQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = JSON.parse(
        JSON.stringify(testData.historyQueries.list[0])
      );
      newHistoryQuery.items = [
        ...testData.historyQueries.list[0].items,
        {
          id: '',
          name: 'new item',
          enabled: true,
          settings: {} as SouthItemSettings
        }
      ];
      repository.saveHistoryQuery(newHistoryQuery);

      const updatedHistoryQuery = repository.findHistoryQueryById(newHistoryQuery.id)!;

      expect(updatedHistoryQuery.items.length).toEqual(3);
    });

    it('should delete a history query', () => {
      repository.deleteHistoryQuery('newId');
      expect(repository.findHistoryQueryById('newId')).toEqual(null);
    });

    it('should update status', () => {
      repository.updateHistoryQueryStatus(testData.historyQueries.list[0].id, 'FINISHED');
      expect(repository.findHistoryQueryById(testData.historyQueries.list[0].id)!.status).toEqual('FINISHED');
    });

    it('should list items', () => {
      const results = repository.listHistoryQueryItems(testData.historyQueries.list[1].id, {
        enabled: true,
        name: 'item'
      });
      expect(results.length).toEqual(1);
    });

    it('should search items', () => {
      const results = repository.searchHistoryQueryItems(testData.historyQueries.list[1].id, {
        enabled: true,
        name: 'item',
        page: 0
      });
      expect(results.totalElements).toEqual(1);

      expect(
        repository.searchHistoryQueryItems(testData.historyQueries.list[1].id, {
          enabled: true,
          name: 'item'
        }).totalElements
      ).toEqual(1);
    });

    it('should find items', () => {
      const results = repository.findAllItemsForHistoryQuery(testData.historyQueries.list[1].id);
      expect(results.length).toEqual(1);
    });

    it('should find item', () => {
      const result = repository.findHistoryQueryItemById(testData.historyQueries.list[1].id, testData.historyQueries.list[1].items[0].id);
      expect(result).toEqual(testData.historyQueries.list[1].items[0]);
      expect(repository.findHistoryQueryItemById(testData.historyQueries.list[0].id, testData.historyQueries.list[1].items[0].id)).toEqual(
        null
      );
    });

    it('should delete item', () => {
      repository.deleteHistoryQueryItem(testData.historyQueries.list[1].items[0].id);
      expect(repository.findHistoryQueryItemById(testData.historyQueries.list[1].id, testData.historyQueries.list[1].items[0].id)).toEqual(
        null
      );
    });

    it('should delete all item by south', () => {
      repository.deleteAllHistoryQueryItemsByHistoryQuery(testData.historyQueries.list[1].id);
      expect(repository.findAllItemsForHistoryQuery(testData.historyQueries.list[1].id).length).toEqual(0);
    });

    it('should disable and enable item', () => {
      repository.disableHistoryQueryItem(testData.historyQueries.list[0].items[0].id);
      expect(
        repository.findHistoryQueryItemById(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id)!.enabled
      ).toEqual(false);
      repository.enableHistoryQueryItem(testData.historyQueries.list[0].items[0].id);
      expect(
        repository.findHistoryQueryItemById(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id)!.enabled
      ).toEqual(true);
    });

    it('should save all items', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('newItemIdHistory1');

      const itemsToSave: Array<HistoryQueryItemEntity<SouthItemSettings>> = JSON.parse(
        JSON.stringify(testData.historyQueries.list[0].items)
      );
      itemsToSave.push({
        id: '',
        name: 'new history item',
        enabled: false,
        settings: {} as SouthItemSettings
      });
      itemsToSave[0].name = 'updated name';

      repository.saveAllItems(testData.historyQueries.list[0].id, itemsToSave);

      const results = repository.findAllItemsForHistoryQuery(testData.historyQueries.list[0].id);
      expect(results.length).toEqual(4);

      expect(
        repository.findHistoryQueryItemById(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id)!.name
      ).toEqual(itemsToSave[0].name);
      expect(repository.findHistoryQueryItemById(testData.historyQueries.list[0].id, 'newItemIdHistory1')!.id).toEqual('newItemIdHistory1');
    });
  });
});

describe('Repository with empty database', () => {
  beforeAll(async () => {
    await initDatabase('config', false);
  });

  afterAll(async () => {
    await emptyDatabase('config');
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
        privateCipherKey: null,
        publicCipherKey: null,
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

  describe('User', () => {
    let repository: UserRepository;
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should not create a default admin user on hash error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementationOnce(() => null);

      (argon2.hash as jest.Mock).mockImplementationOnce(() => {
        throw new Error('hash error');
      });
      (generateRandomId as jest.Mock).mockReturnValueOnce('defaultUser');
      repository = new UserRepository(database);

      await flushPromises();
      expect(repository.findById('defaultUser')).toEqual(null);
      expect(consoleErrorSpy).toHaveBeenCalledWith('hash error');

      consoleErrorSpy.mockRestore();
    });

    it('should create a default admin user', async () => {
      (argon2.hash as jest.Mock).mockImplementationOnce(password => password);
      (generateRandomId as jest.Mock).mockReturnValueOnce('defaultUser');
      repository = new UserRepository(database);

      await flushPromises();
      expect(argon2.hash).toHaveBeenCalledWith('pass');
      expect(repository.findById('defaultUser')).toEqual({
        id: 'defaultUser',
        login: 'admin',
        firstName: null,
        lastName: null,
        email: null,
        language: 'en',
        timezone: 'Europe/Paris'
      });
      expect(repository.getHashedPasswordByLogin('admin')).toEqual('pass'); //default password
    });
  });
});
