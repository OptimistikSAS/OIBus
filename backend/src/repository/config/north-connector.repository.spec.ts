import { before, after, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { createAuditServiceMock, emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import NorthConnectorRepository from './north-connector.repository';
import SouthItemGroupRepository from './south-item-group.repository';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { SourceOriginSouth, Transformer } from '../../model/transformer.model';
import TransformerRepository from './transformer.repository';
import AuditService from '../../service/audit.service';

const TEST_DB_PATH = 'src/tests/test-config-north.db';

let database: Database;
describe('NorthConnectorRepository', () => {
  before(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: NorthConnectorRepository;
  let auditService: AuditService;

  beforeEach(() => {
    new TransformerRepository(database, createAuditServiceMock()); // ensure standard transformers are seeded
    auditService = createAuditServiceMock();
    repository = new NorthConnectorRepository(database, auditService);
  });

  it('should properly get north connectors', () => {
    const result = repository.findAllNorth();
    for (const element of testData.north.list) {
      const found = result.find(r => r.id === element.id);
      assert.ok(found, `North connector ${element.id} not found`);
      assert.strictEqual(found.name, element.name);
      assert.strictEqual(found.type, element.type);
      assert.strictEqual(found.description, element.description);
      assert.strictEqual(found.enabled, element.enabled);
    }
  });

  it('should properly get full north connectors', () => {
    const result = repository.findAllNorthFull().map(stripAuditFields);
    for (const expected of testData.north.list.map(stripAuditFields)) {
      const found = result.find(r => r.id === expected.id);
      assert.ok(found, `North connector ${expected.id} not found`);
    }
  });

  it('should properly get a north connector', () => {
    const result = repository.findNorthById(testData.north.list[0].id);
    const stripped = stripAuditFields(result);
    const expectedStripped = stripAuditFields(testData.north.list[0]);
    assert.ok(stripped);
    assert.strictEqual(stripped.id, expectedStripped.id);
    assert.strictEqual(stripped.name, expectedStripped.name);
    assert.strictEqual(repository.findNorthById('badId'), null);
  });

  it('should save a new north connector', () => {
    const newNorthConnector: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[0]));
    newNorthConnector.id = '';
    newNorthConnector.name = 'new connector';
    // The cloned fixture's transformer links carry real ids belonging to the *other*, still-existing
    // north connector they were cloned from — a real "new" connector (as the UI always sends) never
    // reuses ids like that, so start this one without any rather than accidentally colliding with them.
    newNorthConnector.transformers = [];
    repository.saveNorth(newNorthConnector);

    assert.ok(newNorthConnector.id);
    const createdConnector = repository.findNorthById(newNorthConnector.id)!;
    assert.strictEqual(createdConnector.id, newNorthConnector.id);
    assert.strictEqual(createdConnector.name, 'new connector');

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    const connectorCreateCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'north_connector' && call.arguments[1] === newNorthConnector.id && call.arguments[2] === 'CREATE'
    );
    assert.strictEqual(connectorCreateCalls.length, 1);
    assert.deepStrictEqual(connectorCreateCalls[0].arguments, [
      'north_connector',
      newNorthConnector.id,
      'CREATE',
      null,
      { ...createdConnector, settings: { ...createdConnector.settings, password: '' } },
      newNorthConnector.updatedBy
    ]);
    // The connector's secret settings field must never be persisted in the audit trail
    assert.strictEqual((connectorCreateCalls[0].arguments[4] as { settings: { password: string } }).settings.password, '');

    const newNorthConnectorWithoutTransformer: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[0]));
    newNorthConnectorWithoutTransformer.id = '';
    newNorthConnectorWithoutTransformer.name = 'new connector without transformer';
    newNorthConnectorWithoutTransformer.transformers = [];
    repository.saveNorth(newNorthConnectorWithoutTransformer);

    assert.ok(newNorthConnectorWithoutTransformer.id);
    const createdConnectorWithoutTransformer = repository.findNorthById(newNorthConnectorWithoutTransformer.id)!;
    assert.deepStrictEqual(createdConnectorWithoutTransformer.transformers, []);

    recordMock.mock.resetCalls();
    repository.addOrEditTransformer(
      newNorthConnectorWithoutTransformer.id,
      {
        id: '',
        transformer: testData.transformers.list[0] as Transformer,
        options: {},
        source: { type: 'oianalytics-setpoint' }
      },
      'transformerUser'
    );
    const createdConnectorWithTransformer = repository.findNorthById(newNorthConnectorWithoutTransformer.id)!;
    assert.strictEqual(createdConnectorWithTransformer.transformers.length, 1);
    assert.strictEqual(createdConnectorWithTransformer.transformers[0].transformer.id, testData.transformers.list[0].id);

    const transformerId = createdConnectorWithTransformer.transformers[0].id;
    const transformerCreateCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'north_transformer' && call.arguments[1] === transformerId && call.arguments[2] === 'CREATE'
    );
    assert.strictEqual(transformerCreateCalls.length, 1);
    assert.deepStrictEqual(transformerCreateCalls[0].arguments, [
      'north_transformer',
      transformerId,
      'CREATE',
      null,
      createdConnectorWithTransformer.transformers[0],
      'transformerUser'
    ]);

    recordMock.mock.resetCalls();
    repository.removeTransformer(transformerId, 'removeUser');
    const createdConnectorWithRemovedTransformer = repository.findNorthById(newNorthConnectorWithoutTransformer.id)!;
    assert.deepStrictEqual(createdConnectorWithRemovedTransformer.transformers, []);
    const transformerDeleteCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'north_transformer' && call.arguments[1] === transformerId && call.arguments[2] === 'DELETE'
    );
    assert.strictEqual(transformerDeleteCalls.length, 1);
    assert.strictEqual(transformerDeleteCalls[0].arguments[5], 'removeUser');
  });

  it('should preserve caller-supplied ids for the connector and its transformer link (config import)', () => {
    const northConnector: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[0]));
    northConnector.id = 'preserved-north-id';
    northConnector.name = 'preserved north connector';
    northConnector.transformers = [
      {
        id: 'preserved-north-transformer-id',
        transformer: testData.transformers.list[0] as Transformer,
        options: {},
        source: { type: 'oianalytics-setpoint' }
      }
    ];

    repository.saveNorth(northConnector);

    assert.strictEqual(northConnector.id, 'preserved-north-id');
    const created = repository.findNorthById('preserved-north-id');
    assert.ok(created);
    assert.strictEqual(created.transformers.length, 1);
    assert.strictEqual(created.transformers[0].id, 'preserved-north-transformer-id');
  });

  it('should save a north connector transformer with a group', () => {
    const groupRepository = new SouthItemGroupRepository(database, createAuditServiceMock());

    const group = groupRepository.create(
      {
        name: 'Transformer Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        maxReadInterval: null,
        readDelay: 0
      },
      'userTest'
    );

    const newNorthConnector: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[0]));
    newNorthConnector.id = '';
    newNorthConnector.name = 'north with group transformer';
    newNorthConnector.transformers = [];
    repository.saveNorth(newNorthConnector);

    assert.ok(newNorthConnector.id);

    repository.addOrEditTransformer(
      newNorthConnector.id,
      {
        id: '',
        transformer: testData.transformers.list[0] as Transformer,
        options: {},
        source: {
          type: 'south',
          south: {
            id: testData.south.list[0].id,
            name: testData.south.list[0].name,
            type: testData.south.list[0].type,
            description: testData.south.list[0].description,
            enabled: testData.south.list[0].enabled,
            createdBy: '',
            updatedBy: '',
            createdAt: '',
            updatedAt: ''
          },
          group: {
            id: group.id,
            name: group.name,
            southId: testData.south.list[0].id,
            scanMode: testData.scanMode.list[0],
            startTimeOffset: 0,
            endTimeOffset: null,
            maxReadInterval: 3600,
            readDelay: 200,
            items: [],
            createdBy: '',
            updatedBy: '',
            createdAt: '',
            updatedAt: ''
          },
          items: []
        }
      },
      'userTest'
    );

    const connector = repository.findNorthById(newNorthConnector.id)!;
    assert.strictEqual(connector.transformers.length, 1);
    assert.strictEqual((connector.transformers[0].source as SourceOriginSouth).group?.id, group.id);
    assert.strictEqual((connector.transformers[0].source as SourceOriginSouth).group?.name, group.name);
    assert.deepStrictEqual((connector.transformers[0].source as SourceOriginSouth).items, []);
  });

  it('should remove all transformers for a north connector by transformer id', () => {
    const newNorthConnectorWithoutTransformer2: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[0]));
    newNorthConnectorWithoutTransformer2.id = '';
    newNorthConnectorWithoutTransformer2.name = 'new connector without transformer 2';
    newNorthConnectorWithoutTransformer2.transformers = [];
    repository.saveNorth(newNorthConnectorWithoutTransformer2);

    assert.ok(newNorthConnectorWithoutTransformer2.id);

    repository.addOrEditTransformer(
      newNorthConnectorWithoutTransformer2.id,
      {
        id: '',
        transformer: testData.transformers.list[0] as Transformer,
        options: {},
        source: { type: 'oianalytics-setpoint' }
      },
      'userTest'
    );
    const connectorWithTransformer = repository.findNorthById(newNorthConnectorWithoutTransformer2.id)!;
    assert.strictEqual(connectorWithTransformer.transformers.length, 1);
    const transformerId = connectorWithTransformer.transformers[0].id;

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    recordMock.mock.resetCalls();
    repository.removeTransformersByTransformerId(testData.transformers.list[0].id, 'bulkRemoveUser');
    const connectorWithRemovedTransformers = repository.findNorthById(newNorthConnectorWithoutTransformer2.id)!;
    assert.deepStrictEqual(connectorWithRemovedTransformers.transformers, []);
    const transformerDeleteCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'north_transformer' && call.arguments[1] === transformerId && call.arguments[2] === 'DELETE'
    );
    assert.strictEqual(transformerDeleteCalls.length, 1);
    assert.strictEqual(transformerDeleteCalls[0].arguments[5], 'bulkRemoveUser');
  });

  it('should update a north connector', () => {
    const newNorthConnector: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[1]));
    newNorthConnector.caching.throttling.maxSize = 999;
    const beforeConnector = repository.findNorthById(newNorthConnector.id);
    repository.saveNorth(newNorthConnector);

    const updatedConnector = repository.findNorthById(newNorthConnector.id)!;
    assert.strictEqual(updatedConnector.caching.throttling.maxSize, 999);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    const connectorUpdateCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'north_connector' && call.arguments[1] === newNorthConnector.id && call.arguments[2] === 'UPDATE'
    );
    assert.strictEqual(connectorUpdateCalls.length, 1);
    assert.deepStrictEqual(connectorUpdateCalls[0].arguments, [
      'north_connector',
      newNorthConnector.id,
      'UPDATE',
      beforeConnector,
      updatedConnector,
      newNorthConnector.updatedBy
    ]);
  });

  it('should delete a north connector', () => {
    const newNorthConnector: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[0]));
    newNorthConnector.id = '';
    newNorthConnector.name = 'to be deleted north';
    newNorthConnector.transformers = [];
    repository.saveNorth(newNorthConnector);

    repository.addOrEditTransformer(
      newNorthConnector.id,
      {
        id: '',
        transformer: testData.transformers.list[0] as Transformer,
        options: {},
        source: { type: 'oianalytics-setpoint' }
      },
      'attachUser'
    );

    const beforeConnector = repository.findNorthById(newNorthConnector.id)!;
    assert.ok(beforeConnector);
    const transformerIds = beforeConnector.transformers.map(t => t.id);
    assert.ok(transformerIds.length > 0);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    recordMock.mock.resetCalls();
    repository.deleteNorth(newNorthConnector.id, 'deleteUser');
    assert.strictEqual(repository.findNorthById(newNorthConnector.id), null);

    const transformerDeleteCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'north_transformer' && call.arguments[2] === 'DELETE'
    );
    assert.strictEqual(transformerDeleteCalls.length, transformerIds.length);
    for (const call of transformerDeleteCalls) {
      assert.strictEqual(call.arguments[5], 'deleteUser');
    }

    const connectorDeleteCall = recordMock.mock.calls.find(
      call => call.arguments[0] === 'north_connector' && call.arguments[1] === newNorthConnector.id && call.arguments[2] === 'DELETE'
    );
    assert.deepStrictEqual(connectorDeleteCall!.arguments, [
      'north_connector',
      newNorthConnector.id,
      'DELETE',
      { ...beforeConnector, settings: { ...beforeConnector.settings, password: '' } },
      null,
      'deleteUser'
    ]);
    // The connector's secret settings field must never be persisted in the audit trail
    assert.strictEqual((connectorDeleteCall!.arguments[3] as { settings: { password: string } }).settings.password, '');
  });

  it('should save a north connector with a "temp_" transformer id (treated as new)', () => {
    const newNorthConnector: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[0]));
    newNorthConnector.id = '';
    newNorthConnector.name = 'north with temp transformer id';
    newNorthConnector.transformers = [
      {
        id: 'temp_1',
        transformer: testData.transformers.list[0] as Transformer,
        options: {},
        source: { type: 'oianalytics-setpoint' }
      }
    ];
    repository.saveNorth(newNorthConnector);

    assert.ok(newNorthConnector.id);
    const created = repository.findNorthById(newNorthConnector.id)!;
    assert.strictEqual(created.transformers.length, 1);
    assert.notStrictEqual(created.transformers[0].id, 'temp_1');
  });

  it('should add/edit a south transformer without a group (items only) on insert and update', () => {
    const newNorthConnector: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[0]));
    newNorthConnector.id = '';
    newNorthConnector.name = 'north with south items transformer';
    newNorthConnector.transformers = [];
    repository.saveNorth(newNorthConnector);

    repository.addOrEditTransformer(
      newNorthConnector.id,
      {
        id: '',
        transformer: testData.transformers.list[0] as Transformer,
        options: {},
        source: {
          type: 'south',
          south: {
            id: testData.south.list[0].id,
            name: testData.south.list[0].name,
            type: testData.south.list[0].type,
            description: testData.south.list[0].description,
            enabled: testData.south.list[0].enabled,
            createdBy: '',
            updatedBy: '',
            createdAt: '',
            updatedAt: ''
          },
          items: [
            { id: testData.south.list[0].items[0].id, name: '', enabled: true, createdBy: '', updatedBy: '', createdAt: '', updatedAt: '' }
          ]
        }
      },
      'userTest'
    );

    let connector = repository.findNorthById(newNorthConnector.id)!;
    assert.strictEqual(connector.transformers.length, 1);
    assert.strictEqual((connector.transformers[0].source as SourceOriginSouth).group, undefined);
    const transformerId = connector.transformers[0].id;

    // Update the same transformer, still without a group, to hit the update-path false branch too
    repository.addOrEditTransformer(
      newNorthConnector.id,
      {
        id: transformerId,
        transformer: testData.transformers.list[0] as Transformer,
        options: { updated: true },
        source: {
          type: 'south',
          south: {
            id: testData.south.list[0].id,
            name: testData.south.list[0].name,
            type: testData.south.list[0].type,
            description: testData.south.list[0].description,
            enabled: testData.south.list[0].enabled,
            createdBy: '',
            updatedBy: '',
            createdAt: '',
            updatedAt: ''
          },
          items: []
        }
      },
      'userTest'
    );
    connector = repository.findNorthById(newNorthConnector.id)!;
    assert.strictEqual(connector.transformers.length, 1);
    assert.deepStrictEqual(connector.transformers[0].options, { updated: true });
  });

  it('should update a south transformer to have a group', () => {
    const groupRepository = new SouthItemGroupRepository(database, createAuditServiceMock());
    const group = groupRepository.create(
      {
        name: 'Update Transformer Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        maxReadInterval: null,
        readDelay: 0
      },
      'userTest'
    );

    const newNorthConnector: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[0]));
    newNorthConnector.id = '';
    newNorthConnector.name = 'north with updated group transformer';
    newNorthConnector.transformers = [];
    repository.saveNorth(newNorthConnector);

    repository.addOrEditTransformer(
      newNorthConnector.id,
      {
        id: '',
        transformer: testData.transformers.list[0] as Transformer,
        options: {},
        source: {
          type: 'south',
          south: {
            id: testData.south.list[0].id,
            name: testData.south.list[0].name,
            type: testData.south.list[0].type,
            description: testData.south.list[0].description,
            enabled: testData.south.list[0].enabled,
            createdBy: '',
            updatedBy: '',
            createdAt: '',
            updatedAt: ''
          },
          items: []
        }
      },
      'userTest'
    );
    const connector = repository.findNorthById(newNorthConnector.id)!;
    const transformerId = connector.transformers[0].id;

    repository.addOrEditTransformer(
      newNorthConnector.id,
      {
        id: transformerId,
        transformer: testData.transformers.list[0] as Transformer,
        options: {},
        source: {
          type: 'south',
          south: {
            id: testData.south.list[0].id,
            name: testData.south.list[0].name,
            type: testData.south.list[0].type,
            description: testData.south.list[0].description,
            enabled: testData.south.list[0].enabled,
            createdBy: '',
            updatedBy: '',
            createdAt: '',
            updatedAt: ''
          },
          group: {
            id: group.id,
            name: group.name,
            southId: testData.south.list[0].id,
            scanMode: testData.scanMode.list[0],
            startTimeOffset: 0,
            endTimeOffset: null,
            maxReadInterval: 3600,
            readDelay: 200,
            items: [],
            createdBy: '',
            updatedBy: '',
            createdAt: '',
            updatedAt: ''
          },
          items: []
        }
      },
      'userTest'
    );
    const updatedConnector = repository.findNorthById(newNorthConnector.id)!;
    assert.strictEqual((updatedConnector.transformers[0].source as SourceOriginSouth).group?.id, group.id);
  });

  it('should stop north connector', () => {
    repository.stopNorth(testData.north.list[0].id);
    assert.strictEqual(repository.findNorthById(testData.north.list[0].id)!.enabled, false);
  });

  it('should start north connector', () => {
    repository.startNorth(testData.north.list[0].id);
    assert.strictEqual(repository.findNorthById(testData.north.list[0].id)!.enabled, true);
  });
});
