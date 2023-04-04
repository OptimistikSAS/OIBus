import { Database } from 'better-sqlite3';
import { SubscriptionDTO } from '../../../shared/model/subscription.model';
import { NORTH_CONNECTOR_TABLE } from './north-connector.repository';
import { SOUTH_CONNECTOR_TABLE } from './south-connector.repository';

export const SUBSCRIPTION_TABLE = 'subscription';

/**
 * Repository used for subscriptions
 */
export default class SubscriptionRepository {
  private readonly database: Database;
  constructor(database: Database) {
    this.database = database;
    const query =
      `CREATE TABLE IF NOT EXISTS ${SUBSCRIPTION_TABLE} (north_connector_id TEXT, south_connector_id TEXT, ` +
      `PRIMARY KEY (north_connector_id, south_connector_id), ` +
      `FOREIGN KEY(north_connector_id) REFERENCES ${NORTH_CONNECTOR_TABLE}(id), ` +
      `FOREIGN KEY(south_connector_id) REFERENCES ${SOUTH_CONNECTOR_TABLE}(id));`;
    this.database.prepare(query).run();
  }

  /**
   * Retrieve all subscriptions for a given North connector
   */
  getNorthSubscriptions(northId: string): Array<SubscriptionDTO> {
    const query = `SELECT south_connector_id FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(northId)
      .map(row => row.south_connector_id);
  }

  /**
   * Retrieve all subscribed North connectors for a given South connector
   */
  getSubscribedNorthConnectors(southId: string): Array<SubscriptionDTO> {
    const query = `SELECT north_connector_id FROM ${SUBSCRIPTION_TABLE} WHERE south_connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(southId)
      .map(row => row.north_connector_id);
  }

  /**
   * Check whether a subscription exists for a given North connector
   */
  checkNorthSubscription(northId: string, southId: string): boolean {
    const query = `SELECT south_connector_id FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ? AND south_connector_id = ?;`;
    return !!this.database.prepare(query).get(northId, southId);
  }

  /**
   * Create a subscription for a given North connector
   */
  createNorthSubscription(northId: string, southId: string): void {
    const query = `INSERT INTO ${SUBSCRIPTION_TABLE} (north_connector_id, south_connector_id) ` + 'VALUES (?, ?);';
    this.database.prepare(query).run(northId, southId);
  }

  /**
   * Delete a subscription for a given North connector
   */
  deleteNorthSubscription(northId: string, southId: string): void {
    const query = `DELETE FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ? AND south_connector_id = ?;`;
    this.database.prepare(query).run(northId, southId);
  }

  /**
   * Delete all subscriptions for a given North connector
   */
  deleteNorthSubscriptions(northId: string): void {
    const query = `DELETE FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ?;`;
    this.database.prepare(query).run(northId);
  }
}
