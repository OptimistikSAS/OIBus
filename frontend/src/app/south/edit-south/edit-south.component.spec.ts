import { TestBed } from '@angular/core/testing';

import { EditSouthComponent } from './edit-south.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { SouthConnectorService } from '../../services/south-connector.service';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { FormComponent } from '../../shared/form/form.component';
import { ProxyService } from '../../services/proxy.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { provideHttpClient } from '@angular/common/http';
import { SouthConnectorDTO, SouthConnectorManifest } from '../../../../../shared/model/south-connector.model';

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
    return this.element(FormComponent);
  }
}
describe('EditSouthComponent', () => {
  let tester: EditSouthComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let scanModeService: jasmine.SpyObj<ScanModeService>;
  let proxyService: jasmine.SpyObj<ProxyService>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    scanModeService = createMock(ScanModeService);
    proxyService = createMock(ProxyService);

    TestBed.configureTestingModule({
      imports: [EditSouthComponent],
      providers: [
        provideI18nTesting(),
        provideHttpClient(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: ProxyService, useValue: proxyService }
      ]
    });

    scanModeService.list.and.returnValue(of([]));
    proxyService.list.and.returnValue(of([]));

    southConnectorService.getSouthConnectorTypeManifest.and.returnValue(
      of({
        id: 'mssql',
        category: 'database',
        name: 'SQL',
        description: 'SQL description',
        modes: {
          subscription: false,
          lastPoint: false,
          lastFile: false,
          history: true
        },
        items: {
          scanMode: { subscriptionOnly: false, acceptSubscription: true },
          settings: [],
          schema: {} as unknown
        },
        settings: [],
        schema: {} as unknown
      } as SouthConnectorManifest)
    );
    southConnectorService.listItems.and.returnValue(of([]));
  });

  describe('create mode', () => {
    beforeEach(() => {
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ queryParams: { type: 'SQL' } }) });

      tester = new EditSouthComponentTester();
      tester.detectChanges();
    });

    it('should display general settings', () => {
      expect(tester.title).toContainText('Create SQL south connector');
      expect(tester.enabled).toBeChecked();
      expect(tester.maxInstant).not.toBeChecked();
      expect(tester.description).toHaveValue('');
      expect(tester.specificForm).toBeDefined();

      expect(scanModeService.list).toHaveBeenCalledTimes(1);
      expect(proxyService.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('edit mode', () => {
    const southConnector: SouthConnectorDTO = {
      id: 'id1',
      type: 'SQL',
      name: 'South Connector 1',
      description: 'My South connector description',
      enabled: true,
      history: {
        maxInstantPerItem: false,
        maxReadInterval: 0,
        readDelay: 200
      },
      settings: {}
    };

    beforeEach(() => {
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { southId: 'id1' }, queryParams: { type: 'SQL' } }) });

      southConnectorService.get.and.returnValue(of(southConnector));
      tester = new EditSouthComponentTester();
      tester.detectChanges();
    });

    it('should display general settings', () => {
      tester.maxInstant.check();
      expect(southConnectorService.get).toHaveBeenCalledWith('id1');
      expect(tester.title).toContainText('Edit SQL south connector');
      expect(tester.enabled).toBeChecked();
      expect(tester.maxInstant).toBeChecked();

      expect(tester.description).toHaveValue('My South connector description');
      expect(tester.specificForm).toBeDefined();
      expect(tester.specificTitle).toContainText('SQL settings');
    });
  });
});
