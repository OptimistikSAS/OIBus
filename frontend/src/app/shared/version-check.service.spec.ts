import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { VersionCheckService } from './version-check.service';
import { EngineService } from '../services/engine.service';
import { of } from 'rxjs';
import { OIBusInfo } from '../../../../backend/shared/model/engine.model';
import { createMock, MockObject } from '../../test/vitest-create-mock';

describe('VersionCheckService', () => {
  let service: VersionCheckService;
  let engineService: MockObject<EngineService>;

  const mockOIBusInfo: OIBusInfo = {
    version: '1.0.0',
    launcherVersion: '1.0.0',
    oibusName: 'Test OIBus',
    oibusId: 'test-id',
    dataDirectory: '/data',
    binaryDirectory: '/bin',
    processId: '12345',
    hostname: 'localhost',
    operatingSystem: 'linux',
    architecture: 'x64',
    platform: 'ubuntu'
  };

  beforeEach(() => {
    engineService = createMock(EngineService);
    TestBed.configureTestingModule({
      providers: [VersionCheckService, { provide: EngineService, useValue: engineService }]
    });
    service = TestBed.inject(VersionCheckService);
  });

  afterEach(() => {
    service.reset();
    vi.useRealTimers();
  });

  test('should be created', () => {
    expect(service).toBeTruthy();
  });

  test('should fetch initial version on start monitoring', () => {
    vi.useFakeTimers();
    engineService.getInfo.mockReturnValue(of(mockOIBusInfo));
    service.startMonitoring();
    vi.advanceTimersByTime(0);
    expect(engineService.getInfo).toHaveBeenCalled();
  });

  test('should detect version change', () => {
    vi.useFakeTimers();
    engineService.getInfo.mockReturnValue(of(mockOIBusInfo));

    let versionChangeDetected = false;
    service.versionChange$.subscribe(change => {
      expect(change.oldVersion).toBe('1.0.0');
      expect(change.newVersion).toBe('2.0.0');
      versionChangeDetected = true;
    });

    service.startMonitoring();
    vi.advanceTimersByTime(0);

    engineService.fetchInfo.mockReturnValue(of({ ...mockOIBusInfo, version: '2.0.0' }));
    vi.advanceTimersByTime(10000);

    expect(versionChangeDetected).toBe(true);
  });

  test('should not emit if version has not changed', () => {
    vi.useFakeTimers();
    engineService.getInfo.mockReturnValue(of(mockOIBusInfo));
    engineService.fetchInfo.mockReturnValue(of(mockOIBusInfo));

    let versionChangeCount = 0;
    service.versionChange$.subscribe(() => versionChangeCount++);

    service.startMonitoring();
    vi.advanceTimersByTime(0);
    vi.advanceTimersByTime(10000);
    vi.advanceTimersByTime(10000);

    expect(versionChangeCount).toBe(0);
  });

  test('should stop monitoring when stopMonitoring is called', () => {
    vi.useFakeTimers();
    engineService.getInfo.mockReturnValue(of(mockOIBusInfo));
    engineService.fetchInfo.mockReturnValue(of(mockOIBusInfo));
    service.startMonitoring();
    vi.advanceTimersByTime(0);

    const callCountBefore = engineService.fetchInfo.mock.calls.length;
    service.stopMonitoring();
    vi.advanceTimersByTime(10000);
    const callCountAfter = engineService.fetchInfo.mock.calls.length;

    expect(callCountAfter).toBe(callCountBefore);
  });

  test('should stop monitoring after detecting a version change', () => {
    vi.useFakeTimers();
    engineService.getInfo.mockReturnValue(of(mockOIBusInfo));
    service.startMonitoring();
    vi.advanceTimersByTime(0);

    engineService.fetchInfo.mockReturnValue(of({ ...mockOIBusInfo, version: '2.0.0' }));
    vi.advanceTimersByTime(10000);

    const callCountBefore = engineService.fetchInfo.mock.calls.length;
    vi.advanceTimersByTime(10000);
    const callCountAfter = engineService.fetchInfo.mock.calls.length;

    expect(callCountAfter).toBe(callCountBefore);
  });

  test('should not start monitoring twice', () => {
    vi.useFakeTimers();
    engineService.getInfo.mockReturnValue(of(mockOIBusInfo));
    service.startMonitoring();
    vi.advanceTimersByTime(0);
    service.startMonitoring();
    vi.advanceTimersByTime(0);
    expect(engineService.getInfo.mock.calls.length).toBe(1);
  });

  test('should reset state', () => {
    vi.useFakeTimers();
    engineService.getInfo.mockReturnValue(of(mockOIBusInfo));
    service.startMonitoring();
    vi.advanceTimersByTime(0);
    service.reset();
    service.startMonitoring();
    vi.advanceTimersByTime(0);
    expect(engineService.getInfo.mock.calls.length).toBe(2);
  });
});
