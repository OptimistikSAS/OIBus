import { TestBed } from '@angular/core/testing';

import { EditEngineComponent } from './edit-engine.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { provideTestingI18n } from '../../../i18n/mock-i18n';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { EngineSettingsCommandDTO, EngineSettingsDTO } from '../../model/engine.model';
import { EngineService } from '../../services/engine.service';
import { ProxyService } from '../../services/proxy.service';
import { ProxyDTO } from '../../model/proxy.model';
import { of } from 'rxjs';
import { NotificationService } from '../../shared/notification.service';
import { SaveButtonComponent } from '../../shared/save-button/save-button.component';

class EditEngineComponentTester extends ComponentTester<EditEngineComponent> {
  constructor() {
    super(EditEngineComponent);
  }

  get title() {
    return this.element('h1')!;
  }

  get name() {
    return this.input('#name')!;
  }

  get port() {
    return this.input('#port')!;
  }

  get consoleLevel() {
    return this.select('#console-level')!;
  }

  get fileLevel() {
    return this.select('#file-level')!;
  }

  get fileMaxFileSize() {
    return this.input('#file-max-file-size');
  }

  get fileNumberOfFiles() {
    return this.input('#file-number-of-files');
  }

  get databaseLevel() {
    return this.select('#database-level')!;
  }

  get databaseMaxNumberOfLogs() {
    return this.input('#database-max-number-of-logs');
  }

  get lokiLevel() {
    return this.select('#loki-level')!;
  }

  get lokiInterval() {
    return this.input('#loki-interval');
  }

  get lokiAddress() {
    return this.input('#loki-address');
  }

  get lokiProxy() {
    return this.select('#loki-proxy');
  }

  get lokiTokenAddress() {
    return this.input('#loki-token-address');
  }

  get lokiUsername() {
    return this.input('#loki-username');
  }

  get lokiPassword() {
    return this.input('#loki-password');
  }

  get healthSignalLoggingEnabled() {
    return this.input('#health-signal-logging-enabled')!;
  }

  get healthSignalLoggingInterval() {
    return this.input('#health-signal-logging-interval');
  }

  get healthSignalHttpEnabled() {
    return this.input('#health-signal-http-enabled')!;
  }

  get healthSignalHttpVerbose() {
    return this.input('#health-signal-http-verbose');
  }

  get healthSignalHttpInterval() {
    return this.input('#health-signal-http-interval');
  }

  get healthSignalHttpAddress() {
    return this.input('#health-signal-http-address');
  }

  get healthSignalHttpProxy() {
    return this.select('#health-signal-http-proxy');
  }

  get submitButton() {
    return this.button('#save-button')!;
  }
}

describe('EditEngineComponent', () => {
  let tester: EditEngineComponentTester;
  let engineService: jasmine.SpyObj<EngineService>;
  let proxyService: jasmine.SpyObj<ProxyService>;
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
        level: 'trace',
        numberOfFiles: 5,
        maxFileSize: 10
      },
      database: {
        level: 'silent',
        maxNumberOfLogs: 100_000
      },
      loki: {
        level: 'error',
        interval: 60,
        address: 'http://loki.oibus.com',
        tokenAddress: 'http://token-address.oibus.com',
        username: 'oibus',
        password: 'pass',
        proxyId: null
      }
    },
    healthSignal: {
      logging: {
        enabled: true,
        interval: 60
      },
      http: {
        enabled: true,
        interval: 60,
        verbose: false,
        address: 'http://health-signal.oibus.com',
        proxyId: null,
        authentication: {
          type: 'basic',
          key: 'oibus',
          secret: 'pass'
        }
      }
    }
  };
  const proxies: Array<ProxyDTO> = [
    {
      id: 'id1',
      name: 'proxy1',
      description: 'My Proxy 1',
      address: 'http://localhost',
      username: 'user',
      password: 'pass'
    },
    {
      id: 'id2',
      name: 'proxy2',
      description: 'My Proxy 2',
      address: 'http://localhost',
      username: 'user',
      password: 'pass'
    }
  ];

  beforeEach(() => {
    engineService = createMock(EngineService);
    proxyService = createMock(ProxyService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      imports: [EditEngineComponent, SaveButtonComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        provideTestingI18n(),
        { provide: EngineService, useValue: engineService },
        { provide: ProxyService, useValue: proxyService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    engineService.getEngineSettings.and.returnValue(of(engineSettings));

    engineService.updateEngineSettings.and.returnValue(of(undefined));
    proxyService.getProxies.and.returnValue(of(proxies));

    tester = new EditEngineComponentTester();
    tester.detectChanges();
  });

  it('should display title and filled form', () => {
    expect(tester.title).toContainText('Engine');
    expect(tester.name).toHaveValue(engineSettings.name);
    expect(tester.port).toHaveValue(engineSettings.port.toString());
    expect(tester.consoleLevel).toHaveSelectedLabel('Silent');
    expect(tester.fileLevel).toHaveSelectedLabel('Trace');
    expect(tester.fileMaxFileSize).toHaveValue(engineSettings.logParameters.file.maxFileSize.toString());
    expect(tester.fileNumberOfFiles).toHaveValue(engineSettings.logParameters.file.numberOfFiles.toString());
    expect(tester.databaseLevel).toHaveSelectedLabel('Silent');
    expect(tester.databaseMaxNumberOfLogs).toBeNull();
    expect(tester.lokiLevel).toHaveSelectedLabel('Error');
    expect(tester.lokiInterval).toHaveValue(engineSettings.logParameters.loki.interval.toString());
    expect(tester.lokiAddress).toHaveValue(engineSettings.logParameters.loki.address);
    expect(tester.lokiTokenAddress).toHaveValue(engineSettings.logParameters.loki.tokenAddress);
    expect(tester.lokiAddress).toHaveValue(engineSettings.logParameters.loki.address);
    expect(tester.lokiUsername).toHaveValue(engineSettings.logParameters.loki.username);
    expect(tester.lokiPassword).toHaveValue(engineSettings.logParameters.loki.password);
    expect(tester.lokiProxy).toHaveSelectedLabel('');
    expect(tester.healthSignalLoggingEnabled).toBeChecked();
    expect(tester.healthSignalLoggingInterval).toHaveValue(engineSettings.healthSignal.logging.interval.toString());
    expect(tester.healthSignalHttpEnabled).toBeChecked();
    expect(tester.healthSignalHttpVerbose).not.toBeChecked();
    expect(tester.healthSignalHttpInterval).toHaveValue(engineSettings.healthSignal.http.interval.toString());
    expect(tester.healthSignalHttpAddress).toHaveValue(engineSettings.healthSignal.http.address);
    expect(tester.healthSignalHttpProxy).toHaveSelectedLabel('');
  });

  it('should update engine settings', () => {
    tester.name.fillWith('OIBus Dev');

    tester.consoleLevel.selectLabel('Error');
    tester.fileNumberOfFiles!.fillWith('10');
    tester.lokiLevel.selectLabel('Silent');
    tester.healthSignalLoggingEnabled.uncheck();
    tester.healthSignalHttpVerbose!.check();

    expect(tester.name).toHaveValue('OIBus Dev');
    expect(tester.consoleLevel).toHaveSelectedLabel('Error');
    expect(tester.fileNumberOfFiles).toHaveValue('10');
    expect(tester.lokiLevel).toHaveSelectedLabel('Silent');
    expect(tester.lokiInterval).toBeNull();
    expect(tester.lokiAddress).toBeNull();
    expect(tester.lokiTokenAddress).toBeNull();
    expect(tester.lokiAddress).toBeNull();
    expect(tester.lokiUsername).toBeNull();
    expect(tester.lokiPassword).toBeNull();
    expect(tester.lokiProxy).toBeNull();
    expect(tester.healthSignalLoggingEnabled).not.toBeChecked();
    expect(tester.healthSignalLoggingInterval).toBeNull();
    expect(tester.healthSignalHttpEnabled).toBeChecked();
    expect(tester.healthSignalHttpVerbose).toBeChecked();

    tester.submitButton.click();

    const expectedSettings: EngineSettingsCommandDTO = JSON.parse(JSON.stringify(engineSettings));

    expectedSettings.name = 'OIBus Dev';
    expectedSettings.logParameters.console.level = 'error';
    expectedSettings.logParameters.file.numberOfFiles = 10;
    expectedSettings.logParameters.loki.level = 'silent';
    expectedSettings.healthSignal.logging.enabled = false;
    expectedSettings.healthSignal.http.verbose = true;

    expect(engineService.updateEngineSettings).toHaveBeenCalledWith({
      name: 'OIBus Dev',
      port: 2223,
      logParameters: {
        console: {
          level: 'error'
        },
        file: {
          level: 'trace',
          numberOfFiles: 10,
          maxFileSize: 10
        },
        database: {
          level: 'silent',
          maxNumberOfLogs: 100_000
        },
        loki: {
          level: 'silent',
          interval: 60,
          address: 'http://loki.oibus.com',
          tokenAddress: 'http://token-address.oibus.com',
          username: 'oibus',
          password: 'pass',
          proxyId: null
        }
      },
      healthSignal: {
        logging: {
          enabled: false,
          interval: 60
        },
        http: {
          enabled: true,
          interval: 60,
          verbose: true,
          address: 'http://health-signal.oibus.com',
          proxyId: null,
          authentication: {
            type: 'basic',
            key: 'oibus',
            secret: 'pass'
          }
        }
      }
    });
    expect(notificationService.success).toHaveBeenCalledWith('engine.updated');
  });
});
