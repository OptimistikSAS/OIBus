import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import testData from '../tests/utils/test-data';
import AuditCleanupService from './audit-cleanup.service';
import AuditRepositoryMock from '../tests/__mocks__/repository/config/audit-repository.mock';
import EngineRepositoryMock from '../tests/__mocks__/repository/config/engine-repository.mock';
import { EngineSettings } from '../model/engine.model';

describe('AuditCleanupService', () => {
  let service: AuditCleanupService;
  let auditRepository: AuditRepositoryMock;
  let engineRepository: EngineRepositoryMock;

  beforeEach(() => {
    auditRepository = new AuditRepositoryMock();
    engineRepository = new EngineRepositoryMock();

    mock.timers.enable({ apis: ['Date', 'setInterval'], now: new Date(testData.constants.dates.FAKE_NOW).getTime() });

    service = new AuditCleanupService(auditRepository, engineRepository);
  });

  afterEach(() => {
    mock.restoreAll();
    mock.timers.reset();
  });

  describe('cleanup()', () => {
    it('should do nothing when engine settings are missing', () => {
      engineRepository.get.mock.mockImplementationOnce(() => null);

      service.cleanup();

      assert.strictEqual(auditRepository.deleteOlderThan.mock.calls.length, 0);
    });

    it('should do nothing when auditRetentionDuration is null', () => {
      engineRepository.get.mock.mockImplementationOnce(
        () => ({ ...testData.engine.settings, auditRetentionDuration: null }) as EngineSettings
      );

      service.cleanup();

      assert.strictEqual(auditRepository.deleteOlderThan.mock.calls.length, 0);
    });

    it('should do nothing when auditRetentionDuration is 0', () => {
      engineRepository.get.mock.mockImplementationOnce(
        () => ({ ...testData.engine.settings, auditRetentionDuration: 0 }) as EngineSettings
      );

      service.cleanup();

      assert.strictEqual(auditRepository.deleteOlderThan.mock.calls.length, 0);
    });

    it('should do nothing when auditRetentionDuration is negative', () => {
      engineRepository.get.mock.mockImplementationOnce(
        () => ({ ...testData.engine.settings, auditRetentionDuration: -1 }) as EngineSettings
      );

      service.cleanup();

      assert.strictEqual(auditRepository.deleteOlderThan.mock.calls.length, 0);
    });

    it('should prune audit logs older than the configured retention duration', () => {
      engineRepository.get.mock.mockImplementationOnce(
        () => ({ ...testData.engine.settings, auditRetentionDuration: 90 }) as EngineSettings
      );

      service.cleanup();

      assert.strictEqual(auditRepository.deleteOlderThan.mock.calls.length, 1);
      const expectedCutoff = DateTime.now().minus({ days: 90 }).toUTC().toISO();
      assert.strictEqual(auditRepository.deleteOlderThan.mock.calls[0].arguments[0], expectedCutoff);
    });
  });

  describe('start()/stop()', () => {
    it('should run cleanup immediately and on each interval tick', async () => {
      const cleanupSpy = mock.method(service, 'cleanup', () => undefined);
      const clearIntervalSpy = mock.method(global, 'clearInterval', mock.fn());

      await service.start();
      assert.strictEqual(cleanupSpy.mock.calls.length, 1);

      mock.timers.tick(3600 * 1000);
      assert.strictEqual(cleanupSpy.mock.calls.length, 2);

      mock.timers.tick(3600 * 1000);
      assert.strictEqual(cleanupSpy.mock.calls.length, 3);

      service.stop();
      assert.strictEqual(clearIntervalSpy.mock.calls.length, 1);
    });

    it('should be a no-op when stop() is called twice', async () => {
      const cleanupSpy = mock.method(service, 'cleanup', () => undefined);

      await service.start();
      assert.strictEqual(cleanupSpy.mock.calls.length, 1);

      service.stop();
      service.stop();

      mock.timers.tick(3600 * 1000);
      // interval was cleared, so cleanup should not run again
      assert.strictEqual(cleanupSpy.mock.calls.length, 1);
    });

    it('should restart the interval cleanly when start() is called again', async () => {
      const cleanupSpy = mock.method(service, 'cleanup', () => undefined);

      await service.start();
      await service.start();

      mock.timers.tick(3600 * 1000);
      // Only one interval should be active: 2 immediate runs (one per start()) + 1 tick
      assert.strictEqual(cleanupSpy.mock.calls.length, 3);

      service.stop();
    });
  });
});
