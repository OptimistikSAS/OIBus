import Database from 'better-sqlite3';

import EngineRepository from '../repository/config/engine.repository';
import IpFilterRepository from '../repository/config/ip-filter.repository';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import SouthItemGroupRepository from '../repository/config/south-item-group.repository';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import LogRepository from '../repository/logs/log.repository';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import UserRepository from '../repository/config/user.repository';
import CryptoRepository from '../repository/crypto/crypto.repository';
import SouthConnectorMetricsRepository from '../repository/metrics/south-connector-metrics.repository';
import NorthConnectorMetricsRepository from '../repository/metrics/north-connector-metrics.repository';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import EngineMetricsRepository from '../repository/metrics/engine-metrics.repository';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import OIAnalyticsCommandRepository from '../repository/config/oianalytics-command.repository';
import OIAnalyticsMessageRepository from '../repository/config/oianalytics-message.repository';
import HistoryQueryMetricsRepository from '../repository/metrics/history-query-metrics.repository';
import TransformerRepository from '../repository/config/transformer.repository';

export default class RepositoryService {
  private readonly oibusDatabase;
  private readonly logsDatabase;
  private readonly metricsDatabase;
  private readonly cryptoDatabase;
  private readonly cacheDatabase;

  private readonly _engineRepository: EngineRepository;
  private readonly _cryptoRepository: CryptoRepository;
  private readonly _ipFilterRepository: IpFilterRepository;
  private readonly _scanModeRepository: ScanModeRepository;
  private readonly _certificateRepository: CertificateRepository;
  private readonly _northConnectorRepository: NorthConnectorRepository;
  private readonly _southConnectorRepository: SouthConnectorRepository;
  private readonly _southItemGroupRepository: SouthItemGroupRepository;
  private readonly _logRepository: LogRepository;
  private readonly _southMetricsRepository: SouthConnectorMetricsRepository;
  private readonly _engineMetricsRepository: EngineMetricsRepository;
  private readonly _southCacheRepository: SouthCacheRepository;
  private readonly _northMetricsRepository: NorthConnectorMetricsRepository;
  private readonly _historyQueryMetricsRepository: HistoryQueryMetricsRepository;
  private readonly _historyQueryRepository: HistoryQueryRepository;
  private readonly _userRepository: UserRepository;
  private readonly _oianalyticsRegistrationRepository: OIAnalyticsRegistrationRepository;
  private readonly _oianalyticsCommandRepository: OIAnalyticsCommandRepository;
  private readonly _oianalyticsMessageRepository: OIAnalyticsMessageRepository;
  private readonly _transformerRepository: TransformerRepository;

  constructor(
    oibusDatabasePath: string,
    logsDatabasePath: string,
    metricsDatabasePath: string,
    cryptoDatabasePath: string,
    cacheDatabasePath: string,
    launcherVersion: string
  ) {
    this.oibusDatabase = Database(oibusDatabasePath);
    this.metricsDatabase = Database(metricsDatabasePath);
    this.cryptoDatabase = Database(cryptoDatabasePath);
    this.cacheDatabase = Database(cacheDatabasePath);
    this.logsDatabase = Database(logsDatabasePath);
    // Enable WAL mode and set busy timeout because this database is used in two separates threads (main thread and logger)
    this.logsDatabase.pragma('journal_mode = WAL');
    this.logsDatabase.pragma('busy_timeout = 5000');

    this._ipFilterRepository = new IpFilterRepository(this.oibusDatabase);
    this._scanModeRepository = new ScanModeRepository(this.oibusDatabase);
    this._certificateRepository = new CertificateRepository(this.oibusDatabase);
    this._engineRepository = new EngineRepository(this.oibusDatabase, launcherVersion);
    this._northConnectorRepository = new NorthConnectorRepository(this.oibusDatabase);
    this._southConnectorRepository = new SouthConnectorRepository(this.oibusDatabase);
    this._southItemGroupRepository = new SouthItemGroupRepository(this.oibusDatabase);
    this._historyQueryRepository = new HistoryQueryRepository(this.oibusDatabase);
    this._userRepository = new UserRepository(this.oibusDatabase);
    this._oianalyticsRegistrationRepository = new OIAnalyticsRegistrationRepository(this.oibusDatabase);
    this._oianalyticsCommandRepository = new OIAnalyticsCommandRepository(this.oibusDatabase);
    this._oianalyticsMessageRepository = new OIAnalyticsMessageRepository(this.oibusDatabase);
    this._transformerRepository = new TransformerRepository(this.oibusDatabase);

    this._cryptoRepository = new CryptoRepository(this.cryptoDatabase);

    this._southCacheRepository = new SouthCacheRepository(this.cacheDatabase);

    this._logRepository = new LogRepository(this.logsDatabase);

    this._engineMetricsRepository = new EngineMetricsRepository(this.metricsDatabase);
    this._southMetricsRepository = new SouthConnectorMetricsRepository(this.metricsDatabase);
    this._northMetricsRepository = new NorthConnectorMetricsRepository(this.metricsDatabase);
    this._historyQueryMetricsRepository = new HistoryQueryMetricsRepository(this.metricsDatabase);
  }

  get cryptoRepository(): CryptoRepository {
    return this._cryptoRepository;
  }

  get userRepository(): UserRepository {
    return this._userRepository;
  }

  get logRepository(): LogRepository {
    return this._logRepository;
  }

  get southMetricsRepository(): SouthConnectorMetricsRepository {
    return this._southMetricsRepository;
  }

  get engineMetricsRepository(): EngineMetricsRepository {
    return this._engineMetricsRepository;
  }

  get oianalyticsRegistrationRepository(): OIAnalyticsRegistrationRepository {
    return this._oianalyticsRegistrationRepository;
  }

  get oianalyticsCommandRepository(): OIAnalyticsCommandRepository {
    return this._oianalyticsCommandRepository;
  }

  get oianalyticsMessageRepository(): OIAnalyticsMessageRepository {
    return this._oianalyticsMessageRepository;
  }

  get southCacheRepository(): SouthCacheRepository {
    return this._southCacheRepository;
  }

  get northMetricsRepository(): NorthConnectorMetricsRepository {
    return this._northMetricsRepository;
  }

  get historyQueryMetricsRepository(): HistoryQueryMetricsRepository {
    return this._historyQueryMetricsRepository;
  }

  get engineRepository(): EngineRepository {
    return this._engineRepository;
  }

  get ipFilterRepository(): IpFilterRepository {
    return this._ipFilterRepository;
  }

  get scanModeRepository(): ScanModeRepository {
    return this._scanModeRepository;
  }

  get certificateRepository(): CertificateRepository {
    return this._certificateRepository;
  }

  get northConnectorRepository(): NorthConnectorRepository {
    return this._northConnectorRepository;
  }

  get southConnectorRepository(): SouthConnectorRepository {
    return this._southConnectorRepository;
  }

  get southItemGroupRepository(): SouthItemGroupRepository {
    return this._southItemGroupRepository;
  }

  get historyQueryRepository(): HistoryQueryRepository {
    return this._historyQueryRepository;
  }

  get transformerRepository(): TransformerRepository {
    return this._transformerRepository;
  }

  close(): void {
    this.oibusDatabase.close();
    this.metricsDatabase.close();
    this.cryptoDatabase.close();
    this.cacheDatabase.close();
    this.logsDatabase.close();
  }
}
