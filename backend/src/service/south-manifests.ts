import { SouthConnectorManifest } from '../../shared/model/south-connector.model';
import oianalyticsManifest from '../south/south-oianalytics/manifest';
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
import opcManifest from '../south/south-opc/manifest';
import oledbManifest from '../south/south-oledb/manifest';
import piManifest from '../south/south-pi/manifest';
import sftpManifest from '../south/south-sftp/manifest';
import ftpManifest from '../south/south-ftp/manifest';
import restManifest from '../south/south-rest/manifest';

export const southManifestList: Array<SouthConnectorManifest> = [
  folderScannerManifest,
  mqttManifest,
  opcuaManifest,
  opcManifest,
  mssqlManifest,
  mysqlManifest,
  odbcManifest,
  oledbManifest,
  oracleManifest,
  postgresqlManifest,
  sqliteManifest,
  adsManifest,
  modbusManifest,
  oianalyticsManifest,
  piManifest,
  restManifest,
  sftpManifest,
  ftpManifest
];
