import { testEnumPipe } from './base-enum-pipe.spec';
import { OIBusSouthTypeDescriptionEnumPipe } from './oibus-south-type-description-enum.pipe';

describe('OIBusSouthTypeDescriptionEnumPipe', () => {
  it('should translate south type description', () => {
    testEnumPipe(OIBusSouthTypeDescriptionEnumPipe, {
      ads: 'The ADS protocol used in TwinCAT® systems',
      'folder-scanner': 'Read files from a local or remote folder',
      modbus: 'Access Modbus registers on a PLC',
      mqtt: 'Subscribe to MQTT broker topics',
      mssql: 'Query Microsoft SQL Server™ databases',
      mysql: 'Query MySQL® or MariaDB™ databases',
      odbc: 'Query SQL databases with an ODBC driver',
      oianalytics: 'Query time values from OIAnalytics®',
      oledb: 'Query SQL databases with OLEDB',
      opc: 'Connect to OIBus Agent to retrieve data from OPC Classic™ (HDA/DA) server',
      opcua: 'Query data from OPC UA™ server (HA/DA)',
      oracle: 'Query data from an Oracle Database™',
      'osisoft-pi': 'Establish a connection with an OIBus Agent to access data from a PI System™',
      postgresql: 'Query PostgreSQL databases',
      sftp: 'Read files from a remote SFTP server',
      sqlite: 'Query  SQLite™ databases'
    });
  });
});
