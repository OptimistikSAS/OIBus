import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { AuditUserPipe } from './audit-user.pipe';

describe('AuditUserPipe', () => {
  function createPipe(): AuditUserPipe {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    return TestBed.runInInjectionContext(() => new AuditUserPipe());
  }

  test('should translate the OIAnalytics and system users', () => {
    const pipe = createPipe();
    expect(pipe.transform({ id: 'oianalytics', friendlyName: 'OIAnalytics' })).toBe('OIAnalytics');
    expect(pipe.transform({ id: 'system', friendlyName: 'System' })).toBe('System');
  });

  test('should display the friendly name of regular users', () => {
    const pipe = createPipe();
    expect(pipe.transform({ id: 'user1', friendlyName: 'John Doe (john)' })).toBe('John Doe (john)');
  });

  test('should fall back on the user id, or an empty string without user', () => {
    const pipe = createPipe();
    expect(pipe.transform({ id: 'user1', friendlyName: '' })).toBe('user1');
    expect(pipe.transform(null)).toBe('');
  });
});
