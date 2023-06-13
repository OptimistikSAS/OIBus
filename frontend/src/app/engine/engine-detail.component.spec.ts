import { TestBed } from '@angular/core/testing';

import { EngineDetailComponent } from './engine-detail.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { EngineSettingsDTO } from '../../../../shared/model/engine.model';
import { of, Subject } from 'rxjs';
import { EngineService } from '../services/engine.service';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { ProxyListComponent } from './proxy-list/proxy-list.component';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ScanModeListComponent } from './scan-mode-list/scan-mode-list.component';
import { ExternalSourceListComponent } from './external-source-list/external-source-list.component';
import { IpFilterListComponent } from './ip-filter-list/ip-filter-list.component';
import { ConfirmationService } from '../shared/confirmation.service';
import { NotificationService } from '../shared/notification.service';
import { ProxyService } from '../services/proxy.service';
import { ScanModeService } from '../services/scan-mode.service';
import { IpFilterService } from '../services/ip-filter.service';
import { ExternalSourceService } from '../services/external-source.service';

class EngineComponentTester extends ComponentTester<EngineDetailComponent> {
  constructor() {
    super(EngineDetailComponent);
  }

  get title() {
    return this.element('h1')!;
  }

  get generalSettings() {
    return this.elements('tbody.general-settings tr');
  }

  get healthSignalHttpEnabled() {
    return this.element('#health-http')!;
  }

  get editButton() {
    return this.button('#edit-link')!;
  }

  get proxyList() {
    return this.element(ProxyListComponent);
  }

  get scanModeList() {
    return this.element(ScanModeListComponent);
  }

  get externalSourceList() {
    return this.element(ExternalSourceListComponent);
  }

  get ipFilterList() {
    return this.element(IpFilterListComponent);
  }

  get shutdownButton() {
    return this.button('#shutdown')!;
  }

  get restartButton() {
    return this.button('#restart')!;
  }
}

describe('EngineDetailComponent', () => {
  let tester: EngineComponentTester;
  let engineService: jasmine.SpyObj<EngineService>;
  let proxyService: jasmine.SpyObj<ProxyService>;
  let scanModeService: jasmine.SpyObj<ScanModeService>;
  let ipFilterService: jasmine.SpyObj<IpFilterService>;
  let externalSourceService: jasmine.SpyObj<ExternalSourceService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  const engineSettings: EngineSettingsDTO = {
    id: 'id',
    name: 'OIBus Test',
    port: 2223,
    logParameters: {
      console: {
        level: 'silent'
      },
      file: {
        level: 'trace'
      },
      database: {
        level: 'silent'
      },
      loki: {
        level: 'error'
      }
    },
    healthSignal: {
      logging: {
        enabled: true
      },
      http: {
        enabled: true
      }
    }
  } as EngineSettingsDTO;

  beforeEach(() => {
    engineService = createMock(EngineService);
    proxyService = createMock(ProxyService);
    scanModeService = createMock(ScanModeService);
    ipFilterService = createMock(IpFilterService);
    externalSourceService = createMock(ExternalSourceService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      imports: [EngineDetailComponent, ProxyListComponent],
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClient(),
        { provide: EngineService, useValue: engineService },
        { provide: ProxyService, useValue: proxyService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: IpFilterService, useValue: ipFilterService },
        { provide: ExternalSourceService, useValue: externalSourceService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    engineService.getEngineSettings.and.returnValue(of(engineSettings));
    proxyService.list.and.returnValue(of([]));
    scanModeService.list.and.returnValue(of([]));
    ipFilterService.list.and.returnValue(of([]));
    externalSourceService.list.and.returnValue(of([]));

    tester = new EngineComponentTester();
    tester.detectChanges();
  });

  it('should display engine settings', () => {
    expect(tester.title).toContainText('Engine');

    const table = tester.generalSettings;
    expect(table[0]).toContainText('Name');
    expect(table[0]).toContainText('OIBus Test');
    expect(table[1]).toContainText('Port');
    expect(table[1]).toContainText('2223');
    expect(table[2]).toContainText('Log levels');
    expect(table[2]).toContainText('Console:silent');
    expect(table[2]).toContainText('File:trace');
    expect(table[2]).toContainText('Database:silent');
    expect(table[2]).toContainText('Loki:error');

    expect(tester.proxyList).toBeDefined();
    expect(tester.scanModeList).toBeDefined();
    expect(tester.externalSourceList).toBeDefined();
    expect(tester.ipFilterList).toBeDefined();
  });

  it('should shut down', () => {
    const shutdownSubject = new Subject<void>();
    engineService.shutdown.and.returnValue(shutdownSubject);
    confirmationService.confirm.and.returnValue(of(undefined));

    tester.shutdownButton.click();

    expect(tester.shutdownButton.disabled).toBeTrue();
    expect(tester.restartButton.disabled).toBeTrue();

    shutdownSubject.next();
    tester.detectChanges();

    expect(engineService.shutdown).toHaveBeenCalled();
    expect(notificationService.success).toHaveBeenCalledWith('engine.shutdown-complete');
  });

  it('should restart', () => {
    const restartSubject = new Subject<void>();
    engineService.restart.and.returnValue(restartSubject);
    confirmationService.confirm.and.returnValue(of(undefined));

    tester.restartButton.click();

    expect(tester.shutdownButton.disabled).toBeTrue();
    expect(tester.restartButton.disabled).toBeTrue();

    restartSubject.next();
    tester.detectChanges();

    expect(engineService.restart).toHaveBeenCalled();
    expect(notificationService.success).toHaveBeenCalledWith('engine.restart-complete');
  });
});
