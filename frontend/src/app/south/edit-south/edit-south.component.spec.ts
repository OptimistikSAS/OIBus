import { TestBed } from '@angular/core/testing';

import { EditSouthComponent } from './edit-south.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { SouthConnectorService } from '../../services/south-connector.service';
import { of } from 'rxjs';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideTestingI18n } from '../../../i18n/mock-i18n';
import { FormComponent } from '../../shared/form/form.component';
import { ProxyService } from '../../services/proxy.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { provideHttpClient } from '@angular/common/http';
import { SouthConnectorDTO } from '../../model/south-connector.model';

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

  get description() {
    return this.textarea('#south-description');
  }

  get specificTitle() {
    return this.element('#specific-settings-title');
  }

  get specificForm() {
    return this.element(FormComponent);
  }
}
describe('EditSouthComponent', () => {
  let tester: EditSouthComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let scanModeService: jasmine.SpyObj<ScanModeService>;
  let proxyService: jasmine.SpyObj<ProxyService>;

  describe('create mode', () => {
    beforeEach(() => {
      southConnectorService = createMock(SouthConnectorService);
      scanModeService = createMock(ScanModeService);
      proxyService = createMock(ProxyService);

      TestBed.configureTestingModule({
        imports: [EditSouthComponent],
        providers: [
          provideTestingI18n(),
          provideRouter([]),
          provideHttpClient(),
          { provide: SouthConnectorService, useValue: southConnectorService },
          { provide: ScanModeService, useValue: scanModeService },
          { provide: ProxyService, useValue: proxyService }
        ]
      });

      scanModeService.getScanModes.and.returnValue(of([]));
      proxyService.getProxies.and.returnValue(of([]));

      tester = new EditSouthComponentTester();
      tester.detectChanges();
    });

    it('should display general settings', () => {
      expect(tester.title).toContainText('Create a South connector');
      expect(tester.enabled).not.toBeChecked();
      expect(tester.description).toHaveValue('');
      expect(tester.specificForm).toBeDefined();

      expect(scanModeService.getScanModes).toHaveBeenCalledTimes(1);
      expect(proxyService.getProxies).toHaveBeenCalledTimes(1);
    });
  });

  describe('edit mode', () => {
    const southConnector: SouthConnectorDTO = {
      id: 'id1',
      type: 'SQL',
      name: 'South Connector 1',
      description: 'My South connector description',
      enabled: true,
      settings: {}
    };

    beforeEach(() => {
      southConnectorService = createMock(SouthConnectorService);
      scanModeService = createMock(ScanModeService);
      proxyService = createMock(ProxyService);

      TestBed.configureTestingModule({
        imports: [EditSouthComponent],
        providers: [
          provideTestingI18n(),
          provideRouter([]),
          provideHttpClient(),
          { provide: SouthConnectorService, useValue: southConnectorService },
          { provide: ScanModeService, useValue: scanModeService },
          { provide: ProxyService, useValue: proxyService },
          {
            provide: ActivatedRoute,
            useValue: stubRoute({
              params: {
                southId: 'id1'
              },
              queryParams: {
                type: 'SQL'
              }
            })
          },
          { provide: SouthConnectorService, useValue: southConnectorService }
        ]
      });

      scanModeService.getScanModes.and.returnValue(of([]));
      proxyService.getProxies.and.returnValue(of([]));

      southConnectorService.getSouthConnector.and.returnValue(of(southConnector));
      southConnectorService.getSouthConnectorTypeManifest.and.returnValue(
        of({
          category: 'database',
          name: 'SQL',
          modes: {
            subscription: false,
            lastPoint: false,
            lastFile: false,
            historyPoint: false,
            historyFile: true
          },
          items: [],
          settings: []
        })
      );
      tester = new EditSouthComponentTester();
      tester.detectChanges();
    });
    it('should display general settings', () => {
      expect(southConnectorService.getSouthConnector).toHaveBeenCalledWith('id1');
      expect(tester.title).toContainText('Edit South connector');
      expect(tester.enabled).toBeChecked();
      expect(tester.description).toHaveValue('My South connector description');
      expect(tester.specificForm).toBeDefined();
      expect(tester.specificTitle).toContainText('SQL settings');
    });
  });
});
