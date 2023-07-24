import { Database } from 'better-sqlite3';
import { ExternalSubscriptionDTO, SubscriptionDTO } from '../../../shared/model/subscription.model';
import { NORTH_CONNECTOR_TABLE } from './north-connector.repository';
import { SOUTH_CONNECTOR_TABLE } from './south-connector.repository';
import { EXTERNAL_SOURCES_TABLE } from './external-source.repository';

export const SUBSCRIPTION_TABLE = 'subscription';
export const EXTERNAL_SUBSCRIPTION_TABLE = 'external_subscription';

/**
 * Repository used for subscriptions
 */
export default class SubscriptionRepository {
  private readonly database: Database;
  constructor(database: Database) {
    this.database = database;

    const southQuery =
      `CREATE TABLE IF NOT EXISTS ${SUBSCRIPTION_TABLE} (north_connector_id TEXT, south_connector_id TEXT, ` +
      `PRIMARY KEY (north_connector_id, south_connector_id), ` +
      `FOREIGN KEY(north_connector_id) REFERENCES ${NORTH_CONNECTOR_TABLE}(id), ` +
      `FOREIGN KEY(south_connector_id) REFERENCES ${SOUTH_CONNECTOR_TABLE}(id));`;
    this.database.prepare(southQuery).run();

    const externalQuery =
      `CREATE TABLE IF NOT EXISTS ${EXTERNAL_SUBSCRIPTION_TABLE} (north_connector_id TEXT, external_source_id TEXT, ` +
      `PRIMARY KEY (north_connector_id, external_source_id), ` +
      `FOREIGN KEY(north_connector_id) REFERENCES ${NORTH_CONNECTOR_TABLE}(id), ` +
      `FOREIGN KEY(external_source_id) REFERENCES ${EXTERNAL_SOURCES_TABLE}(id));`;
    this.database.prepare(externalQuery).run();
  }

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
