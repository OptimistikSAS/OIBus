import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { SouthItemGroupCommand, SouthItemGroupEntity } from '../../model/south-connector.model';
import { ScanMode } from '../../model/scan-mode.model';

const SOUTH_ITEM_GROUPS_TABLE = 'south_item_groups';
const SOUTH_ITEMS_TABLE = 'south_items';
const GROUP_ITEMS_TABLE = 'group_items';
const SCAN_MODE_TABLE = 'scan_modes';

/**
 * Repository used for south item groups
 */
export default class SouthItemGroupRepository {
  constructor(private readonly database: Database) {}

  findById(id: string): SouthItemGroupEntity | null {
    const query =
      `SELECT g.id, g.created_at, g.updated_at, g.created_by, g.updated_by, g.name, g.south_id, ` +
      `g.scan_mode_id, g.overlap, g.max_read_interval, g.read_delay, s.id as scan_mode_id_full, ` +
      `s.name as scan_mode_name, s.description as scan_mode_description, s.cron as scan_mode_cron, ` +
      `s.created_at as scan_mode_created_at, s.updated_at as scan_mode_updated_at, s.created_by as scan_mode_created_by, s.updated_by as scan_mode_updated_by ` +
      `FROM ${SOUTH_ITEM_GROUPS_TABLE} g JOIN ${SCAN_MODE_TABLE} s ON g.scan_mode_id = s.id WHERE g.id = ?;`;
    const result = this.database.prepare<[string], Record<string, string | number> | undefined>(query).get(id);
    return result ? toSouthItemGroup(result, this.findAllItemsForGroup(result.id as string)) : null;
  }

  findBySouthId(southId: string): Array<SouthItemGroupEntity> {
    const query =
      `SELECT g.id, g.created_at, g.updated_at, g.created_by, g.updated_by, g.name, g.south_id, ` +
      `g.scan_mode_id, g.overlap, g.max_read_interval, g.read_delay, s.id as scan_mode_id_full, ` +
      `s.name as scan_mode_name, s.description as scan_mode_description, s.cron as scan_mode_cron, ` +
      `s.created_at as scan_mode_created_at, s.updated_at as scan_mode_updated_at, s.created_by as scan_mode_created_by, s.updated_by as scan_mode_updated_by ` +
      `FROM ${SOUTH_ITEM_GROUPS_TABLE} g JOIN scan_modes s ON g.scan_mode_id = s.id WHERE g.south_id = ? ORDER BY g.name;`;
    return this.database
      .prepare<[string], Record<string, string | number>>(query)
      .all(southId)
      .map(result => toSouthItemGroup(result, this.findAllItemsForGroup(result.id as string)));
  }

  findByNameAndSouthId(name: string, southId: string): SouthItemGroupEntity | null {
    const query =
      `SELECT g.id, g.created_at, g.updated_at, g.created_by, g.updated_by, g.name, g.south_id, ` +
      `g.scan_mode_id, g.overlap, g.max_read_interval, g.read_delay, s.id as scan_mode_id_full, ` +
      `s.name as scan_mode_name, s.description as scan_mode_description, s.cron as scan_mode_cron, ` +
      `s.created_at as scan_mode_created_at, s.updated_at as scan_mode_updated_at, s.created_by as scan_mode_created_by, s.updated_by as scan_mode_updated_by ` +
      `FROM ${SOUTH_ITEM_GROUPS_TABLE} g JOIN ${SCAN_MODE_TABLE} s ON g.scan_mode_id = s.id WHERE g.name = ? AND g.south_id = ?;`;
    const result = this.database.prepare(query).get(name, southId) as Record<string, string | number> | undefined;
    return result ? toSouthItemGroup(result, this.findAllItemsForGroup(result.id as string)) : null;
  }

  create(command: SouthItemGroupCommand, createdBy: string, id = generateRandomId(6)): SouthItemGroupEntity {
    const insertQuery = `INSERT INTO ${SOUTH_ITEM_GROUPS_TABLE} (id, name, south_id, scan_mode_id, overlap, max_read_interval, read_delay, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));`;
    this.database
      .prepare(insertQuery)
      .run(
        id,
        command.name,
        command.southId,
        command.scanMode.id,
        command.overlap ?? null,
        command.maxReadInterval ?? null,
        command.readDelay,
        createdBy,
        createdBy
      );
    const created = this.findById(id);
    if (!created) {
      throw new Error(`Failed to create south item group with id ${id}`);
    }
    return created;
  }

  update(id: string, command: Omit<SouthItemGroupCommand, 'southId'>, updatedBy: string): void {
    const query = `UPDATE ${SOUTH_ITEM_GROUPS_TABLE}
      SET name = ?, scan_mode_id = ?, overlap = ?, max_read_interval = ?, read_delay = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?;`;
    this.database
      .prepare(query)
      .run(command.name, command.scanMode.id, command.overlap ?? null, command.maxReadInterval ?? null, command.readDelay, updatedBy, id);
  }

  delete(id: string): void {
    // Delete the group (cascade in group_items is handled by foreign key)
    this.database.prepare(`DELETE FROM ${SOUTH_ITEM_GROUPS_TABLE} WHERE id = ?;`).run(id);
  }

  findAllItemsForGroup(groupId: string): Array<Record<string, string>> {
    const query = `SELECT si.id, si.name, si.enabled, si.created_by, si.updated_by, si.created_at, si.updated_at FROM ${GROUP_ITEMS_TABLE} gi JOIN ${SOUTH_ITEMS_TABLE} si ON si.id = gi.item_id  WHERE gi.group_id = ?;`;
    return this.database.prepare<[string], Record<string, string>>(query).all(groupId);
  }
}

export const toSouthItemGroup = (
  result: Record<string, string | number>,
  items: Array<Record<string, string | number>>
): SouthItemGroupEntity => {
  const scanMode: ScanMode = {
    id: result.scan_mode_id_full as string,
    name: result.scan_mode_name as string,
    description: result.scan_mode_description as string,
    cron: result.scan_mode_cron as string,
    createdBy: result.scan_mode_created_by as string,
    updatedBy: result.scan_mode_updated_by as string,
    createdAt: result.scan_mode_created_at as string,
    updatedAt: result.scan_mode_updated_at as string
  };
  return {
    id: result.id as string,
    name: result.name as string,
    southId: result.south_id as string,
    scanMode,
    overlap: result.overlap !== null && result.overlap !== undefined ? (result.overlap as number) : null,
    maxReadInterval:
      result.max_read_interval !== null && result.max_read_interval !== undefined ? (result.max_read_interval as number) : null,
    readDelay: (result.read_delay as number) || 0,
    createdBy: result.created_by as string,
    updatedBy: result.updated_by as string,
    createdAt: result.created_at as string,
    updatedAt: result.updated_at as string,
    items: items.map(item => ({
      id: item.id as string,
      name: item.name as string,
      enabled: Boolean(item.enabled),
      createdBy: item.created_by as string,
      updatedBy: item.updated_by as string,
      createdAt: item.created_at as string,
      updatedAt: item.updated_at as string
    }))
  };
};
