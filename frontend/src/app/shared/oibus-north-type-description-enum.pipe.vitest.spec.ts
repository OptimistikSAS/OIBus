import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { OIBusNorthTypeDescriptionEnumPipe } from './oibus-north-type-description-enum.pipe';

describe('OIBusNorthTypeDescriptionEnumPipe', () => {
  test('should translate north type description', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new OIBusNorthTypeDescriptionEnumPipe());
    expect(pipe.transform('aws-s3')).toBe('Store files in Amazon S3™ (Simple Storage Service)');
    expect(pipe.transform('azure-blob')).toBe('Store files in Microsoft Azure Blob Storage™');
    expect(pipe.transform('console')).toBe('Display filenames or values in Console (used for debug)');
    expect(pipe.transform('file-writer')).toBe('Write files and data to the output folder');
    expect(pipe.transform('oianalytics')).toBe('Send files and values to OIAnalytics®');
    expect(pipe.transform('sftp')).toBe('Upload files and data to an SFTP server');
  });
});
