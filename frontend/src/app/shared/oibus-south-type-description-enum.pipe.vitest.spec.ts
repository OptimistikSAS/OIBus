import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { OIBusSouthTypeDescriptionEnumPipe } from './oibus-south-type-description-enum.pipe';

describe('OIBusSouthTypeDescriptionEnumPipe', () => {
  test('should translate south type description', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new OIBusSouthTypeDescriptionEnumPipe());
    expect(pipe.transform('ads')).toBe('The ADS protocol used in TwinCAT® systems');
    expect(pipe.transform('folder-scanner')).toBe('Read files from a local or remote folder');
    expect(pipe.transform('modbus')).toBe('Access Modbus registers on a PLC');
    expect(pipe.transform('mqtt')).toBe('Subscribe to MQTT broker topics');
    expect(pipe.transform('mssql')).toBe('Query Microsoft SQL Server™ databases');
    expect(pipe.transform('mysql')).toBe('Query MySQL® or MariaDB™ databases');
    expect(pipe.transform('odbc')).toBe('Query SQL databases with an ODBC driver');
    expect(pipe.transform('oianalytics')).toBe('Query time values from OIAnalytics®');
    expect(pipe.transform('oledb')).toBe('Query SQL databases with OLEDB');
    expect(pipe.transform('opc')).toBe('Connect to OIBus Agent to retrieve data from OPC Classic™ (HDA/DA) server');
    expect(pipe.transform('opcua')).toBe('Query data from OPC UA™ server (HA/DA)');
    expect(pipe.transform('oracle')).toBe('Query data from an Oracle Database™');
    expect(pipe.transform('osisoft-pi')).toBe('Establish a connection with an OIBus Agent to access data from a PI System™');
    expect(pipe.transform('postgresql')).toBe('Query PostgreSQL databases');
    expect(pipe.transform('sftp')).toBe('Read files from a remote SFTP server');
    expect(pipe.transform('sqlite')).toBe('Query  SQLite™ databases');
  });
});
