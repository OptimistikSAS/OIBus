import { RegisterOibusModalComponent } from './register-oibus-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { EngineService } from '../../../services/engine.service';
import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../../../../backend/shared/model/engine.model';

class RegisterOibusModalComponentTester extends ComponentTester<RegisterOibusModalComponent> {
  constructor() {
    super(RegisterOibusModalComponent);
  }

  get host() {
    return this.input('#host')!;
  }

  get acceptUnauthorized() {
    return this.input('#accept-unauthorized')!;
  }

  get useProxy() {
    return this.input('#use-proxy')!;
  }

  get proxyUrl() {
    return this.input('#proxy-url')!;
  }

  get proxyUsername() {
    return this.input('#proxy-username')!;
  }

  get proxyPassword() {
    return this.input('#proxy-password')!;
  }

  get commandRefreshInterval() {
    return this.input('#command-refresh-interval')!;
  }

  get commandRetryInterval() {
    return this.input('#command-retry-interval')!;
  }

  get messageRetryInterval() {
    return this.input('#message-retry-interval')!;
  }

  get validationErrors() {
    return this.elements('val-errors div');
  }

  get save() {
    return this.button('#save-button')!;
  }

  get cancel() {
    return this.button('#cancel-button')!;
  }
}

describe('RegisterOibusModalComponent', () => {
  let tester: RegisterOibusModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let engineService: jasmine.SpyObj<EngineService>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    engineService = createMock(EngineService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: EngineService, useValue: engineService }
      ]
    });

    engineService.updateRegistrationSettings.and.returnValue(of());
    engineService.editRegistrationSettings.and.returnValue(of());
    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new RegisterOibusModalComponentTester();
  });

  it('should have an empty form in register mode', () => {
    tester.componentInstance.prepare({ host: '' } as RegistrationSettingsDTO, 'register');
    tester.detectChanges();
    expect(tester.host).toHaveValue('');
    expect(tester.acceptUnauthorized).not.toBeChecked();
    expect(tester.useProxy).not.toBeChecked();
  });

  it('should not register if invalid', () => {
    tester.componentInstance.prepare({ host: '' } as RegistrationSettingsDTO, 'register');
    tester.detectChanges();
    tester.save.click();

    // host and the three intervals
    expect(tester.validationErrors.length).toBe(4);
    expect(fakeActiveModal.close).not.toHaveBeenCalled();
  });

  it('should register if valid', fakeAsync(() => {
    tester.componentInstance.prepare({ host: '' } as RegistrationSettingsDTO, 'register');
    tester.detectChanges();
    tester.host.fillWith('http://localhost:4200');
    tester.acceptUnauthorized.check();
    tester.useProxy.check();
    tester.proxyUrl.fillWith('http://localhost:8080');
    tester.proxyUsername.fillWith('user');
    tester.proxyPassword.fillWith('pass');
    tester.commandRefreshInterval.fillWith('15');
    tester.commandRetryInterval.fillWith('10');
    tester.messageRetryInterval.fillWith('5');
    tester.detectChanges();
    tester.save.click();

    const expectedCommand: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200',
      acceptUnauthorized: true,
      useProxy: true,
      proxyUrl: 'http://localhost:8080',
      proxyUsername: 'user',
      proxyPassword: 'pass',
      commandRefreshInterval: 15,
      commandRetryInterval: 10,
      messageRetryInterval: 5,
      commandPermissions: {
        updateVersion: true,
        restartEngine: true,
        regenerateCipherKeys: true,
        updateEngineSettings: true,
        updateRegistrationSettings: true,
        createScanMode: true,
        updateScanMode: true,
        deleteScanMode: true,
        createIpFilter: true,
        updateIpFilter: true,
        deleteIpFilter: true,
        createCertificate: true,
        updateCertificate: true,
        deleteCertificate: true,
        createHistoryQuery: true,
        updateHistoryQuery: true,
        deleteHistoryQuery: true,
        createOrUpdateHistoryItemsFromCsv: true,
        testHistoryNorthConnection: true,
        testHistorySouthConnection: true,
        testHistorySouthItem: true,
        createSouth: true,
        updateSouth: true,
        deleteSouth: true,
        createOrUpdateSouthItemsFromCsv: true,
        testSouthConnection: true,
        testSouthItem: true,
        createNorth: true,
        updateNorth: true,
        deleteNorth: true,
        testNorthConnection: true
      }
    };

    expect(engineService.updateRegistrationSettings).toHaveBeenCalledWith(expectedCommand);
  }));

  it('should cancel in register mode', () => {
    tester.componentInstance.prepare({ host: '' } as RegistrationSettingsDTO, 'register');
    tester.detectChanges();
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });

  it('should have an empty form in edit mode', () => {
    tester.componentInstance.prepare({ host: '' } as RegistrationSettingsDTO, 'edit');
    tester.detectChanges();
    expect(tester.host).toHaveValue('');
    expect(tester.acceptUnauthorized).not.toBeChecked();
    expect(tester.useProxy).not.toBeChecked();
  });

  it('should edit registration if valid', fakeAsync(() => {
    tester.componentInstance.prepare(
      {
        host: 'http://localhost:4200',
        commandRefreshInterval: 60,
        commandRetryInterval: 5,
        messageRetryInterval: 5,
        commandPermissions: {
          updateVersion: true,
          restartEngine: true,
          regenerateCipherKeys: true,
          updateEngineSettings: true,
          updateRegistrationSettings: true,
          createScanMode: true,
          updateScanMode: true,
          deleteScanMode: true,
          createIpFilter: true,
          updateIpFilter: true,
          deleteIpFilter: true,
          createCertificate: true,
          updateCertificate: true,
          deleteCertificate: true,
          createHistoryQuery: true,
          updateHistoryQuery: true,
          deleteHistoryQuery: true,
          createOrUpdateHistoryItemsFromCsv: true,
          createSouth: true,
          updateSouth: true,
          deleteSouth: true,
          createOrUpdateSouthItemsFromCsv: true,
          createNorth: true,
          updateNorth: true,
          deleteNorth: true
        }
      } as RegistrationSettingsDTO,
      'edit'
    );
    tester.detectChanges();
    tester.acceptUnauthorized.check();
    tester.useProxy.check();
    tester.proxyUrl.fillWith('http://localhost:8080');
    tester.proxyUsername.fillWith('user');
    tester.proxyPassword.fillWith('pass');
    tester.detectChanges();
    tester.save.click();

    const expectedCommand: RegistrationSettingsCommandDTO = {
      host: 'http://localhost:4200',
      acceptUnauthorized: true,
      useProxy: true,
      proxyUrl: 'http://localhost:8080',
      proxyUsername: 'user',
      proxyPassword: 'pass',
      commandRefreshInterval: 60,
      commandRetryInterval: 5,
      messageRetryInterval: 5,
      commandPermissions: {
        updateVersion: true,
        restartEngine: true,
        regenerateCipherKeys: true,
        updateEngineSettings: true,
        updateRegistrationSettings: true,
        createScanMode: true,
        updateScanMode: true,
        deleteScanMode: true,
        createIpFilter: true,
        updateIpFilter: true,
        deleteIpFilter: true,
        createCertificate: true,
        updateCertificate: true,
        deleteCertificate: true,
        createHistoryQuery: true,
        updateHistoryQuery: true,
        deleteHistoryQuery: true,
        createOrUpdateHistoryItemsFromCsv: true,
        testHistoryNorthConnection: true,
        testHistorySouthConnection: true,
        testHistorySouthItem: true,
        createSouth: true,
        updateSouth: true,
        deleteSouth: true,
        createOrUpdateSouthItemsFromCsv: true,
        testSouthConnection: true,
        testSouthItem: true,
        createNorth: true,
        updateNorth: true,
        deleteNorth: true,
        testNorthConnection: true
      }
    };

    expect(engineService.editRegistrationSettings).toHaveBeenCalledWith(expectedCommand);
  }));

  it('should cancel in edit mode', () => {
    tester.componentInstance.prepare({ host: '' } as RegistrationSettingsDTO, 'edit');
    tester.detectChanges();
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
