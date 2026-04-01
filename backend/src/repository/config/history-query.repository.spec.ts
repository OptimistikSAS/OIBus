import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import { generateRandomId } from '../../service/utils';
import HistoryQueryRepository from './history-query.repository';
import { HistoryQueryEntity, HistoryQueryItemEntity } from '../../model/histor-query.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { Transformer } from '../../model/transformer.model';

jest.mock('../../service/utils');

const TEST_DB_PATH = 'src/tests/test-config-history-query.db';

let database: Database;
describe('HistoryQueryRepository', () => {
  beforeAll(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: HistoryQueryRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    repository = new HistoryQueryRepository(database);
  });

  it('should properly get history queries (light)', () => {
    expect(repository.findAllHistoriesLight()).toEqual(
      testData.historyQueries.list.map(element =>
        expect.objectContaining({
          id: element.id,
          name: element.name,
          description: element.description,
          status: element.status,
          startTime: element.queryTimeRange.startTime,
          endTime: element.queryTimeRange.endTime,
          southType: element.southType,
          northType: element.northType
        })
      )
    );
  });

  it('should properly get history queries (full)', () => {
    expect(stripAuditFields(repository.findAllHistoriesFull())).toEqual(stripAuditFields(testData.historyQueries.list));
  });

  it('should properly get a history query', () => {
    expect(stripAuditFields(repository.findHistoryById(testData.historyQueries.list[0].id))).toEqual(
      stripAuditFields(testData.historyQueries.list[0])
    );
    expect(repository.findHistoryById('badId')).toEqual(null);
  });

  it('should save a new history query', () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('newId').mockReturnValueOnce('newIdWithoutTransformer');

    const newHistoryQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = JSON.parse(
      JSON.stringify(testData.historyQueries.list[0])
    );
    newHistoryQuery.id = '';
    newHistoryQuery.name = 'new history query';
    repository.saveHistory(newHistoryQuery);

    expect(newHistoryQuery.id).toEqual('newId');
    const createdHistoryQuery = repository.findHistoryById('newId')!;
    expect(createdHistoryQuery.id).toEqual('newId');
    expect(createdHistoryQuery.name).toEqual('new history query');
    expect(createdHistoryQuery.items.length).toEqual(0);

    const newHistoryWithoutTransformer: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = JSON.parse(
      JSON.stringify(testData.historyQueries.list[0])
    );
    newHistoryWithoutTransformer.id = '';
    newHistoryWithoutTransformer.name = 'new history query without transformer';
    newHistoryWithoutTransformer.northTransformers = [];
    newHistoryQuery.items = [];
    repository.saveHistory(newHistoryWithoutTransformer);

    expect(newHistoryWithoutTransformer.id).toEqual('newIdWithoutTransformer');
    const createdHistoryWithoutTransformer = repository.findHistoryById('newIdWithoutTransformer')!;
    expect(createdHistoryWithoutTransformer.northTransformers).toEqual([]);

    (generateRandomId as jest.Mock).mockReturnValueOnce('newId');
    repository.addOrEditTransformer(newHistoryWithoutTransformer.id, {
      id: '',
      transformer: testData.transformers.list[0] as Transformer,
      options: {},
      items: []
    });
    const createdHistoryWithTransformer = repository.findHistoryById('newIdWithoutTransformer')!;
    expect(createdHistoryWithTransformer.northTransformers.length).toEqual(1);
    expect(createdHistoryWithTransformer.northTransformers[0].transformer.id).toEqual(testData.transformers.list[0].id);

    repository.removeTransformer('newId');
    const createdHistoryWithRemovedTransformer = repository.findHistoryById('newIdWithoutTransformer')!;
    expect(createdHistoryWithRemovedTransformer.northTransformers).toEqual([]);
  });

  it('should remove all transformers for a history query by transformer id', () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('newHistoryIdWithoutTransformer2');
    const newHistoryWithoutTransformer2: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = JSON.parse(
      JSON.stringify(testData.historyQueries.list[1])
    );
    newHistoryWithoutTransformer2.id = '';
    newHistoryWithoutTransformer2.name = 'new history without transformer 2';
    newHistoryWithoutTransformer2.northTransformers = [];
    newHistoryWithoutTransformer2.items = [];
    repository.saveHistory(newHistoryWithoutTransformer2);

    expect(newHistoryWithoutTransformer2.id).toEqual('newHistoryIdWithoutTransformer2');

    (generateRandomId as jest.Mock).mockReturnValueOnce('newHistoryTransformerId2');
    repository.addOrEditTransformer(newHistoryWithoutTransformer2.id, {
      id: '',
      transformer: testData.transformers.list[0] as Transformer,
      options: {},
      items: []
    });
    const historyWithTransformer = repository.findHistoryById('newHistoryIdWithoutTransformer2')!;
    expect(historyWithTransformer.northTransformers.length).toEqual(1);

    repository.removeTransformersByTransformerId(testData.transformers.list[0].id);
    const historyWithRemovedTransformers = repository.findHistoryById('newHistoryIdWithoutTransformer2')!;
    expect(historyWithRemovedTransformers.northTransformers).toEqual([]);
  });

  it('should update a history query', () => {
    (generateRandomId as jest.Mock)
      .mockReturnValueOnce('newItemId')
      .mockReturnValueOnce('anotherItemId')
      .mockReturnValueOnce('newHistoryTransformerId');

    const newHistoryQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = JSON.parse(
      JSON.stringify(testData.historyQueries.list[1])
    );
    newHistoryQuery.items = [
      ...testData.historyQueries.list[1].items,
      {
        id: '',
        name: 'new item',
        enabled: true,
        settings: {} as SouthItemSettings,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: '',
        name: 'another item',
        enabled: true,
        settings: {} as SouthItemSettings,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ];
    newHistoryQuery.northTransformers = [
      {
        id: '',
        transformer: testData.transformers.list[0],
        options: {},
        items: [
          { id: '', name: 'new item', createdBy: '', updatedBy: '', createdAt: '', updatedAt: '' },
          { id: '', name: 'bad item', createdBy: '', updatedBy: '', createdAt: '', updatedAt: '' }
        ]
      }
    ];
    repository.saveHistory(newHistoryQuery);

    const updatedHistoryQuery = repository.findHistoryById(newHistoryQuery.id)!;
    expect(updatedHistoryQuery.items.length).toEqual(3);
    expect(updatedHistoryQuery.northTransformers.length).toEqual(1);
    expect(updatedHistoryQuery.northTransformers[0].items.length).toEqual(1);
  });

  it('should update a history query by removing items and transformers', () => {
    const newHistoryQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = JSON.parse(
      JSON.stringify(testData.historyQueries.list[1])
    );
    newHistoryQuery.id = 'newId';
    newHistoryQuery.name = 'new history query';
    newHistoryQuery.items = [];
    newHistoryQuery.northTransformers = [];
    repository.saveHistory(newHistoryQuery);

    const updatedHistoryQuery = repository.findHistoryById(newHistoryQuery.id)!;
    expect(updatedHistoryQuery.items.length).toEqual(0);
    expect(updatedHistoryQuery.northTransformers.length).toEqual(0);
  });

  it('should delete a history query', () => {
    repository.deleteHistory('newId');
    expect(repository.findHistoryById('newId')).toEqual(null);
  });

  it('should update status', () => {
    repository.updateHistoryStatus(testData.historyQueries.list[0].id, 'FINISHED');
    expect(repository.findHistoryById(testData.historyQueries.list[0].id)!.status).toEqual('FINISHED');
  });

  it('should list items', () => {
    expect(repository.listItems(testData.historyQueries.list[1].id, { enabled: true, name: 'item' }).length).toEqual(3);

    expect(repository.listItems(testData.historyQueries.list[1].id, { enabled: undefined, name: undefined }).length).toEqual(3);
  });

  it('should search items', () => {
    expect(repository.searchItems(testData.historyQueries.list[1].id, { enabled: true, name: 'item', page: 0 }).totalElements).toEqual(3);

    expect(
      repository.searchItems(testData.historyQueries.list[1].id, { enabled: undefined, name: undefined, page: 0 }).totalElements
    ).toEqual(3);
  });

  it('should find items', () => {
    const results = repository.findAllItemsForHistory(testData.historyQueries.list[1].id);
    expect(results.length).toEqual(3);
  });

  it('should find item', () => {
    const result = repository.findItemById(testData.historyQueries.list[1].id, testData.historyQueries.list[1].items[0].id);
    expect(stripAuditFields(result)).toEqual(expect.objectContaining(stripAuditFields(testData.historyQueries.list[1].items[0])));
    expect(repository.findItemById(testData.historyQueries.list[0].id, testData.historyQueries.list[1].items[0].id)).toEqual(null);
  });

  it('should delete item', () => {
    repository.deleteItem(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id);
    expect(repository.findItemById(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id)).toEqual(null);
  });

  it('should delete all item by south', () => {
    repository.deleteAllItemsByHistory(testData.historyQueries.list[0].id);
    expect(repository.findAllItemsForHistory(testData.historyQueries.list[0].id).length).toEqual(0);
  });

  it('should disable and enable item', () => {
    repository.disableItem(testData.historyQueries.list[1].items[0].id);
    expect(repository.findItemById(testData.historyQueries.list[1].id, testData.historyQueries.list[1].items[0].id)!.enabled).toEqual(
      false
    );
    repository.enableItem(testData.historyQueries.list[1].items[0].id);
    expect(repository.findItemById(testData.historyQueries.list[1].id, testData.historyQueries.list[1].items[0].id)!.enabled).toEqual(true);
  });

  it('should save all items without and delete previous items', () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('newItemIdHistory1');

    const itemsToSave: Array<HistoryQueryItemEntity<SouthItemSettings>> = JSON.parse(JSON.stringify(testData.historyQueries.list[1].items));
    itemsToSave.push({
      id: '',
      name: 'new history item',
      enabled: false,
      settings: {} as SouthItemSettings,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    });
    itemsToSave[0].name = 'updated name';

    repository.saveAllItems(testData.historyQueries.list[1].id, itemsToSave, false);

    const results = repository.findAllItemsForHistory(testData.historyQueries.list[1].id);
    expect(results.length).toEqual(4);

    expect(repository.findItemById(testData.historyQueries.list[1].id, testData.historyQueries.list[1].items[0].id)!.name).toEqual(
      itemsToSave[0].name
    );
    expect(repository.findItemById(testData.historyQueries.list[1].id, 'newItemIdHistory1')!.id).toEqual('newItemIdHistory1');
  });

  it('should save all items without deleting previous items', () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('newItemIdHistory1');

    const itemsToSave: Array<HistoryQueryItemEntity<SouthItemSettings>> = JSON.parse(JSON.stringify(testData.historyQueries.list[0].items));
    itemsToSave.push({
      id: '',
      name: 'new history item',
      enabled: false,
      settings: {} as SouthItemSettings,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    });
    itemsToSave[0].name = 'updated name';

    repository.saveAllItems(testData.historyQueries.list[1].id, itemsToSave, true);

    const results = repository.findAllItemsForHistory(testData.historyQueries.list[1].id);
    expect(results.length).toEqual(1);
    expect(repository.findItemById(testData.historyQueries.list[1].id, 'newItemIdHistory1')!.id).toEqual('newItemIdHistory1');
  });
});
