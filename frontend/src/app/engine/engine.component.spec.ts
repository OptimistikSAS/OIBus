import { TestBed } from '@angular/core/testing';

import { EngineComponent } from './engine.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { EngineSettingsDTO } from '../model/engine.model';
import { of } from 'rxjs';
import { EngineService } from '../services/engine.service';
import { provideTestingI18n } from '../../i18n/mock-i18n';
import { ProxyListComponent } from './proxy-list/proxy-list.component';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ScanModeListComponent } from './scan-mode-list/scan-mode-list.component';
import { ExternalSourceListComponent } from './external-source-list/external-source-list.component';
import { IpFilterListComponent } from './ip-filter-list/ip-filter-list.component';

class EngineComponentTester extends ComponentTester<EngineComponent> {
  constructor() {
    super(EngineComponent);
  }

  get title() {
    return this.element('h1')!;
  }

  get name() {
    return this.element('#name')!;
  }

  get port() {
    return this.element('#port')!;
  }

  get consoleLevel() {
    return this.element('#console-level')!;
  }

  get fileLevel() {
    return this.element('#file-level')!;
  }

  get databaseLevel() {
    return this.element('#database-level')!;
  }

  get lokiLevel() {
    return this.element('#loki-level')!;
  }

  get healthSignalLoggingEnabled() {
    return this.element('#health-logging')!;
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
}

describe('EngineComponent', () => {
  let tester: EngineComponentTester;
  let engineService: jasmine.SpyObj<EngineService>;

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

    TestBed.configureTestingModule({
      imports: [EngineComponent, ProxyListComponent],
      providers: [provideTestingI18n(), provideRouter([]), provideHttpClient(), { provide: EngineService, useValue: engineService }]
    }).compileComponents();

    engineService.getEngineSettings.and.returnValue(of(engineSettings));

    tester = new EngineComponentTester();
    tester.detectChanges();
  });

  it('should display engine settings', () => {
    expect(tester.title).toContainText('Engine');
    expect(tester.name).toContainText('OIBus Test');
    expect(tester.port).toContainText('Port: 2223');
    expect(tester.consoleLevel).toContainText('Console: Silent');
    expect(tester.fileLevel).toContainText('File: Trace');
    expect(tester.databaseLevel).toContainText('Database: Silent');
    expect(tester.lokiLevel).toContainText('Loki: Error');
    expect(tester.healthSignalLoggingEnabled).toContainText('Logger: Enabled');
    expect(tester.healthSignalHttpEnabled).toContainText('HTTP: Enabled');
    expect(tester.editButton).toContainText('Edit settings');

    expect(tester.proxyList).toBeDefined();
    expect(tester.scanModeList).toBeDefined();
    expect(tester.externalSourceList).toBeDefined();
    expect(tester.ipFilterList).toBeDefined();
  });
});
