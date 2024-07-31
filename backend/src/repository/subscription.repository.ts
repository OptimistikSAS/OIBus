import { Database } from 'better-sqlite3';
import { SubscriptionDTO } from '../../../shared/model/subscription.model';

export const SUBSCRIPTION_TABLE = 'subscription';

/**
 * Repository used for subscriptions
 */
export default class SubscriptionRepository {
  constructor(private readonly database: Database) {}

  /**
   * Retrieve all subscriptions for a given North connector
   */
  list(northId: string): Array<SubscriptionDTO> {
    const query = `SELECT south_connector_id AS southConnectorId FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(northId)
      .map((row: any) => row.southConnectorId);
  }

  /**
   * Retrieve all subscribed North connectors for a given South connector
   */
  listSubscribedNorth(southId: string): Array<SubscriptionDTO> {
    const query = `SELECT north_connector_id AS northConnectorId FROM ${SUBSCRIPTION_TABLE} WHERE south_connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(southId)
      .map((row: any) => row.northConnectorId);
  }

  /**
   * Check whether a subscription exists for a given North connector
   */
  checkSubscription(northId: string, southId: string): boolean {
    const query = `SELECT south_connector_id AS southConnectorId FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ? AND south_connector_id = ?;`;
    return !!this.database.prepare(query).get(northId, southId);
  }

  /**
   * Create a subscription for a given North connector
   */
  create(northId: string, southId: string): void {
    const query = `INSERT INTO ${SUBSCRIPTION_TABLE} (north_connector_id, south_connector_id) ` + 'VALUES (?, ?);';
    this.database.prepare(query).run(northId, southId);
  }

  /**
   * Delete a subscription for a given North connector
   */
  delete(northId: string, southId: string): void {
    const query = `DELETE FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ? AND south_connector_id = ?;`;
    this.database.prepare(query).run(northId, southId);
  }

  deleteAllByNorthConnector(northId: string): void {
    const query = `DELETE FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ?;`;
    this.database.prepare(query).run(northId);
  }
}
