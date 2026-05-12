import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { OibusCommandStatusEnumPipe } from './oibus-command-status-enum.pipe';

describe('OibusCommandStatusEnumPipe', () => {
  test('should translate OIBus command status', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new OibusCommandStatusEnumPipe());
    expect(pipe.transform('RETRIEVED')).toBe('Pending');
    expect(pipe.transform('ERRORED')).toBe('Errored');
    expect(pipe.transform('CANCELLED')).toBe('Cancelled');
    expect(pipe.transform('COMPLETED')).toBe('Completed');
  });
});
