import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import { generateRandomId } from '../../service/utils';
import ScanModeRepository from './scan-mode.repository';

jest.mock('../../service/utils');

const TEST_DB_PATH = 'src/tests/test-config-scan-mode.db';

let database: Database;
describe('ScanModeRepository with populated database', () => {
  beforeAll(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: ScanModeRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    repository = new ScanModeRepository(database);
  });

  it('should properly get all scan modes', () => {
    expect(repository.findAll().length).toEqual(testData.scanMode.list.length);
  });

  it('should properly get a scan mode', () => {
    expect(stripAuditFields(repository.findById(testData.scanMode.list[0].id))).toEqual(
      expect.objectContaining(stripAuditFields(testData.scanMode.list[0]))
    );
    expect(repository.findById('badId')).toEqual(null);
  });

  it('should create a scan mode', () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('newId');
    expect(repository.create(testData.scanMode.command, 'userTest')).toEqual(
      expect.objectContaining({ ...testData.scanMode.command, id: 'newId', createdBy: 'userTest', updatedBy: 'userTest' })
    );
  });

  it('should update a scan mode', () => {
    repository.update('newId', testData.scanMode.command, 'userTest');
    expect(repository.findById('newId')).toEqual(
      expect.objectContaining({ ...testData.scanMode.command, id: 'newId', updatedBy: 'userTest' })
    );
  });

  it('should delete a scan mode', () => {
    expect(repository.findById('newId')).not.toEqual(null);
    repository.delete('newId');
    expect(repository.findById('newId')).toEqual(null);
  });
});

describe('ScanModeRepository with empty database', () => {
  beforeAll(async () => {
    database = await initDatabase('config', false, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: ScanModeRepository;
  beforeEach(() => {
    jest.resetAllMocks();
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
