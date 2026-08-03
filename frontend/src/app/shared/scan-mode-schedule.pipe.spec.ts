import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, test } from 'vitest';

import { isScanModeWindowExpired, ScanModeSchedulePipe } from './scan-mode-schedule.pipe';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { ScanModeDTO } from '../../../../backend/shared/model/scan-mode.model';

const scanMode = (overrides: Partial<ScanModeDTO>): ScanModeDTO =>
  ({
    id: 'id',
    name: 'name',
    description: '',
    type: 'cron',
    cron: '* * * * * *',
    interval: null,
    activationWindow: null,
    activationWindowExpired: false,
    ...overrides
  }) as ScanModeDTO;

describe('ScanModeSchedulePipe', () => {
  let pipe: ScanModeSchedulePipe;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting(), ScanModeSchedulePipe] });
    pipe = TestBed.inject(ScanModeSchedulePipe);
  });

  test('should render the raw cron expression for a cron scan mode', () => {
    expect(pipe.transform(scanMode({ cron: '0 0 * * * *' }))).toBe('0 0 * * * *');
  });

  test('should render a readable period for an interval scan mode', () => {
    expect(pipe.transform(scanMode({ type: 'interval', cron: '', interval: { value: 30, unit: 's' } }))).toBe('every 30 s');
    expect(pipe.transform(scanMode({ type: 'interval', cron: '', interval: { value: 500, unit: 'ms' } }))).toBe('every 500 ms');
    expect(pipe.transform(scanMode({ type: 'interval', cron: '', interval: { value: 5, unit: 'min' } }))).toBe('every 5 min');
    expect(pipe.transform(scanMode({ type: 'interval', cron: '', interval: { value: 2, unit: 'hour' } }))).toBe('every 2 h');
  });

  test('should render nothing without a scan mode', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});

describe('isScanModeWindowExpired', () => {
  test('should only be true when the flag is set', () => {
    expect(isScanModeWindowExpired(scanMode({ activationWindowExpired: true }))).toBe(true);
    expect(isScanModeWindowExpired(scanMode({ activationWindowExpired: false }))).toBe(false);
    expect(isScanModeWindowExpired(null)).toBe(false);
  });
});
