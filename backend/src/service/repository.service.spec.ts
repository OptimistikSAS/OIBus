import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { after, before, describe, it } from 'node:test';

import { migrateCrypto, migrateEntities, migrateLogs, migrateMetrics, migrateSouthCache } from '../migration/migration-service';
import RepositoryService from './repository.service';

const TEST_DB_PREFIX = 'src/tests/test-repo-service';
const CONFIG_DB = `${TEST_DB_PREFIX}-config.db`;
const LOG_DB = `${TEST_DB_PREFIX}-logs.db`;
const METRICS_DB = `${TEST_DB_PREFIX}-metrics.db`;
const CRYPTO_DB = `${TEST_DB_PREFIX}-crypto.db`;
const CACHE_DB = `${TEST_DB_PREFIX}-cache.db`;

/**
 * The UserRepository creates the default admin in the background (its password is hashed first): wait for it, otherwise
 * the databases are closed under it and the insert fails with "The database connection is not open".
 */
const waitForDefaultUser = async (service: RepositoryService) => {
  for (let attempt = 0; attempt < 500; attempt++) {
    if (service.userRepository.findByLogin('admin')) {
      return;
    }
    await setTimeout(10);
  }
  throw new Error('The default admin user was not created');
};

const cleanupDbs = async (prefix: string) => {
  for (const name of ['config', 'logs', 'metrics', 'crypto', 'cache']) {
    for (const ext of ['.db', '.db-wal', '.db-shm']) {
      await fs.rm(`${prefix}-${name}${ext}`, { force: true });
    }
  }
};

let repositoryService: RepositoryService;

describe('Repository service', () => {
  before(async () => {
    // Run migrations first so repository constructors find the required tables
    await Promise.all([
      migrateEntities(CONFIG_DB),
      migrateLogs(LOG_DB),
      migrateMetrics(METRICS_DB),
      migrateCrypto(CRYPTO_DB),
      migrateSouthCache(CACHE_DB)
    ]);
    repositoryService = new RepositoryService(CONFIG_DB, LOG_DB, METRICS_DB, CRYPTO_DB, CACHE_DB, '3.5.0');
    await waitForDefaultUser(repositoryService);
  });

  after(async () => {
    // Already closed when the close test ran: better-sqlite3 ignores closing a closed database
    repositoryService.close();
    await cleanupDbs(TEST_DB_PREFIX);
  });

  it('should properly initialize service', () => {
    assert.ok(repositoryService.engineRepository);
    assert.ok(repositoryService.cryptoRepository);
    assert.ok(repositoryService.ipFilterRepository);
    assert.ok(repositoryService.scanModeRepository);
    assert.ok(repositoryService.northConnectorRepository);
    assert.ok(repositoryService.northMetricsRepository);
    assert.ok(repositoryService.southConnectorRepository);
    assert.ok(repositoryService.southItemGroupRepository);
    assert.ok(repositoryService.configurationWorkflowRepository);
    assert.ok(repositoryService.workflowRunRepository);
    assert.ok(repositoryService.itemPointMetadataRepository);
    assert.ok(repositoryService.southMetricsRepository);
    assert.ok(repositoryService.historyQueryMetricsRepository);
    assert.ok(repositoryService.engineMetricsRepository);
    assert.ok(repositoryService.oianalyticsRegistrationRepository);
    assert.ok(repositoryService.southCacheRepository);
    assert.ok(repositoryService.logRepository);
    assert.ok(repositoryService.historyQueryRepository);
    assert.ok(repositoryService.userRepository);
    assert.ok(repositoryService.certificateRepository);
    assert.ok(repositoryService.oianalyticsCommandRepository);
    assert.ok(repositoryService.oianalyticsMessageRepository);
    assert.ok(repositoryService.transformerRepository);
    assert.ok(repositoryService.userRepository.findByLogin('admin'), 'the default admin user must be created');
  });

  it('should properly close', () => {
    assert.doesNotThrow(() => repositoryService.close());
  });
});
