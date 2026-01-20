import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { SouthItemGroupEntity } from '../../model/south-connector.model';
import { ScanMode } from '../../model/scan-mode.model';

const SOUTH_ITEM_GROUPS_TABLE = 'south_item_groups';

/**
 * Repository used for south item groups
 */
export default class SouthItemGroupRepository {
  constructor(private readonly database: Database) {}

  findById(id: string): SouthItemGroupEntity | null {
    const query = `SELECT
      g.id,
      g.created_at,
      g.updated_at,
      g.name,
      g.south_id,
      g.scan_mode_id,
      g.share_tracked_instant,
      g.overlap,
      s.id as scan_mode_id_full,
      s.name as scan_mode_name,
      s.description as scan_mode_description,
      s.cron as scan_mode_cron
    FROM ${SOUTH_ITEM_GROUPS_TABLE} g
    JOIN scan_modes s ON g.scan_mode_id = s.id
    WHERE g.id = ?;`;
    const result = this.database.prepare(query).get(id) as Record<string, string | number> | undefined;
    return result ? toSouthItemGroup(result) : null;
  }

  findBySouthId(southId: string): Array<SouthItemGroupEntity> {
    const query = `SELECT
      g.id,
      g.created_at,
      g.updated_at,
      g.name,
      g.south_id,
      g.scan_mode_id,
      g.share_tracked_instant,
      g.overlap,
      s.id as scan_mode_id_full,
      s.name as scan_mode_name,
      s.description as scan_mode_description,
      s.cron as scan_mode_cron
    FROM ${SOUTH_ITEM_GROUPS_TABLE} g
    JOIN scan_modes s ON g.scan_mode_id = s.id
    WHERE g.south_id = ?
    ORDER BY g.name;`;
    return this.database
      .prepare(query)
      .all(southId)
      .map(result => toSouthItemGroup(result as Record<string, string | number>));
  }

  create(command: Omit<SouthItemGroupEntity, 'id' | 'created_at' | 'updated_at'>, id = generateRandomId(6)): SouthItemGroupEntity {
    const insertQuery = `INSERT INTO ${SOUTH_ITEM_GROUPS_TABLE} (id, name, south_id, scan_mode_id, share_tracked_instant, overlap) VALUES (?, ?, ?, ?, ?, ?);`;
    this.database
      .prepare(insertQuery)
      .run(id, command.name, command.southId, command.scanMode.id, +command.shareTrackedInstant, command.overlap ?? null);
    const created = this.findById(id);
    if (!created) {
      throw new Error(`Failed to create south item group with id ${id}`);
    }
    return created;
  }

  update(id: string, command: Omit<SouthItemGroupEntity, 'id' | 'created_at' | 'updated_at' | 'southId'>): void {
    const query = `UPDATE ${SOUTH_ITEM_GROUPS_TABLE}
      SET name = ?, scan_mode_id = ?, share_tracked_instant = ?, overlap = ?, updated_at = datetime('now')
      WHERE id = ?;`;
    this.database.prepare(query).run(command.name, command.scanMode.id, +command.shareTrackedInstant, command.overlap ?? null, id);
  }

  delete(id: string): void {
    // Delete the group (cascade in group_items is handled by foreign key)
    this.database.prepare(`DELETE FROM ${SOUTH_ITEM_GROUPS_TABLE} WHERE id = ?;`).run(id);
  }
}

export const toSouthItemGroup = (result: Record<string, string | number>): SouthItemGroupEntity => {
  const scanMode: ScanMode = {
    id: result.scan_mode_id_full as string,
    name: result.scan_mode_name as string,
    description: result.scan_mode_description as string,
    cron: result.scan_mode_cron as string
  };
  return {
    id: result.id as string,
    name: result.name as string,
    southId: result.south_id as string,
    scanMode,
    shareTrackedInstant: Boolean(result.share_tracked_instant),
    overlap: result.overlap !== null && result.overlap !== undefined ? (result.overlap as number) : null
  };
};
