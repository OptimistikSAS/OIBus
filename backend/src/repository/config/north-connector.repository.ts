import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { NorthConnectorEntity, NorthConnectorEntityLight } from '../../model/north-connector.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { SouthConnectorEntityLight, SouthConnectorItemEntityLight, SouthItemGroupEntity } from '../../model/south-connector.model';
import { OIBusNorthType } from '../../../shared/model/north-connector.model';
import { toTransformer } from './transformer.repository';
import { NorthTransformerWithOptions, TransformerSource } from '../../model/transformer.model';
import { ScanMode } from '../../model/scan-mode.model';
import { toScanMode } from './scan-mode.repository';
import { OIBusSouthType } from '../../../shared/model/south-connector.model';
import { toSouthItemGroup } from './south-item-group.repository';

const NORTH_CONNECTORS_TABLE = 'north_connectors';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';
const TRANSFORMERS_TABLE = 'transformers';
const NORTH_TRANSFORMERS_TABLE = 'north_transformers';
const NORTH_TRANSFORMERS_ITEMS_TABLE = 'north_transformers_items';
const SOUTH_ITEM_GROUPS_TABLE = 'south_item_groups';
const GROUP_ITEMS_TABLE = 'group_items';
const SCAN_MODE_TABLE = 'scan_modes';

export default class NorthConnectorRepository {
  constructor(private readonly database: Database) {}

  findAllNorth(): Array<NorthConnectorEntityLight> {
    const query = `SELECT id, name, type, description, enabled, created_by, updated_by, created_at, updated_at FROM ${NORTH_CONNECTORS_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => this.toNorthConnectorLight(result as Record<string, string>));
  }

  findAllNorthFull(): Array<NorthConnectorEntity<NorthSettings>> {
    const query =
      `SELECT id, name, type, description, enabled, settings, ` +
      `caching_trigger_schedule, caching_trigger_number_of_elements, caching_trigger_number_of_files, ` +
      `caching_throttling_run_min_delay, caching_throttling_cache_max_size, caching_throttling_max_number_of_elements, ` +
      `caching_error_retry_interval, caching_error_retry_count, caching_error_retention_duration, ` +
      `caching_archive_enabled, caching_archive_retention_duration, created_by, updated_by, created_at, updated_at ` +
      `FROM ${NORTH_CONNECTORS_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => this.toNorthConnector(result as Record<string, string | number>));
  }

  findNorthById(id: string): NorthConnectorEntity<NorthSettings> | null {
    const query =
      `SELECT id, name, type, description, enabled, settings, ` +
      `caching_trigger_schedule, caching_trigger_number_of_elements, caching_trigger_number_of_files, ` +
      `caching_throttling_run_min_delay, caching_throttling_cache_max_size, caching_throttling_max_number_of_elements, ` +
      `caching_error_retry_interval, caching_error_retry_count, caching_error_retention_duration, ` +
      `caching_archive_enabled, caching_archive_retention_duration, created_by, updated_by, created_at, updated_at ` +
      `FROM ${NORTH_CONNECTORS_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    if (!result) return null;
    return this.toNorthConnector(result as Record<string, string | number>);
  }

  saveNorth(north: NorthConnectorEntity<NorthSettings>): void {
    const transaction = this.database.transaction(() => {
      if (!north.id) {
        north.id = generateRandomId(6);
        const insertQuery =
          `INSERT INTO ${NORTH_CONNECTORS_TABLE} (id, name, type, description, enabled, settings, ` +
          `caching_trigger_schedule, caching_trigger_number_of_elements, caching_trigger_number_of_files, ` +
          `caching_throttling_run_min_delay, caching_throttling_cache_max_size, caching_throttling_max_number_of_elements, ` +
          `caching_error_retry_interval, caching_error_retry_count, caching_error_retention_duration, ` +
          `caching_archive_enabled, caching_archive_retention_duration, created_by, updated_by, created_at, updated_at) ` +
          `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));`;
        this.database
          .prepare(insertQuery)
          .run(
            north.id,
            north.name,
            north.type,
            north.description,
            +north.enabled,
            JSON.stringify(north.settings),
            north.caching.trigger.scanMode.id,
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
            north.createdBy,
            north.updatedBy
          );
      } else {
        const query =
          `UPDATE ${NORTH_CONNECTORS_TABLE} SET name = ?, description = ?, enabled = ?, settings = ?, ` +
          `caching_trigger_schedule = ?, caching_trigger_number_of_elements = ?, caching_trigger_number_of_files = ?, ` +
          `caching_throttling_run_min_delay = ?, caching_throttling_cache_max_size = ?, caching_throttling_max_number_of_elements = ?, ` +
          `caching_error_retry_interval = ?, caching_error_retry_count = ?, caching_error_retention_duration = ?, ` +
          `caching_archive_enabled = ?, caching_archive_retention_duration = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ` +
          `WHERE id = ?;`;
        this.database
          .prepare(query)
          .run(
            north.name,
            north.description,
            +north.enabled,
            JSON.stringify(north.settings),
            north.caching.trigger.scanMode.id,
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
            north.updatedBy,
            north.id
          );
      }

      const keepIds = north.transformers.filter(t => t.id).map(t => t.id);
      if (keepIds.length === 0) {
        this.database
          .prepare(
            `DELETE FROM ${NORTH_TRANSFORMERS_ITEMS_TABLE}
             WHERE id IN (
               SELECT id FROM ${NORTH_TRANSFORMERS_TABLE} WHERE north_id = ?
             );`
          )
          .run(north.id);
        // The list is empty, so we delete EVERYTHING for this north_id
        this.database.prepare(`DELETE FROM ${NORTH_TRANSFORMERS_TABLE} WHERE north_id = ?`).run(north.id);
      } else {
        this.database
          .prepare(
            `DELETE FROM ${NORTH_TRANSFORMERS_ITEMS_TABLE}
             WHERE id IN (
               SELECT id FROM ${NORTH_TRANSFORMERS_TABLE} WHERE north_id = ?
             ) AND id NOT IN (${keepIds.map(() => '?').join(', ')});`
          )
          .run(north.id, ...keepIds);

        // The list has items, so we delete only those NOT in the list
        const placeholders = keepIds.map(() => '?').join(',');

        const sql = `DELETE FROM ${NORTH_TRANSFORMERS_TABLE} WHERE north_id = ? AND id NOT IN (${placeholders})`;
        // We spread (...keepIds) so they fill the placeholders after history.id
        this.database.prepare(sql).run(north.id, ...keepIds);
      }

      for (const transformerWithOptions of north.transformers) {
        this.addOrEditTransformer(north.id, transformerWithOptions);
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
      // 1. Delete items
      this.database
        .prepare(
          `DELETE FROM ${NORTH_TRANSFORMERS_ITEMS_TABLE}
         WHERE id IN (
           SELECT id FROM ${NORTH_TRANSFORMERS_TABLE} WHERE north_id = ?
         );`
        )
        .run(id);

      // 2. Delete transformers
      this.database.prepare(`DELETE FROM ${NORTH_TRANSFORMERS_TABLE} WHERE north_id = ?;`).run(id);

      // 3. Delete the connector itself
      this.database.prepare(`DELETE FROM ${NORTH_CONNECTORS_TABLE} WHERE id = ?;`).run(id);
    });

    transaction();
  }

  addOrEditTransformer(northId: string, transformerWithOptions: NorthTransformerWithOptions): void {
    if (!transformerWithOptions.id) {
      transformerWithOptions.id = generateRandomId(6);
      const query = `INSERT INTO ${NORTH_TRANSFORMERS_TABLE} (id, north_id, transformer_id, options, source_type, source_api_data_source_id, source_south_south_id, source_south_group_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
      this.database
        .prepare(query)
        .run(
          transformerWithOptions.id,
          northId,
          transformerWithOptions.transformer.id,
          JSON.stringify(transformerWithOptions.options),
          transformerWithOptions.source.type,
          transformerWithOptions.source.type === 'oibus-api' ? transformerWithOptions.source.dataSourceId : null,
          transformerWithOptions.source.type === 'south' ? transformerWithOptions.source.south.id : null,
          transformerWithOptions.source.type === 'south' && transformerWithOptions.source.group
            ? transformerWithOptions.source.group.id
            : null
        );
    } else {
      const query = `UPDATE ${NORTH_TRANSFORMERS_TABLE} SET transformer_id = ?, options = ?, source_api_data_source_id = ?, source_south_south_id = ?, source_south_group_id = ? WHERE id = ?;`;
      this.database
        .prepare(query)
        .run(
          transformerWithOptions.transformer.id,
          JSON.stringify(transformerWithOptions.options),
          transformerWithOptions.source.type === 'oibus-api' ? transformerWithOptions.source.dataSourceId : null,
          transformerWithOptions.source.type === 'south' ? transformerWithOptions.source.south.id : null,
          transformerWithOptions.source.type === 'south' && transformerWithOptions.source.group
            ? transformerWithOptions.source.group.id
            : null,
          transformerWithOptions.id
        );
    }
    this.database.prepare(`DELETE FROM ${NORTH_TRANSFORMERS_ITEMS_TABLE} WHERE id = ?;`).run(transformerWithOptions.id);
    if (transformerWithOptions.source.type === 'south') {
      if (transformerWithOptions.source.group?.id) {
        this.database
          .prepare(`INSERT INTO ${NORTH_TRANSFORMERS_ITEMS_TABLE} (id, group_id) VALUES (?, ?);`)
          .run(transformerWithOptions.id, transformerWithOptions.source.group.id);
      } else {
        const items = transformerWithOptions.source.items.filter(item => item.id);
        for (const item of items) {
          this.database
            .prepare(`INSERT INTO ${NORTH_TRANSFORMERS_ITEMS_TABLE} (id, item_id) VALUES (?, ?);`)
            .run(transformerWithOptions.id, item.id);
        }
      }
    }
  }

  removeTransformer(id: string): void {
    const transaction = this.database.transaction(() => {
      this.database.prepare(`DELETE FROM ${NORTH_TRANSFORMERS_ITEMS_TABLE} WHERE id = ?;`).run(id);
      this.database.prepare(`DELETE FROM ${NORTH_TRANSFORMERS_TABLE} WHERE id = ?;`).run(id);
    });
    transaction();
  }

  removeTransformersByTransformerId(transformerId: string): void {
    const transaction = this.database.transaction(() => {
      this.database
        .prepare(
          `DELETE FROM ${NORTH_TRANSFORMERS_ITEMS_TABLE} WHERE id IN (SELECT id FROM ${NORTH_TRANSFORMERS_TABLE} WHERE transformer_id = ?);`
        )
        .run(transformerId);
      this.database.prepare(`DELETE FROM ${NORTH_TRANSFORMERS_TABLE} WHERE transformer_id = ?;`).run(transformerId);
    });
    transaction();
  }

  private findTransformersForNorth(northId: string): Array<NorthTransformerWithOptions> {
    const query =
      `SELECT t.id, t.type, t.input_type, t.output_type, t.function_name, t.name, t.description, t.custom_manifest, ` +
      `t.custom_code, t.language, t.timeout, t.created_by, t.updated_by, t.created_at, t.updated_at, nt.options, nt.source_type, ` +
      `nt.source_api_data_source_id, nt.source_south_south_id, nt.source_south_group_id, sig.name as group_name, nt.id as ntId ` +
      `FROM ${NORTH_TRANSFORMERS_TABLE} nt ` +
      `JOIN ${TRANSFORMERS_TABLE} t ON nt.transformer_id = t.id ` +
      `LEFT JOIN ${SOUTH_ITEM_GROUPS_TABLE} sig ON nt.source_south_group_id = sig.south_id ` +
      `WHERE nt.north_id = ?;`;
    const result = this.database.prepare(query).all(northId) as Array<Record<string, string>>;
    return result.map(element => ({
      id: element.ntId,
      transformer: toTransformer(element),
      options: JSON.parse(element.options),
      source: this.transformerSourceFromCommand(element)
    }));
  }

  private transformerSourceFromCommand(sourceCommand: Record<string, string>): TransformerSource {
    switch (sourceCommand.source_type) {
      case 'oibus-api':
        return {
          type: 'oibus-api',
          dataSourceId: sourceCommand.source_api_data_source_id
        };
      case 'south':
        return {
          type: 'south',
          south: this.findSouth(sourceCommand.source_south_south_id),
          group: sourceCommand.source_south_group_id ? this.findGroup(sourceCommand.source_south_group_id) : undefined,
          items: !sourceCommand.source_south_group_id ? this.findSouthItemsByNorthTransformer(sourceCommand.ntId) : []
        };
      default:
        return {
          type: 'oianalytics-setpoint'
        };
    }
  }

  private findGroup(groupId: string): SouthItemGroupEntity {
    const query =
      `SELECT g.id, g.created_at, g.updated_at, g.created_by, g.updated_by, g.name, g.south_id, ` +
      `g.scan_mode_id, g.overlap, g.max_read_interval, g.read_delay, s.id as scan_mode_id_full, ` +
      `s.name as scan_mode_name, s.description as scan_mode_description, s.cron as scan_mode_cron, ` +
      `s.created_at as scan_mode_created_at, s.updated_at as scan_mode_updated_at, s.created_by as scan_mode_created_by, s.updated_by as scan_mode_updated_by ` +
      `FROM ${SOUTH_ITEM_GROUPS_TABLE} g JOIN ${SCAN_MODE_TABLE} s ON g.scan_mode_id = s.id WHERE g.id = ?;`;
    const result = this.database.prepare<[string], Record<string, string | number>>(query).get(groupId)!;
    return toSouthItemGroup(result, this.findAllItemsForGroup(result.id as string));
  }

  findAllItemsForGroup(groupId: string): Array<Record<string, string>> {
    const query = `SELECT si.id, si.name, si.created_by, si.updated_by, si.created_at, si.updated_at FROM ${GROUP_ITEMS_TABLE} gi JOIN ${SOUTH_ITEMS_TABLE} si ON si.id = gi.item_id  WHERE gi.group_id = ?;`;
    return this.database.prepare<[string], Record<string, string>>(query).all(groupId);
  }

  private findScanModeForNorth(scanModeId: string): ScanMode {
    const query = `SELECT id, name, description, cron, created_by, updated_by, created_at, updated_at FROM ${SCAN_MODE_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(scanModeId) as Record<string, string>;
    return toScanMode(result);
  }

  private findSouth(southId: string): SouthConnectorEntityLight {
    const query = `SELECT id, name, type, description, enabled, created_by, updated_by, created_at, updated_at FROM ${SOUTH_CONNECTORS_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(southId) as Record<string, string>;
    return {
      id: result.id,
      name: result.name,
      type: result.type as OIBusSouthType,
      description: result.description,
      enabled: Boolean(result.enabled),
      createdBy: result.created_by,
      updatedBy: result.updated_by,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
  }

  private findSouthItemsByNorthTransformer(northTransformerId: string): Array<SouthConnectorItemEntityLight> {
    const query = `SELECT nt.id, nt.item_id, si.name, si.enabled, si.created_by, si.updated_by, si.created_at, si.updated_at FROM ${NORTH_TRANSFORMERS_ITEMS_TABLE} nt JOIN ${SOUTH_ITEMS_TABLE} si ON nt.item_id = si.id WHERE nt.id = ?;`;
    const results = this.database.prepare(query).all(northTransformerId) as Array<Record<string, string>>;
    return results.map(result => ({
      id: result.item_id as string,
      name: result.name as string,
      enabled: Boolean(result.enabled),
      createdBy: result.created_by,
      updatedBy: result.updated_by,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    }));
  }

  private toNorthConnectorLight(result: Record<string, string>): NorthConnectorEntityLight {
    return {
      id: result.id,
      name: result.name,
      type: result.type as OIBusNorthType,
      description: result.description,
      enabled: Boolean(result.enabled),
      createdBy: result.created_by,
      updatedBy: result.updated_by,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
  }

  private toNorthConnector(result: Record<string, string | number>): NorthConnectorEntity<NorthSettings> {
    return {
      id: result.id as string,
      name: result.name as string,
      type: result.type as OIBusNorthType,
      description: result.description as string,
      enabled: Boolean(result.enabled),
      settings: JSON.parse(result.settings as string) as NorthSettings,
      caching: {
        trigger: {
          scanMode: this.findScanModeForNorth(result.caching_trigger_schedule as string),
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
      transformers: this.findTransformersForNorth(result.id as string),
      createdBy: result.created_by as string,
      updatedBy: result.updated_by as string,
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string
    };
  }
}
