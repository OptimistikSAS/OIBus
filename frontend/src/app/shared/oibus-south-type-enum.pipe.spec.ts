import { testEnumPipe } from './base-enum-pipe.spec';
import { OIBusSouthTypeEnumPipe } from './oibus-south-type-enum.pipe';

describe('OIBusSouthTypeEnumPipe', () => {
  it('should translate south type', () => {
    testEnumPipe(OIBusSouthTypeEnumPipe, {
      ads: 'ADS - TwinCAT®',
      'folder-scanner': 'Folder scanner',
      modbus: 'Modbus',
      mqtt: 'MQTT',
      mssql: 'Microsoft SQL Server™',
      mysql: 'MySQL® / MariaDB™',
      odbc: 'ODBC',
      oianalytics: 'OIAnalytics®',
      oledb: 'OLEDB',
      opc: 'OPC Classic™',
      opcua: 'OPC UA™',
      oracle: 'Oracle Database™',
      'osisoft-pi': 'OSIsoft PI System™',
      postgresql: 'PostgreSQL',
      sftp: 'SFTP',
      sqlite: 'SQLite™'
    });
  });
});
