import { TestBed } from '@angular/core/testing';

import { EditNorthComponent } from './edit-north.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { of } from 'rxjs';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { FormComponent } from '../../shared/form/form.component';
import { ScanModeService } from '../../services/scan-mode.service';
import { provideHttpClient } from '@angular/common/http';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NorthConnectorDTO, NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { CertificateService } from '../../services/certificate.service';

class EditNorthComponentTester extends ComponentTester<EditNorthComponent> {
  constructor() {
    super(EditNorthComponent);
  }

  get title() {
    return this.element('h1');
  }

  get name() {
    return this.input('#north-name');
  }

  get enabled() {
    return this.input('#north-enabled');
  }

  get description() {
    return this.input('#north-description');
  }

  get specificTitle() {
    return this.element('#specific-settings-title');
  }

  get specificForm() {
    return this.element(FormComponent);
  }
}
describe('EditNorthComponent', () => {
  let tester: EditNorthComponentTester;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;
  let scanModeService: jasmine.SpyObj<ScanModeService>;
  let certificateService: jasmine.SpyObj<CertificateService>;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);
    scanModeService = createMock(ScanModeService);
    certificateService = createMock(CertificateService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClient(),
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: CertificateService, useValue: certificateService }
      ]
    });

    scanModeService.list.and.returnValue(of([]));
    certificateService.list.and.returnValue(of([]));

    northConnectorService.getNorthConnectorTypeManifest.and.returnValue(
      of({
        id: 'console',
        category: 'debug',
        name: 'Console',
        description: 'Console description',
        modes: {
          files: true,
          points: true,
          items: false
        },
        settings: [],
        schema: {} as unknown
      } as NorthConnectorManifest)
    );
  });

  describe('create mode', () => {
    beforeEach(() => {
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ queryParams: { type: 'console' } }) });

      tester = new EditNorthComponentTester();
      tester.detectChanges();
    });

    it('should display general settings', () => {
      expect(tester.title).toContainText('Create Console north connector');
      expect(tester.enabled).toBeChecked();
      expect(tester.description).toHaveValue('');
      expect(tester.specificForm).toBeDefined();

      expect(scanModeService.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('edit mode', () => {
    const northConnector: NorthConnectorDTO = {
      id: 'id1',
      type: 'Console',
      name: 'North Connector',
      description: 'My North connector description',
      enabled: true,
      settings: {},
      caching: {
        scanModeId: 'scanModeId1',
        retryInterval: 1000,
        retryCount: 3,
        groupCount: 1000,
        maxSendCount: 10000,
        sendFileImmediately: true,
        maxSize: 0
      },
      archive: {
        enabled: false,
        retentionDuration: 0
      }
    };

    beforeEach(() => {
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { northId: 'id1' } }) });

      northConnectorService.get.and.returnValue(of(northConnector));
      tester = new EditNorthComponentTester();
      tester.detectChanges();
    });
    it('should display general settings', () => {
      expect(northConnectorService.get).toHaveBeenCalledWith('id1');
      expect(tester.title).toContainText('Edit North Connector');
      expect(tester.enabled).toBeChecked();
      expect(tester.description).toHaveValue('My North connector description');
      expect(tester.specificForm).toBeDefined();
      expect(tester.specificTitle).toContainText('Console settings');
    });
  });
});
