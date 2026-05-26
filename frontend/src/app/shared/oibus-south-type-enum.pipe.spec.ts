import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { OIBusSouthTypeEnumPipe } from './oibus-south-type-enum.pipe';

describe('OIBusSouthTypeEnumPipe', () => {
  test('should translate south type', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new OIBusSouthTypeEnumPipe());
    expect(pipe.transform('ads')).toBe('ADS - TwinCAT®');
    expect(pipe.transform('folder-scanner')).toBe('Folder scanner');
    expect(pipe.transform('modbus')).toBe('Modbus');
    expect(pipe.transform('mqtt')).toBe('MQTT');
    expect(pipe.transform('mssql')).toBe('Microsoft SQL Server™');
    expect(pipe.transform('mysql')).toBe('MySQL® / MariaDB™');
    expect(pipe.transform('odbc')).toBe('ODBC');
    expect(pipe.transform('oianalytics')).toBe('OIAnalytics®');
    expect(pipe.transform('oledb')).toBe('OLEDB');
    expect(pipe.transform('opc')).toBe('OPC Classic™');
    expect(pipe.transform('opcua')).toBe('OPC UA™');
    expect(pipe.transform('oracle')).toBe('Oracle Database™');
    expect(pipe.transform('osisoft-pi')).toBe('OSIsoft PI System™');
    expect(pipe.transform('postgresql')).toBe('PostgreSQL');
    expect(pipe.transform('sftp')).toBe('SFTP');
    expect(pipe.transform('sqlite')).toBe('SQLite™');
  });
});
