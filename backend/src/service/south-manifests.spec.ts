import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { OIBusSouthType } from '../../shared/model/connector/south-manifest.model';

import SouthADS from '../south/south-ads/south-ads';
import SouthBACnet from '../south/south-bacnet/south-bacnet';
import SouthFolderScanner from '../south/south-folder-scanner/south-folder-scanner';
import SouthFTP from '../south/south-ftp/south-ftp';
import SouthInfluxDB from '../south/south-influxdb/south-influxdb';
import SouthModbus from '../south/south-modbus/south-modbus';
import SouthMongoDB from '../south/south-mongodb/south-mongodb';
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
import SouthS7 from '../south/south-s7/south-s7';
import SouthSFTP from '../south/south-sftp/south-sftp';
import SouthSQLite from '../south/south-sqlite/south-sqlite';
import { southManifestList } from './south-manifests';

/** The connector class of each south type - its prototype tells which capabilities it really implements. */
const connectorClasses: Record<OIBusSouthType, { prototype: object }> = {
  ads: SouthADS,
  bacnet: SouthBACnet,
  'folder-scanner': SouthFolderScanner,
  ftp: SouthFTP,
  influxdb: SouthInfluxDB,
  modbus: SouthModbus,
  mongodb: SouthMongoDB,
  mqtt: SouthMQTT,
  mssql: SouthMSSQL,
  mysql: SouthMySQL,
  odbc: SouthODBC,
  oianalytics: SouthOIAnalytics,
  oledb: SouthOLEDB,
  opc: SouthOPC,
  opcua: SouthOPCUA,
  oracle: SouthOracle,
  'osisoft-pi': SouthPI,
  postgresql: SouthPostgreSQL,
  rest: SouthRest,
  s7: SouthS7,
  sftp: SouthSFTP,
  sqlite: SouthSQLite
};

describe('southManifestList', () => {
  it('exports an array', () => {
    assert.ok(Array.isArray(southManifestList));
  });

  it('contains one manifest per registered south connector', () => {
    assert.equal(southManifestList.length, 22);
  });

  it('contains only manifests with a non-empty unique id', () => {
    const ids = southManifestList.map(manifest => manifest.id);
    assert.equal(ids.length, new Set(ids).size);
    for (const id of ids) {
      assert.equal(typeof id, 'string');
      assert.ok(id.length > 0);
    }
  });

  it('includes the expected connector ids', () => {
    const ids: Array<string> = southManifestList.map(manifest => manifest.id);
    for (const expected of [
      'folder-scanner',
      'mqtt',
      'opcua',
      'opc',
      'mssql',
      'mysql',
      'odbc',
      'oledb',
      'oracle',
      'postgresql',
      'sqlite',
      'ads',
      'bacnet',
      'modbus',
      'oianalytics',
      'osisoft-pi',
      'rest',
      's7',
      'sftp',
      'ftp',
      'influxdb'
    ]) {
      assert.ok(ids.includes(expected), `expected southManifestList to include '${expected}'`);
    }
  });

  it('every manifest explore flag mirrors whether its connector implements explore()', () => {
    for (const manifest of southManifestList) {
      assert.equal(manifest.explore === true, 'explore' in connectorClasses[manifest.id].prototype, `manifest '${manifest.id}'`);
    }
  });

  it('every manifest discovery flag mirrors whether its connector implements discover()', () => {
    for (const manifest of southManifestList) {
      assert.equal(manifest.discovery !== undefined, 'discover' in connectorClasses[manifest.id].prototype, `manifest '${manifest.id}'`);
    }
  });

  it('every manifest exposes an items schema, a category and settings', () => {
    for (const manifest of southManifestList) {
      assert.ok(manifest.settings, `manifest '${manifest.id}' should have settings`);
      assert.ok(manifest.items, `manifest '${manifest.id}' should have an items schema`);
      assert.equal(typeof manifest.category, 'string');
    }
  });
});
