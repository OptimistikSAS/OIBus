import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { VersionCheckService } from './version-check.service';
import { EngineService } from '../services/engine.service';
import { of } from 'rxjs';
import { OIBusInfo } from '../../../../backend/shared/model/engine.model';

describe('VersionCheckService', () => {
  let service: VersionCheckService;
  let engineService: jasmine.SpyObj<EngineService>;

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
    const engineServiceSpy = jasmine.createSpyObj('EngineService', ['getInfo']);

    TestBed.configureTestingModule({
      providers: [VersionCheckService, { provide: EngineService, useValue: engineServiceSpy }]
    });

    service = TestBed.inject(VersionCheckService);
    engineService = TestBed.inject(EngineService) as jasmine.SpyObj<EngineService>;
  });

  afterEach(() => {
    service.reset();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch initial version on start monitoring', fakeAsync(() => {
    engineService.getInfo.and.returnValue(of(mockOIBusInfo));

    service.startMonitoring();
    tick();

    expect(engineService.getInfo).toHaveBeenCalled();
  }));

  it('should detect version change', fakeAsync(() => {
    engineService.getInfo.and.returnValue(of(mockOIBusInfo));

    let versionChangeDetected = false;
    service.versionChange$.subscribe(change => {
      expect(change.oldVersion).toBe('1.0.0');
      expect(change.newVersion).toBe('2.0.0');
      versionChangeDetected = true;
    });

    service.startMonitoring();
    tick(); // Initial fetch

    // Change version
    engineService.getInfo.and.returnValue(of({ ...mockOIBusInfo, version: '2.0.0' }));
    tick(10000); // Wait for next poll

    expect(versionChangeDetected).toBe(true);
  }));

  it('should not emit if version has not changed', fakeAsync(() => {
    engineService.getInfo.and.returnValue(of(mockOIBusInfo));

    let versionChangeCount = 0;
    service.versionChange$.subscribe(() => {
      versionChangeCount++;
    });

    service.startMonitoring();
    tick(); // Initial fetch
    tick(10000); // First poll - same version
    tick(10000); // Second poll - same version

    expect(versionChangeCount).toBe(0);
  }));

  it('should stop monitoring when stopMonitoring is called', fakeAsync(() => {
    engineService.getInfo.and.returnValue(of(mockOIBusInfo));

    service.startMonitoring();
    tick();

    const callCountBefore = engineService.getInfo.calls.count();
    service.stopMonitoring();

    tick(10000);
    const callCountAfter = engineService.getInfo.calls.count();

    expect(callCountAfter).toBe(callCountBefore);
  }));

  it('should stop monitoring after detecting a version change', fakeAsync(() => {
    engineService.getInfo.and.returnValue(of(mockOIBusInfo));

    service.startMonitoring();
    tick(); // Initial fetch

    // Change version
    engineService.getInfo.and.returnValue(of({ ...mockOIBusInfo, version: '2.0.0' }));
    tick(10000); // Detect change

    const callCountBefore = engineService.getInfo.calls.count();
    tick(10000); // Should not poll anymore
    const callCountAfter = engineService.getInfo.calls.count();

    expect(callCountAfter).toBe(callCountBefore);
  }));

  it('should not start monitoring twice', fakeAsync(() => {
    engineService.getInfo.and.returnValue(of(mockOIBusInfo));

    service.startMonitoring();
    tick();
    service.startMonitoring();
    tick();

    // Should only call getInfo once for the initial fetch
    expect(engineService.getInfo.calls.count()).toBe(1);
  }));

  it('should reset state', fakeAsync(() => {
    engineService.getInfo.and.returnValue(of(mockOIBusInfo));

    service.startMonitoring();
    tick();

    service.reset();

    // After reset, should be able to start monitoring again
    service.startMonitoring();
    tick();

    expect(engineService.getInfo.calls.count()).toBe(2);
  }));
});
