import SubscriptionRepository from './subscription.repository';
import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { Database } from 'better-sqlite3';
import { SubscriptionDTO } from '../../../shared/model/subscription.model';

jest.mock('../tests/__mocks__/database.mock');

let database: Database;
let repository: SubscriptionRepository;
describe('Subscription repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new SubscriptionRepository(database);
  });

  it('should properly get all subscriptions', () => {
    const expectedValue: Array<SubscriptionDTO> = ['south1', 'south2'];
    all.mockReturnValueOnce(expectedValue.map(southId => ({ southConnectorId: southId })));
    const subscriptions = repository.getNorthSubscriptions('north1');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT south_connector_id AS southConnectorId FROM subscription WHERE north_connector_id = ?;'
    );
    expect(subscriptions).toEqual(expectedValue);
  });

  it('should properly get all subscribed North connectors', () => {
    const expectedValue = ['north1', 'north2'];
    all.mockReturnValueOnce(expectedValue.map(northId => ({ northConnectorId: northId })));
    const subscriptions = repository.getSubscribedNorthConnectors('south1');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT north_connector_id AS northConnectorId FROM subscription WHERE south_connector_id = ?;'
    );
    expect(subscriptions).toEqual(expectedValue);
  });

  it('should check a subscription', () => {
    get.mockReturnValueOnce({ southConnectorId: 'south1' });

    repository.checkNorthSubscription('north1', 'south1');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT south_connector_id AS southConnectorId FROM subscription WHERE north_connector_id = ? AND south_connector_id = ?;'
    );
    expect(get).toHaveBeenCalledWith('north1', 'south1');
  });

  it('should create a subscription', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });

    repository.createNorthSubscription('north1', 'south1');
    expect(database.prepare).toHaveBeenCalledWith('INSERT INTO subscription (north_connector_id, south_connector_id) VALUES (?, ?);');
    expect(run).toHaveBeenCalledWith('north1', 'south1');
  });

  it('should delete a subscription', () => {
    repository.deleteNorthSubscription('north1', 'south1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM subscription WHERE north_connector_id = ? AND south_connector_id = ?;');
    expect(run).toHaveBeenCalledWith('north1', 'south1');
  });

  it('should delete all North subscriptions', () => {
    repository.deleteNorthSubscriptions('north1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM subscription WHERE north_connector_id = ?;');
    expect(run).toHaveBeenCalledWith('north1');
  });
});
