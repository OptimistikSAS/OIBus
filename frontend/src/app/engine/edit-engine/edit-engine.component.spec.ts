import { TestBed } from '@angular/core/testing';

import { EditEngineComponent } from './edit-engine.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { EngineSettingsDTO } from '../../../../../shared/model/engine.model';
import { EngineService } from '../../services/engine.service';
import { of } from 'rxjs';
import { NotificationService } from '../../shared/notification.service';

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

  get proxyEnabled() {
    return this.input('#proxy-enabled')!;
  }

  get proxyPort() {
    return this.input('#proxy-port')!;
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

  get lokiUsername() {
    return this.input('#loki-username');
  }

  get lokiPassword() {
    return this.input('#loki-password');
  }

  get oiaLevel() {
    return this.select('#oia-level')!;
  }

  get oiaInterval() {
    return this.input('#oia-interval');
  }

  get submitButton() {
    return this.button('#save-button')!;
  }
}

describe('EditEngineComponent', () => {
  let tester: EditEngineComponentTester;
  let engineService: jasmine.SpyObj<EngineService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  const engineSettings: EngineSettingsDTO = {
    id: 'id',
    name: 'OIBus Test',
    port: 2223,
    version: '3.3.3',
    proxyEnabled: true,
    proxyPort: 9000,
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
        username: 'oibus',
        password: 'pass'
      },
      oia: {
        level: 'silent',
        interval: 60
      }
    }
  };

  beforeEach(() => {
    engineService = createMock(EngineService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        provideI18nTesting(),
        { provide: EngineService, useValue: engineService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    engineService.getEngineSettings.and.returnValue(of(engineSettings));

    engineService.updateEngineSettings.and.returnValue(of(undefined));

    tester = new EditEngineComponentTester();
    tester.detectChanges();
  });

  it('should display title and filled form', () => {
    expect(tester.title).toContainText('Edit engine settings');
    expect(tester.name).toHaveValue(engineSettings.name);
    expect(tester.port).toHaveValue(engineSettings.port.toString());
    expect(tester.proxyPort).toHaveValue(engineSettings.proxyPort.toString());
    expect(tester.proxyEnabled).toBeChecked();
    expect(tester.consoleLevel).toHaveSelectedLabel('Silent');
    expect(tester.fileLevel).toHaveSelectedLabel('Trace');
    expect(tester.fileMaxFileSize).toHaveValue(engineSettings.logParameters.file.maxFileSize.toString());
    expect(tester.fileNumberOfFiles).toHaveValue(engineSettings.logParameters.file.numberOfFiles.toString());
    expect(tester.databaseLevel).toHaveSelectedLabel('Silent');
    expect(tester.databaseMaxNumberOfLogs).toHaveValue('100000');
    expect(tester.lokiLevel).toHaveSelectedLabel('Error');
    expect(tester.lokiInterval).toHaveValue(engineSettings.logParameters.loki.interval.toString());
    expect(tester.lokiAddress).toHaveValue(engineSettings.logParameters.loki.address);
    expect(tester.lokiUsername).toHaveValue(engineSettings.logParameters.loki.username);
    expect(tester.lokiPassword).toHaveValue(engineSettings.logParameters.loki.password);
    expect(tester.oiaLevel).toHaveSelectedLabel('Silent');
    expect(tester.oiaInterval).toHaveValue(engineSettings.logParameters.oia.interval.toString());
  });

  it('should update engine settings', () => {
    tester.name.fillWith('OIBus Dev');

    tester.proxyPort.fillWith('8000');
    tester.proxyEnabled.uncheck();

    tester.consoleLevel.selectLabel('Error');
    tester.fileNumberOfFiles!.fillWith('10');
    tester.lokiLevel.selectLabel('Silent');
    tester.oiaLevel.selectLabel('Error');

    expect(tester.name).toHaveValue('OIBus Dev');
    expect(tester.consoleLevel).toHaveSelectedLabel('Error');
    expect(tester.fileNumberOfFiles).toHaveValue('10');
    expect(tester.lokiLevel).toHaveSelectedLabel('Silent');
    expect(tester.oiaLevel).toHaveSelectedLabel('Error');

    tester.submitButton.click();

    expect(engineService.updateEngineSettings).toHaveBeenCalledWith({
      name: 'OIBus Dev',
      port: 2223,
      proxyEnabled: false,
      proxyPort: 8000,
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
          username: 'oibus',
          password: 'pass'
        },
        oia: {
          level: 'error',
          interval: 60
        }
      }
    });
    expect(notificationService.success).toHaveBeenCalledWith('engine.updated');
  });
});
