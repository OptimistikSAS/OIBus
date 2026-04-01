import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import { generateRandomId } from '../../service/utils';
import NorthConnectorRepository from './north-connector.repository';
import SouthItemGroupRepository from './south-item-group.repository';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { Transformer } from '../../model/transformer.model';
import TransformerRepository from './transformer.repository';

jest.mock('../../service/utils');

const TEST_DB_PATH = 'src/tests/test-config-north.db';

const standardTransformerIds = [
  'csvToMqtt',
  'csvToTimeValues',
  'ignore',
  'iso',
  'jsonToCsv',
  'oibusTimeValuesToCsv',
  'oibusTimeValuesToJson',
  'oibusTimeValuesToModbus',
  'oibusTimeValuesToMqtt',
  'oibusTimeValuesToOia',
  'oibusTimeValuesToOpcua',
  'oibusSetpointToModbus',
  'oibusSetpointToMqtt',
  'oibusSetpointToOpcua'
];

let database: Database;
describe('NorthConnectorRepository', () => {
  beforeAll(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: NorthConnectorRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    // TransformerRepository initialises standard transformers on construction; provide IDs
    for (const id of standardTransformerIds) {
      (generateRandomId as jest.Mock).mockReturnValueOnce(id);
    }
    new TransformerRepository(database); // ensure standard transformers are seeded
    jest.resetAllMocks();
    repository = new NorthConnectorRepository(database);
  });

  it('should properly get north connectors', () => {
    expect(repository.findAllNorth()).toEqual(
      testData.north.list.map(element =>
        expect.objectContaining({
          id: element.id,
          name: element.name,
          type: element.type,
          description: element.description,
          enabled: element.enabled
        })
      )
    );
  });

  it('should properly get full north connectors', () => {
    expect(repository.findAllNorthFull().map(stripAuditFields)).toEqual(
      testData.north.list.map(stripAuditFields).map(n => expect.objectContaining(n))
    );
  });

  it('should properly get a north connector', () => {
    const result = repository.findNorthById(testData.north.list[0].id);
    expect(stripAuditFields(result)).toEqual(expect.objectContaining(stripAuditFields(testData.north.list[0])));
    expect(repository.findNorthById('badId')).toEqual(null);
  });

  it('should save a new north connector', () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('newId').mockReturnValueOnce('newIdWithoutTransformer');

    const newNorthConnector: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[0]));
    newNorthConnector.id = '';
    newNorthConnector.name = 'new connector';
    repository.saveNorth(newNorthConnector);

    expect(newNorthConnector.id).toEqual('newId');
    const createdConnector = repository.findNorthById('newId')!;
    expect(createdConnector.id).toEqual('newId');
    expect(createdConnector.name).toEqual('new connector');

    const newNorthConnectorWithoutTransformer: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[0]));
    newNorthConnectorWithoutTransformer.id = '';
    newNorthConnectorWithoutTransformer.name = 'new connector without transformer';
    newNorthConnectorWithoutTransformer.transformers = [];
    repository.saveNorth(newNorthConnectorWithoutTransformer);

    expect(newNorthConnectorWithoutTransformer.id).toEqual('newIdWithoutTransformer');
    const createdConnectorWithoutTransformer = repository.findNorthById('newIdWithoutTransformer')!;
    expect(createdConnectorWithoutTransformer.transformers).toEqual([]);

    (generateRandomId as jest.Mock).mockReturnValueOnce('newId');
    repository.addOrEditTransformer(newNorthConnectorWithoutTransformer.id, {
      id: '',
      inputType: 'input',
      transformer: testData.transformers.list[0] as Transformer,
      options: {},
      south: undefined,
      group: undefined,
      items: []
    });
    const createdConnectorWithTransformer = repository.findNorthById('newIdWithoutTransformer')!;
    expect(createdConnectorWithTransformer.transformers.length).toEqual(1);
    expect(createdConnectorWithTransformer.transformers[0].transformer.id).toEqual(testData.transformers.list[0].id);

    repository.removeTransformer('newId');
    const createdConnectorWithRemovedTransformer = repository.findNorthById('newIdWithoutTransformer')!;
    expect(createdConnectorWithRemovedTransformer.transformers).toEqual([]);
  });

  it('should save a north connector transformer with a group', () => {
    const groupRepository = new SouthItemGroupRepository(database);
    (generateRandomId as jest.Mock)
      .mockReturnValueOnce('groupForTransformerId')
      .mockReturnValueOnce('northWithGroupId')
      .mockReturnValueOnce('transformerWithGroupId');

    const group = groupRepository.create({
      name: 'Transformer Group',
      southId: testData.south.list[0].id,
      scanMode: testData.scanMode.list[0],
      overlap: null,
      maxReadInterval: null,
      readDelay: 0,
      createdBy: '',
      updatedBy: ''
    });

    const newNorthConnector: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[0]));
    newNorthConnector.id = '';
    newNorthConnector.name = 'north with group transformer';
    newNorthConnector.transformers = [];
    repository.saveNorth(newNorthConnector);

    repository.addOrEditTransformer(newNorthConnector.id, {
      id: '',
      inputType: 'input',
      transformer: testData.transformers.list[0] as Transformer,
      options: {},
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
      group: { id: group.id, name: group.name, createdBy: '', updatedBy: '', createdAt: '', updatedAt: '' },
      items: []
    });

    const connector = repository.findNorthById(newNorthConnector.id)!;
    expect(connector.transformers.length).toEqual(1);
    expect(connector.transformers[0].group).toEqual(expect.objectContaining({ id: group.id, name: group.name }));
    expect(connector.transformers[0].items).toEqual([]);
  });

  it('should remove all transformers for a north connector by transformer id', () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('newIdWithoutTransformer2');
    const newNorthConnectorWithoutTransformer2: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[0]));
    newNorthConnectorWithoutTransformer2.id = '';
    newNorthConnectorWithoutTransformer2.name = 'new connector without transformer 2';
    newNorthConnectorWithoutTransformer2.transformers = [];
    repository.saveNorth(newNorthConnectorWithoutTransformer2);

    expect(newNorthConnectorWithoutTransformer2.id).toEqual('newIdWithoutTransformer2');

    (generateRandomId as jest.Mock).mockReturnValueOnce('newId2');
    repository.addOrEditTransformer(newNorthConnectorWithoutTransformer2.id, {
      id: '',
      inputType: 'input',
      transformer: testData.transformers.list[0] as Transformer,
      options: {},
      south: undefined,
      group: undefined,
      items: []
    });
    const connectorWithTransformer = repository.findNorthById('newIdWithoutTransformer2')!;
    expect(connectorWithTransformer.transformers.length).toEqual(1);

    repository.removeTransformersByTransformerId(testData.transformers.list[0].id);
    const connectorWithRemovedTransformers = repository.findNorthById('newIdWithoutTransformer2')!;
    expect(connectorWithRemovedTransformers.transformers).toEqual([]);
  });

  it('should update a north connector', () => {
    const newNorthConnector: NorthConnectorEntity<NorthSettings> = JSON.parse(JSON.stringify(testData.north.list[1]));
    newNorthConnector.caching.throttling.maxSize = 999;
    repository.saveNorth(newNorthConnector);

    const updatedConnector = repository.findNorthById(newNorthConnector.id)!;
    expect(updatedConnector.caching.throttling.maxSize).toEqual(newNorthConnector.caching.throttling.maxSize);
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
});
