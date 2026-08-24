import { DateTime } from 'luxon';
import AuditRepository from '../repository/config/audit.repository';
import EngineRepository from '../repository/config/engine.repository';

const CLEAN_UP_INTERVAL = 3600 * 1000; // Every hour, matching CleanupService's cadence

/**
 * Prunes audit log rows older than the configured retention duration (in days), on an hourly
 * interval. A `null`/`0`/negative retention duration means "keep forever" and disables pruning.
 */
export default class AuditCleanupService {
  private cleanUpInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly auditRepository: AuditRepository,
    private readonly engineRepository: EngineRepository
  ) {}

  start(): Promise<void> {
    this.cleanup();
    this.stop();
    this.cleanUpInterval = setInterval(this.cleanup.bind(this), CLEAN_UP_INTERVAL);
    return Promise.resolve();
  }

  stop(): void {
    if (this.cleanUpInterval) {
      clearInterval(this.cleanUpInterval);
      this.cleanUpInterval = null;
    }
  }

  cleanup(): void {
    const settings = this.engineRepository.get();
    const retentionDays = settings?.auditRetentionDuration;
    if (!retentionDays || retentionDays <= 0) {
      return;
    }
    const cutoff = DateTime.now().minus({ days: retentionDays }).toUTC().toISO()!;
    this.auditRepository.deleteOlderThan(cutoff);
  }
}
