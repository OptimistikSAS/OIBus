import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { Database } from 'better-sqlite3';

import { NorthSettings } from '../../../shared/model/connector/north-settings.model';

import { NorthConnectorEntity } from '../../model/north-connector.model';
import { SouthItemGroupEntity } from '../../model/south-connector.model';
import { NorthTransformerWithOptions, SourceOriginAPI, SourceOriginSouth, TransformerSource } from '../../model/transformer.model';
import { NotFoundError } from '../../model/types';
import AuditService from '../../service/audit.service';
import { emptyDatabase, initDatabase } from '../../tests/utils/database-utils';
import testData from '../../tests/utils/test-data';
import { createAuditServiceMock, Mocked, stripAuditFields } from '../../tests/utils/test-utils';
import NorthConnectorRepository from './north-connector.repository';
import SouthItemGroupRepository from './south-item-group.repository';
import TransformerRepository from './transformer.repository';

const TEST_DB_PATH = 'src/tests/test-config-north.db';

type North = NorthConnectorEntity<NorthSettings>;
type AuditCall = Parameters<AuditService['record']>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// A real "new" connector (as the UI always sends) never reuses the transformer links of the fixture it
// is cloned from, which belong to the other, still-existing north connector: start them empty.
const newNorth = (name: string, overrides: Partial<North> = {}): North => ({
  ...clone(testData.north.list[0]),
  id: '',
  name,
  transformers: [],
  ...overrides
});

const transformerLink = (
  source: TransformerSource = { type: 'oianalytics-setpoint' },
  overrides: Partial<NorthTransformerWithOptions> = {}
): NorthTransformerWithOptions => ({
  id: '',
  transformer: testData.transformers.list[0],
  options: {},
  source,
  ...overrides
});

/** A transformer source on the items (or the group) of the first south connector. */
const southSource = (group?: SouthItemGroupEntity, items: SourceOriginSouth['items'] = []): SourceOriginSouth => ({
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
  ...(group && {
    group: {
      id: group.id,
      name: group.name,
      southId: testData.south.list[0].id,
      scanMode: testData.scanMode.list[0],
      startTimeOffset: 0,
      endTimeOffset: null,
      maxReadInterval: 3600,
      readDelay: 200,
      recoveryStrategy: null,
      cachingStrategy: null,
      items: [],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    }
  }),
  items
});

/** Matches the audit records on `entityType`, with `action` and on `entityId` when given. */
const isAudit =
  (entityType: string, action?: string, entityId?: string) =>
  ([type, id, act]: AuditCall): boolean =>
    type === entityType && (action === undefined || act === action) && (entityId === undefined || id === entityId);

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
  let auditService: Mocked<AuditService>;

  beforeEach(() => {
    new TransformerRepository(database, createAuditServiceMock()); // ensure standard transformers are seeded
    auditService = createAuditServiceMock();
    repository = new NorthConnectorRepository(database, auditService);
  });

  /** The arguments of every audit record made in the test so far. */
  const recorded = (): Array<AuditCall> => auditService.record.mock.calls.map(call => call.arguments);

  /** The arguments of the audit records made while running `action`. */
  const auditsDuring = (action: () => void): Array<AuditCall> => {
    const start = recorded().length;
    action();
    return recorded().slice(start);
  };

  /** Creates a group of the first south connector. */
  const createGroup = (name: string) =>
    new SouthItemGroupRepository(database, createAuditServiceMock()).create(
      {
        name,
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        maxReadInterval: null,
        readDelay: 0,
        recoveryStrategy: null,
        cachingStrategy: null
      },
      'userTest'
    );

  /** Saves a new north connector, with a transformer link when `link` is given. */
  const saveNewNorth = (name: string, link?: NorthTransformerWithOptions, userId = 'userTest'): North => {
    const north = newNorth(name);
    repository.saveNorth(north, true);
    if (link) repository.addOrEditTransformer(north.id, link, userId);
    return north;
  };

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

  it('should reject an update whose target id does not exist, instead of silently creating it', () => {
    const ghost: North = { ...clone(testData.north.list[0]), id: 'north-id-that-does-not-exist' };

    assert.throws(() => repository.saveNorth(ghost, false), NotFoundError);
    assert.strictEqual(repository.findNorthById('north-id-that-does-not-exist'), null);
  });

  it('should save a new north connector', () => {
    const newNorthConnector = newNorth('new connector');
    repository.saveNorth(newNorthConnector, true);

    assert.ok(newNorthConnector.id);
    const createdConnector = repository.findNorthById(newNorthConnector.id)!;
    assert.strictEqual(createdConnector.id, newNorthConnector.id);
    assert.strictEqual(createdConnector.name, 'new connector');

    const connectorCreateCalls = recorded().filter(isAudit('north_connector', 'CREATE', newNorthConnector.id));
    assert.strictEqual(connectorCreateCalls.length, 1);
    assert.deepStrictEqual(connectorCreateCalls[0], [
      'north_connector',
      newNorthConnector.id,
      'CREATE',
      null,
      { ...createdConnector, settings: { ...createdConnector.settings, password: '' } },
      newNorthConnector.updatedBy
    ]);
    // The connector's secret settings field must never be persisted in the audit trail
    assert.strictEqual((connectorCreateCalls[0][4] as { settings: { password: string } }).settings.password, '');

    const newNorthConnectorWithoutTransformer = newNorth('new connector without transformer');
    repository.saveNorth(newNorthConnectorWithoutTransformer, true);

    assert.ok(newNorthConnectorWithoutTransformer.id);
    const createdConnectorWithoutTransformer = repository.findNorthById(newNorthConnectorWithoutTransformer.id)!;
    assert.deepStrictEqual(createdConnectorWithoutTransformer.transformers, []);

    const addCalls = auditsDuring(() =>
      repository.addOrEditTransformer(newNorthConnectorWithoutTransformer.id, transformerLink(), 'transformerUser')
    );
    const createdConnectorWithTransformer = repository.findNorthById(newNorthConnectorWithoutTransformer.id)!;
    assert.strictEqual(createdConnectorWithTransformer.transformers.length, 1);
    assert.strictEqual(createdConnectorWithTransformer.transformers[0].transformer.id, testData.transformers.list[0].id);

    const transformerId = createdConnectorWithTransformer.transformers[0].id;
    assert.deepStrictEqual(addCalls.filter(isAudit('north_transformer', 'CREATE', transformerId)), [
      ['north_transformer', transformerId, 'CREATE', null, createdConnectorWithTransformer.transformers[0], 'transformerUser']
    ]);

    // Re-saving an unchanged transformer (as done when saving the north connector) records nothing
    assert.deepStrictEqual(
      auditsDuring(() =>
        repository.addOrEditTransformer(
          newNorthConnectorWithoutTransformer.id,
          createdConnectorWithTransformer.transformers[0],
          'transformerUser'
        )
      ),
      []
    );

    // A changed transformer is recorded as an update
    const editCalls = auditsDuring(() =>
      repository.addOrEditTransformer(
        newNorthConnectorWithoutTransformer.id,
        { ...createdConnectorWithTransformer.transformers[0], options: { field: 'value' } },
        'transformerUser'
      )
    );
    const updatedTransformer = repository.findNorthById(newNorthConnectorWithoutTransformer.id)!.transformers[0];
    assert.deepStrictEqual(editCalls, [
      ['north_transformer', transformerId, 'UPDATE', createdConnectorWithTransformer.transformers[0], updatedTransformer, 'transformerUser']
    ]);

    const removeCalls = auditsDuring(() => repository.removeTransformer(transformerId, 'removeUser'));
    const createdConnectorWithRemovedTransformer = repository.findNorthById(newNorthConnectorWithoutTransformer.id)!;
    assert.deepStrictEqual(createdConnectorWithRemovedTransformer.transformers, []);
    const transformerDeleteCalls = removeCalls.filter(isAudit('north_transformer', 'DELETE', transformerId));
    assert.strictEqual(transformerDeleteCalls.length, 1);
    assert.strictEqual(transformerDeleteCalls[0][5], 'removeUser');
  });

  it('should preserve caller-supplied ids for the connector and its transformer link (config import)', () => {
    const northConnector = newNorth('preserved north connector', {
      id: 'preserved-north-id',
      transformers: [transformerLink(undefined, { id: 'preserved-north-transformer-id' })]
    });

    repository.saveNorth(northConnector, true);

    assert.strictEqual(northConnector.id, 'preserved-north-id');
    const created = repository.findNorthById('preserved-north-id');
    assert.ok(created);
    assert.strictEqual(created.transformers.length, 1);
    assert.strictEqual(created.transformers[0].id, 'preserved-north-transformer-id');
  });

  it('should save a north connector transformer with a group', () => {
    const group = createGroup('Transformer Group');

    const newNorthConnector = saveNewNorth('north with group transformer');
    assert.ok(newNorthConnector.id);

    repository.addOrEditTransformer(newNorthConnector.id, transformerLink(southSource(group)), 'userTest');

    const connector = repository.findNorthById(newNorthConnector.id)!;
    assert.strictEqual(connector.transformers.length, 1);
    const source = connector.transformers[0].source as SourceOriginSouth;
    assert.strictEqual(source.group?.id, group.id);
    assert.strictEqual(source.group?.name, group.name);
    assert.deepStrictEqual(source.items, []);
  });

  it('should remove all transformers for a north connector by transformer id', () => {
    const newNorthConnectorWithoutTransformer2 = saveNewNorth('new connector without transformer 2');
    assert.ok(newNorthConnectorWithoutTransformer2.id);

    repository.addOrEditTransformer(newNorthConnectorWithoutTransformer2.id, transformerLink(), 'userTest');
    const connectorWithTransformer = repository.findNorthById(newNorthConnectorWithoutTransformer2.id)!;
    assert.strictEqual(connectorWithTransformer.transformers.length, 1);
    const transformerId = connectorWithTransformer.transformers[0].id;

    const calls = auditsDuring(() => repository.removeTransformersByTransformerId(testData.transformers.list[0].id, 'bulkRemoveUser'));
    const connectorWithRemovedTransformers = repository.findNorthById(newNorthConnectorWithoutTransformer2.id)!;
    assert.deepStrictEqual(connectorWithRemovedTransformers.transformers, []);
    const transformerDeleteCalls = calls.filter(isAudit('north_transformer', 'DELETE', transformerId));
    assert.strictEqual(transformerDeleteCalls.length, 1);
    assert.strictEqual(transformerDeleteCalls[0][5], 'bulkRemoveUser');
  });

  it('should update a north connector', () => {
    const newNorthConnector: North = clone(testData.north.list[1]);
    newNorthConnector.caching.throttling.maxSize = 999;
    const beforeConnector = repository.findNorthById(newNorthConnector.id);
    repository.saveNorth(newNorthConnector, false);

    const updatedConnector = repository.findNorthById(newNorthConnector.id)!;
    assert.strictEqual(updatedConnector.caching.throttling.maxSize, 999);

    assert.deepStrictEqual(recorded().filter(isAudit('north_connector', 'UPDATE', newNorthConnector.id)), [
      ['north_connector', newNorthConnector.id, 'UPDATE', beforeConnector, updatedConnector, newNorthConnector.updatedBy]
    ]);
  });

  it('should record a DELETE audit entry for each transformer removed by an update', () => {
    const newNorthConnector = saveNewNorth('north losing a transformer on update', transformerLink());
    const withTransformer = repository.findNorthById(newNorthConnector.id)!;
    assert.strictEqual(withTransformer.transformers.length, 1);
    const removedTransformerId = withTransformer.transformers[0].id;

    const calls = auditsDuring(() => repository.saveNorth({ ...clone(withTransformer), transformers: [] }, false));

    const afterUpdate = repository.findNorthById(newNorthConnector.id)!;
    assert.deepStrictEqual(afterUpdate.transformers, []);

    assert.ok(
      calls.find(isAudit('north_transformer', 'DELETE', removedTransformerId)),
      'expected a DELETE audit entry for the transformer dropped by the update'
    );
  });

  it('should redact an unknown north connector type by returning it as-is (no manifest match)', () => {
    const newNorthConnector = newNorth('north with unknown type', { type: 'not-a-real-north-type' as North['type'] });
    repository.saveNorth(newNorthConnector, true);

    const calls = auditsDuring(() => repository.deleteNorth(newNorthConnector.id, 'deleteUser'));

    const deleteCall = calls.find(isAudit('north_connector', 'DELETE', newNorthConnector.id));
    assert.ok(deleteCall);
    // With no manifest for this type, redactConnector must return the entity untouched rather than filtering secrets.
    assert.strictEqual((deleteCall[3] as { type: string }).type, 'not-a-real-north-type');
  });

  it('should insert and update a transformer sourced from oibus-api', () => {
    const newNorthConnector = saveNewNorth('north with oibus-api transformer', transformerLink({ type: 'oibus-api', dataSourceId: 'ds1' }));
    let connector = repository.findNorthById(newNorthConnector.id)!;
    assert.strictEqual(connector.transformers.length, 1);
    assert.strictEqual((connector.transformers[0].source as SourceOriginAPI).dataSourceId, 'ds1');
    const transformerId = connector.transformers[0].id;

    repository.addOrEditTransformer(
      newNorthConnector.id,
      transformerLink({ type: 'oibus-api', dataSourceId: 'ds2' }, { id: transformerId }),
      'userTest'
    );
    connector = repository.findNorthById(newNorthConnector.id)!;
    assert.strictEqual((connector.transformers[0].source as SourceOriginAPI).dataSourceId, 'ds2');
  });

  it('should return null when removing a transformer whose id does not exist', () => {
    assert.doesNotThrow(() => repository.removeTransformer('non-existent-transformer-id', 'removeUser'));
    assert.strictEqual(recorded().filter(isAudit('north_transformer', 'DELETE', 'non-existent-transformer-id')).length, 0);
  });

  it('should delete a north connector', () => {
    const newNorthConnector = saveNewNorth('to be deleted north', transformerLink(), 'attachUser');

    const beforeConnector = repository.findNorthById(newNorthConnector.id)!;
    assert.ok(beforeConnector);
    const transformerIds = beforeConnector.transformers.map(t => t.id);
    assert.ok(transformerIds.length > 0);

    const calls = auditsDuring(() => repository.deleteNorth(newNorthConnector.id, 'deleteUser'));
    assert.strictEqual(repository.findNorthById(newNorthConnector.id), null);

    const transformerDeleteCalls = calls.filter(isAudit('north_transformer', 'DELETE'));
    assert.strictEqual(transformerDeleteCalls.length, transformerIds.length);
    for (const call of transformerDeleteCalls) {
      assert.strictEqual(call[5], 'deleteUser');
    }

    const connectorDeleteCall = calls.find(isAudit('north_connector', 'DELETE', newNorthConnector.id));
    assert.deepStrictEqual(connectorDeleteCall, [
      'north_connector',
      newNorthConnector.id,
      'DELETE',
      { ...beforeConnector, settings: { ...beforeConnector.settings, password: '' } },
      null,
      'deleteUser'
    ]);
    // The connector's secret settings field must never be persisted in the audit trail
    assert.strictEqual((connectorDeleteCall[3] as { settings: { password: string } }).settings.password, '');
  });

  it('should save a north connector with a "temp_" transformer id (treated as new)', () => {
    const newNorthConnector = newNorth('north with temp transformer id', { transformers: [transformerLink(undefined, { id: 'temp_1' })] });
    repository.saveNorth(newNorthConnector, true);

    assert.ok(newNorthConnector.id);
    const created = repository.findNorthById(newNorthConnector.id)!;
    assert.strictEqual(created.transformers.length, 1);
    assert.notStrictEqual(created.transformers[0].id, 'temp_1');
  });

  it('should add/edit a south transformer without a group (items only) on insert and update', () => {
    const items = [
      { id: testData.south.list[0].items[0].id, name: '', enabled: true, createdBy: '', updatedBy: '', createdAt: '', updatedAt: '' }
    ];
    const newNorthConnector = saveNewNorth('north with south items transformer', transformerLink(southSource(undefined, items)));

    let connector = repository.findNorthById(newNorthConnector.id)!;
    assert.strictEqual(connector.transformers.length, 1);
    assert.strictEqual((connector.transformers[0].source as SourceOriginSouth).group, undefined);
    const transformerId = connector.transformers[0].id;

    // Update the same transformer, still without a group, to hit the update-path false branch too
    repository.addOrEditTransformer(
      newNorthConnector.id,
      transformerLink(southSource(), { id: transformerId, options: { updated: true } }),
      'userTest'
    );
    connector = repository.findNorthById(newNorthConnector.id)!;
    assert.strictEqual(connector.transformers.length, 1);
    assert.deepStrictEqual(connector.transformers[0].options, { updated: true });
  });

  it('should update a south transformer to have a group', () => {
    const group = createGroup('Update Transformer Group');

    const newNorthConnector = saveNewNorth('north with updated group transformer', transformerLink(southSource()));
    const transformerId = repository.findNorthById(newNorthConnector.id)!.transformers[0].id;

    repository.addOrEditTransformer(newNorthConnector.id, transformerLink(southSource(group), { id: transformerId }), 'userTest');
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
