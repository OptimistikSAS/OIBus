import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ComponentTester, createMock, TestInput } from 'ngx-speculoos';
import { SouthConnectorManifest } from '../../../../../backend/shared/model/south-connector.model';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { Component } from '@angular/core';
import { HistoryQueryItemsComponent } from './history-query-items.component';
import { HistoryQueryDTO } from '../../../../../backend/shared/model/history-query.model';
import { HistoryQueryService } from '../../services/history-query.service';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';

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
    },
    {
      id: 'id3',
      name: 'item3',
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
      forceMaxInstantPerItem: false
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

  get sortByNameBtn() {
    return this.button('button:has( > span[translate="history-query.items.name"])')!;
  }

  get tableItemNames() {
    return this.elements<HTMLTableCellElement>('tbody tr.south-item td:nth-child(2)').map(e => e.nativeElement.innerText);
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
    expect(tester.southItems.length).toBe(3);
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

  it('should sort items by name', () => {
    const expectedOrder = tester.tableItemNames;

    // Ascending
    tester.sortByNameBtn.click();
    expect(tester.tableItemNames).toEqual(expectedOrder);

    // Descending
    tester.sortByNameBtn.click();
    expectedOrder.reverse();
    expect(tester.tableItemNames).toEqual(expectedOrder);

    // Unset
    tester.sortByNameBtn.click();
    expect(tester.tableItemNames).toEqual(expectedOrder);

    // Ascending (this call reverses the list to the original sorting, if omitted, tests fail)
    tester.sortByNameBtn.click();
    expectedOrder.reverse();
    expect(tester.tableItemNames).toEqual(expectedOrder);
  });

  it('should delete one item', () => {
    tester = new HistoryQueryItemsComponentTester();
    tester.detectChanges();
    confirmationService.confirm.and.returnValue(of(undefined));
    historyQueryService.deleteItem.and.returnValue(of(undefined));

    tester.southItems[0].button('.delete-south-item')!.click();

    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(historyQueryService.deleteItem).toHaveBeenCalledTimes(1);
  });

  it('should reset sorting after deletion of an item', () => {
    tester = new HistoryQueryItemsComponentTester();
    tester.detectChanges();
    confirmationService.confirm.and.returnValue(of(undefined));
    historyQueryService.deleteItem.and.returnValue(of(undefined));

    // Sort items descending
    tester.sortByNameBtn.click(); // Ascending
    tester.sortByNameBtn.click(); // Descending
    expect(tester.tableItemNames).toEqual(['item3', 'item2', 'item1']);
  });

  it('should filter items', fakeAsync(() => {
    tester = new HistoryQueryItemsComponentTester();
    tester.detectChanges();

    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();

    expect(tester.southItems.length).toBe(3);
  }));

  it('should not reset sorting after filtering', fakeAsync(() => {
    tester = new HistoryQueryItemsComponentTester();
    tester.detectChanges();

    // Sort items descending
    tester.sortByNameBtn.click(); // Ascending
    tester.sortByNameBtn.click(); // Descending
    expect(tester.tableItemNames).toEqual(['item3', 'item2', 'item1']);

    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('2');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();

    expect(tester.southItems.length).toBe(1);
    expect(tester.tableItemNames).toEqual(['item2']);
  }));

  it('should be able to delete item when filtering', fakeAsync(() => {
    tester = new HistoryQueryItemsComponentTester();
    tester.detectChanges();

    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('2');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();

    expect(tester.southItems.length).toBe(1);
    expect(tester.tableItemNames).toEqual(['item2']);

    // Empty filter and make sure the items are correct
    filterInput?.fillWith('');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();
    expect(tester.southItems.length).toBe(3);
    expect(tester.tableItemNames).toEqual(['item1', 'item2', 'item3']);

    // Delete first item in the list
    confirmationService.confirm.and.returnValue(of(undefined));
    historyQueryService.deleteItem.and.returnValue(of(undefined));
    tester.southItems[0].button('.delete-south-item')!.click();

    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(historyQueryService.deleteItem).toHaveBeenCalledTimes(1);
  }));
});
