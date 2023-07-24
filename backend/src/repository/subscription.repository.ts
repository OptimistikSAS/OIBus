import { Database } from 'better-sqlite3';
import { ExternalSubscriptionDTO, SubscriptionDTO } from '../../../shared/model/subscription.model';

export const SUBSCRIPTION_TABLE = 'subscription';
export const EXTERNAL_SUBSCRIPTION_TABLE = 'external_subscription';

/**
 * Repository used for subscriptions
 */
export default class SubscriptionRepository {
  constructor(private readonly database: Database) {}

  /**
   * Retrieve all subscriptions for a given North connector
   */
  getNorthSubscriptions(northId: string): Array<SubscriptionDTO> {
    const query = `SELECT south_connector_id AS southConnectorId FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(northId)
      .map((row: any) => row.southConnectorId);
  }

  /**
   * Retrieve all external subscriptions for a given North connector
   */
  getExternalNorthSubscriptions(northId: string): Array<ExternalSubscriptionDTO> {
    const query = `SELECT external_source_id AS externalSourceId FROM ${EXTERNAL_SUBSCRIPTION_TABLE} WHERE north_connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(northId)
      .map((row: any) => row.externalSourceId);
  }

  /**
   * Retrieve all subscribed North connectors for a given South connector
   */
  getSubscribedNorthConnectors(southId: string): Array<SubscriptionDTO> {
    const query = `SELECT north_connector_id AS northConnectorId FROM ${SUBSCRIPTION_TABLE} WHERE south_connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(southId)
      .map((row: any) => row.northConnectorId);
  }

  /**
   * Check whether a subscription exists for a given North connector
   */
  checkNorthSubscription(northId: string, southId: string): boolean {
    const query = `SELECT south_connector_id AS southConnectorId FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ? AND south_connector_id = ?;`;
    return !!this.database.prepare(query).get(northId, southId);
  }

  /**
   * Check whether an external subscription exists for a given North connector
   */
  checkExternalNorthSubscription(northId: string, externalSourceId: string): boolean {
    const query = `SELECT external_source_id AS externalSourceId FROM ${EXTERNAL_SUBSCRIPTION_TABLE} WHERE north_connector_id = ? AND external_source_id = ?;`;
    return !!this.database.prepare(query).get(northId, externalSourceId);
  }

  /**
   * Create a subscription for a given North connector
   */
  createNorthSubscription(northId: string, southId: string): void {
    const query = `INSERT INTO ${SUBSCRIPTION_TABLE} (north_connector_id, south_connector_id) ` + 'VALUES (?, ?);';
    this.database.prepare(query).run(northId, southId);
  }

  /**
   * Create an external subscription for a given North connector
   */
  createExternalNorthSubscription(northId: string, externalSourceId: string): void {
    const query = `INSERT INTO ${EXTERNAL_SUBSCRIPTION_TABLE} (north_connector_id, external_source_id) ` + 'VALUES (?, ?);';
    this.database.prepare(query).run(northId, externalSourceId);
  }

  /**
   * Delete a subscription for a given North connector
   */
  deleteNorthSubscription(northId: string, southId: string): void {
    const query = `DELETE FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ? AND south_connector_id = ?;`;
    this.database.prepare(query).run(northId, southId);
  }

  /**
   * Delete an external subscription for a given North connector
   */
  deleteExternalNorthSubscription(northId: string, externalSourceId: string): void {
    const query = `DELETE FROM ${EXTERNAL_SUBSCRIPTION_TABLE} WHERE north_connector_id = ? AND external_source_id = ?;`;
    this.database.prepare(query).run(northId, externalSourceId);
  }

  /**
   * Delete all subscriptions for a given North connector
   */
  deleteNorthSubscriptions(northId: string): void {
    const query = `DELETE FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ?;`;
    this.database.prepare(query).run(northId);
  }

  /**
   * Delete all external subscriptions for a given North connector
   */
  deleteExternalNorthSubscriptions(northId: string): void {
    const query = `DELETE FROM ${EXTERNAL_SUBSCRIPTION_TABLE} WHERE north_connector_id = ?;`;
    this.database.prepare(query).run(northId);
  }
}
