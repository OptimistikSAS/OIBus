import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, test } from 'vitest';

import { ItemTestResultComponent } from './item-test-result.component';
import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { OIBusAnyContent, OIBusTimeValueContent } from '../../../../../../../backend/shared/model/engine.model';

describe('ItemTestResultComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });
  });

  test('should display info message', () => {
    const fixture = TestBed.createComponent(ItemTestResultComponent);
    fixture.detectChanges();

    fixture.componentInstance.displayInfo('Test info message');

    expect(fixture.componentInstance.message).toEqual({ type: 'info', value: 'Test info message' });
  });

  test('should display result for time-values content', () => {
    const fixture = TestBed.createComponent(ItemTestResultComponent);
    fixture.detectChanges();

    const content: OIBusTimeValueContent = {
      type: 'time-values',
      content: [
        {
          pointId: 'point1',
          timestamp: '2024-01-01T00:00:00.000Z',
          data: { value: '42' }
        }
      ]
    };

    fixture.componentInstance.displayResult(content);
    fixture.detectChanges();

    expect(fixture.componentInstance.result).toEqual(content);
    expect(fixture.componentInstance.message).toBeNull();
    expect(fixture.componentInstance.isLoading).toBe(false);
  });

  test('should drop stale table mode when a new result no longer supports it', () => {
    const fixture = TestBed.createComponent(ItemTestResultComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    // Raw time-values result -> defaults to table mode.
    component.displayResult({
      type: 'time-values',
      content: [{ pointId: 'p', timestamp: '2024-01-01T00:00:00.000Z', data: { value: '1' } }]
    } as OIBusTimeValueContent);
    expect(component.displayMode()).toBe('table');

    // Transformed any-content result has no table mode -> must switch to 'any', not stay stuck on 'table'.
    component.displayResult({ type: 'any-content', content: '[]' } as OIBusAnyContent);
    expect(component.displayMode()).toBe('any');
  });
});
