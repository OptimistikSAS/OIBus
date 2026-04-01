import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import { generateRandomId } from '../../service/utils';
import IpFilterRepository from './ip-filter.repository';

jest.mock('../../service/utils');

const TEST_DB_PATH = 'src/tests/test-config-ip-filter.db';

let database: Database;
describe('IpFilterRepository', () => {
  beforeAll(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: IpFilterRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    repository = new IpFilterRepository(database);
  });

  it('findAll() should properly get all IP filters', () => {
    expect(repository.list().map(stripAuditFields)).toEqual(
      testData.ipFilters.list.map(stripAuditFields).map(f => expect.objectContaining(f))
    );
  });

  it('findById() should properly get an IP filter', () => {
    expect(stripAuditFields(repository.findById(testData.ipFilters.list[0].id))).toEqual(
      expect.objectContaining(stripAuditFields(testData.ipFilters.list[0]))
    );
    expect(repository.findById('badId')).toEqual(null);
  });

  it('create() should create an IP filter', () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('newId');
    expect(repository.create(testData.ipFilters.command, 'userTest')).toEqual(
      expect.objectContaining({ ...testData.ipFilters.command, id: 'newId', createdBy: 'userTest', updatedBy: 'userTest' })
    );
  });

  it('update() should update an IP filter', () => {
    repository.update('newId', testData.ipFilters.command, 'userTest');
    expect(repository.findById('newId')).toEqual(
      expect.objectContaining({ ...testData.ipFilters.command, id: 'newId', updatedBy: 'userTest' })
    );
  });

  it('delete() should delete an IP filter', () => {
    expect(repository.findById('newId')).not.toEqual(null);
    repository.delete('newId');
    expect(repository.findById('newId')).toEqual(null);
  });
});
