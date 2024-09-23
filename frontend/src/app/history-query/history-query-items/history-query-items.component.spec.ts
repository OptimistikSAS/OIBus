import { TestBed } from '@angular/core/testing';
import { ComponentTester, createMock, TestInput } from 'ngx-speculoos';
import { SouthConnectorManifest } from '../../../../../shared/model/south-connector.model';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { Component } from '@angular/core';
import { HistoryQueryItemsComponent } from './history-query-items.component';
import { HistoryQueryDTO } from '../../../../../shared/model/history-query.model';
import { HistoryQueryService } from '../../services/history-query.service';
import { SouthItemSettings, SouthSettings } from '../../../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../../../shared/model/north-settings.model';

const historyQuery: HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings> = {
  id: 'historyId',
  name: 'History query',
  description: 'My History query description',
  status: 'PENDING',
  history: {
    maxInstantPerItem: false,
    maxReadInterval: 0,
    readDelay: 200
  },
  southType: 'OPCUA_HA',
  northType: 'OIConnect',
  startTime: '2023-01-01T00:00:00.000Z',
  endTime: '2023-01-01T00:00:00.000Z',
  southSettings: {
    database: 'my database'
  } as SouthSettings,
  southSharedConnection: false,
  northSettings: {
    host: 'localhost'
  } as NorthSettings,
  caching: {
    scanModeId: 'scanModeId1',
    retryInterval: 1000,
    retryCount: 3,
    maxSize: 30,
    oibusTimeValues: {
      groupCount: 1000,
      maxSendCount: 10000
    },
    rawFiles: {
      sendFileImmediately: true,
      archive: {
        enabled: false,
        retentionDuration: 0
      }
    }
  },
  items: [
    {
      id: 'id1',
      name: 'item1',
      enabled: true,
      settings: {
        query: 'sql'
      } as SouthItemSettings
    },
    {
      id: 'id2',
      name: 'item2',
      enabled: false,
      settings: {
        query: 'sql'
      } as SouthItemSettings
    }
  ]
};

@Component({
  template: `<oib-history-query-items [historyQuery]="historyQuery" [southManifest]="manifest" />`,
  standalone: true,
  imports: [HistoryQueryItemsComponent]
})
class TestComponent {
  historyQuery = historyQuery;
  manifest: SouthConnectorManifest = {
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
      forceMaxInstantPerItem: false,
      sharedConnection: false
    }
  };
}

class HistoryQueryItemsComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get title() {
    return this.element('#title');
  }

  get toggleButtons() {
    return this.elements('.form-check-input')! as Array<TestInput>;
  }

  get deleteAllButton() {
    return this.button('#delete-all')!;
  }

  get exportButton() {
    return this.button('#export-items')!;
  }

  get southItems() {
    return this.elements('tbody tr.south-item');
  }

  get spinner() {
    return this.element('#import-button .spinner-border')!;
  }
}

describe('HistoryQueryItemsComponent', () => {
  let tester: HistoryQueryItemsComponentTester;
  let historyQueryService: jasmine.SpyObj<HistoryQueryService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    historyQueryService = createMock(HistoryQueryService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClient(),
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    historyQueryService.enableItem.and.returnValue(of(undefined));
    historyQueryService.disableItem.and.returnValue(of(undefined));
    historyQueryService.deleteAllItems.and.returnValue(of(undefined));
    historyQueryService.exportItems.and.returnValue(of(undefined));

    tester = new HistoryQueryItemsComponentTester();
    tester.detectChanges();
  });

  it('should display items', () => {
    expect(tester.southItems.length).toBe(2);
    const item = tester.southItems[0];
    expect(item.elements('td')[1]).toContainText('item1');
    expect(item.elements('td')[2]).toContainText('sql');
  });

  it('should enable history item', () => {
    tester.toggleButtons[0].click();
    expect(historyQueryService.disableItem).toHaveBeenCalledWith('historyId', historyQuery.items[0].id);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.items.disabled', { name: historyQuery.items[0].name });
  });

  it('should disable history item', () => {
    tester.toggleButtons[1].click();
    expect(historyQueryService.enableItem).toHaveBeenCalledWith('historyId', historyQuery.items[1].id);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.items.enabled', { name: historyQuery.items[1].name });
  });

  it('should delete all', () => {
    confirmationService.confirm.and.returnValue(of(undefined));

    tester.deleteAllButton.click();
    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(historyQueryService.deleteAllItems).toHaveBeenCalledTimes(1);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.items.all-deleted');
  });
});
