import pino from 'pino';
import { SouthConnectorEntity } from '../model/south-connector.model';
import { OIBusContent } from '../../shared/model/engine.model';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from 'src/repository/config/oianalytics-registration.repository';
import {
  SouthADSItemSettings,
  SouthADSSettings,
  SouthFolderScannerItemSettings,
  SouthFolderScannerSettings,
  SouthFTPItemSettings,
  SouthFTPSettings,
  SouthItemSettings,
  SouthModbusItemSettings,
  SouthModbusSettings,
  SouthMQTTItemSettings,
  SouthMQTTSettings,
  SouthMSSQLItemSettings,
  SouthMSSQLSettings,
  SouthMySQLItemSettings,
  SouthMySQLSettings,
  SouthODBCItemSettings,
  SouthODBCSettings,
  SouthOIAnalyticsItemSettings,
  SouthOIAnalyticsSettings,
  SouthOLEDBItemSettings,
  SouthOLEDBSettings,
  SouthOPCItemSettings,
  SouthOPCSettings,
  SouthOPCUAItemSettings,
  SouthOPCUASettings,
  SouthOracleItemSettings,
  SouthOracleSettings,
  SouthPIItemSettings,
  SouthPISettings,
  SouthPostgreSQLItemSettings,
  SouthPostgreSQLSettings,
  SouthRestItemSettings,
  SouthRestSettings,
  SouthSettings,
  SouthSFTPItemSettings,
  SouthSFTPSettings,
  SouthSQLiteItemSettings,
  SouthSQLiteSettings
} from '../../shared/model/south-settings.model';
import SouthADS from '../south/south-ads/south-ads';
import SouthFolderScanner from '../south/south-folder-scanner/south-folder-scanner';
import SouthModbus from '../south/south-modbus/south-modbus';
import SouthMQTT from '../south/south-mqtt/south-mqtt';
import SouthMSSQL from '../south/south-mssql/south-mssql';
import SouthMySQL from '../south/south-mysql/south-mysql';
import SouthODBC from '../south/south-odbc/south-odbc';
import SouthOIAnalytics from '../south/south-oianalytics/south-oianalytics';
import SouthOLEDB from '../south/south-oledb/south-oledb';
import SouthOPC from '../south/south-opc/south-opc';
import SouthOPCUA from '../south/south-opcua/south-opcua';
import SouthOracle from '../south/south-oracle/south-oracle';
import SouthPI from '../south/south-pi/south-pi';
import SouthPostgreSQL from '../south/south-postgresql/south-postgresql';
import SouthRest from '../south/south-rest/south-rest';
import SouthSFTP from '../south/south-sftp/south-sftp';
import SouthFTP from '../south/south-ftp/south-ftp';
import SouthSQLite from '../south/south-sqlite/south-sqlite';
import SouthConnector from './south-connector';

export const buildSouth = (
  settings: SouthConnectorEntity<SouthSettings, SouthItemSettings>,
  addContent: (southId: string, data: OIBusContent) => Promise<void>,
  logger: pino.Logger,
  southCacheFolder: string,
  southCacheRepository: SouthCacheRepository,
  certificateRepository: CertificateRepository,
  oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository
): SouthConnector<SouthSettings, SouthItemSettings> => {
  switch (settings.type) {
    case 'ads':
      return new SouthADS(
        settings as SouthConnectorEntity<SouthADSSettings, SouthADSItemSettings>,
        addContent,
        southCacheRepository,
        logger,
        southCacheFolder
      );
    case 'folder-scanner':
      return new SouthFolderScanner(
        settings as SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings>,
        addContent,
        southCacheRepository,
        logger,
        southCacheFolder
      );
    case 'modbus':
      return new SouthModbus(
        settings as SouthConnectorEntity<SouthModbusSettings, SouthModbusItemSettings>,
        addContent,
        southCacheRepository,
        logger,
        southCacheFolder
      );
    case 'mqtt':
      return new SouthMQTT(
        settings as SouthConnectorEntity<SouthMQTTSettings, SouthMQTTItemSettings>,
        addContent,
        southCacheRepository,
        logger,
        southCacheFolder
      );
    case 'mssql':
      return new SouthMSSQL(
        settings as SouthConnectorEntity<SouthMSSQLSettings, SouthMSSQLItemSettings>,
        addContent,
        southCacheRepository,
        logger,
        southCacheFolder
      );
    case 'mysql':
      return new SouthMySQL(
        settings as SouthConnectorEntity<SouthMySQLSettings, SouthMySQLItemSettings>,
        addContent,
        southCacheRepository,
        logger,
        southCacheFolder
      );
    case 'odbc':
      return new SouthODBC(
        settings as SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings>,
        addContent,
        southCacheRepository,
        logger,
        southCacheFolder
      );
    case 'oianalytics':
      return new SouthOIAnalytics(
        settings as SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings>,
        addContent,
        southCacheRepository,
        logger,
        southCacheFolder,
        certificateRepository,
        oIAnalyticsRegistrationRepository
      );
    case 'oledb':
      return new SouthOLEDB(
        settings as SouthConnectorEntity<SouthOLEDBSettings, SouthOLEDBItemSettings>,
        addContent,
        southCacheRepository,
        logger,
        southCacheFolder
      );
    case 'opc':
      return new SouthOPC(
        settings as SouthConnectorEntity<SouthOPCSettings, SouthOPCItemSettings>,
        addContent,
        southCacheRepository,
        logger,
        southCacheFolder
      );
    case 'opcua':
      return new SouthOPCUA(
        settings as SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings>,
        addContent,
        southCacheRepository,
        logger,
        southCacheFolder
      );
    case 'oracle':
      return new SouthOracle(
        settings as SouthConnectorEntity<SouthOracleSettings, SouthOracleItemSettings>,
        addContent,
        southCacheRepository,
        logger,
        southCacheFolder
      );
    case 'osisoft-pi':
      return new SouthPI(
        settings as SouthConnectorEntity<SouthPISettings, SouthPIItemSettings>,
        addContent,
        southCacheRepository,
        logger,
        southCacheFolder
      );
    case 'postgresql':
      return new SouthPostgreSQL(
        settings as SouthConnectorEntity<SouthPostgreSQLSettings, SouthPostgreSQLItemSettings>,
        addContent,
        southCacheRepository,
        logger,
        southCacheFolder
      );
    case 'rest':
      return new SouthRest(
        settings as SouthConnectorEntity<SouthRestSettings, SouthRestItemSettings>,
        addContent,
        southCacheRepository,
        logger,
        southCacheFolder
      );
    case 'sftp':
      return new SouthSFTP(
        settings as SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings>,
        addContent,
        southCacheRepository,
        logger,
        southCacheFolder
      );
    case 'ftp':
      return new SouthFTP(
        settings as SouthConnectorEntity<SouthFTPSettings, SouthFTPItemSettings>,
        addContent,
        southCacheRepository,
        logger,
        southCacheFolder
      );
    case 'sqlite':
      return new SouthSQLite(
        settings as SouthConnectorEntity<SouthSQLiteSettings, SouthSQLiteItemSettings>,
        addContent,
        southCacheRepository,
        logger,
        southCacheFolder
      );
    default:
      throw Error(`South connector of type "${settings.type}" not installed`);
  }
};
