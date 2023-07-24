import SubscriptionRepository from './subscription.repository';
import SqliteDatabaseMock, { run, all, get } from '../tests/__mocks__/database.mock';
import { Database } from 'better-sqlite3';
import { ExternalSubscriptionDTO, SubscriptionDTO } from '../../../shared/model/subscription.model';

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

  it('should properly get all external subscriptions', () => {
    const expectedValue: Array<ExternalSubscriptionDTO> = ['external1', 'external2'];
    all.mockReturnValueOnce(expectedValue.map(sourceId => ({ externalSourceId: sourceId })));
    const subscriptions = repository.getExternalNorthSubscriptions('north1');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT external_source_id AS externalSourceId FROM external_subscription WHERE north_connector_id = ?;'
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

  it('should check an external subscription', () => {
    get.mockReturnValueOnce({ externalSourceId: 'external1' });

    repository.checkExternalNorthSubscription('north1', 'external1');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT external_source_id AS externalSourceId FROM external_subscription WHERE north_connector_id = ? AND external_source_id = ?;'
    );
    expect(get).toHaveBeenCalledWith('north1', 'external1');
  });

  it('should create a subscription', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });

    repository.createNorthSubscription('north1', 'south1');
    expect(database.prepare).toHaveBeenCalledWith('INSERT INTO subscription (north_connector_id, south_connector_id) VALUES (?, ?);');
    expect(run).toHaveBeenCalledWith('north1', 'south1');
  });

  it('should create an external subscription', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });

    repository.createExternalNorthSubscription('north1', 'external1');
    expect(database.prepare).toHaveBeenCalledWith(
      'INSERT INTO external_subscription (north_connector_id, external_source_id) VALUES (?, ?);'
    );
    expect(run).toHaveBeenCalledWith('north1', 'external1');
  });

  it('should delete a subscription', () => {
    repository.deleteNorthSubscription('north1', 'south1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM subscription WHERE north_connector_id = ? AND south_connector_id = ?;');
    expect(run).toHaveBeenCalledWith('north1', 'south1');
  });

  it('should delete an external subscription', () => {
    repository.deleteExternalNorthSubscription('north1', 'external1');
    expect(database.prepare).toHaveBeenCalledWith(
      'DELETE FROM external_subscription WHERE north_connector_id = ? AND external_source_id = ?;'
    );
    expect(run).toHaveBeenCalledWith('north1', 'external1');
  });

  it('should delete all North subscriptions', () => {
    repository.deleteNorthSubscriptions('north1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM subscription WHERE north_connector_id = ?;');
    expect(run).toHaveBeenCalledWith('north1');
  });

  it('should delete all external North subscriptions', () => {
    repository.deleteExternalNorthSubscriptions('north1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM external_subscription WHERE north_connector_id = ?;');
    expect(run).toHaveBeenCalledWith('north1');
  });
});
