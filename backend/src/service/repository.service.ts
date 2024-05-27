import Database from 'better-sqlite3';

import EngineRepository from '../repository/engine.repository';
import IpFilterRepository from '../repository/ip-filter.repository';
import ScanModeRepository from '../repository/scan-mode.repository';
import SouthConnectorRepository from '../repository/south-connector.repository';
import SouthItemRepository from '../repository/south-item.repository';
import NorthConnectorRepository from '../repository/north-connector.repository';
import LogRepository from '../repository/log.repository';
import HistoryQueryRepository from '../repository/history-query.repository';
import UserRepository from '../repository/user.repository';
import HistoryQueryItemRepository from '../repository/history-query-item.repository';
import SubscriptionRepository from '../repository/subscription.repository';
import CryptoRepository from '../repository/crypto.repository';
import SouthConnectorMetricsRepository from '../repository/south-connector-metrics.repository';
import NorthConnectorMetricsRepository from '../repository/north-connector-metrics.repository';
import SouthCacheRepository from '../repository/south-cache.repository';
import EngineMetricsRepository from '../repository/engine-metrics.repository';
import CertificateRepository from '../repository/certificate.repository';
import RegistrationRepository from '../repository/registration.repository';
import CommandRepository from '../repository/command.repository';
import NorthItemRepository from '../repository/north-item.repository';
import TransformerRepository from '../repository/transformer.repository';

export default class RepositoryService {
  private readonly _engineRepository: EngineRepository;
  private readonly _cryptoRepository: CryptoRepository;
  private readonly _ipFilterRepository: IpFilterRepository;
  private readonly _scanModeRepository: ScanModeRepository;
  private readonly _certificateRepository: CertificateRepository;
  private readonly _northConnectorRepository: NorthConnectorRepository;
  private readonly _southConnectorRepository: SouthConnectorRepository;
  private readonly _southItemRepository: SouthItemRepository;
  private readonly _logRepository: LogRepository;
  private readonly _southMetricsRepository: SouthConnectorMetricsRepository;
  private readonly _engineMetricsRepository: EngineMetricsRepository;
  private readonly _southCacheRepository: SouthCacheRepository;
  private readonly _northMetricsRepository: NorthConnectorMetricsRepository;
  private readonly _historyQueryRepository: HistoryQueryRepository;
  private readonly _historyQueryItemRepository: HistoryQueryItemRepository;
  private readonly _userRepository: UserRepository;
  private readonly _subscriptionRepository: SubscriptionRepository;
  private readonly _registrationRepository: RegistrationRepository;
  private readonly _commandRepository: CommandRepository;
  private readonly _northItemRepository: NorthItemRepository;
  private readonly _transformerRepository: TransformerRepository;

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
    this._southItemRepository = new SouthItemRepository(oibusDatabase);
    this._northItemRepository = new NorthItemRepository(oibusDatabase);
    this._historyQueryRepository = new HistoryQueryRepository(oibusDatabase);
    this._historyQueryItemRepository = new HistoryQueryItemRepository(oibusDatabase);
    this._userRepository = new UserRepository(oibusDatabase);
    this._subscriptionRepository = new SubscriptionRepository(oibusDatabase);
    this._registrationRepository = new RegistrationRepository(oibusDatabase);
    this._commandRepository = new CommandRepository(oibusDatabase);
    this._oianalyticsMessageRepository = new OianalyticsMessageRepository(oibusDatabase);

    this._cryptoRepository = new CryptoRepository(cryptoDatabase);

    this._southCacheRepository = new SouthCacheRepository(cacheDatabase);

    this._logRepository = new LogRepository(logsDatabase);
    this._engineMetricsRepository = new EngineMetricsRepository(logsDatabase);
    this._southMetricsRepository = new SouthConnectorMetricsRepository(logsDatabase);
    this._northMetricsRepository = new NorthConnectorMetricsRepository(logsDatabase);
    this._logRepository = new LogRepository(logsDatabase);

    this._transformerRepository = new TransformerRepository(oibusDatabase);
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

  get registrationRepository(): RegistrationRepository {
    return this._registrationRepository;
  }

  get southCacheRepository(): SouthCacheRepository {
    return this._southCacheRepository;
  }

  get northMetricsRepository(): NorthConnectorMetricsRepository {
    return this._northMetricsRepository;
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

  get southItemRepository(): SouthItemRepository {
    return this._southItemRepository;
  }

  get northItemRepository(): NorthItemRepository {
    return this._northItemRepository;
  }

  get historyQueryRepository(): HistoryQueryRepository {
    return this._historyQueryRepository;
  }

  get historyQueryItemRepository(): HistoryQueryItemRepository {
    return this._historyQueryItemRepository;
  }

  get subscriptionRepository(): SubscriptionRepository {
    return this._subscriptionRepository;
  }

  get commandRepository(): CommandRepository {
    return this._commandRepository;
  }

  get transformerRepository(): TransformerRepository {
    return this._transformerRepository;
  }
}
