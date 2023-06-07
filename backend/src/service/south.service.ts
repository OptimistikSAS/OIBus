import ProxyService from './proxy.service';
import EncryptionService from './encryption.service';
import pino from 'pino';
import RepositoryService from './repository.service';

// South imports
import SouthFolderScanner from '../south/south-folder-scanner/south-folder-scanner';
import SouthOPCUAHA from '../south/south-opcua-ha/south-opcua-ha';
import SouthOPCUADA from '../south/south-opcua-da/south-opcua-da';
import SouthOPCHDA from '../south/south-opchda/south-opchda';
import SouthMQTT from '../south/south-mqtt/south-mqtt';
import SouthMSSQL from '../south/south-mssql/south-mssql';
import SouthMySQL from '../south/south-mysql/south-mysql';
import SouthODBC from '../south/south-odbc/south-odbc';
import SouthOracle from '../south/south-oracle/south-oracle';
import SouthPostgreSQL from '../south/south-postgresql/south-postgresql';
import SouthSQLite from '../south/south-sqlite/south-sqlite';
import SouthADS from '../south/south-ads/south-ads';
import SouthModbus from '../south/south-modbus/south-modbus';
import SouthOIConnect from '../south/south-oiconnect/south-oiconnect';

import { SouthConnectorDTO, OibusItemDTO } from '../../../shared/model/south-connector.model';
import SouthConnector from '../south/south-connector';

const southList: Array<typeof SouthConnector> = [
  SouthFolderScanner,
  SouthMQTT,
  SouthOPCUAHA,
  SouthOPCUADA,
  SouthOPCHDA,
  SouthMSSQL,
  SouthMySQL,
  SouthODBC,
  SouthOracle,
  SouthPostgreSQL,
  SouthSQLite,
  SouthADS,
  SouthModbus,
  SouthOIConnect
];

export default class SouthService {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly encryptionService: EncryptionService,
    private readonly repositoryService: RepositoryService
  ) {}

  /**
   * Return the South connector
   */
  createSouth(
    settings: SouthConnectorDTO,
    items: Array<OibusItemDTO>,
    addValues: (southId: string, values: Array<any>) => Promise<void>,
    addFile: (southId: string, filePath: string) => Promise<void>,
    baseFolder: string,
    streamMode: boolean,
    logger: pino.Logger
  ): SouthConnector {
    const SouthConnector = southList.find(connector => connector.type === settings.type);
    if (!SouthConnector) {
      throw Error(`South connector of type ${settings.type} not installed`);
    }
    return new SouthConnector(
      settings,
      items,
      addValues,
      addFile,
      this.encryptionService,
      this.proxyService,
      this.repositoryService,
      logger,
      baseFolder,
      streamMode
    );
  }

  /**
   * Retrieve a south connector from the config
   */
  getSouth(southId: string): SouthConnectorDTO | null {
    return this.repositoryService.southConnectorRepository.getSouthConnector(southId);
  }

  getSouthList(): Array<SouthConnectorDTO> {
    return this.repositoryService.southConnectorRepository.getSouthConnectors();
  }

  getSouthItems(southId: string): Array<OibusItemDTO> {
    return this.repositoryService.southItemRepository.getSouthItems(southId);
  }
}
