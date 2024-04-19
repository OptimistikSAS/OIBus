import EncryptionService from './encryption.service';
import pino from 'pino';
import RepositoryService from './repository.service';

// South imports
import SouthFolderScanner from '../south/south-folder-scanner/south-folder-scanner';
import SouthOPCUA from '../south/south-opcua/south-opcua';
import SouthMQTT from '../south/south-mqtt/south-mqtt';
import SouthMSSQL from '../south/south-mssql/south-mssql';
import SouthMySQL from '../south/south-mysql/south-mysql';
import SouthODBC from '../south/south-odbc/south-odbc';
import SouthOracle from '../south/south-oracle/south-oracle';
import SouthPostgreSQL from '../south/south-postgresql/south-postgresql';
import SouthSQLite from '../south/south-sqlite/south-sqlite';
import SouthADS from '../south/south-ads/south-ads';
import SouthModbus from '../south/south-modbus/south-modbus';
import SouthOIAnalytics from '../south/south-oianalytics/south-oianalytics';
import SouthSlims from '../south/south-slims/south-slims';
import SouthOPCHDA from '../south/south-opchda/south-opchda';
import SouthOLEDB from '../south/south-oledb/south-oledb';
import SouthPI from '../south/south-pi/south-pi';

import { SouthConnectorDTO, SouthConnectorItemDTO, SouthConnectorManifest } from '../../../shared/model/south-connector.model';
import SouthConnector from '../south/south-connector';

import oianalyticsManifest from '../south/south-oianalytics/manifest';
import slimsManifest from '../south/south-slims/manifest';
import opcuaManifest from '../south/south-opcua/manifest';
import mqttManifest from '../south/south-mqtt/manifest';
import modbusManifest from '../south/south-modbus/manifest';
import folderScannerManifest from '../south/south-folder-scanner/manifest';
import adsManifest from '../south/south-ads/manifest';
import mssqlManifest from '../south/south-mssql/manifest';
import mysqlManifest from '../south/south-mysql/manifest';
import postgresqlManifest from '../south/south-postgresql/manifest';
import oracleManifest from '../south/south-oracle/manifest';
import odbcManifest from '../south/south-odbc/manifest';
import sqliteManifest from '../south/south-sqlite/manifest';
import opchdaManifest from '../south/south-opchda/manifest';
import oledbManifest from '../south/south-oledb/manifest';
import piManifest from '../south/south-pi/manifest';
import ConnectionService from './connection.service';

const southList: Array<{ class: typeof SouthConnector<any, any>; manifest: SouthConnectorManifest }> = [
  { class: SouthFolderScanner, manifest: folderScannerManifest },
  { class: SouthMQTT, manifest: mqttManifest },
  { class: SouthOPCUA, manifest: opcuaManifest },
  { class: SouthOPCHDA, manifest: opchdaManifest },
  { class: SouthMSSQL, manifest: mssqlManifest },
  { class: SouthMySQL, manifest: mysqlManifest },
  { class: SouthODBC, manifest: odbcManifest },
  { class: SouthOLEDB, manifest: oledbManifest },
  { class: SouthOracle, manifest: oracleManifest },
  { class: SouthPostgreSQL, manifest: postgresqlManifest },
  { class: SouthSQLite, manifest: sqliteManifest },
  { class: SouthADS, manifest: adsManifest },
  { class: SouthModbus, manifest: modbusManifest },
  { class: SouthOIAnalytics, manifest: oianalyticsManifest },
  { class: SouthSlims, manifest: slimsManifest },
  { class: SouthPI, manifest: piManifest }
];

export default class SouthService {
  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly repositoryService: RepositoryService,
    private readonly _connectionService: ConnectionService
  ) {}

  /**
   * Return the South connector
   */
  createSouth(
    settings: SouthConnectorDTO,
    items: Array<SouthConnectorItemDTO>,
    addContent: (southId: string, data: OIBusContent) => Promise<void>,
    baseFolder: string,
    logger: pino.Logger
  ): SouthConnector {
    const SouthConnector = southList.find(connector => connector.class.type === settings.type);
    if (!SouthConnector) {
      throw Error(`South connector of type ${settings.type} not installed`);
    }
    return new SouthConnector.class(
      settings,
      items,
      addContent,
      this.encryptionService,
      this.repositoryService,
      logger,
      baseFolder,
      this._connectionService
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

  getSouthItems(southId: string): Array<SouthConnectorItemDTO> {
    return this.repositoryService.southItemRepository.getSouthItems(southId);
  }

  getInstalledSouthManifests(): Array<SouthConnectorManifest> {
    return southList.map(element => element.manifest);
  }
}
