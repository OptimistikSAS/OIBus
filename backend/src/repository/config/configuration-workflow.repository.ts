import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { ConfigurationWorkflowCommand, ConfigurationWorkflowEntity } from '../../model/configuration-workflow.model';
import { scanModeAliasedColumns, toScanModeFromPrefixedRow } from './scan-mode.repository';
import AuditService from '../../service/audit.service';

const CONFIGURATION_WORKFLOWS_TABLE = 'configuration_workflows';
const SCAN_MODE_TABLE = 'scan_modes';

const SELECT_COLUMNS =
  'w.id, w.created_at, w.updated_at, w.created_by, w.updated_by, w.south_id, w.target_item_id, ' +
  'w.discovery_scope, w.identity_key_fields, w.eligibility_filter, w.item_field_mapping, w.remote_field_mapping, ' +
  'w.scan_mode_id, w.enabled';

/**
 * Repository used for Configuration Workflows
 */
export default class ConfigurationWorkflowRepository {
  constructor(
    private readonly database: Database,
    private readonly auditService: AuditService
  ) {}

  findById(id: string): ConfigurationWorkflowEntity | null {
    const query =
      `SELECT ${SELECT_COLUMNS}, ${scanModeAliasedColumns('s', 'sm_')} ` +
      `FROM ${CONFIGURATION_WORKFLOWS_TABLE} w LEFT JOIN ${SCAN_MODE_TABLE} s ON w.scan_mode_id = s.id WHERE w.id = ?;`;
    const result = this.database.prepare(query).get(id) as Record<string, unknown> | undefined;
    return result ? toConfigurationWorkflow(result) : null;
  }

  findBySouthId(southId: string): Array<ConfigurationWorkflowEntity> {
    const query =
      `SELECT ${SELECT_COLUMNS}, ${scanModeAliasedColumns('s', 'sm_')} ` +
      `FROM ${CONFIGURATION_WORKFLOWS_TABLE} w LEFT JOIN ${SCAN_MODE_TABLE} s ON w.scan_mode_id = s.id ` +
      `WHERE w.south_id = ? ORDER BY w.created_at;`;
    return this.database
      .prepare(query)
      .all(southId)
      .map(result => toConfigurationWorkflow(result as Record<string, unknown>));
  }

  create(command: ConfigurationWorkflowCommand, createdBy: string, id = generateRandomId(6)): ConfigurationWorkflowEntity {
    const insertQuery =
      `INSERT INTO ${CONFIGURATION_WORKFLOWS_TABLE} ` +
      `(id, south_id, target_item_id, discovery_scope, identity_key_fields, eligibility_filter, item_field_mapping, ` +
      `remote_field_mapping, scan_mode_id, enabled, created_by, updated_by, created_at, updated_at) ` +
      `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));`;
    this.database
      .prepare(insertQuery)
      .run(
        id,
        command.southId,
        command.targetItemId,
        JSON.stringify(command.discoveryScope),
        JSON.stringify(command.identityKeyFields),
        JSON.stringify(command.eligibilityFilter),
        command.itemFieldMapping !== null ? JSON.stringify(command.itemFieldMapping) : null,
        command.remoteFieldMapping !== null ? JSON.stringify(command.remoteFieldMapping) : null,
        command.scanMode?.id ?? null,
        +command.enabled,
        createdBy,
        createdBy
      );
    const created = this.findById(id);
    if (!created) {
      throw new Error(`Failed to create configuration workflow with id ${id}`);
    }
    this.auditService.record(
      'configuration_workflow',
      created.id,
      'CREATE',
      null,
      created as unknown as Record<string, unknown>,
      createdBy
    );
    return created;
  }

  update(id: string, command: Omit<ConfigurationWorkflowCommand, 'southId'>, updatedBy: string): void {
    const before = this.findById(id);
    const query =
      `UPDATE ${CONFIGURATION_WORKFLOWS_TABLE} ` +
      `SET target_item_id = ?, discovery_scope = ?, identity_key_fields = ?, eligibility_filter = ?, item_field_mapping = ?, ` +
      `remote_field_mapping = ?, scan_mode_id = ?, enabled = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ` +
      `WHERE id = ?;`;
    this.database
      .prepare(query)
      .run(
        command.targetItemId,
        JSON.stringify(command.discoveryScope),
        JSON.stringify(command.identityKeyFields),
        JSON.stringify(command.eligibilityFilter),
        command.itemFieldMapping !== null ? JSON.stringify(command.itemFieldMapping) : null,
        command.remoteFieldMapping !== null ? JSON.stringify(command.remoteFieldMapping) : null,
        command.scanMode?.id ?? null,
        +command.enabled,
        updatedBy,
        id
      );
    const after = this.findById(id);
    this.auditService.record(
      'configuration_workflow',
      id,
      'UPDATE',
      before as unknown as Record<string, unknown> | null,
      after as unknown as Record<string, unknown>,
      updatedBy
    );
  }

  delete(id: string, deletedBy: string): void {
    const before = this.findById(id);
    // Cascades to workflow_runs/item_point_metadata (added in a later migration) via foreign key.
    this.database.prepare(`DELETE FROM ${CONFIGURATION_WORKFLOWS_TABLE} WHERE id = ?;`).run(id);
    if (before) {
      this.auditService.record('configuration_workflow', id, 'DELETE', before as unknown as Record<string, unknown>, null, deletedBy);
    }
  }
}

export const toConfigurationWorkflow = (result: Record<string, unknown>): ConfigurationWorkflowEntity => ({
  id: result.id as string,
  southId: result.south_id as string,
  targetItemId: (result.target_item_id as string | null) ?? null,
  discoveryScope: JSON.parse(result.discovery_scope as string),
  identityKeyFields: JSON.parse(result.identity_key_fields as string),
  eligibilityFilter: JSON.parse(result.eligibility_filter as string),
  itemFieldMapping: result.item_field_mapping !== null ? JSON.parse(result.item_field_mapping as string) : null,
  remoteFieldMapping: result.remote_field_mapping !== null ? JSON.parse(result.remote_field_mapping as string) : null,
  scanMode: result.scan_mode_id != null ? toScanModeFromPrefixedRow(result, 'sm_') : null,
  enabled: Boolean(result.enabled),
  createdBy: result.created_by as string,
  updatedBy: result.updated_by as string,
  createdAt: result.created_at as string,
  updatedAt: result.updated_at as string
});
