import { Database } from 'better-sqlite3';
import { Subscription } from '../model/subscription.model';
import { SOUTH_CONNECTORS_TABLE } from './south-connector.repository';

export const SUBSCRIPTION_TABLE = 'subscription';

/**
 * Repository used for subscriptions of North connectors to South connectors
 */
export default class SubscriptionRepository {
  constructor(private readonly database: Database) {}

  /**
   * Retrieve all subscriptions for a given North connector
   */
  listSouthByNorth(northId: string): Array<Subscription> {
    const query = `SELECT ${SUBSCRIPTION_TABLE}.south_connector_id AS southId, ${SOUTH_CONNECTORS_TABLE}.type AS southType, ${SOUTH_CONNECTORS_TABLE}.name AS southName
                   FROM ${SUBSCRIPTION_TABLE}
                        LEFT JOIN ${SOUTH_CONNECTORS_TABLE}
                            ON ${SUBSCRIPTION_TABLE}.south_connector_id = ${SOUTH_CONNECTORS_TABLE}.id
                   WHERE ${SUBSCRIPTION_TABLE}.north_connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(northId)
      .map(result => this.toSubscription(result));
  }

  /**
   * Retrieve all subscribed North connector ids for a given South connector
   */
  listNorthBySouth(southId: string): Array<string> {
    const query = `SELECT north_connector_id AS northId FROM ${SUBSCRIPTION_TABLE} WHERE south_connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(southId)
      .map(result => (result as { northId: string }).northId);
  }

  /**
   * Check whether a subscription exists for a given North connector
   */
  checkSubscription(northId: string, southId: string): boolean {
    const query = `SELECT south_connector_id AS southId FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ? AND south_connector_id = ?;`;
    return !!this.database.prepare(query).get(northId, southId);
  }

  create(northId: string, southId: string): void {
    const query = `INSERT INTO ${SUBSCRIPTION_TABLE} (north_connector_id, south_connector_id) ` + 'VALUES (?, ?);';
    this.database.prepare(query).run(northId, southId);
  }

  delete(northId: string, southId: string): void {
    const query = `DELETE FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ? AND south_connector_id = ?;`;
    this.database.prepare(query).run(northId, southId);
  }

  deleteAllByNorth(northId: string): void {
    const query = `DELETE FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ?;`;
    this.database.prepare(query).run(northId);
  }

  private toSubscription(subscription: any): Subscription {
    return { south: { id: subscription.southId, name: subscription.southName, type: subscription.southType } };
  }
}
