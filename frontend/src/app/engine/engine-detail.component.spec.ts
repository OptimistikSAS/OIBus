import { TestBed } from '@angular/core/testing';

import { EngineDetailComponent } from './engine-detail.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { EngineSettingsDTO } from '../../../../backend/shared/model/engine.model';
import { of, Subject } from 'rxjs';
import { EngineService } from '../services/engine.service';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ScanModeListComponent } from './scan-mode-list/scan-mode-list.component';
import { IpFilterListComponent } from './ip-filter-list/ip-filter-list.component';
import { ConfirmationService } from '../shared/confirmation.service';
import { NotificationService } from '../shared/notification.service';
import { ScanModeService } from '../services/scan-mode.service';
import { IpFilterService } from '../services/ip-filter.service';
import { provideHttpClientTesting } from '@angular/common/http/testing';

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

  get scanModeList() {
    return this.element(ScanModeListComponent);
  }

  get ipFilterList() {
    return this.element(IpFilterListComponent);
  }

  get restartButton() {
    return this.button('#restart')!;
  }
}

describe('EngineDetailComponent', () => {
  let tester: EngineComponentTester;
  let engineService: jasmine.SpyObj<EngineService>;
  let scanModeService: jasmine.SpyObj<ScanModeService>;
  let ipFilterService: jasmine.SpyObj<IpFilterService>;
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
      },
      oia: {
        level: 'silent'
      }
    },
    proxyEnabled: true,
    proxyPort: 8888
  } as EngineSettingsDTO;

  beforeEach(() => {
    engineService = createMock(EngineService);
    scanModeService = createMock(ScanModeService);
    ipFilterService = createMock(IpFilterService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: EngineService, useValue: engineService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: IpFilterService, useValue: ipFilterService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    engineService.getEngineSettings.and.returnValue(of(engineSettings));
    scanModeService.list.and.returnValue(of([]));
    ipFilterService.list.and.returnValue(of([]));

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
    expect(table[2]).toContainText('Console: silent|');
    expect(table[2]).toContainText('File: trace|');
    expect(table[2]).toContainText('Database: silent|');
    expect(table[2]).toContainText('Loki: error');
    expect(table[3]).toContainText('Proxy serverEnabled on port 8888');

    expect(tester.scanModeList).toBeDefined();
    expect(tester.ipFilterList).toBeDefined();
  });

  it('should restart', () => {
    const restartSubject = new Subject<void>();
    engineService.restart.and.returnValue(restartSubject);
    confirmationService.confirm.and.returnValue(of(undefined));

    tester.restartButton.click();

    expect(tester.restartButton.disabled).toBeTrue();

    restartSubject.next();
    tester.detectChanges();

    expect(engineService.restart).toHaveBeenCalled();
    expect(notificationService.success).toHaveBeenCalledWith('engine.restart-complete');
  });
});
