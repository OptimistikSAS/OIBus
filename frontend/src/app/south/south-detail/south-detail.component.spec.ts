import { TestBed } from '@angular/core/testing';

import { SouthDetailComponent } from './south-detail.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { SouthConnectorService } from '../../services/south-connector.service';
import { SouthConnectorDTO, SouthConnectorManifest } from '../../../../../shared/model/south-connector.model';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { ScanModeService } from '../../services/scan-mode.service';

class SouthDisplayComponentTester extends ComponentTester<SouthDetailComponent> {
  constructor() {
    super(SouthDetailComponent);
  }

  get title() {
    return this.element('#title');
  }

  get toggleButton() {
    return this.button('#south-enabled')!;
  }

  get southSettings() {
    return this.elements('tbody.south-settings tr');
  }

  get southItems() {
    return this.elements('tbody tr.south-item');
  }
}

describe('SouthDetailComponent', () => {
  let tester: SouthDisplayComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let scanModeService: jasmine.SpyObj<ScanModeService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  const manifest: SouthConnectorManifest = {
    id: 'mssql',
    category: 'database',
    name: 'SQL',
    description: 'SQL',
    settings: [],
    items: {
      scanMode: {
        acceptSubscription: false,
        subscriptionOnly: false
      },
      settings: [
        {
          label: 'query',
          key: 'query',
          displayInViewMode: true,
          type: 'OibText'
        }
      ]
    },
    modes: {
      subscription: false,
      history: true,
      lastFile: true,
      lastPoint: false,
      forceMaxInstantPerItem: false
    }
  };

  const southConnector: SouthConnectorDTO = {
    id: 'id1',
    type: 'Generic',
    name: 'South Connector',
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
    southConnectorService = createMock(SouthConnectorService);
    scanModeService = createMock(ScanModeService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: stubRoute({
            params: {
              southId: 'id1'
            }
          })
        },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ScanModeService, useValue: scanModeService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    scanModeService.list.and.returnValue(
      of([
        {
          id: 'scanModeId1',
          name: 'Every mn',
          description: '',
          cron: ''
        }
      ])
    );

    southConnectorService.get.and.returnValue(of(southConnector));
    southConnectorService.getSouthConnectorTypeManifest.and.returnValue(of(manifest));
    southConnectorService.startSouth.and.returnValue(of(undefined));
    southConnectorService.stopSouth.and.returnValue(of(undefined));
    southConnectorService.listItems.and.returnValue(
      of([
        {
          id: 'id1',
          name: 'item1',
          connectorId: 'southId',
          settings: {
            query: 'sql'
          },
          scanModeId: 'scanModeId1'
        }
      ])
    );

    tester = new SouthDisplayComponentTester();
  });

  it('should display south connector detail', () => {
    tester.detectChanges();
    expect(tester.title).toContainText(southConnector.name);
    const settings = tester.southSettings;
    expect(settings.length).toBe(1);
    expect(settings[0]).toContainText('Status');
    expect(settings[0]).toContainText('active');
  });

  it('should display items', () => {
    tester.detectChanges();
    expect(tester.southItems.length).toBe(1);
    const item = tester.southItems[0];
    expect(item.elements('td')[0]).toContainText('item1');
    expect(item.elements('td')[1]).toContainText('Every mn');
    expect(item.elements('td')[2]).toContainText('sql');
  });

  it('should stop south', () => {
    tester.detectChanges();
    tester.toggleButton.click();
    expect(southConnectorService.stopSouth).toHaveBeenCalledWith(southConnector.id);
    expect(notificationService.success).toHaveBeenCalledWith('south.stopped', { name: southConnector.name });
  });

  it('should start south', () => {
    southConnectorService.get.and.returnValue(of({ ...southConnector, enabled: false }));
    tester.detectChanges();
    tester.toggleButton.click();
    expect(southConnectorService.startSouth).toHaveBeenCalledWith(southConnector.id);
    expect(notificationService.success).toHaveBeenCalledWith('south.started', { name: southConnector.name });
  });
});
