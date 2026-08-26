import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { NotFoundError } from '../../model/types';
import {
  SouthConnectorEntity,
  SouthConnectorEntityLight,
  SouthConnectorItemEntity,
  SouthItemGroupEntity,
  SouthItemGroupEntityLight
} from '../../model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import {
  OIBusSouthType,
  SouthCachingStrategy,
  SouthCachingThresholdType,
  SouthConnectorItemSearchParam,
  SouthHistoryRecoveryStrategy
} from '../../../shared/model/south-connector.model';
import { Page } from '../../../shared/model/types';
import { OIBusObjectAttribute } from '../../../shared/model/form.model';
import { ScanMode } from '../../model/scan-mode.model';
import { scanModeAliasedColumns, scanModeColumns, toScanMode, toScanModeFromPrefixedRow } from './scan-mode.repository';
import SouthItemGroupRepository from './south-item-group.repository';
import AuditService from '../../service/audit.service';
import { encryptionService } from '../../service/encryption.service';
import { southManifestList } from '../../service/south-manifests';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';
const NORTH_TRANSFORMERS_TABLE = 'north_transformers';
const NORTH_TRANSFORMERS_ITEMS_TABLE = 'north_transformers_items';
const SCAN_MODE_TABLE = 'scan_modes';
const GROUP_ITEMS_TABLE = 'group_items';
const SOUTH_ITEM_GROUPS_TABLE = 'south_item_groups';
const PAGE_SIZE = 50;

/**
 * SELECT clause and FROM clause shared by all item-fetching queries.
 * Using LEFT JOINs to resolve scan modes and groups in one round-trip.
 */
const ITEM_JOIN_SELECT =
  `SELECT si.id, si.name, si.enabled, si.scan_mode_id, si.settings, si.sync_with_group, ` +
  `si.max_read_interval, si.read_delay, si.start_time_offset, si.end_time_offset, si.recovery_strategy, ` +
  `si.caching_strategy, si.threshold_type, si.threshold, si.range_low, si.range_high, si.max_caching_interval, ` +
  `si.created_by_workflow_id, si.disabled_reason, ` +
  `si.created_by, si.updated_by, si.created_at, si.updated_at, ` +
  `${scanModeAliasedColumns('sm', 'sm_')}, ` +
  `g.id AS g_id, g.name AS g_name, g.start_time_offset AS g_start_time_offset, g.end_time_offset AS g_end_time_offset, g.max_read_interval AS g_max_read_interval, ` +
  `g.read_delay AS g_read_delay, g.recovery_strategy AS g_recovery_strategy, g.caching_strategy AS g_caching_strategy, ` +
  `g.created_by AS g_created_by, g.updated_by AS g_updated_by, ` +
  `g.created_at AS g_created_at, g.updated_at AS g_updated_at, ` +
  `${scanModeAliasedColumns('gsm', 'gsm_')}`;

const ITEM_JOIN_FROM =
  `FROM ${SOUTH_ITEMS_TABLE} si ` +
  `LEFT JOIN ${SCAN_MODE_TABLE} sm ON si.scan_mode_id = sm.id ` +
  `LEFT JOIN ${GROUP_ITEMS_TABLE} gi ON si.id = gi.item_id ` +
  `LEFT JOIN ${SOUTH_ITEM_GROUPS_TABLE} g ON gi.group_id = g.id ` +
  `LEFT JOIN ${SCAN_MODE_TABLE} gsm ON g.scan_mode_id = gsm.id`;

export default class SouthConnectorRepository {
  private groupRepository: SouthItemGroupRepository;

  constructor(
    private readonly database: Database,
    private readonly auditService: AuditService
  ) {
    this.groupRepository = new SouthItemGroupRepository(database, auditService);
  }

  findAllSouth(): Array<SouthConnectorEntityLight> {
    const query = `SELECT id, name, type, description, enabled, created_by, updated_by, created_at, updated_at FROM ${SOUTH_CONNECTORS_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => toSouthConnectorLight(result as Record<string, string>));
  }

  /**
   * Returns every south connector fully hydrated (settings, items, groups) in one call — for a
   * bulk read (e.g. config export) that would otherwise re-fetch each connector's base row one at a
   * time via `findSouthById`, mirroring `NorthConnectorRepository.findAllNorthFull`. Each
   * connector's items/groups are still fetched per-row inside `toSouthConnector` (same as north
   * still fetches transformers per-row) — only the redundant base-row re-fetch is eliminated here.
   */
  findAllSouthFull(): Array<SouthConnectorEntity<SouthSettings, SouthItemSettings>> {
    const query = `SELECT id, name, type, description, enabled, settings, created_by, updated_by, created_at, updated_at FROM ${SOUTH_CONNECTORS_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => this.toSouthConnector(result as Record<string, string | number>));
  }

  findSouthById(id: string): SouthConnectorEntity<SouthSettings, SouthItemSettings> | null {
    const query = `
        SELECT id, name, type, description, enabled, settings, created_by, updated_by, created_at, updated_at
        FROM ${SOUTH_CONNECTORS_TABLE}
        WHERE id = ?;`;

    const result = this.database.prepare(query).get(id);
    if (!result) {
      return null;
    }
    return this.toSouthConnector(result as Record<string, string | number>);
  }

  /**
   * Inserts or updates a south connector. Whether a given `south.id` is treated as "create" or
   * "update" is decided by whether a row for that id already exists — not merely by whether `id` is
   * set — so a caller (e.g. config import) can preserve a specific id for a brand-new row instead of
   * always getting a freshly generated one. Every normal caller only ever passes either no id (new
   * connector from the UI) or the id of a connector it just read back from this repository, so this
   * is not a behavior change for them.
   */
  saveSouth(south: SouthConnectorEntity<SouthSettings, SouthItemSettings>, isNewConnector: boolean): void {
    const beforeConnector = isNewConnector ? null : this.findSouthById(south.id);
    if (!isNewConnector && !beforeConnector) {
      // The caller believes this is an update of an existing connector, but a fresh check right
      // before writing shows it's gone — most likely deleted by another request during this
      // request's own (awaited) validation. Failing loudly here is the only thing standing between
      // that race and silently resurrecting a deleted connector: `isNewConnector` used to be inferred
      // from this same existence check, which made "doesn't exist" indistinguishable from "is
      // legitimately new" and took the CREATE branch below instead.
      throw new NotFoundError(`South connector "${south.id}" not found`);
    }
    const beforeItemsById = beforeConnector
      ? new Map(this.findAllItemsForSouth(south.id).map(i => [i.id, i]))
      : new Map<string, SouthConnectorItemEntity<SouthItemSettings>>();
    const transaction = this.database.transaction(() => {
      if (isNewConnector) {
        if (!south.id) {
          south.id = generateRandomId(6);
        }
        const insertQuery = `INSERT INTO ${SOUTH_CONNECTORS_TABLE} (id, name, type, description, enabled, settings, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));`;
        this.database
          .prepare(insertQuery)
          .run(
            south.id,
            south.name,
            south.type,
            south.description,
            +south.enabled,
            JSON.stringify(south.settings),
            south.createdBy,
            south.updatedBy
          );
      } else {
        const query = `UPDATE ${SOUTH_CONNECTORS_TABLE} SET name = ?, description = ?, enabled = ?, settings = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?;`;
        this.database
          .prepare(query)
          .run(south.name, south.description, +south.enabled, JSON.stringify(south.settings), south.updatedBy, south.id);
      }

      // Captured before any create/update below, so a group whose id was just preserved into a
      // freshly created row (import case, see below) is correctly excluded from the "update
      // existing" pass that follows.
      const existingGroupIds = new Set(this.findGroupBySouthId(south.id).map(group => group.id));

      // A group is "to create" if it has no id yet (brand-new from the UI, which always mints a
      // `temp_`-prefixed id client-side for a not-yet-persisted group), or if it carries an id that
      // does not correspond to any existing row — the latter is how config import preserves a
      // group's original id across a wipe+recreate instead of always minting a new one.
      const groupsToCreate = south.groups.filter(group => !group.id || group.id.startsWith('temp_') || !existingGroupIds.has(group.id));
      for (const groupToCreate of groupsToCreate) {
        const preservedId = groupToCreate.id && !groupToCreate.id.startsWith('temp_') ? groupToCreate.id : undefined;
        const newGroup = this.groupRepository.create(
          {
            name: groupToCreate.name,
            southId: south.id,
            scanMode: groupToCreate.scanMode,
            startTimeOffset: groupToCreate.startTimeOffset,
            endTimeOffset: groupToCreate.endTimeOffset,
            maxReadInterval: groupToCreate.maxReadInterval,
            readDelay: groupToCreate.readDelay,
            recoveryStrategy: groupToCreate.recoveryStrategy,
            cachingStrategy: groupToCreate.cachingStrategy
          },
          south.updatedBy,
          preservedId
        );
        for (const item of south.items) {
          if (item.group?.id === groupToCreate.id) {
            item.group.id = newGroup.id;
          }
        }
        south.groups[south.groups.findIndex(group => group.id === groupToCreate.id)] = newGroup;
      }

      // Update existing groups (name, scan mode, history settings may have changed via the connector edit form)
      for (const group of south.groups.filter(g => g.id && existingGroupIds.has(g.id))) {
        this.groupRepository.update(
          group.id,
          {
            name: group.name,
            scanMode: group.scanMode,
            startTimeOffset: group.startTimeOffset,
            endTimeOffset: group.endTimeOffset,
            maxReadInterval: group.maxReadInterval,
            readDelay: group.readDelay,
            recoveryStrategy: group.recoveryStrategy,
            cachingStrategy: group.cachingStrategy
          },
          south.updatedBy
        );
      }

      if (south.items.length > 0) {
        this.database
          .prepare(
            `DELETE FROM ${NORTH_TRANSFORMERS_ITEMS_TABLE}
                     WHERE id IN (
                       SELECT id FROM ${NORTH_TRANSFORMERS_TABLE} WHERE source_south_south_id = ?
                     ) AND item_id NOT IN (${south.items
                       .filter(item => item.id)
                       .map(() => '?')
                       .join(', ')});`
          )
          .run(
            south.id,
            south.items.filter(item => item.id).map(item => item.id)
          );

        this.database
          .prepare(
            `DELETE FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ? AND id NOT IN (${south.items
              .filter(item => item.id)
              .map(() => '?')
              .join(', ')});`
          )
          .run(
            south.id,
            south.items.filter(item => item.id).map(item => item.id)
          );

        const incomingItemIds = new Set(south.items.filter(item => item.id).map(item => item.id));
        for (const [removedItemId, removedItem] of beforeItemsById) {
          if (!incomingItemIds.has(removedItemId)) {
            this.auditService.record(
              'south_item',
              removedItemId,
              'DELETE',
              this.redactItem(removedItem, south.type),
              null,
              south.updatedBy
            );
          }
        }

        const insert = this.database.prepare(
          `INSERT INTO ${SOUTH_ITEMS_TABLE} (id, name, enabled, connector_id, scan_mode_id, settings, sync_with_group, max_read_interval, read_delay, start_time_offset, end_time_offset, recovery_strategy, caching_strategy, threshold_type, threshold, range_low, range_high, max_caching_interval, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));`
        );
        const update = this.database.prepare(
          `UPDATE ${SOUTH_ITEMS_TABLE} SET name = ?, enabled = ?, scan_mode_id = ?, settings = ?, sync_with_group = ?, max_read_interval = ?, read_delay = ?, start_time_offset = ?, end_time_offset = ?, recovery_strategy = ?, caching_strategy = ?, threshold_type = ?, threshold = ?, range_low = ?, range_high = ?, max_caching_interval = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?;`
        );
        const insertGroup = this.database.prepare(`INSERT INTO ${GROUP_ITEMS_TABLE} (group_id, item_id) VALUES (?, ?);`);
        const deleteGroups = this.database.prepare(`DELETE FROM ${GROUP_ITEMS_TABLE} WHERE item_id = ?;`);
        const existingItemsById = new Map(
          this.database
            .prepare<
              [string],
              {
                id: string;
                name: string;
                enabled: number;
                scan_mode_id: string | null;
                settings: string;
                sync_with_group: number;
                max_read_interval: number | null;
                read_delay: number | null;
                start_time_offset: number | null;
                end_time_offset: number | null;
                recovery_strategy: string | null;
                caching_strategy: string | null;
                threshold_type: string | null;
                threshold: number | null;
                range_low: number | null;
                range_high: number | null;
                max_caching_interval: number | null;
              }
            >(
              `SELECT id, name, enabled, scan_mode_id, settings, sync_with_group, max_read_interval, read_delay, start_time_offset, end_time_offset, recovery_strategy, caching_strategy, threshold_type, threshold, range_low, range_high, max_caching_interval FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ?;`
            )
            .all(south.id)
            .map(row => [row.id, row])
        );

        for (const item of south.items) {
          if (!item.id || !existingItemsById.has(item.id)) {
            if (!item.id) {
              item.id = generateRandomId(6);
            }
            insert.run(
              item.id,
              item.name,
              +item.enabled,
              south.id,
              item.scanMode?.id ?? null,
              JSON.stringify(item.settings),
              +item.syncWithGroup,
              item.maxReadInterval ?? null,
              item.readDelay ?? null,
              item.startTimeOffset ?? null,
              item.endTimeOffset ?? null,
              item.recoveryStrategy ?? null,
              item.cachingStrategy ?? null,
              item.thresholdType ?? null,
              item.threshold ?? null,
              item.rangeLow ?? null,
              item.rangeHigh ?? null,
              item.maxCachingInterval ?? null,
              item.createdBy,
              item.updatedBy
            );
            const created = this.findItemById(south.id, item.id);
            this.auditService.record('south_item', item.id, 'CREATE', null, this.redactItem(created, south.type), item.updatedBy);
          } else {
            const existing = existingItemsById.get(item.id);
            const hasChanged =
              !existing ||
              existing.name !== item.name ||
              existing.enabled !== +item.enabled ||
              existing.scan_mode_id !== (item.scanMode?.id ?? null) ||
              existing.settings !== JSON.stringify(item.settings) ||
              existing.sync_with_group !== +item.syncWithGroup ||
              existing.max_read_interval !== (item.maxReadInterval ?? null) ||
              existing.read_delay !== (item.readDelay ?? null) ||
              existing.start_time_offset !== (item.startTimeOffset ?? null) ||
              existing.end_time_offset !== (item.endTimeOffset ?? null) ||
              existing.recovery_strategy !== (item.recoveryStrategy ?? null) ||
              existing.caching_strategy !== (item.cachingStrategy ?? null) ||
              existing.threshold_type !== (item.thresholdType ?? null) ||
              existing.threshold !== (item.threshold ?? null) ||
              existing.range_low !== (item.rangeLow ?? null) ||
              existing.range_high !== (item.rangeHigh ?? null) ||
              existing.max_caching_interval !== (item.maxCachingInterval ?? null);
            if (hasChanged) {
              update.run(
                item.name,
                +item.enabled,
                item.scanMode?.id ?? null,
                JSON.stringify(item.settings),
                +item.syncWithGroup,
                item.maxReadInterval ?? null,
                item.readDelay ?? null,
                item.startTimeOffset ?? null,
                item.endTimeOffset ?? null,
                item.recoveryStrategy ?? null,
                item.cachingStrategy ?? null,
                item.thresholdType ?? null,
                item.threshold ?? null,
                item.rangeLow ?? null,
                item.rangeHigh ?? null,
                item.maxCachingInterval ?? null,
                item.updatedBy,
                item.id
              );
              const after = this.findItemById(south.id, item.id);
              this.auditService.record(
                'south_item',
                item.id,
                'UPDATE',
                this.redactItem(beforeItemsById.get(item.id) ?? null, south.type),
                this.redactItem(after, south.type),
                item.updatedBy
              );
            }
          }
          // Update groups
          deleteGroups.run(item.id);
          if (item.group) {
            insertGroup.run(item.group.id, item.id);
          }
        }
      } else {
        this.database
          .prepare(
            `DELETE FROM ${NORTH_TRANSFORMERS_ITEMS_TABLE}
                     WHERE id IN (
                       SELECT id FROM ${NORTH_TRANSFORMERS_TABLE} WHERE source_south_south_id = ?
                     );`
          )
          .run(south.id);
        this.database.prepare(`DELETE FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ?;`).run(south.id);
        for (const [removedItemId, removedItem] of beforeItemsById) {
          this.auditService.record('south_item', removedItemId, 'DELETE', this.redactItem(removedItem, south.type), null, south.updatedBy);
        }
      }

      const existingGroups = this.findGroupBySouthId(south.id);
      if (south.groups.length > 0) {
        const incomingGroupIds = new Set(south.groups.filter(group => group.id).map(group => group.id));
        const removedGroupIds = existingGroups.filter(group => !incomingGroupIds.has(group.id)).map(group => group.id);
        for (const removedGroupId of removedGroupIds) {
          this.groupRepository.delete(removedGroupId, south.updatedBy);
        }
      } else {
        for (const existingGroup of existingGroups) {
          this.groupRepository.delete(existingGroup.id, south.updatedBy);
        }
      }

      const afterConnector = this.findSouthById(south.id);
      this.auditService.record(
        'south_connector',
        south.id,
        isNewConnector ? 'CREATE' : 'UPDATE',
        this.redactConnector(beforeConnector),
        this.redactConnector(afterConnector),
        south.updatedBy
      );
    });
    transaction();
  }

  start(id: string): void {
    const query = `UPDATE ${SOUTH_CONNECTORS_TABLE} SET enabled = ? WHERE id = ?;`;
    this.database.prepare(query).run(1, id);
  }

  stop(id: string): void {
    const query = `UPDATE ${SOUTH_CONNECTORS_TABLE} SET enabled = ? WHERE id = ?;`;
    this.database.prepare(query).run(0, id);
  }

  deleteSouth(id: string, deletedBy: string): void {
    const before = this.findSouthById(id);
    const transaction = this.database.transaction(() => {
      this.database.prepare(`DELETE FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ?;`).run(id);
      this.database.prepare(`DELETE FROM ${NORTH_TRANSFORMERS_TABLE} WHERE source_south_south_id = ?;`).run(id);
      this.database.prepare(`DELETE FROM ${SOUTH_CONNECTORS_TABLE} WHERE id = ?;`).run(id);
      if (before) {
        for (const item of before.items) {
          this.auditService.record('south_item', item.id, 'DELETE', this.redactItem(item, before.type), null, deletedBy);
        }
        for (const group of before.groups) {
          this.auditService.record('south_item_group', group.id, 'DELETE', group as unknown as Record<string, unknown>, null, deletedBy);
        }
        this.auditService.record('south_connector', id, 'DELETE', this.redactConnector(before), null, deletedBy);
      }
    });
    transaction();
  }

  /**
   * Deletes a south item group. Items that belonged to it keep working afterwards: any of their own
   * scan mode / history settings (overlap, max read interval, read delay) left empty is filled in with
   * the value the item was inheriting from the group.
   */
  deleteGroupAndUpdateItems(southId: string, group: SouthItemGroupEntity, applyHistorySettings: boolean, deletedBy: string): void {
    const items = this.findAllItemsForSouth(southId).filter(item => item.group?.id === group.id);
    const transaction = this.database.transaction(() => {
      for (const item of items) {
        if (!item.scanMode) {
          item.scanMode = group.scanMode;
        }
        if (applyHistorySettings) {
          if (item.startTimeOffset == null) {
            item.startTimeOffset = group.startTimeOffset;
          }
          if (item.endTimeOffset == null) {
            item.endTimeOffset = group.endTimeOffset;
          }
          if (item.maxReadInterval == null) {
            item.maxReadInterval = group.maxReadInterval;
          }
          if (item.readDelay == null) {
            item.readDelay = group.readDelay;
          }
          if (item.recoveryStrategy == null) {
            item.recoveryStrategy = group.recoveryStrategy;
          }
          if (item.cachingStrategy == null) {
            item.cachingStrategy = group.cachingStrategy;
          }
        }
        item.syncWithGroup = false;
        item.group = null;
        this.saveItem(southId, item);
      }
      this.groupRepository.delete(group.id, deletedBy);
    });
    transaction();
  }

  listItems(
    southId: string,
    searchParams: Omit<SouthConnectorItemSearchParam, 'page'>
  ): Array<SouthConnectorItemEntity<SouthItemSettings>> {
    let whereClause = `WHERE si.connector_id = ?`;
    const queryParams = [southId];

    if (searchParams.scanModeId) {
      queryParams.push(searchParams.scanModeId);
      whereClause += ` AND si.scan_mode_id = ?`;
    }
    if (searchParams.enabled !== undefined) {
      queryParams.push(`${+searchParams.enabled}`);
      whereClause += ` AND si.enabled = ?`;
    }
    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND si.name like '%' || ? || '%'`;
    }
    const query = `${ITEM_JOIN_SELECT} ${ITEM_JOIN_FROM} ${whereClause};`;

    return this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => toItemEntityFromJoinedRow(result as Record<string, string | number | null>));
  }

  searchItems(southId: string, searchParams: SouthConnectorItemSearchParam): Page<SouthConnectorItemEntity<SouthItemSettings>> {
    let whereClause = `WHERE si.connector_id = ?`;
    let countWhereClause = `WHERE connector_id = ?`;
    const queryParams = [southId];

    const page = searchParams.page;

    if (searchParams.scanModeId) {
      queryParams.push(searchParams.scanModeId);
      whereClause += ` AND si.scan_mode_id = ?`;
      countWhereClause += ` AND scan_mode_id = ?`;
    }
    if (searchParams.enabled !== undefined) {
      queryParams.push(`${+searchParams.enabled}`);
      whereClause += ` AND si.enabled = ?`;
      countWhereClause += ` AND enabled = ?`;
    }
    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND si.name like '%' || ? || '%'`;
      countWhereClause += ` AND name like '%' || ? || '%'`;
    }
    const query = `${ITEM_JOIN_SELECT} ${ITEM_JOIN_FROM} ${whereClause} LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE * page};`;
    const results = this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => toItemEntityFromJoinedRow(result as Record<string, string | number | null>));
    const totalElements = (
      this.database.prepare(`SELECT COUNT(*) as count FROM ${SOUTH_ITEMS_TABLE} ${countWhereClause}`).get(...queryParams) as {
        count: number;
      }
    ).count;
    const totalPages = Math.ceil(totalElements / PAGE_SIZE);

    return {
      content: results,
      size: PAGE_SIZE,
      number: page,
      totalElements,
      totalPages
    };
  }

  findAllItemsForSouth(southId: string): Array<SouthConnectorItemEntity<SouthItemSettings>> {
    const query = `${ITEM_JOIN_SELECT} ${ITEM_JOIN_FROM} WHERE si.connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(southId)
      .map(result => toItemEntityFromJoinedRow(result as Record<string, string | number | null>));
  }

  findItemById(southConnectorId: string, itemId: string): SouthConnectorItemEntity<SouthItemSettings> | null {
    const query = `${ITEM_JOIN_SELECT} ${ITEM_JOIN_FROM} WHERE si.id = ? AND si.connector_id = ?;`;
    const result = this.database.prepare(query).get(itemId, southConnectorId);
    if (!result) return null;
    return toItemEntityFromJoinedRow(result as Record<string, string | number | null>);
  }

  saveItem(southConnectorId: string, southItem: SouthConnectorItemEntity<SouthItemSettings>): void {
    const wasNew = !southItem.id;
    const before = wasNew ? null : this.findItemById(southConnectorId, southItem.id);
    const southType = this.findSouthById(southConnectorId)?.type;
    if (!southItem.id) {
      southItem.id = generateRandomId(6);
      const insertQuery =
        `INSERT INTO ${SOUTH_ITEMS_TABLE} (id, name, enabled, connector_id, scan_mode_id, settings, sync_with_group, max_read_interval, read_delay, start_time_offset, end_time_offset, recovery_strategy, caching_strategy, threshold_type, threshold, range_low, range_high, max_caching_interval, created_by, updated_by, created_at, updated_at) ` +
        `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));`;
      this.database
        .prepare(insertQuery)
        .run(
          southItem.id,
          southItem.name,
          +southItem.enabled,
          southConnectorId,
          southItem.scanMode?.id ?? null,
          JSON.stringify(southItem.settings),
          +southItem.syncWithGroup,
          southItem.maxReadInterval ?? null,
          southItem.readDelay ?? null,
          southItem.startTimeOffset ?? null,
          southItem.endTimeOffset ?? null,
          southItem.recoveryStrategy ?? null,
          southItem.cachingStrategy ?? null,
          southItem.thresholdType ?? null,
          southItem.threshold ?? null,
          southItem.rangeLow ?? null,
          southItem.rangeHigh ?? null,
          southItem.maxCachingInterval ?? null,
          southItem.createdBy,
          southItem.updatedBy
        );
    } else {
      const query = `UPDATE ${SOUTH_ITEMS_TABLE} SET name = ?, enabled = ?, scan_mode_id = ?, settings = ?, sync_with_group = ?, max_read_interval = ?, read_delay = ?, start_time_offset = ?, end_time_offset = ?, recovery_strategy = ?, caching_strategy = ?, threshold_type = ?, threshold = ?, range_low = ?, range_high = ?, max_caching_interval = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?;`;
      this.database
        .prepare(query)
        .run(
          southItem.name,
          +southItem.enabled,
          southItem.scanMode?.id ?? null,
          JSON.stringify(southItem.settings),
          +southItem.syncWithGroup,
          southItem.maxReadInterval ?? null,
          southItem.readDelay ?? null,
          southItem.startTimeOffset ?? null,
          southItem.endTimeOffset ?? null,
          southItem.recoveryStrategy ?? null,
          southItem.cachingStrategy ?? null,
          southItem.thresholdType ?? null,
          southItem.threshold ?? null,
          southItem.rangeLow ?? null,
          southItem.rangeHigh ?? null,
          southItem.maxCachingInterval ?? null,
          southItem.updatedBy,
          southItem.id
        );
    }

    this.database.prepare(`DELETE FROM ${GROUP_ITEMS_TABLE} WHERE item_id = ?;`).run(southItem.id);
    if (southItem.group) {
      const insertGroup = this.database.prepare(`INSERT INTO ${GROUP_ITEMS_TABLE} (group_id, item_id) VALUES (?, ?);`);
      insertGroup.run(southItem.group.id, southItem.id);
    }

    const after = this.findItemById(southConnectorId, southItem.id);
    this.auditService.record(
      'south_item',
      southItem.id,
      wasNew ? 'CREATE' : 'UPDATE',
      southType ? this.redactItem(before, southType) : (before as unknown as Record<string, unknown> | null),
      southType ? this.redactItem(after, southType) : (after as unknown as Record<string, unknown>),
      southItem.updatedBy
    );
  }

  saveAllItems(
    southConnectorId: string,
    southItems: Array<SouthConnectorItemEntity<SouthItemSettings>>,
    deleteItemsNotPresent: boolean,
    deletedBy: string
  ): void {
    const transaction = this.database.transaction(() => {
      if (deleteItemsNotPresent) {
        this.deleteAllItemsBySouth(southConnectorId, deletedBy);
      }
      for (const item of southItems) {
        this.saveItem(southConnectorId, item);
      }
    });
    transaction();
  }

  deleteItem(southId: string, id: string, deletedBy: string): void {
    const before = this.findItemById(southId, id);
    const southType = this.findSouthById(southId)?.type;
    const transaction = this.database.transaction(() => {
      this.database
        .prepare(
          `DELETE FROM ${NORTH_TRANSFORMERS_ITEMS_TABLE}
                     WHERE id IN (
                       SELECT id FROM ${NORTH_TRANSFORMERS_TABLE} WHERE source_south_south_id = ?
                     ) AND item_id = ?;`
        )
        .run(southId, id);
      this.database.prepare(`DELETE FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ? AND id = ?;`).run(southId, id);
      if (before) {
        this.auditService.record(
          'south_item',
          id,
          'DELETE',
          southType ? this.redactItem(before, southType) : (before as unknown as Record<string, unknown>),
          null,
          deletedBy
        );
      }
    });
    transaction();
  }

  deleteAllItemsBySouth(southId: string, deletedBy: string): void {
    const beforeItems = this.findAllItemsForSouth(southId);
    const southType = this.findSouthById(southId)?.type;
    const transaction = this.database.transaction(() => {
      this.database
        .prepare(
          `DELETE FROM ${NORTH_TRANSFORMERS_ITEMS_TABLE}
         WHERE id IN (
           SELECT id FROM ${NORTH_TRANSFORMERS_TABLE} WHERE source_south_south_id = ?
         );`
        )
        .run(southId);
      this.database.prepare(`DELETE FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ?;`).run(southId);
      for (const item of beforeItems) {
        this.auditService.record(
          'south_item',
          item.id,
          'DELETE',
          southType ? this.redactItem(item, southType) : (item as unknown as Record<string, unknown>),
          null,
          deletedBy
        );
      }
    });
    transaction();
  }

  // Both clear disabled_reason: whatever workflow-diagnosed reason an item may have carried, a
  // person's own manual enable/disable is not that — see disableItemWithReason() below for the one
  // that sets it.
  enableItem(id: string): void {
    const query = `UPDATE ${SOUTH_ITEMS_TABLE} SET enabled = 1, disabled_reason = NULL WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  disableItem(id: string): void {
    const query = `UPDATE ${SOUTH_ITEMS_TABLE} SET enabled = 0, disabled_reason = NULL WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  /**
   * Claims ownership of an item for a self-scoping Configuration Workflow, right after the workflow
   * creates it — the only way `created_by_workflow_id` is ever set (never part of the normal item
   * create/update path).
   */
  claimItemForWorkflow(southConnectorId: string, itemId: string, workflowId: string, updatedBy: string): void {
    const southType = this.findSouthById(southConnectorId)?.type;
    const before = this.findItemById(southConnectorId, itemId);
    this.database
      .prepare(
        `UPDATE ${SOUTH_ITEMS_TABLE} SET created_by_workflow_id = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?;`
      )
      .run(workflowId, updatedBy, itemId);
    const after = this.findItemById(southConnectorId, itemId);
    this.auditService.record(
      'south_item',
      itemId,
      'UPDATE',
      southType ? this.redactItem(before, southType) : (before as unknown as Record<string, unknown> | null),
      southType ? this.redactItem(after, southType) : (after as unknown as Record<string, unknown> | null),
      updatedBy
    );
  }

  /**
   * Auto-disables an item because a Configuration Workflow's discovery no longer finds the entry it
   * corresponds to — distinct from a person's manual disableItem(), which leaves disabled_reason null
   * so the two are never confused.
   */
  disableItemWithReason(southConnectorId: string, itemId: string, reason: string, updatedBy: string): void {
    const southType = this.findSouthById(southConnectorId)?.type;
    const before = this.findItemById(southConnectorId, itemId);
    this.database
      .prepare(
        `UPDATE ${SOUTH_ITEMS_TABLE} SET enabled = 0, disabled_reason = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?;`
      )
      .run(reason, updatedBy, itemId);
    const after = this.findItemById(southConnectorId, itemId);
    this.auditService.record(
      'south_item',
      itemId,
      'UPDATE',
      southType ? this.redactItem(before, southType) : (before as unknown as Record<string, unknown> | null),
      southType ? this.redactItem(after, southType) : (after as unknown as Record<string, unknown> | null),
      updatedBy
    );
  }

  moveItemsToGroup(itemIds: Array<string>, groupId: string | null): void {
    const placeholders = itemIds.map(() => '?').join(', ');
    const transaction = this.database.transaction(() => {
      // Remove items from all groups (enforcing single-group behavior for "Move to")
      this.database.prepare(`DELETE FROM ${GROUP_ITEMS_TABLE} WHERE item_id IN (${placeholders});`).run(...itemIds);

      if (groupId && itemIds.length > 0) {
        // Also align the items' own scan_mode_id with the target group's: it stops driving scheduling
        // once sync_with_group is set (south-connector.ts prefers item.group.scanMode), but it remains
        // a real FK to scan_modes, so leaving it stale would silently block deleting the old scan mode.
        const group = this.groupRepository.findById(groupId);
        if (!group) {
          throw new Error(`South item group "${groupId}" not found`);
        }
        const insertGroup = this.database.prepare(`INSERT INTO ${GROUP_ITEMS_TABLE} (group_id, item_id) VALUES (?, ?);`);
        const setSyncWithGroup = this.database.prepare(
          `UPDATE ${SOUTH_ITEMS_TABLE} SET sync_with_group = 1, scan_mode_id = ? WHERE id = ?;`
        );
        for (const itemId of itemIds) {
          insertGroup.run(groupId, itemId);
          setSyncWithGroup.run(group.scanMode.id, itemId);
        }
      } else {
        // When removing from group, reset sync_with_group to false
        this.database.prepare(`UPDATE ${SOUTH_ITEMS_TABLE} SET sync_with_group = 0 WHERE id IN (${placeholders});`).run(...itemIds);
      }
    });
    transaction();
  }

  findScanModeForSouth(scanModeId: string): ScanMode {
    const query = `SELECT ${scanModeColumns()} FROM ${SCAN_MODE_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(scanModeId) as Record<string, string>;
    return toScanMode(result);
  }

  findGroupBySouthId(southId: string): Array<SouthItemGroupEntityLight> {
    const query =
      `SELECT g.id, g.created_at, g.updated_at, g.created_by, g.updated_by, g.name, ` +
      `g.scan_mode_id, g.start_time_offset, g.end_time_offset, g.max_read_interval, g.read_delay, g.recovery_strategy, g.caching_strategy, ` +
      `${scanModeAliasedColumns('s', 'sm_')} ` +
      `FROM ${SOUTH_ITEM_GROUPS_TABLE} g JOIN ${SCAN_MODE_TABLE} s ON g.scan_mode_id = s.id WHERE g.south_id = ? ORDER BY g.name;`;
    return this.database
      .prepare<[string], Record<string, string | number>>(query)
      .all(southId)
      .map(result => toSouthItemGroupLight(result));
  }

  /**
   * Returns a shallow copy of the south connector with its settings' secret fields redacted, using the
   * same manifest-driven filtering applied before exposing the connector to the frontend (see
   * toSouthConnectorDTO in south-connector-dto.utils.ts), so real secrets never end up persisted in the
   * audit trail.
   */
  private redactConnector(entity: SouthConnectorEntity<SouthSettings, SouthItemSettings> | null): Record<string, unknown> | null {
    if (!entity) return null;
    const manifest = southManifestList.find(element => element.id === entity.type);
    if (!manifest) return entity as unknown as Record<string, unknown>;
    return { ...entity, settings: encryptionService.filterSecrets(entity.settings, manifest.settings) };
  }

  /**
   * Returns a shallow copy of the south item with its settings' secret fields redacted, using the
   * same item-level manifest lookup as toSouthConnectorItemDTO in south-connector-dto.utils.ts.
   */
  private redactItem(entity: SouthConnectorItemEntity<SouthItemSettings> | null, southType: string): Record<string, unknown> | null {
    if (!entity) return null;
    const manifest = southManifestList.find(element => element.id === southType);
    if (!manifest) return entity as unknown as Record<string, unknown>;
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(attribute => attribute.key === 'settings') as
      OIBusObjectAttribute | undefined;
    if (!itemSettingsManifest) return entity as unknown as Record<string, unknown>;
    return { ...entity, settings: encryptionService.filterSecrets(entity.settings, itemSettingsManifest) };
  }

  private toSouthConnector(result: Record<string, string | number>): SouthConnectorEntity<SouthSettings, SouthItemSettings> {
    return {
      id: result.id as string,
      name: result.name as string,
      type: result.type as OIBusSouthType,
      description: result.description as string,
      enabled: Boolean(result.enabled),
      settings: JSON.parse(result.settings as string) as SouthSettings,
      items: this.findAllItemsForSouth(result.id as string),
      groups: this.findGroupBySouthId(result.id as string),
      createdBy: result.created_by as string,
      updatedBy: result.updated_by as string,
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string
    };
  }
}

/**
 * Converts a pre-joined query row (from ITEM_JOIN_SELECT + ITEM_JOIN_FROM) to a SouthConnectorItemEntity.
 * This is the single-trip replacement for the old N+1 toSouthConnectorItemEntity approach.
 */
export function toItemEntityFromJoinedRow(row: Record<string, string | number | null>): SouthConnectorItemEntity<SouthItemSettings> {
  const scanMode: ScanMode | null = row.sm_id ? toScanModeFromPrefixedRow(row, 'sm_') : null;

  const group: SouthItemGroupEntityLight | null = row.g_id
    ? {
        id: row.g_id as string,
        name: row.g_name as string,
        scanMode: toScanModeFromPrefixedRow(row, 'gsm_'),
        startTimeOffset: row.g_start_time_offset !== null && row.g_start_time_offset !== undefined ? Number(row.g_start_time_offset) : null,
        endTimeOffset: row.g_end_time_offset !== null && row.g_end_time_offset !== undefined ? Number(row.g_end_time_offset) : null,
        maxReadInterval: row.g_max_read_interval !== null && row.g_max_read_interval !== undefined ? Number(row.g_max_read_interval) : null,
        readDelay: row.g_read_delay !== null && row.g_read_delay !== undefined ? Number(row.g_read_delay) : null,
        recoveryStrategy: (row.g_recovery_strategy as SouthHistoryRecoveryStrategy) || null,
        cachingStrategy: (row.g_caching_strategy as SouthCachingStrategy) || null,
        createdBy: row.g_created_by as string,
        updatedBy: row.g_updated_by as string,
        createdAt: row.g_created_at as string,
        updatedAt: row.g_updated_at as string
      }
    : null;

  return {
    id: row.id as string,
    name: row.name as string,
    enabled: Boolean(row.enabled),
    scanMode,
    settings: JSON.parse(row.settings as string) as SouthItemSettings,
    group,
    syncWithGroup: Boolean(row.sync_with_group),
    maxReadInterval: row.max_read_interval !== null && row.max_read_interval !== undefined ? Number(row.max_read_interval) : null,
    readDelay: row.read_delay !== null && row.read_delay !== undefined ? Number(row.read_delay) : null,
    startTimeOffset: row.start_time_offset !== null && row.start_time_offset !== undefined ? Number(row.start_time_offset) : null,
    endTimeOffset: row.end_time_offset !== null && row.end_time_offset !== undefined ? Number(row.end_time_offset) : null,
    recoveryStrategy: (row.recovery_strategy as SouthHistoryRecoveryStrategy) || null,
    // cachingStrategy falls back to the group's value when the item is synced with its group, mirroring
    // the recovery_strategy / g_recovery_strategy group-prefixed column convention. The five params below
    // (thresholdType, threshold, rangeLow, rangeHigh, maxCachingInterval) are item-only and have no
    // group-prefixed counterpart, so they are mapped directly from the item's own row.
    cachingStrategy:
      row.sync_with_group && group
        ? (row.caching_strategy as SouthCachingStrategy) || group.cachingStrategy
        : (row.caching_strategy as SouthCachingStrategy) || null,
    thresholdType: (row.threshold_type as SouthCachingThresholdType) || null,
    threshold: row.threshold !== null && row.threshold !== undefined ? Number(row.threshold) : null,
    rangeLow: row.range_low !== null && row.range_low !== undefined ? Number(row.range_low) : null,
    rangeHigh: row.range_high !== null && row.range_high !== undefined ? Number(row.range_high) : null,
    maxCachingInterval:
      row.max_caching_interval !== null && row.max_caching_interval !== undefined ? Number(row.max_caching_interval) : null,
    createdBy: row.created_by as string,
    updatedBy: row.updated_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    createdByWorkflowId: (row.created_by_workflow_id as string | null) ?? null,
    disabledReason: (row.disabled_reason as string | null) ?? null
  };
}

export const toSouthConnectorLight = (result: Record<string, string>): SouthConnectorEntityLight => {
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
};

export const toSouthItemGroupLight = (result: Record<string, string | number>): SouthItemGroupEntityLight => {
  const scanMode: ScanMode = toScanModeFromPrefixedRow(result, 'sm_');
  return {
    id: result.id as string,
    name: result.name as string,
    scanMode,
    startTimeOffset:
      result.start_time_offset !== null && result.start_time_offset !== undefined ? (result.start_time_offset as number) : null,
    endTimeOffset: result.end_time_offset !== null && result.end_time_offset !== undefined ? (result.end_time_offset as number) : null,
    maxReadInterval:
      result.max_read_interval !== null && result.max_read_interval !== undefined ? (result.max_read_interval as number) : null,
    readDelay: (result.read_delay as number) || 0,
    recoveryStrategy: (result.recovery_strategy as SouthHistoryRecoveryStrategy) || null,
    cachingStrategy: (result.caching_strategy as SouthCachingStrategy) || null,
    createdBy: result.created_by as string,
    updatedBy: result.updated_by as string,
    createdAt: result.created_at as string,
    updatedAt: result.updated_at as string
  };
};
