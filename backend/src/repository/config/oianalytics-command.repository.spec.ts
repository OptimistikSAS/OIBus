import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import OIAnalyticsCommandRepository from './oianalytics-command.repository';
import { createPageFromArray } from '../../../shared/model/types';
import {
  OIAnalyticsFetchCreateCertificateCommandDTO,
  OIAnalyticsFetchCreateHistoryQueryCommandDTO,
  OIAnalyticsFetchCreateIPFilterCommandDTO,
  OIAnalyticsFetchCreateNorthConnectorCommandDTO,
  OIAnalyticsFetchCreateOrUpdateHistoryQuerySouthItemsFromCSVCommandDTO,
  OIAnalyticsFetchCreateOrUpdateSouthConnectorItemsFromCSVCommandDTO,
  OIAnalyticsFetchCreateSouthConnectorCommandDTO,
  OIAnalyticsFetchDeleteCertificateCommandDTO,
  OIAnalyticsFetchDeleteHistoryQueryCommandDTO,
  OIAnalyticsFetchDeleteIPFilterCommandDTO,
  OIAnalyticsFetchDeleteNorthConnectorCommandDTO,
  OIAnalyticsFetchDeleteScanModeCommandDTO,
  OIAnalyticsFetchDeleteSouthConnectorCommandDTO,
  OIAnalyticsFetchGetHistoryCacheFileContentCommandDTO,
  OIAnalyticsFetchGetNorthCacheFileContentCommandDTO,
  OIAnalyticsFetchRestartEngineCommandDTO,
  OIAnalyticsFetchSearchHistoryCacheContentCommandDTO,
  OIAnalyticsFetchSearchNorthCacheContentCommandDTO,
  OIAnalyticsFetchSetpointCommandDTO,
  OIAnalyticsFetchTestHistoryQueryNorthConnectionCommandDTO,
  OIAnalyticsFetchTestHistoryQuerySouthConnectionCommandDTO,
  OIAnalyticsFetchTestHistoryQuerySouthItemConnectionCommandDTO,
  OIAnalyticsFetchTestNorthConnectionCommandDTO,
  OIAnalyticsFetchTestSouthConnectionCommandDTO,
  OIAnalyticsFetchTestSouthItemCommandDTO,
  OIAnalyticsFetchUpdateCertificateCommandDTO,
  OIAnalyticsFetchUpdateEngineSettingsCommandDTO,
  OIAnalyticsFetchUpdateHistoryCacheContentCommandDTO,
  OIAnalyticsFetchUpdateHistoryQueryCommandDTO,
  OIAnalyticsFetchUpdateHistoryQueryStatusCommandDTO,
  OIAnalyticsFetchUpdateIPFilterCommandDTO,
  OIAnalyticsFetchUpdateNorthCacheContentCommandDTO,
  OIAnalyticsFetchUpdateNorthConnectorCommandDTO,
  OIAnalyticsFetchUpdateRegistrationSettingsCommandDTO,
  OIAnalyticsFetchUpdateScanModeCommandDTO,
  OIAnalyticsFetchUpdateSouthConnectorCommandDTO,
  OIAnalyticsFetchUpdateVersionCommandDTO,
  OIAnalyticsFetchCreateCustomTransformerCommandDTO,
  OIAnalyticsFetchUpdateCustomTransformerCommandDTO,
  OIAnalyticsFetchDeleteCustomTransformerCommandDTO,
  OIAnalyticsFetchTestCustomTransformerCommandDTO
} from '../../service/oia/oianalytics.model';
import { CustomTransformerCommandDTO, TransformerTestRequest } from '../../../shared/model/transformer.model';
import { NorthConnectorCommandDTO } from '../../../shared/model/north-connector.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemTestingSettings
} from '../../../shared/model/south-connector.model';
import { HistoryQueryCommandDTO, HistoryQueryItemCommandDTO } from '../../../shared/model/history-query.model';
import { CacheSearchParam } from '../../../shared/model/engine.model';

const TEST_DB_PATH = 'src/tests/test-config-command.db';

let database: Database;
describe('OIAnalyticsCommandRepository', () => {
  beforeAll(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: OIAnalyticsCommandRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    repository = new OIAnalyticsCommandRepository(database);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should properly list commands', () => {
    expect(repository.findAll().map(stripAuditFields)).toEqual(testData.oIAnalytics.commands.oIBusList.map(stripAuditFields));
  });

  it('should properly search commands and page them', () => {
    const filteredResult = repository.search({
      types: ['update-version'],
      status: ['RUNNING'],
      ack: false,
      start: testData.constants.dates.JANUARY_1ST_2020_UTC,
      end: testData.constants.dates.FAKE_NOW_IN_FUTURE,
      page: 0
    });
    expect({
      ...filteredResult,
      content: filteredResult.content.map(stripAuditFields)
    }).toEqual(
      createPageFromArray(
        testData.oIAnalytics.commands.oIBusList
          .filter(element => ['update-version'].includes(element.type) && ['RUNNING'].includes(element.status))
          .map(stripAuditFields),
        50,
        0
      )
    );

    const searchResult = repository.search({
      types: [],
      status: [],
      ack: undefined,
      start: undefined,
      end: undefined,
      page: 0
    });
    expect({
      ...searchResult,
      content: searchResult.content.sort((a, b) => a.id.localeCompare(b.id)).map(stripAuditFields)
    }).toEqual(
      createPageFromArray(testData.oIAnalytics.commands.oIBusList.sort((a, b) => a.id.localeCompare(b.id)).map(stripAuditFields), 50, 0)
    );
  });

  it('should properly search commands and list them', () => {
    expect(
      repository
        .list({
          types: ['update-version'],
          status: ['RUNNING'],
          ack: false,
          start: testData.constants.dates.JANUARY_1ST_2020_UTC,
          end: testData.constants.dates.FAKE_NOW_IN_FUTURE
        })
        .map(stripAuditFields)
    ).toEqual(
      testData.oIAnalytics.commands.oIBusList
        .filter(element => ['update-version'].includes(element.type) && ['RUNNING'].includes(element.status))
        .map(stripAuditFields)
    );
    const listResult = repository.list({
      types: [],
      status: [],
      ack: undefined,
      start: undefined,
      end: undefined
    });
    expect(listResult.sort((a, b) => a.id.localeCompare(b.id)).map(stripAuditFields)).toEqual(
      testData.oIAnalytics.commands.oIBusList.sort((a, b) => a.id.localeCompare(b.id)).map(stripAuditFields)
    );
  });

  it('should properly find by id', () => {
    expect(stripAuditFields(repository.findById(testData.oIAnalytics.commands.oIBusList[2].id))).toEqual(
      stripAuditFields(testData.oIAnalytics.commands.oIBusList[2])
    );
    expect(repository.findById('badId')).toEqual(null);
  });

  it('should create an update version command', () => {
    const command: OIAnalyticsFetchUpdateVersionCommandDTO = testData.oIAnalytics.commands
      .oIAnalyticsList[0] as OIAnalyticsFetchUpdateVersionCommandDTO;
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      commandContent: { version: 'v3.5.0-beta', assetId: 'assetId', backupFolders: 'cache/*', updateLauncher: false }
    });
  });

  it('should create an update engine settings command', () => {
    const command: OIAnalyticsFetchUpdateEngineSettingsCommandDTO = testData.oIAnalytics.commands
      .oIAnalyticsList[1] as OIAnalyticsFetchUpdateEngineSettingsCommandDTO;
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
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

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
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

  it('should create a create-or-update-south-items-from-csv command', () => {
    const command: OIAnalyticsFetchCreateOrUpdateSouthConnectorItemsFromCSVCommandDTO = testData.oIAnalytics.commands
      .oIAnalyticsList[10] as OIAnalyticsFetchCreateOrUpdateSouthConnectorItemsFromCSVCommandDTO;
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      southConnectorId: command.southConnectorId,
      commandContent: {
        csvContent: command.csvContent,
        deleteItemsNotPresent: command.deleteItemsNotPresent,
        delimiter: command.delimiter
      }
    });
  });

  it('should create an update scan mode command', () => {
    const command: OIAnalyticsFetchUpdateScanModeCommandDTO = testData.oIAnalytics.commands
      .oIAnalyticsList[3] as OIAnalyticsFetchUpdateScanModeCommandDTO;
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
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

  it('should create a create south command', () => {
    const command: OIAnalyticsFetchCreateSouthConnectorCommandDTO = testData.oIAnalytics.commands
      .oIAnalyticsList[11] as OIAnalyticsFetchCreateSouthConnectorCommandDTO;
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      targetVersion: command.targetVersion,
      commandContent: command.commandContent,
      southConnectorId: command.retrieveSecretsFromSouth
    });
  });

  it('should create a create south command without retrieve secrets from South', () => {
    const command: OIAnalyticsFetchCreateSouthConnectorCommandDTO = JSON.parse(
      JSON.stringify(testData.oIAnalytics.commands.oIAnalyticsList[11])
    ) as OIAnalyticsFetchCreateSouthConnectorCommandDTO;
    command.id = 'create-south-without-secrets';
    command.retrieveSecretsFromSouth = null;
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      targetVersion: command.targetVersion,
      commandContent: command.commandContent,
      southConnectorId: ''
    });
  });

  it('should create an update south command', () => {
    const command: OIAnalyticsFetchUpdateSouthConnectorCommandDTO = testData.oIAnalytics.commands
      .oIAnalyticsList[4] as OIAnalyticsFetchUpdateSouthConnectorCommandDTO;
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
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

  it('should create a create north command', () => {
    const command: OIAnalyticsFetchCreateNorthConnectorCommandDTO = testData.oIAnalytics.commands
      .oIAnalyticsList[12] as OIAnalyticsFetchCreateNorthConnectorCommandDTO;
    repository.create(command);

    expect(repository.findById(command.id)).toEqual(
      expect.objectContaining({
        id: command.id,
        type: command.type,
        status: 'RETRIEVED',
        ack: false,
        retrievedDate: testData.constants.dates.FAKE_NOW,
        completedDate: null,
        result: null,
        targetVersion: command.targetVersion,
        northConnectorId: command.retrieveSecretsFromNorth
      })
    );
  });

  it('should create a create north command without retrieved secrets from North', () => {
    const command: OIAnalyticsFetchCreateNorthConnectorCommandDTO = JSON.parse(
      JSON.stringify(testData.oIAnalytics.commands.oIAnalyticsList[12])
    ) as OIAnalyticsFetchCreateNorthConnectorCommandDTO;
    command.id = 'create-north-without-secrets';
    command.retrieveSecretsFromNorth = null;
    repository.create(command);

    expect(repository.findById(command.id)).toEqual(
      expect.objectContaining({
        id: command.id,
        type: command.type,
        status: 'RETRIEVED',
        ack: false,
        retrievedDate: testData.constants.dates.FAKE_NOW,
        completedDate: null,
        result: null,
        targetVersion: command.targetVersion,
        northConnectorId: ''
      })
    );
  });

  it('should create an update north command', () => {
    const command: OIAnalyticsFetchUpdateNorthConnectorCommandDTO = testData.oIAnalytics.commands
      .oIAnalyticsList[5] as OIAnalyticsFetchUpdateNorthConnectorCommandDTO;
    repository.create(command);

    expect(repository.findById(command.id)).toEqual(
      expect.objectContaining({
        id: command.id,
        type: command.type,
        status: 'RETRIEVED',
        ack: false,
        retrievedDate: testData.constants.dates.FAKE_NOW,
        completedDate: null,
        result: null,
        targetVersion: command.targetVersion,
        northConnectorId: command.northConnectorId
      })
    );
  });

  it('should create a delete scan mode command', () => {
    const command: OIAnalyticsFetchDeleteScanModeCommandDTO = testData.oIAnalytics.commands
      .oIAnalyticsList[6] as OIAnalyticsFetchDeleteScanModeCommandDTO;
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
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

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
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

  it('should create a test south connection command', () => {
    const command: OIAnalyticsFetchTestSouthConnectionCommandDTO = {
      id: 'testSouthConnectionCommandId',
      targetVersion: 'v3.5.0',
      type: 'test-south-connection',
      southConnectorId: 'southId',
      commandContent: {} as SouthConnectorCommandDTO
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      southConnectorId: 'southId',
      commandContent: {}
    });
  });

  it('should create a test south item command', () => {
    const command: OIAnalyticsFetchTestSouthItemCommandDTO = {
      id: 'testSouthItemCommandId',
      targetVersion: 'v3.5.0',
      type: 'test-south-item',
      southConnectorId: 'southId',
      itemId: 'itemId',
      commandContent: {
        southCommand: {} as SouthConnectorCommandDTO,
        itemCommand: {} as SouthConnectorItemCommandDTO,
        testingSettings: {} as SouthConnectorItemTestingSettings
      }
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      itemId: 'itemId',
      southConnectorId: 'southId',
      commandContent: {
        southCommand: {},
        itemCommand: {},
        testingSettings: {}
      }
    });
  });

  it('should create a delete north command', () => {
    const command: OIAnalyticsFetchDeleteNorthConnectorCommandDTO = testData.oIAnalytics.commands
      .oIAnalyticsList[8] as OIAnalyticsFetchDeleteNorthConnectorCommandDTO;
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
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

  it('should create a test north connection command', () => {
    const command: OIAnalyticsFetchTestNorthConnectionCommandDTO = {
      id: 'testNorthConnectionCommandId',
      targetVersion: 'v3.5.0',
      type: 'test-north-connection',
      northConnectorId: 'northId',
      commandContent: {} as NorthConnectorCommandDTO
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      northConnectorId: 'northId',
      commandContent: {}
    });
  });

  it('should create an update registration settings command', () => {
    const command: OIAnalyticsFetchUpdateRegistrationSettingsCommandDTO = testData.oIAnalytics.commands
      .oIAnalyticsList[13] as OIAnalyticsFetchUpdateRegistrationSettingsCommandDTO;
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
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

  it('should mark a command as COMPLETED', () => {
    repository.markAsCompleted(testData.oIAnalytics.commands.oIBusList[0].id, testData.constants.dates.FAKE_NOW, 'ok');

    expect(stripAuditFields(repository.findById(testData.oIAnalytics.commands.oIBusList[0].id))).toEqual(
      stripAuditFields({
        ...JSON.parse(JSON.stringify(testData.oIAnalytics.commands.oIBusList[0])),
        completedDate: testData.constants.dates.FAKE_NOW,
        result: 'ok',
        status: 'COMPLETED',
        ack: false
      })
    );
  });

  it('should mark a command as ERRORED', () => {
    repository.markAsErrored(testData.oIAnalytics.commands.oIBusList[1].id, 'not ok');

    expect(stripAuditFields(repository.findById(testData.oIAnalytics.commands.oIBusList[1].id))).toEqual(
      stripAuditFields({
        ...JSON.parse(JSON.stringify(testData.oIAnalytics.commands.oIBusList[1])),
        result: 'not ok',
        status: 'ERRORED'
      })
    );
  });

  it('should mark a command as RUNNING', () => {
    repository.markAsRunning(testData.oIAnalytics.commands.oIBusList[2].id);

    expect(stripAuditFields(repository.findById(testData.oIAnalytics.commands.oIBusList[2].id))).toEqual(
      stripAuditFields({
        ...JSON.parse(JSON.stringify(testData.oIAnalytics.commands.oIBusList[2])),
        status: 'RUNNING'
      })
    );
  });

  it('should mark a command as Acknowledged', () => {
    repository.markAsAcknowledged(testData.oIAnalytics.commands.oIBusList[3].id);

    expect(stripAuditFields(repository.findById(testData.oIAnalytics.commands.oIBusList[3].id))).toEqual(
      stripAuditFields({
        ...JSON.parse(JSON.stringify(testData.oIAnalytics.commands.oIBusList[3])),
        ack: true
      })
    );
  });

  it('should mark a command as CANCELLED', () => {
    repository.cancel(testData.oIAnalytics.commands.oIBusList[4].id);

    expect(stripAuditFields(repository.findById(testData.oIAnalytics.commands.oIBusList[4].id))).toEqual(
      stripAuditFields({
        ...JSON.parse(JSON.stringify(testData.oIAnalytics.commands.oIBusList[4])),
        status: 'CANCELLED'
      })
    );
  });

  it('should delete a command', () => {
    repository.delete(testData.oIAnalytics.commands.oIBusList[5].id);
    expect(repository.findById(testData.oIAnalytics.commands.oIBusList[5].id)).toEqual(null);
  });

  it('should create a create ip filter command', () => {
    const command: OIAnalyticsFetchCreateIPFilterCommandDTO = {
      id: 'createIpFilterCommandId',
      targetVersion: 'v3.5.0',
      type: 'create-ip-filter',
      commandContent: { address: '*', description: 'desc' }
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      commandContent: { address: '*', description: 'desc' }
    });
  });

  it('should create an update ip filter command', () => {
    const command: OIAnalyticsFetchUpdateIPFilterCommandDTO = {
      id: 'updateIpFilterCommandId',
      targetVersion: 'v3.5.0',
      type: 'update-ip-filter',
      ipFilterId: 'ipFilterId',
      commandContent: { address: '*', description: 'desc' }
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      ipFilterId: 'ipFilterId',
      commandContent: { address: '*', description: 'desc' }
    });
  });

  it('should create a delete ip filter command', () => {
    const command: OIAnalyticsFetchDeleteIPFilterCommandDTO = {
      id: 'deleteIpFilterCommandId',
      targetVersion: 'v3.5.0',
      type: 'delete-ip-filter',
      ipFilterId: 'ipFilterId'
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      ipFilterId: 'ipFilterId'
    });
  });

  it('should create a create certificate command', () => {
    const command: OIAnalyticsFetchCreateCertificateCommandDTO = {
      id: 'createCertificateCommandId',
      targetVersion: 'v3.5.0',
      type: 'create-certificate',
      commandContent: { name: 'name', description: 'desc', regenerateCertificate: false, options: null }
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      commandContent: { name: 'name', description: 'desc', regenerateCertificate: false, options: null }
    });
  });

  it('should create an update certificate command', () => {
    const command: OIAnalyticsFetchUpdateCertificateCommandDTO = {
      id: 'updateCertificateCommandId',
      targetVersion: 'v3.5.0',
      type: 'update-certificate',
      certificateId: 'certificateId',
      commandContent: { name: 'name', description: 'desc', regenerateCertificate: false, options: null }
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      certificateId: 'certificateId',
      commandContent: { name: 'name', description: 'desc', regenerateCertificate: false, options: null }
    });
  });

  it('should create a delete certificate command', () => {
    const command: OIAnalyticsFetchDeleteCertificateCommandDTO = {
      id: 'deleteCertificateCommandId',
      targetVersion: 'v3.5.0',
      type: 'delete-certificate',
      certificateId: 'certificateId'
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      certificateId: 'certificateId'
    });
  });

  it('should create a create history query command', () => {
    const command: OIAnalyticsFetchCreateHistoryQueryCommandDTO = {
      id: 'createHistoryQueryCommandId',
      targetVersion: 'v3.5.0',
      type: 'create-history-query',
      retrieveSecretsFromSouth: 'id1',
      retrieveSecretsFromNorth: 'id2',
      retrieveSecretsFromHistoryQuery: 'id3',
      commandContent: {} as HistoryQueryCommandDTO
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      targetVersion: command.targetVersion,
      commandContent: command.commandContent,
      southConnectorId: command.retrieveSecretsFromSouth,
      northConnectorId: command.retrieveSecretsFromNorth,
      historyQueryId: command.retrieveSecretsFromHistoryQuery
    });
  });

  it('should create a create history query command without retrieve secrets', () => {
    const command: OIAnalyticsFetchCreateHistoryQueryCommandDTO = {
      id: 'createHistoryQueryWithoutSecretsCommandId',
      targetVersion: 'v3.5.0',
      type: 'create-history-query',
      retrieveSecretsFromSouth: null,
      retrieveSecretsFromNorth: null,
      retrieveSecretsFromHistoryQuery: null,
      commandContent: {} as HistoryQueryCommandDTO
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      targetVersion: command.targetVersion,
      commandContent: command.commandContent,
      southConnectorId: '',
      northConnectorId: '',
      historyQueryId: ''
    });
  });

  it('should create an update history query command', () => {
    const command: OIAnalyticsFetchUpdateHistoryQueryCommandDTO = {
      id: 'updateHistoryQueryCommandId',
      targetVersion: 'v3.5.0',
      type: 'update-history-query',
      historyId: 'id1',
      commandContent: { resetCache: false, historyQuery: {} as HistoryQueryCommandDTO }
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      targetVersion: command.targetVersion,
      commandContent: command.commandContent,
      historyQueryId: command.historyId
    });
  });

  it('should create a delete history query command', () => {
    const command: OIAnalyticsFetchDeleteHistoryQueryCommandDTO = {
      id: 'deleteHistoryQueryCommandId',
      targetVersion: 'v3.5.0',
      type: 'delete-history-query',
      historyId: 'id1'
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      targetVersion: command.targetVersion,
      historyQueryId: command.historyId
    });
  });

  it('should create a test history query north connection command', () => {
    const command: OIAnalyticsFetchTestHistoryQueryNorthConnectionCommandDTO = {
      id: 'testHistoryQueryNorthCommandId',
      targetVersion: 'v3.5.0',
      type: 'test-history-query-north-connection',
      historyId: 'h1',
      northConnectorId: 'n1',
      commandContent: {} as HistoryQueryCommandDTO
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      historyQueryId: 'h1',
      northConnectorId: 'n1',
      commandContent: {}
    });
  });

  it('should create a test south connection command', () => {
    const command: OIAnalyticsFetchTestHistoryQuerySouthConnectionCommandDTO = {
      id: 'testHistoryQuerySouthCommandId',
      targetVersion: 'v3.5.0',
      type: 'test-history-query-south-connection',
      historyId: 'h1',
      southConnectorId: 's1',
      commandContent: {} as HistoryQueryCommandDTO
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      historyQueryId: 'h1',
      southConnectorId: 's1',
      commandContent: {}
    });
  });

  it('should create a test south item command', () => {
    const command: OIAnalyticsFetchTestHistoryQuerySouthItemConnectionCommandDTO = {
      id: 'testHistoryQuerySouthItemCommandId',
      targetVersion: 'v3.5.0',
      type: 'test-history-query-south-item',
      historyId: 'h1',
      southConnectorId: 'southId',
      itemId: 'itemId',
      commandContent: {
        historyCommand: {} as HistoryQueryCommandDTO,
        itemCommand: {} as HistoryQueryItemCommandDTO,
        testingSettings: {} as SouthConnectorItemTestingSettings
      }
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      historyQueryId: 'h1',
      itemId: 'itemId',
      southConnectorId: 'southId',
      commandContent: {
        historyCommand: {},
        itemCommand: {},
        testingSettings: {}
      }
    });
  });

  it('should create a create-or-update-history-query-south-items-from-csv command', () => {
    const command: OIAnalyticsFetchCreateOrUpdateHistoryQuerySouthItemsFromCSVCommandDTO = {
      id: 'createOrUpdateHistoryQuerySouthItemsCommandId',
      targetVersion: 'v3.5.0',
      type: 'create-or-update-history-query-south-items-from-csv',
      historyId: 'h1',
      deleteItemsNotPresent: true,
      csvContent: '',
      delimiter: ','
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      historyQueryId: command.historyId,
      commandContent: {
        csvContent: command.csvContent,
        deleteItemsNotPresent: command.deleteItemsNotPresent,
        delimiter: command.delimiter
      }
    });
  });

  it('should create a update-history-query-status command', () => {
    const command: OIAnalyticsFetchUpdateHistoryQueryStatusCommandDTO = {
      id: 'updateHistoryQueryStatusCommandId',
      targetVersion: 'v3.5.0',
      type: 'update-history-query-status',
      historyId: 'h1',
      historyQueryStatus: 'RUNNING'
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      historyQueryId: command.historyId,
      commandContent: { historyQueryStatus: command.historyQueryStatus }
    });
  });

  it('should create a setpoint command', () => {
    const command: OIAnalyticsFetchSetpointCommandDTO = {
      id: 'setpointCommandId',
      targetVersion: 'v3.7.0',
      type: 'setpoint',
      northConnectorId: 'n1',
      commandContent: { pointId: 'reference', value: '123456' }
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      northConnectorId: command.northConnectorId,
      commandContent: command.commandContent
    });
  });

  it('should properly read search-north-cache-content command from database', () => {
    const command: OIAnalyticsFetchSearchNorthCacheContentCommandDTO = {
      id: 'searchNorthCacheContentId',
      targetVersion: '3.8.0',
      type: 'search-north-cache-content',
      northConnectorId: 'northId1',
      commandContent: { searchParams: {} as CacheSearchParam, maxNumberOfFilesReturned: 1000 }
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      northConnectorId: command.northConnectorId,
      commandContent: command.commandContent
    });
  });

  it('should properly read search-history-cache-content command from database', () => {
    const command: OIAnalyticsFetchSearchHistoryCacheContentCommandDTO = {
      id: 'searchHistoryCacheContentId',
      targetVersion: '3.8.0',
      type: 'search-history-cache-content',
      historyQueryId: 'historyId1',
      commandContent: { searchParams: {} as CacheSearchParam, maxNumberOfFilesReturned: 1000 }
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      historyQueryId: command.historyQueryId,
      commandContent: command.commandContent
    });
  });

  it('should properly read get-north-cache-file-content command from database', () => {
    const command: OIAnalyticsFetchGetNorthCacheFileContentCommandDTO = {
      id: 'getNorthCacheFileContentId',
      targetVersion: '3.8.0',
      type: 'get-north-cache-file-content',
      northConnectorId: 'northId1',
      commandContent: { folder: 'error' as const, filename: 'file.txt' }
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      northConnectorId: command.northConnectorId,
      commandContent: command.commandContent
    });
  });

  it('should properly read get-history-cache-file-content command from database', () => {
    const command: OIAnalyticsFetchGetHistoryCacheFileContentCommandDTO = {
      id: 'getHistoryCacheFileContentId',
      targetVersion: '3.8.0',
      type: 'get-history-cache-file-content',
      historyQueryId: 'historyId1',
      commandContent: { folder: 'error' as const, filename: 'file.txt' }
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      historyQueryId: command.historyQueryId,
      commandContent: command.commandContent
    });
  });

  it('should properly read update-north-cache-content command from database', () => {
    const command: OIAnalyticsFetchUpdateNorthCacheContentCommandDTO = {
      id: 'updateNorthCacheContentId',
      targetVersion: '3.8.0',
      type: 'update-north-cache-content',
      northConnectorId: 'northId1',
      commandContent: {
        cache: { remove: [], move: [] },
        error: { remove: [], move: [] },
        archive: { remove: [], move: [] }
      }
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      northConnectorId: command.northConnectorId,
      commandContent: command.commandContent
    });
  });

  it('should properly read update-history-cache-content command from database', () => {
    const command: OIAnalyticsFetchUpdateHistoryCacheContentCommandDTO = {
      id: 'updateHistoryCacheContentId',
      targetVersion: '3.8.0',
      type: 'update-history-cache-content',
      historyQueryId: 'historyId1',
      commandContent: {
        cache: { remove: [], move: [] },
        error: { remove: [], move: [] },
        archive: { remove: [], move: [] }
      }
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      historyQueryId: command.historyQueryId,
      commandContent: command.commandContent
    });
  });

  it('should create a create-custom-transformer command', () => {
    const command: OIAnalyticsFetchCreateCustomTransformerCommandDTO = {
      id: 'createCustomTransformerId',
      targetVersion: 'v3.8.0',
      type: 'create-custom-transformer',
      commandContent: {} as CustomTransformerCommandDTO
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      commandContent: {}
    });
  });

  it('should create an update-custom-transformer command', () => {
    const command: OIAnalyticsFetchUpdateCustomTransformerCommandDTO = {
      id: 'updateCustomTransformerId',
      targetVersion: 'v3.8.0',
      type: 'update-custom-transformer',
      transformerId: 'tr1',
      commandContent: {} as CustomTransformerCommandDTO
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      transformerId: 'tr1',
      commandContent: {}
    });
  });

  it('should create a delete-custom-transformer command', () => {
    const command: OIAnalyticsFetchDeleteCustomTransformerCommandDTO = {
      id: 'deleteCustomTransformerId',
      targetVersion: 'v3.8.0',
      type: 'delete-custom-transformer',
      transformerId: 'tr1'
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      transformerId: 'tr1'
    });
  });

  it('should create a test-custom-transformer command', () => {
    const command: OIAnalyticsFetchTestCustomTransformerCommandDTO = {
      id: 'testCustomTransformerId',
      targetVersion: 'v3.8.0',
      type: 'test-custom-transformer',
      transformerId: 'tr1',
      commandContent: { inputData: 'test-input' } as TransformerTestRequest
    };
    repository.create(command);

    expect(stripAuditFields(repository.findById(command.id))).toEqual({
      id: command.id,
      type: command.type,
      status: 'RETRIEVED',
      ack: false,
      targetVersion: command.targetVersion,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      transformerId: 'tr1',
      commandContent: { inputData: 'test-input' }
    });
  });
});
