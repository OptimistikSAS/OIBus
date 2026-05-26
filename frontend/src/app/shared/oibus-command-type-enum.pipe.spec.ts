import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { OibusCommandTypeEnumPipe } from './oibus-command-type-enum.pipe';

describe('OibusCommandTypeEnumPipe', () => {
  test('should translate OIBus command type', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new OibusCommandTypeEnumPipe());
    expect(pipe.transform('update-version')).toBe('Upgrade version');
    expect(pipe.transform('restart-engine')).toBe('Restart');
    expect(pipe.transform('regenerate-cipher-keys')).toBe('Regenerate cipher keys');
    expect(pipe.transform('update-engine-settings')).toBe('Update engine settings');
    expect(pipe.transform('create-scan-mode')).toBe('Create scan mode');
    expect(pipe.transform('update-scan-mode')).toBe('Update scan mode');
    expect(pipe.transform('delete-scan-mode')).toBe('Delete scan mode');
    expect(pipe.transform('create-ip-filter')).toBe('Create IP filter');
    expect(pipe.transform('update-ip-filter')).toBe('Update IP filter');
    expect(pipe.transform('delete-ip-filter')).toBe('Delete IP filter');
    expect(pipe.transform('create-certificate')).toBe('Create certificate');
    expect(pipe.transform('update-certificate')).toBe('Update certificate');
    expect(pipe.transform('delete-certificate')).toBe('Delete certificate');
    expect(pipe.transform('create-south')).toBe('Create south connector');
    expect(pipe.transform('update-south')).toBe('Update south connector');
    expect(pipe.transform('delete-south')).toBe('Delete south connector');
    expect(pipe.transform('create-or-update-south-items-from-csv')).toBe('Load south items from CSV');
    expect(pipe.transform('create-north')).toBe('Create north connector');
    expect(pipe.transform('update-north')).toBe('Update north connector');
    expect(pipe.transform('delete-north')).toBe('Delete north connector');
  });
});
