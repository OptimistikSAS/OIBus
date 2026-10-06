import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import Database from 'better-sqlite3';

import { ConfigExportDTO, OIBusConfigurationDTO } from '../../../../shared/model/oia/config-transfer.model';

import { migrateEntities } from '../../../migration/migration-service';
import {
  CONFIG_TRANSFER_FIXTURES_DIR,
  exportConfigDatabase,
  importedPart
} from '../../../tests/config-transfer-fixtures/config-transfer-fixture';
import { loadSqliteDump } from '../../../tests/utils/sqlite-dump';
import { CONFIG_SCHEMA } from '../config-schema';
import { JsonObject } from './config-upgrade';
import { getUpgradesBetween } from './registry';

const fixtureVersions = fs
  .readdirSync(CONFIG_TRANSFER_FIXTURES_DIR, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name);

/**
 * Version the fixtures are upgraded and migrated to, pinned independently of `package.json` (only bumped by
 * release-please at release time). It must not be older than the newest config upgrade step.
 */
const currentVersion = '3.11.0';

/**
 * Uses the entity migrations as the reference for the config upgrade chain. For every frozen fixture
 * of a past version (see `config-transfer-fixture.ts`):
 *  - expected: its database, migrated to the current version, then exported with the current code
 *  - actual: its export, brought to the current version by the config upgrade chain
 * Both must be the same configuration. A migration changing configuration data without an equivalent
 * config upgrade step (or a step doing something else than its migration) fails here.
 */
describe('Config upgrades against entity migrations', () => {
  it('has at least one fixture', () => {
    assert.ok(fixtureVersions.length > 0, `expected fixtures in ${CONFIG_TRANSFER_FIXTURES_DIR}`);
  });

  for (const fixtureVersion of fixtureVersions) {
    describe(`from OIBus ${fixtureVersion}`, () => {
      const fixtureDir = path.join(CONFIG_TRANSFER_FIXTURES_DIR, fixtureVersion);
      const databasePath = path.resolve(`src/tests/test-config-transfer-differential-${fixtureVersion}.db`);
      let expected: OIBusConfigurationDTO;
      let actual: OIBusConfigurationDTO;
      let exported: ConfigExportDTO;

      before(async () => {
        fs.rmSync(databasePath, { force: true });
        loadSqliteDump(databasePath, fs.readFileSync(path.join(fixtureDir, 'oibus.sql'), 'utf-8'));
        await migrateEntities(databasePath);
        const database = new Database(databasePath);
        try {
          // Round-tripped through JSON like a real file, which drops `undefined` values
          expected = JSON.parse(JSON.stringify(exportConfigDatabase(database, currentVersion).config));
        } finally {
          database.close();
        }

        exported = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'export.json'), 'utf-8'));
        let config = structuredClone(exported.config) as unknown as JsonObject;
        for (const upgrade of getUpgradesBetween(exported.oibusVersion, currentVersion)) {
          config = upgrade.apply(config);
        }
        actual = config as unknown as OIBusConfigurationDTO;
      });

      after(() => {
        fs.rmSync(databasePath, { force: true });
      });

      it('is a fixture of the version it is named after', () => {
        assert.strictEqual(exported.oibusVersion, fixtureVersion);
      });

      it('upgrades the export to the current configuration shape', () => {
        const { error } = CONFIG_SCHEMA.validate(actual, { abortEarly: false, allowUnknown: true });
        assert.deepStrictEqual(
          error?.details.map(detail => detail.message),
          undefined,
          'the upgraded export does not match the current configuration schema: a config upgrade step is missing'
        );
      });

      it('upgrades the export to what the migrations bring its database to', () => {
        assert.deepStrictEqual(
          importedPart(actual).config,
          importedPart(expected).config,
          'the upgraded export differs from the migrated database: a config upgrade step is missing or differs from its migration'
        );
      });

      it('keeps every standard transformer it references', () => {
        const available = importedPart(expected).standardTransformers;
        for (const transformer of importedPart(actual).standardTransformers) {
          assert.ok(
            available.some(candidate => candidate.functionName === transformer.functionName),
            `standard transformer "${transformer.functionName}" does not exist anymore`
          );
        }
      });
    });
  }
});
