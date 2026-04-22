import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import NorthConnectorRepository from './north-connector.repository';
import SouthItemGroupRepository from './south-item-group.repository';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { SourceOriginSouth, Transformer } from '../../model/transformer.model';
import TransformerRepository from './transformer.repository';

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

  beforeEach(() => {
    new TransformerRepository(database); // ensure standard transformers are seeded
    repository = new NorthConnectorRepository(database);
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
    repository.saveNorth(newNorthConnector);

    assert.ok(newNorthConnector.id);
    const createdConnector = repository.findNorthById(newNorthConnector.id)!;
    assert.strictEqual(createdConnector.id, newNorthConnector.id);
    assert.strictEqual(createdConnector.name, 'new connector');

    const newNorthConnectorWithoutTransformer: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[0]));
    newNorthConnectorWithoutTransformer.id = '';
    newNorthConnectorWithoutTransformer.name = 'new connector without transformer';
    newNorthConnectorWithoutTransformer.transformers = [];
    repository.saveNorth(newNorthConnectorWithoutTransformer);

    assert.ok(newNorthConnectorWithoutTransformer.id);
    const createdConnectorWithoutTransformer = repository.findNorthById(newNorthConnectorWithoutTransformer.id)!;
    assert.deepStrictEqual(createdConnectorWithoutTransformer.transformers, []);

    repository.addOrEditTransformer(newNorthConnectorWithoutTransformer.id, {
      id: '',
      transformer: testData.transformers.list[0] as Transformer,
      options: {},
      source: { type: 'oianalytics-setpoint' }
    });
    const createdConnectorWithTransformer = repository.findNorthById(newNorthConnectorWithoutTransformer.id)!;
    assert.strictEqual(createdConnectorWithTransformer.transformers.length, 1);
    assert.strictEqual(createdConnectorWithTransformer.transformers[0].transformer.id, testData.transformers.list[0].id);

    const transformerId = createdConnectorWithTransformer.transformers[0].id;
    repository.removeTransformer(transformerId);
    const createdConnectorWithRemovedTransformer = repository.findNorthById(newNorthConnectorWithoutTransformer.id)!;
    assert.deepStrictEqual(createdConnectorWithRemovedTransformer.transformers, []);
  });

  it('should save a north connector transformer with a group', () => {
    const groupRepository = new SouthItemGroupRepository(database);

    const group = groupRepository.create(
      {
        name: 'Transformer Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
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

    repository.addOrEditTransformer(newNorthConnector.id, {
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
          overlap: 0,
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
    });

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

    repository.addOrEditTransformer(newNorthConnectorWithoutTransformer2.id, {
      id: '',
      transformer: testData.transformers.list[0] as Transformer,
      options: {},
      source: { type: 'oianalytics-setpoint' }
    });
    const connectorWithTransformer = repository.findNorthById(newNorthConnectorWithoutTransformer2.id)!;
    assert.strictEqual(connectorWithTransformer.transformers.length, 1);

    repository.removeTransformersByTransformerId(testData.transformers.list[0].id);
    const connectorWithRemovedTransformers = repository.findNorthById(newNorthConnectorWithoutTransformer2.id)!;
    assert.deepStrictEqual(connectorWithRemovedTransformers.transformers, []);
  });

  it('should update a north connector', () => {
    const newNorthConnector: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[1]));
    newNorthConnector.caching.throttling.maxSize = 999;
    repository.saveNorth(newNorthConnector);

    const updatedConnector = repository.findNorthById(newNorthConnector.id)!;
    assert.strictEqual(updatedConnector.caching.throttling.maxSize, 999);
  });

  it('should delete a north connector', () => {
    const newNorthConnector: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[0]));
    newNorthConnector.id = '';
    newNorthConnector.name = 'to be deleted north';
    newNorthConnector.transformers = [];
    repository.saveNorth(newNorthConnector);

    assert.ok(repository.findNorthById(newNorthConnector.id));
    repository.deleteNorth(newNorthConnector.id);
    assert.strictEqual(repository.findNorthById(newNorthConnector.id), null);
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
