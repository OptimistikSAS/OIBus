import Database from 'better-sqlite3';

import EngineRepository from '../repository/engine.repository';
import ExternalSourceRepository from '../repository/external-source.repository';
import IpFilterRepository from '../repository/ip-filter.repository';
import ProxyRepository from '../repository/proxy.repository';
import ScanModeRepository from '../repository/scan-mode.repository';
import SouthConnectorRepository from '../repository/south-connector.repository';
import SouthItemRepository from '../repository/south-item.repository';
import NorthConnectorRepository from '../repository/north-connector.repository';
import LogRepository from '../repository/log.repository';
import HistoryQueryRepository from '../repository/history-query.repository';

export default class RepositoryService {
  private readonly _engineRepository: EngineRepository;
  private readonly _externalSourceRepository: ExternalSourceRepository;
  private readonly _ipFilterRepository: IpFilterRepository;
  private readonly _proxyRepository: ProxyRepository;
  private readonly _scanModeRepository: ScanModeRepository;
  private readonly _northConnectorRepository: NorthConnectorRepository;
  private readonly _southConnectorRepository: SouthConnectorRepository;
  private readonly _southItemRepository: SouthItemRepository;
  private readonly _logRepository: LogRepository;
  private readonly _historyQueryRepository: HistoryQueryRepository;

  constructor(oibusDatabasePath: string, logsDatabasePath: string) {
    const oibusDatabase = Database(oibusDatabasePath);
    const logsDatabase = Database(logsDatabasePath);
    this._externalSourceRepository = new ExternalSourceRepository(oibusDatabase);
    this._ipFilterRepository = new IpFilterRepository(oibusDatabase);
    this._proxyRepository = new ProxyRepository(oibusDatabase);
    this._scanModeRepository = new ScanModeRepository(oibusDatabase);
    this._engineRepository = new EngineRepository(oibusDatabase);
    this._northConnectorRepository = new NorthConnectorRepository(oibusDatabase);
    this._southConnectorRepository = new SouthConnectorRepository(oibusDatabase);
    this._southItemRepository = new SouthItemRepository(oibusDatabase);
    this._southItemRepository = new SouthItemRepository(oibusDatabase);
    this._historyQueryRepository = new HistoryQueryRepository(oibusDatabase);
    this._logRepository = new LogRepository(logsDatabase);
  }

  get logRepository(): LogRepository {
    return this._logRepository;
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

  get proxyRepository(): ProxyRepository {
    return this._proxyRepository;
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
}
