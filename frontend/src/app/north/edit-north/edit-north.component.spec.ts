import { TestBed } from '@angular/core/testing';

import { EditNorthComponent } from './edit-north.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { of } from 'rxjs';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideTestingI18n } from '../../../i18n/mock-i18n';
import { FormComponent } from '../../shared/form/form.component';
import { ProxyService } from '../../services/proxy.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { provideHttpClient } from '@angular/common/http';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NorthConnectorDTO, NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';

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
    return this.textarea('#north-description');
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
  let proxyService: jasmine.SpyObj<ProxyService>;

  describe('create mode', () => {
    beforeEach(() => {
      northConnectorService = createMock(NorthConnectorService);
      scanModeService = createMock(ScanModeService);
      proxyService = createMock(ProxyService);

      TestBed.configureTestingModule({
        imports: [EditNorthComponent],
        providers: [
          provideTestingI18n(),
          provideRouter([]),
          provideHttpClient(),
          { provide: NorthConnectorService, useValue: northConnectorService },
          { provide: ScanModeService, useValue: scanModeService },
          { provide: ProxyService, useValue: proxyService }
        ]
      });

      scanModeService.getScanModes.and.returnValue(of([]));
      proxyService.getProxies.and.returnValue(of([]));

      tester = new EditNorthComponentTester();
      tester.detectChanges();
    });

    it('should display general settings', () => {
      expect(tester.title).toContainText('Create a North connector');
      expect(tester.enabled).not.toBeChecked();
      expect(tester.description).toHaveValue('');
      expect(tester.specificForm).toBeDefined();

      expect(scanModeService.getScanModes).toHaveBeenCalledTimes(1);
      expect(proxyService.getProxies).toHaveBeenCalledTimes(1);
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
        maxSize: 0
      },
      archive: {
        enabled: false,
        retentionDuration: 0
      }
    };

    beforeEach(() => {
      northConnectorService = createMock(NorthConnectorService);
      scanModeService = createMock(ScanModeService);
      proxyService = createMock(ProxyService);

      TestBed.configureTestingModule({
        imports: [EditNorthComponent],
        providers: [
          provideTestingI18n(),
          provideRouter([]),
          provideHttpClient(),
          { provide: NorthConnectorService, useValue: northConnectorService },
          { provide: ScanModeService, useValue: scanModeService },
          { provide: ProxyService, useValue: proxyService },
          {
            provide: ActivatedRoute,
            useValue: stubRoute({
              params: {
                northId: 'id1'
              },
              queryParams: {
                type: 'SQL'
              }
            })
          }
        ]
      });

      scanModeService.getScanModes.and.returnValue(of([]));
      proxyService.getProxies.and.returnValue(of([]));

      northConnectorService.getNorthConnector.and.returnValue(of(northConnector));
      northConnectorService.getNorthConnectorTypeManifest.and.returnValue(
        of({
          category: 'debug',
          name: 'Console',
          description: 'Console description',
          modes: {
            files: true,
            points: true
          },
          settings: [],
          schema: {} as unknown
        } as NorthConnectorManifest)
      );
      tester = new EditNorthComponentTester();
      tester.detectChanges();
    });
    it('should display general settings', () => {
      expect(northConnectorService.getNorthConnector).toHaveBeenCalledWith('id1');
      expect(tester.title).toContainText('Edit North connector');
      expect(tester.enabled).toBeChecked();
      expect(tester.description).toHaveValue('My North connector description');
      expect(tester.specificForm).toBeDefined();
      expect(tester.specificTitle).toContainText('Console settings');
    });
  });
});
