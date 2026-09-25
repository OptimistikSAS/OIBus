/**
 * Generates the config-transfer fixture of an OIBus version (see `config-transfer-fixture.ts`): run it
 * when releasing that version, from its own code, and commit the result.
 *
 *   npm run generate:config-transfer-fixture [-- <version>]   (defaults to the package.json version)
 *
 * The reference database is the shared test fixture (`testData`) plus what it lacks (south item groups,
 * configuration workflows), so it covers every entity the export carries.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAuditServiceMock, initDatabase } from '../utils/test-utils';
import testData from '../utils/test-data';
import { dumpSqliteDatabase } from '../utils/sqlite-dump';
import { CONFIG_TRANSFER_FIXTURES_DIR, exportConfigDatabase } from './config-transfer-fixture';
import ConfigurationWorkflowRepository from '../../repository/config/configuration-workflow.repository';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthItemGroupRepository from '../../repository/config/south-item-group.repository';
import { version as packageVersion } from '../../../package.json';
import { Database } from 'better-sqlite3';

function seedMissingEntities(database: Database): void {
  const auditService = createAuditServiceMock();
  const workflowRepository = new ConfigurationWorkflowRepository(database, auditService);
  const southRepository = new SouthConnectorRepository(database, auditService);
  const [firstSouth, secondSouth] = testData.south.list;

  const group = new SouthItemGroupRepository(database, auditService).create(
    {
      name: 'Fixture group',
      southId: firstSouth.id,
      scanMode: testData.scanMode.list[0],
      startTimeOffset: 0,
      endTimeOffset: 0,
      maxReadInterval: 3600,
      readDelay: 200,
      recoveryStrategy: 'oldest',
      cachingStrategy: 'allValues'
    },
    'fixture',
    'fixtureGroup'
  );
  southRepository.moveItemsToGroup([firstSouth.items[1].id], group.id);

  const local = workflowRepository.create(
    {
      name: 'Local discovery',
      southId: firstSouth.id,
      discoveryScope: { rootNodeId: 'ns=1;s=Root' },
      identityKeyFields: ['nodeId'],
      eligibilityFilter: [{ field: 'type', operator: 'equals', value: 'Variable' }],
      itemFieldMapping: { name: '{{name}}', 'settings.nodeId': '{{nodeId}}' },
      pushToOIAnalytics: false,
      scanMode: testData.scanMode.list[0],
      enabled: true
    },
    'fixture',
    'fixtureLocalWorkflow'
  );
  southRepository.claimItemForWorkflow(firstSouth.id, firstSouth.items[0].id, local.id, 'fixture');
  southRepository.disableItemWithReason(firstSouth.id, firstSouth.items[0].id, 'Not found by the last discovery', 'fixture');

  workflowRepository.create(
    {
      name: 'Remote discovery',
      southId: secondSouth.id,
      discoveryScope: { query: 'SELECT tag_name, unit FROM tags' },
      identityKeyFields: [],
      eligibilityFilter: [],
      itemFieldMapping: null,
      pushToOIAnalytics: true,
      scanMode: null,
      enabled: false
    },
    'fixture',
    'fixtureRemoteWorkflow'
  );
}

async function generate(version: string): Promise<void> {
  const databasePath = path.join(os.tmpdir(), `oibus-config-transfer-fixture-${version}.db`);
  const database = await initDatabase('config', true, databasePath);
  try {
    seedMissingEntities(database);
    const outputDir = path.join(CONFIG_TRANSFER_FIXTURES_DIR, version);
    fs.mkdirSync(outputDir, { recursive: true });
    // Exported before dumping, so the dump also holds whatever the repositories seed on construction
    // (e.g. missing standard transformers), exactly as the export saw it
    const exported = exportConfigDatabase(database, version);
    fs.writeFileSync(path.join(outputDir, 'oibus.sql'), dumpSqliteDatabase(database));
    fs.writeFileSync(path.join(outputDir, 'export.json'), `${JSON.stringify(exported, null, 2)}\n`);
    console.info(`Config-transfer fixture of OIBus ${version} written to ${outputDir}`);
  } finally {
    database.close();
    fs.rmSync(databasePath, { force: true });
  }
}

generate(process.argv[2] ?? packageVersion).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
