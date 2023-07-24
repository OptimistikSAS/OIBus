import Database from 'better-sqlite3';

import EngineRepository from '../repository/engine.repository';
import ExternalSourceRepository from '../repository/external-source.repository';
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

export default class RepositoryService {
  private readonly _engineRepository: EngineRepository;
  private readonly _cryptoRepository: CryptoRepository;
  private readonly _externalSourceRepository: ExternalSourceRepository;
  private readonly _ipFilterRepository: IpFilterRepository;
  private readonly _scanModeRepository: ScanModeRepository;
  private readonly _northConnectorRepository: NorthConnectorRepository;
  private readonly _southConnectorRepository: SouthConnectorRepository;
  private readonly _southItemRepository: SouthItemRepository;
  private readonly _logRepository: LogRepository;
  private readonly _southMetricsRepository: SouthConnectorMetricsRepository;
  private readonly _northMetricsRepository: NorthConnectorMetricsRepository;
  private readonly _historyQueryRepository: HistoryQueryRepository;
  private readonly _historyQueryItemRepository: HistoryQueryItemRepository;
  private readonly _userRepository: UserRepository;
  private readonly _subscriptionRepository: SubscriptionRepository;

  constructor(oibusDatabasePath: string, logsDatabasePath: string, cryptoDatabasePath: string) {
    const oibusDatabase = Database(oibusDatabasePath);
    const logsDatabase = Database(logsDatabasePath);
    const cryptoDatabase = Database(cryptoDatabasePath);
    this._externalSourceRepository = new ExternalSourceRepository(oibusDatabase);
    this._ipFilterRepository = new IpFilterRepository(oibusDatabase);
    this._scanModeRepository = new ScanModeRepository(oibusDatabase);
    this._engineRepository = new EngineRepository(oibusDatabase);
    this._cryptoRepository = new CryptoRepository(cryptoDatabase);
    this._northConnectorRepository = new NorthConnectorRepository(oibusDatabase);
    this._southConnectorRepository = new SouthConnectorRepository(oibusDatabase);
    this._southItemRepository = new SouthItemRepository(oibusDatabase);
    this._southItemRepository = new SouthItemRepository(oibusDatabase);
    this._historyQueryRepository = new HistoryQueryRepository(oibusDatabase);
    this._historyQueryItemRepository = new HistoryQueryItemRepository(oibusDatabase);
    this._userRepository = new UserRepository(oibusDatabase);
    this._logRepository = new LogRepository(logsDatabase);
    this._southMetricsRepository = new SouthConnectorMetricsRepository(logsDatabase);
    this._northMetricsRepository = new NorthConnectorMetricsRepository(logsDatabase);
    this._logRepository = new LogRepository(logsDatabase);
    this._subscriptionRepository = new SubscriptionRepository(oibusDatabase);
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

  get northMetricsRepository(): NorthConnectorMetricsRepository {
    return this._northMetricsRepository;
  }

  get engineRepository(): EngineRepository {
    return this._engineRepository;
  }

  get externalSourceRepository(): ExternalSourceRepository {
    return this._externalSourceRepository;
  }

  get ipFilterRepository(): IpFilterRepository {
    return this._ipFilterRepository;
  }

  get scanModeRepository(): ScanModeRepository {
    return this._scanModeRepository;
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

  get historyQueryRepository(): HistoryQueryRepository {
    return this._historyQueryRepository;
  }

  get historyQueryItemRepository(): HistoryQueryItemRepository {
    return this._historyQueryItemRepository;
  }

  get subscriptionRepository(): SubscriptionRepository {
    return this._subscriptionRepository;
  }
}
