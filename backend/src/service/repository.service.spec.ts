import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { setImmediate } from 'node:timers';
import RepositoryService from './repository.service';
import { migrateEntities, migrateLogs, migrateMetrics, migrateCrypto, migrateSouthCache } from '../migration/migration-service';

const TEST_DB_PREFIX = 'src/tests/test-repo-service';
const CONFIG_DB = `${TEST_DB_PREFIX}-config.db`;
const LOG_DB = `${TEST_DB_PREFIX}-logs.db`;
const METRICS_DB = `${TEST_DB_PREFIX}-metrics.db`;
const CRYPTO_DB = `${TEST_DB_PREFIX}-crypto.db`;
const CACHE_DB = `${TEST_DB_PREFIX}-cache.db`;

const flushPromises = () => new Promise(setImmediate);

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
    // Let async operations (e.g. UserRepository default admin creation) complete
    await flushPromises();
  });

  after(async () => {
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
  });

  it('should properly close', async () => {
    const closePrefix = `${TEST_DB_PREFIX}-close`;
    await Promise.all([
      migrateEntities(`${closePrefix}-config.db`),
      migrateLogs(`${closePrefix}-logs.db`),
      migrateMetrics(`${closePrefix}-metrics.db`),
      migrateCrypto(`${closePrefix}-crypto.db`),
      migrateSouthCache(`${closePrefix}-cache.db`)
    ]);
    const rs = new RepositoryService(
      `${closePrefix}-config.db`,
      `${closePrefix}-logs.db`,
      `${closePrefix}-metrics.db`,
      `${closePrefix}-crypto.db`,
      `${closePrefix}-cache.db`,
      '3.5.0'
    );
    await flushPromises();
    assert.doesNotThrow(() => rs.close());
    await cleanupDbs(closePrefix);
  });
});
