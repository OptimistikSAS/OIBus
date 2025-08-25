import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { NorthConnectorEntity, NorthConnectorEntityLight } from '../../model/north-connector.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { toSouthConnectorLight } from './south-connector.repository';
import { SouthConnectorEntityLight } from '../../model/south-connector.model';
import { OIBusNorthType } from '../../../shared/model/north-connector.model';
import { toTransformer } from './transformer.repository';
import { TransformerWithOptions } from '../../model/transformer.model';

const NORTH_CONNECTORS_TABLE = 'north_connectors';
const SUBSCRIPTION_TABLE = 'subscription';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const TRANSFORMERS_TABLE = 'transformers';
const NORTH_TRANSFORMERS_TABLE = 'north_transformers';

/**
 * Repository used for North connectors
 */
export default class NorthConnectorRepository {
  constructor(private readonly database: Database) {}

  findAllNorth(): Array<NorthConnectorEntityLight> {
    const query = `SELECT id, name, type, description, enabled FROM ${NORTH_CONNECTORS_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => this.toNorthConnectorLight(result as Record<string, string>));
  }

  findNorthById<N extends NorthSettings>(id: string): NorthConnectorEntity<N> | null {
    const query =
      `SELECT id, name, type, description, enabled, settings, ` +
      `caching_trigger_schedule, caching_trigger_number_of_elements, caching_trigger_number_of_files, ` +
      `caching_throttling_run_min_delay, caching_throttling_cache_max_size, caching_throttling_max_number_of_elements, ` +
      `caching_error_retry_interval, caching_error_retry_count, caching_error_retention_duration, ` +
      `caching_archive_enabled, caching_archive_retention_duration ` +
      `FROM ${NORTH_CONNECTORS_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    if (!result) return null;
    return this.toNorthConnector<N>(result as Record<string, string | number>);
  }

  saveNorthConnector(north: NorthConnectorEntity<NorthSettings>): void {
    const transaction = this.database.transaction(() => {
      if (!north.id) {
        north.id = generateRandomId(6);
        const insertQuery =
          `INSERT INTO ${NORTH_CONNECTORS_TABLE} (id, name, type, description, enabled, settings, ` +
          `caching_trigger_schedule, caching_trigger_number_of_elements, caching_trigger_number_of_files, ` +
          `caching_throttling_run_min_delay, caching_throttling_cache_max_size, caching_throttling_max_number_of_elements, ` +
          `caching_error_retry_interval, caching_error_retry_count, caching_error_retention_duration, ` +
          `caching_archive_enabled, caching_archive_retention_duration) ` +
          `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
        this.database
          .prepare(insertQuery)
          .run(
            north.id,
            north.name,
            north.type,
            north.description,
            +north.enabled,
            JSON.stringify(north.settings),
            north.caching.trigger.scanModeId,
            north.caching.trigger.numberOfElements,
            north.caching.trigger.numberOfFiles,
            north.caching.throttling.runMinDelay,
            north.caching.throttling.maxSize,
            north.caching.throttling.maxNumberOfElements,
            north.caching.error.retryInterval,
            north.caching.error.retryCount,
            north.caching.error.retentionDuration,
            +north.caching.archive.enabled,
            north.caching.archive.retentionDuration
          );
      } else {
        const query =
          `UPDATE ${NORTH_CONNECTORS_TABLE} SET name = ?, description = ?, enabled = ?, settings = ?, ` +
          `caching_trigger_schedule = ?, caching_trigger_number_of_elements = ?, caching_trigger_number_of_files = ?, ` +
          `caching_throttling_run_min_delay = ?, caching_throttling_cache_max_size = ?, caching_throttling_max_number_of_elements = ?, ` +
          `caching_error_retry_interval = ?, caching_error_retry_count = ?, caching_error_retention_duration = ?, ` +
          `caching_archive_enabled = ?, caching_archive_retention_duration = ? ` +
          `WHERE id = ?;`;
        this.database
          .prepare(query)
          .run(
            north.name,
            north.description,
            +north.enabled,
            JSON.stringify(north.settings),
            north.caching.trigger.scanModeId,
            north.caching.trigger.numberOfElements,
            north.caching.trigger.numberOfFiles,
            north.caching.throttling.runMinDelay,
            north.caching.throttling.maxSize,
            north.caching.throttling.maxNumberOfElements,
            north.caching.error.retryInterval,
            north.caching.error.retryCount,
            north.caching.error.retentionDuration,
            +north.caching.archive.enabled,
            north.caching.archive.retentionDuration,
            north.id
          );
      }

      if (north.subscriptions.length > 0) {
        this.database
          .prepare(
            `DELETE FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ? AND south_connector_id NOT IN (${north.subscriptions
              .map(() => '?')
              .join(', ')});`
          )
          .run(
            north.id,
            north.subscriptions.map(subscription => subscription.id)
          );

        const insert = this.database.prepare(
          `INSERT OR IGNORE INTO ${SUBSCRIPTION_TABLE} (north_connector_id, south_connector_id) VALUES (?, ?);`
        );
        for (const subscription of north.subscriptions) {
          insert.run(north.id, subscription.id);
        }
      } else {
        this.database.prepare(`DELETE FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ?;`).run(north.id);
      }

      this.database.prepare(`DELETE FROM ${NORTH_TRANSFORMERS_TABLE} WHERE north_id = ?;`).run(north.id);
      const insert = this.database.prepare(
        `INSERT INTO ${NORTH_TRANSFORMERS_TABLE} (north_id, transformer_id, options, input_type) VALUES (?, ?, ?, ?);`
      );
      for (const transformerWithOptions of north.transformers) {
        insert.run(
          north.id,
          transformerWithOptions.transformer.id,
          JSON.stringify(transformerWithOptions.options),
          transformerWithOptions.inputType
        );
      }
    });
    transaction();
  }

  startNorth(id: string) {
    const query = `UPDATE ${NORTH_CONNECTORS_TABLE} SET enabled = ? WHERE id = ?;`;
    this.database.prepare(query).run(1, id);
  }

  stopNorth(id: string) {
    const query = `UPDATE ${NORTH_CONNECTORS_TABLE} SET enabled = ? WHERE id = ?;`;
    this.database.prepare(query).run(0, id);
  }

  deleteNorth(id: string): void {
    const transaction = this.database.transaction(() => {
      this.database.prepare(`DELETE FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ?;`).run(id);
      this.database.prepare(`DELETE FROM ${NORTH_TRANSFORMERS_TABLE} WHERE north_id = ?;`).run(id);
      this.database.prepare(`DELETE FROM ${NORTH_CONNECTORS_TABLE} WHERE id = ?;`).run(id);
    });
    transaction();
  }

  listNorthSubscriptions(northId: string): Array<SouthConnectorEntityLight> {
    const query = `SELECT id, name, type, description, enabled, settings
            FROM ${SOUTH_CONNECTORS_TABLE}
            LEFT JOIN ${SUBSCRIPTION_TABLE}
              ON ${SUBSCRIPTION_TABLE}.south_connector_id = ${SOUTH_CONNECTORS_TABLE}.id
            WHERE ${SUBSCRIPTION_TABLE}.north_connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(northId)
      .map(result => toSouthConnectorLight(result as Record<string, string>));
  }

  checkSubscription(northId: string, southId: string): boolean {
    const query = `SELECT south_connector_id AS southId FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ? AND south_connector_id = ?;`;
    return !!this.database.prepare(query).get(northId, southId);
  }

  createSubscription(northId: string, southId: string): void {
    const query = `INSERT INTO ${SUBSCRIPTION_TABLE} (north_connector_id, south_connector_id) ` + 'VALUES (?, ?);';
    this.database.prepare(query).run(northId, southId);
  }

  deleteSubscription(northId: string, southId: string): void {
    const query = `DELETE FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ? AND south_connector_id = ?;`;
    this.database.prepare(query).run(northId, southId);
  }

  deleteAllSubscriptionsByNorth(northId: string): void {
    const query = `DELETE FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ?;`;
    this.database.prepare(query).run(northId);
  }

  findTransformersForNorth(northId: string): Array<TransformerWithOptions> {
    const query = `SELECT t.id, t.type, nt.input_type, t.output_type, t.function_name, t.name, t.description, t.custom_manifest, t.custom_code, t.language, nt.options FROM ${NORTH_TRANSFORMERS_TABLE} nt JOIN ${TRANSFORMERS_TABLE} t ON nt.transformer_id = t.id WHERE nt.north_id = ?;`;
    const result = this.database.prepare(query).all(northId) as Array<Record<string, string>>;
    return result.map(element => ({
      transformer: toTransformer(element),
      options: JSON.parse(element.options),
      inputType: element.input_type
    }));
  }

  private toNorthConnectorLight(result: Record<string, string>): NorthConnectorEntityLight {
    return {
      id: result.id,
      name: result.name,
      type: result.type as OIBusNorthType,
      description: result.description,
      enabled: Boolean(result.enabled)
    };
  }

  private toNorthConnector<N extends NorthSettings>(result: Record<string, string | number>): NorthConnectorEntity<N> {
    return {
      id: result.id as string,
      name: result.name as string,
      type: result.type as OIBusNorthType,
      description: result.description as string,
      enabled: Boolean(result.enabled),
      settings: JSON.parse(result.settings as string) as N,
      caching: {
        trigger: {
          scanModeId: result.caching_trigger_schedule as string,
          numberOfElements: result.caching_trigger_number_of_elements as number,
          numberOfFiles: result.caching_trigger_number_of_files as number
        },
        throttling: {
          runMinDelay: result.caching_throttling_run_min_delay as number,
          maxSize: result.caching_throttling_cache_max_size as number,
          maxNumberOfElements: result.caching_throttling_max_number_of_elements as number
        },
        error: {
          retryInterval: result.caching_error_retry_interval as number,
          retryCount: result.caching_error_retry_count as number,
          retentionDuration: result.caching_error_retention_duration as number
        },
        archive: {
          enabled: Boolean(result.caching_archive_enabled),
          retentionDuration: result.caching_archive_retention_duration as number
        }
      },
      subscriptions: this.listNorthSubscriptions(result.id as string),
      transformers: this.findTransformersForNorth(result.id as string)
    };
  }
}
