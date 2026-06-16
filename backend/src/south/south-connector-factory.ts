import { SouthConnectorEntity, SouthConnectorItemEntity } from '../model/south-connector.model';
import { OIBusContent } from '../../shared/model/engine.model';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import {
  SouthADSItemSettings,
  SouthADSSettings,
  SouthFolderScannerItemSettings,
  SouthFolderScannerSettings,
  SouthFTPItemSettings,
  SouthFTPSettings,
  SouthInfluxDBItemSettings,
  SouthInfluxDBSettings,
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
import SouthInfluxDB from '../south/south-influxdb/south-influxdb';
import SouthSQLite from '../south/south-sqlite/south-sqlite';
import SouthConnector from './south-connector';
import { Instant } from '../model/types';
import { createFolder } from '../service/utils';
import path from 'node:path';
import fs from 'node:fs/promises';
import { OIBusSouthType } from '../../shared/model/south-connector.model';
export const buildSouth = (
  settings: SouthConnectorEntity<SouthSettings, SouthItemSettings>,
  addContent: (
    southId: string,
    data: OIBusContent,
    queryTime: Instant,
    items: Array<SouthConnectorItemEntity<SouthItemSettings>>
  ) => Promise<void>,
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
        southCacheFolder
      );
    case 'folder-scanner':
      return new SouthFolderScanner(
        settings as SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings>,
        addContent,
        southCacheRepository,
        southCacheFolder
      );
    case 'modbus':
      return new SouthModbus(
        settings as SouthConnectorEntity<SouthModbusSettings, SouthModbusItemSettings>,
        addContent,
        southCacheRepository,
        southCacheFolder
      );
    case 'mqtt':
      return new SouthMQTT(
        settings as SouthConnectorEntity<SouthMQTTSettings, SouthMQTTItemSettings>,
        addContent,
        southCacheRepository,
        southCacheFolder
      );
    case 'mssql':
      return new SouthMSSQL(
        settings as SouthConnectorEntity<SouthMSSQLSettings, SouthMSSQLItemSettings>,
        addContent,
        southCacheRepository,
        southCacheFolder
      );
    case 'mysql':
      return new SouthMySQL(
        settings as SouthConnectorEntity<SouthMySQLSettings, SouthMySQLItemSettings>,
        addContent,
        southCacheRepository,
        southCacheFolder
      );
    case 'odbc':
      return new SouthODBC(
        settings as SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings>,
        addContent,
        southCacheRepository,
        southCacheFolder
      );
    case 'oianalytics':
      return new SouthOIAnalytics(
        settings as SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings>,
        addContent,
        southCacheRepository,
        southCacheFolder,
        certificateRepository,
        oIAnalyticsRegistrationRepository
      );
    case 'oledb':
      return new SouthOLEDB(
        settings as SouthConnectorEntity<SouthOLEDBSettings, SouthOLEDBItemSettings>,
        addContent,
        southCacheRepository,
        southCacheFolder
      );
    case 'opc':
      return new SouthOPC(
        settings as SouthConnectorEntity<SouthOPCSettings, SouthOPCItemSettings>,
        addContent,
        southCacheRepository,
        southCacheFolder
      );
    case 'opcua':
      return new SouthOPCUA(
        settings as SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings>,
        addContent,
        southCacheRepository,
        southCacheFolder
      );
    case 'oracle':
      return new SouthOracle(
        settings as SouthConnectorEntity<SouthOracleSettings, SouthOracleItemSettings>,
        addContent,
        southCacheRepository,
        southCacheFolder
      );
    case 'osisoft-pi':
      return new SouthPI(
        settings as SouthConnectorEntity<SouthPISettings, SouthPIItemSettings>,
        addContent,
        southCacheRepository,
        southCacheFolder
      );
    case 'postgresql':
      return new SouthPostgreSQL(
        settings as SouthConnectorEntity<SouthPostgreSQLSettings, SouthPostgreSQLItemSettings>,
        addContent,
        southCacheRepository,
        southCacheFolder
      );
    case 'rest':
      return new SouthRest(
        settings as SouthConnectorEntity<SouthRestSettings, SouthRestItemSettings>,
        addContent,
        southCacheRepository,
        southCacheFolder
      );
    case 'sftp':
      return new SouthSFTP(
        settings as SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings>,
        addContent,
        southCacheRepository,
        southCacheFolder
      );
    case 'ftp':
      return new SouthFTP(
        settings as SouthConnectorEntity<SouthFTPSettings, SouthFTPItemSettings>,
        addContent,
        southCacheRepository,
        southCacheFolder
      );
    case 'influxdb':
      return new SouthInfluxDB(
        settings as SouthConnectorEntity<SouthInfluxDBSettings, SouthInfluxDBItemSettings>,
        addContent,
        southCacheRepository,
        southCacheFolder
      );
    case 'sqlite':
      return new SouthSQLite(
        settings as SouthConnectorEntity<SouthSQLiteSettings, SouthSQLiteItemSettings>,
        addContent,
        southCacheRepository,
        southCacheFolder
      );
    default:
      throw Error(`South connector of type "${settings.type}" not installed`);
  }
};

export const initSouthCache = async (id: string, type: OIBusSouthType, baseFolder: string) => {
  await createFolder(path.join(baseFolder, 'cache', `south-${id}`));
  await createFolder(path.join(baseFolder, 'cache', `south-${id}`, 'tmp'));
  if (type === 'opcua') {
    await createFolder(path.join(baseFolder, 'cache', `south-${id}`, 'opcua'));
  }
};

export const deleteSouthCache = async (id: string, baseFolder: string) => {
  await fs.rm(path.join(baseFolder, 'cache', `south-${id}`), { recursive: true, force: true });
};
