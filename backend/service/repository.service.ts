import db from "better-sqlite3";

import EngineRepository from "../repository/engine.repository";
import ExternalSourceRepository from "../repository/external-source.repository";
import IpFilterRepository from "../repository/ip-filter.repository";
import ProxyRepository from "../repository/proxy.repository";
import ScanModeRepository from "../repository/scan-mode.repository";
import SouthConnectorRepository from "../repository/south-connector.repository";
import SouthItemRepository from "../repository/south-item.repository";
import NorthConnectorRepository from "../repository/north-connector.repository";

export default class RepositoryService {
  private readonly _engineRepository: EngineRepository;
  private readonly _externalSourceRepository: ExternalSourceRepository;
  private readonly _ipFilterRepository: IpFilterRepository;
  private readonly _proxyRepository: ProxyRepository;
  private readonly _scanModeRepository: ScanModeRepository;
  private readonly _northConnectorRepository: NorthConnectorRepository;
  private readonly _southConnectorRepository: SouthConnectorRepository;
  private readonly _southItemRepository: SouthItemRepository;

  constructor(databasePath: string) {
    const database = db(databasePath);
    this._externalSourceRepository = new ExternalSourceRepository(database);
    this._ipFilterRepository = new IpFilterRepository(database);
    this._proxyRepository = new ProxyRepository(database);
    this._scanModeRepository = new ScanModeRepository(database);
    this._engineRepository = new EngineRepository(database);
    this._northConnectorRepository = new NorthConnectorRepository(database);
    this._southConnectorRepository = new SouthConnectorRepository(database);
    this._southItemRepository = new SouthItemRepository(database);
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
}
