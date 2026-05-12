import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { OIBusNorthTypeEnumPipe } from './oibus-north-type-enum.pipe';

describe('OIBusNorthTypeEnumPipe', () => {
  test('should translate north type', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new OIBusNorthTypeEnumPipe());
    expect(pipe.transform('aws-s3')).toBe('Amazon S3™');
    expect(pipe.transform('azure-blob')).toBe('Azure Blob Storage™');
    expect(pipe.transform('console')).toBe('Console');
    expect(pipe.transform('file-writer')).toBe('File writer');
    expect(pipe.transform('oianalytics')).toBe('OIAnalytics®');
    expect(pipe.transform('sftp')).toBe('SFTP');
  });
});
