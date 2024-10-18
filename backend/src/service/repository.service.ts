import Database from 'better-sqlite3';

import EngineRepository from '../repository/config/engine.repository';
import IpFilterRepository from '../repository/config/ip-filter.repository';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import LogRepository from '../repository/logs/log.repository';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import UserRepository from '../repository/config/user.repository';
import CryptoRepository from '../repository/crypto/crypto.repository';
import SouthConnectorMetricsRepository from '../repository/logs/south-connector-metrics.repository';
import NorthConnectorMetricsRepository from '../repository/logs/north-connector-metrics.repository';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import EngineMetricsRepository from '../repository/logs/engine-metrics.repository';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import OIAnalyticsCommandRepository from '../repository/config/oianalytics-command.repository';
import OIAnalyticsMessageRepository from '../repository/config/oianalytics-message.repository';
import HistoryQueryMetricsRepository from '../repository/logs/history-query-metrics.repository';

export default class RepositoryService {
  private readonly _engineRepository: EngineRepository;
  private readonly _cryptoRepository: CryptoRepository;
  private readonly _ipFilterRepository: IpFilterRepository;
  private readonly _scanModeRepository: ScanModeRepository;
  private readonly _certificateRepository: CertificateRepository;
  private readonly _northConnectorRepository: NorthConnectorRepository;
  private readonly _southConnectorRepository: SouthConnectorRepository;
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

  constructor(oibusDatabasePath: string, logsDatabasePath: string, cryptoDatabasePath: string, cacheDatabasePath: string) {
    const oibusDatabase = Database(oibusDatabasePath);
    const logsDatabase = Database(logsDatabasePath);
    const cryptoDatabase = Database(cryptoDatabasePath);
    const cacheDatabase = Database(cacheDatabasePath);

    this._ipFilterRepository = new IpFilterRepository(oibusDatabase);
    this._scanModeRepository = new ScanModeRepository(oibusDatabase);
    this._certificateRepository = new CertificateRepository(oibusDatabase);
    this._engineRepository = new EngineRepository(oibusDatabase);
    this._northConnectorRepository = new NorthConnectorRepository(oibusDatabase);
    this._southConnectorRepository = new SouthConnectorRepository(oibusDatabase);
    this._historyQueryRepository = new HistoryQueryRepository(oibusDatabase);
    this._userRepository = new UserRepository(oibusDatabase);
    this._oianalyticsRegistrationRepository = new OIAnalyticsRegistrationRepository(oibusDatabase);
    this._oianalyticsCommandRepository = new OIAnalyticsCommandRepository(oibusDatabase);
    this._oianalyticsMessageRepository = new OIAnalyticsMessageRepository(oibusDatabase);

    this._cryptoRepository = new CryptoRepository(cryptoDatabase);

    this._southCacheRepository = new SouthCacheRepository(cacheDatabase);

    this._logRepository = new LogRepository(logsDatabase);
    this._engineMetricsRepository = new EngineMetricsRepository(logsDatabase);
    this._southMetricsRepository = new SouthConnectorMetricsRepository(logsDatabase);
    this._northMetricsRepository = new NorthConnectorMetricsRepository(logsDatabase);
    this._historyQueryMetricsRepository = new HistoryQueryMetricsRepository(logsDatabase);
    this._logRepository = new LogRepository(logsDatabase);
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

  get historyQueryRepository(): HistoryQueryRepository {
    return this._historyQueryRepository;
  }
}
