import { SettingsUpgradeEntry } from '../registry';

/**
 * The OPC UA south settings gained a required maxParallelRun field (how many HA node reads can
 * run concurrently). Existing connectors/history queries never had it, so it's backfilled to 1 —
 * a single sequential read at a time, matching the behavior before this setting existed.
 *
 * Shared with the entity migration that backfills the same field for existing installs
 * (`backend/src/migration/entity-migrations/3/3.9/v3.9.0_1.ts`), so the exported settings shape
 * an import upgrades to always matches what a freshly-migrated db would already contain.
 */
export function addOpcuaMaxParallelRun(settings: Record<string, unknown>): Record<string, unknown> {
  return { ...settings, maxParallelRun: 1 };
}

export const opcuaMaxParallelRunUpgrades: Array<SettingsUpgradeEntry> = [
  { version: '3.9.0', scope: 'south:opcua', apply: addOpcuaMaxParallelRun },
  { version: '3.9.0', scope: 'historyQuerySouth:opcua', apply: addOpcuaMaxParallelRun }
];
