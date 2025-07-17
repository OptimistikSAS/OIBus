import { TestBed } from '@angular/core/testing';

import { EditSouthComponent } from './edit-south.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { SouthConnectorService } from '../../services/south-connector.service';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ScanModeService } from '../../services/scan-mode.service';
import { provideHttpClient } from '@angular/common/http';
import { SouthConnectorDTO } from '../../../../../backend/shared/model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { OIBusObjectFormControlComponent } from '../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { CertificateService } from '../../services/certificate.service';

class EditSouthComponentTester extends ComponentTester<EditSouthComponent> {
  constructor() {
    super(EditSouthComponent);
  }

  get title() {
    return this.element('h1');
  }

  get name() {
    return this.input('#south-name');
  }

  get enabled() {
    return this.input('#south-enabled');
  }

  get maxInstant() {
    return this.input('#south-max-instant-per-item')!;
  }

  get description() {
    return this.input('#south-description');
  }

  get specificTitle() {
    return this.element('#specific-settings-title');
  }

  get specificForm() {
    return this.element(OIBusObjectFormControlComponent);
  }
}
describe('EditSouthComponent', () => {
  let tester: EditSouthComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let scanModeService: jasmine.SpyObj<ScanModeService>;
  let certificateService: jasmine.SpyObj<CertificateService>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    scanModeService = createMock(ScanModeService);
    certificateService = createMock(CertificateService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClient(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService }
      ]
    });

    scanModeService.list.and.returnValue(of([]));
    certificateService.list.and.returnValue(of([]));

    southConnectorService.getSouthConnectorTypeManifest.and.returnValue(of(testData.south.manifest));
  });

  describe('create mode', () => {
    beforeEach(() => {
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ queryParams: { type: 'SQL' } }) });

      tester = new EditSouthComponentTester();
      tester.detectChanges();
    });

    it('should display general settings', () => {
      expect(tester.title).toContainText('Create Folder scanner south connector');
      expect(tester.enabled).toBeChecked();
      expect(tester.description).toHaveValue('');
      expect(tester.specificForm).toBeDefined();

      expect(scanModeService.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('edit mode', () => {
    const southConnector: SouthConnectorDTO<SouthSettings, SouthItemSettings> = {
      id: 'id1',
      type: 'mssql',
      name: 'My South Connector 1',
      description: 'My South connector description',
      enabled: true,
      settings: {} as SouthSettings,
      items: []
    };

    beforeEach(() => {
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { southId: 'id1' }, queryParams: { type: 'SQL' } }) });

      southConnectorService.get.and.returnValue(of(southConnector));
      tester = new EditSouthComponentTester();
      tester.detectChanges();
    });

    it('should display general settings', () => {
      expect(southConnectorService.get).toHaveBeenCalledWith('id1');
      expect(tester.title).toContainText('Edit My South Connector 1');
      expect(tester.enabled).toBeChecked();
      expect(tester.description).toHaveValue('My South connector description');
      expect(tester.specificForm).toBeDefined();
      expect(tester.specificTitle).toContainText('Folder scanner settings');
    });
  });
});
