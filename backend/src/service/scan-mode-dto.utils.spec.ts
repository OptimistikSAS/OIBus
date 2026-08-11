import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toScanModeDTO } from './scan-mode-dto.utils';
import { ScanMode } from '../model/scan-mode.model';
import { ActivationWindow } from '../../shared/model/scan-mode.model';
import { GetUserInfo } from '../../shared/model/types';

const getUserInfo: GetUserInfo = (id: string) => ({ id, friendlyName: id });

const baseScanMode: ScanMode = {
  id: 'id1',
  name: 'scan mode',
  description: 'a description',
  type: 'cron',
  cron: '* * * * * *',
  interval: null,
  activationWindow: null,
  createdBy: 'creator',
  updatedBy: 'updater',
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-02T00:00:00.000Z'
};

const withWindow = (activationWindow: ActivationWindow | null): ScanMode => ({ ...baseScanMode, activationWindow });

describe('scan-mode-dto utils', () => {
  describe('toScanModeDTO', () => {
    it('should map plain fields and user info regardless of schedule type', () => {
      const result = toScanModeDTO(baseScanMode, getUserInfo);

      assert.strictEqual(result.id, baseScanMode.id);
      assert.strictEqual(result.name, baseScanMode.name);
      assert.strictEqual(result.description, baseScanMode.description);
      assert.strictEqual(result.cron, baseScanMode.cron);
      assert.deepStrictEqual(result.createdBy, getUserInfo(baseScanMode.createdBy));
      assert.deepStrictEqual(result.updatedBy, getUserInfo(baseScanMode.updatedBy));
      assert.strictEqual(result.createdAt, baseScanMode.createdAt);
      assert.strictEqual(result.updatedAt, baseScanMode.updatedAt);
    });

    it('should map a cron-type scan mode with a null interval', () => {
      const result = toScanModeDTO(baseScanMode, getUserInfo);

      assert.strictEqual(result.type, 'cron');
      assert.strictEqual(result.interval, null);
    });

    it('should map an interval-type scan mode with its interval payload', () => {
      const intervalScanMode: ScanMode = { ...baseScanMode, type: 'interval', interval: { value: 30, unit: 's' } };

      const result = toScanModeDTO(intervalScanMode, getUserInfo);

      assert.strictEqual(result.type, 'interval');
      assert.deepStrictEqual(result.interval, { value: 30, unit: 's' });
    });

    it('should report no activation window and no expiry when none is configured', () => {
      const result = toScanModeDTO(withWindow(null), getUserInfo);

      assert.strictEqual(result.activationWindow, null);
      assert.strictEqual(result.activationWindowExpired, false);
    });

    it('should pass an activation window through untouched and report it as not expired', () => {
      const window: ActivationWindow = { dateRange: { start: '2000-01-01T00:00:00.000Z', end: '3000-01-01T00:00:00.000Z' } };

      const result = toScanModeDTO(withWindow(window), getUserInfo);

      assert.deepStrictEqual(result.activationWindow, window);
      assert.strictEqual(result.activationWindowExpired, false);
    });

    it('should flag an activation window whose date range has already ended as expired', () => {
      const window: ActivationWindow = { dateRange: { end: '2000-01-01T00:00:00.000Z' } };

      const result = toScanModeDTO(withWindow(window), getUserInfo);

      assert.deepStrictEqual(result.activationWindow, window);
      assert.strictEqual(result.activationWindowExpired, true);
    });

    it('should not flag an open-ended future window as expired', () => {
      const window: ActivationWindow = { dateRange: { start: '3000-01-01T00:00:00.000Z' } };

      const result = toScanModeDTO(withWindow(window), getUserInfo);

      assert.strictEqual(result.activationWindowExpired, false);
    });

    it('should flag a recurring window with an unknown timezone as expired', () => {
      const window: ActivationWindow = { recurring: { timezone: 'Not/AZone' } };

      const result = toScanModeDTO(withWindow(window), getUserInfo);

      assert.strictEqual(result.activationWindowExpired, true);
    });

    it('should not flag a recurring window with a valid overnight time range as expired', () => {
      const window: ActivationWindow = { recurring: { timezone: 'UTC', timeOfDay: { start: '22:00', end: '02:00' } } };

      const result = toScanModeDTO(withWindow(window), getUserInfo);

      assert.strictEqual(result.activationWindowExpired, false);
    });
  });
});
