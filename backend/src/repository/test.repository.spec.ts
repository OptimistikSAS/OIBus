import { Database } from 'better-sqlite3';
import SubscriptionRepository from './subscription.repository';
import ScanModeRepository from './scan-mode.repository';
import { emptyDatabase, initDatabase } from '../tests/utils/test-utils';
import testData from '../tests/utils/test-data';
import { generateRandomId } from '../service/utils';
import IpFilterRepository from './ip-filter.repository';

jest.mock('../service/utils');

let database: Database;
describe('Repository with populated database', () => {
  beforeAll(async () => {
    database = await initDatabase();
  });

  afterAll(async () => {
    await emptyDatabase();
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

  describe('Scan Mode', () => {
    let repository: ScanModeRepository;
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
