import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { AuditEntityTypesEnumPipe } from './audit-entity-types-enum.pipe';
import { AUDIT_ENTITY_TYPES } from '../../../../backend/shared/model/audit.model';

describe('AuditEntityTypesEnumPipe', () => {
  test('should translate every audit entity type', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new AuditEntityTypesEnumPipe());
    for (const entityType of AUDIT_ENTITY_TYPES) {
      expect(pipe.transform(entityType)).toBeTruthy();
    }
  });

  test('should translate south connector', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new AuditEntityTypesEnumPipe());
    expect(pipe.transform('south_connector')).toBe('South connector');
  });
});
