import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ComponentTester, createMock, TestInput } from 'ngx-speculoos';
import { SouthConnectorItemDTO, SouthConnectorManifest } from '../../../../../shared/model/south-connector.model';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { Component } from '@angular/core';
import { HistoryQueryItemsComponent } from './history-query-items.component';
import { HistoryQueryDTO } from '../../../../../shared/model/history-query.model';
import { HistoryQueryService } from '../../services/history-query.service';

@Component({
  template: `<oib-history-query-items [inMemory]="false" [historyQuery]="historyQuery" [southManifest]="manifest" />`,
  standalone: true,
  imports: [HistoryQueryItemsComponent]
})
class TestComponent {
  historyQuery: HistoryQueryDTO = {
    id: 'historyId',
    name: 'History query',
    description: 'My History query description',
    status: 'PENDING',
    history: {
      maxInstantPerItem: false,
      maxReadInterval: 0,
      readDelay: 200,
      overlap: 0
    },
    southType: 'OPCUA_HA',
    northType: 'OIConnect',
    startTime: '2023-01-01T00:00:00.000Z',
    endTime: '2023-01-01T00:00:00.000Z',
    southSettings: {
      database: 'my database'
    },
    southSharedConnection: false,
    northSettings: {
      host: 'localhost'
    },
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
    }
  };
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

  const items: Array<SouthConnectorItemDTO> = [
    {
      id: 'id1',
      name: 'item1',
      enabled: true,
      connectorId: 'historyId',
      settings: {
        query: 'sql'
      },
      scanModeId: 'scanModeId1'
    },
    {
      id: 'id2',
      name: 'item2',
      enabled: false,
      connectorId: 'historyId',
      settings: {
        query: 'sql'
      },
      scanModeId: 'scanModeId1'
    }
  ];

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

    historyQueryService.listItems.and.returnValue(of(items));
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
    expect(historyQueryService.disableItem).toHaveBeenCalledWith('historyId', items[0].id);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.items.disabled', { name: items[0].name });
    expect(historyQueryService.listItems).toHaveBeenCalledTimes(2);
  });

  it('should disable history item', () => {
    tester.toggleButtons[1].click();
    expect(historyQueryService.enableItem).toHaveBeenCalledWith('historyId', items[1].id);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.items.enabled', { name: items[1].name });
    expect(historyQueryService.listItems).toHaveBeenCalledTimes(2);
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
    historyQueryService.listItems.and.returnValues(
      // initial call, where 3 items are present
      of([
        {
          id: 'id3',
          name: 'item3',
          enabled: false,
          connectorId: 'historyId',
          settings: {
            query: 'sql'
          },
          scanModeId: 'scanModeId1'
        },
        ...items
      ]),
      // second call, where the first item is deleted
      of(items)
    );

    tester = new HistoryQueryItemsComponentTester();
    tester.detectChanges();
    confirmationService.confirm.and.returnValue(of(undefined));
    historyQueryService.deleteItem.and.returnValue(of(undefined));

    const deleteBtn = tester.southItems[0].button('.delete-south-item');
    expect(tester.southItems.length).toBe(3);

    deleteBtn?.click();

    expect(tester.southItems.length).toBe(2);
    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(historyQueryService.deleteItem).toHaveBeenCalledTimes(1);
    expect(tester.tableItemNames).toEqual(items.map(i => i.name));

    // 1st call is when the tester is first created in the beforeEach
    // 2nd call is when the tester is recreated here
    // 3rd call is after the item is deleted and the list is recreated
    expect(historyQueryService.listItems).toHaveBeenCalledTimes(3);
  });

  it('should reset sorting after deletion of an item', () => {
    // Setup for deletion
    historyQueryService.listItems.and.returnValues(
      // initial call, where 3 items are present
      of([
        {
          id: 'id3',
          name: 'item3',
          enabled: false,
          connectorId: 'historyId',
          settings: {
            query: 'sql'
          },
          scanModeId: 'scanModeId1'
        },
        ...items
      ]),
      // second call, where the first item is deleted
      of(items)
    );
    tester = new HistoryQueryItemsComponentTester();
    tester.detectChanges();
    confirmationService.confirm.and.returnValue(of(undefined));
    historyQueryService.deleteItem.and.returnValue(of(undefined));

    // Sort items descending
    tester.sortByNameBtn.click(); // Ascending
    tester.sortByNameBtn.click(); // Descending
    expect(tester.tableItemNames).toEqual(['item3', 'item2', 'item1']);

    // Delete first item
    const deleteBtn = tester.southItems[0].button('.delete-south-item');
    expect(tester.southItems.length).toBe(3);
    deleteBtn?.click();
    expect(tester.southItems.length).toBe(2);

    // Sort order should be initial one (the order in which items were specified in)
    expect(tester.tableItemNames).toEqual(items.map(i => i.name));
  });

  it('should filter items', fakeAsync(() => {
    historyQueryService.listItems.and.returnValue(
      of([
        {
          id: 'id3',
          name: 'foo-bar',
          enabled: false,
          connectorId: 'historyId',
          settings: {
            query: 'sql'
          },
          scanModeId: 'scanModeId1'
        },
        ...items
      ])
    );

    tester = new HistoryQueryItemsComponentTester();
    tester.detectChanges();

    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();

    expect(tester.southItems.length).toBe(2);
    expect(tester.tableItemNames).toEqual(items.map(i => i.name));
  }));

  it('should not reset sorting after filtering', fakeAsync(() => {
    historyQueryService.listItems.and.returnValue(
      of([
        {
          id: 'id3',
          name: 'foo-bar',
          enabled: false,
          connectorId: 'historyId',
          settings: {
            query: 'sql'
          },
          scanModeId: 'scanModeId1'
        },
        ...items
      ])
    );

    tester = new HistoryQueryItemsComponentTester();
    tester.detectChanges();

    // Sort items descending
    tester.sortByNameBtn.click(); // Ascending
    tester.sortByNameBtn.click(); // Descending
    expect(tester.tableItemNames).toEqual(['item2', 'item1', 'foo-bar']);

    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();

    expect(tester.southItems.length).toBe(2);
    expect(tester.tableItemNames).toEqual(['item2', 'item1']);
  }));

  it('should be able to delete item when filtering', fakeAsync(() => {
    const extendedItems = [
      {
        id: 'id3',
        name: 'foo-bar',
        enabled: false,
        connectorId: 'historyId',
        settings: {
          query: 'sql'
        },
        scanModeId: 'scanModeId1'
      },
      ...items
    ];
    historyQueryService.listItems.and.returnValues(
      // initial call, where 3 items are present
      of(extendedItems),
      // second call, where the second item is deleted
      of([extendedItems[0], extendedItems[2]])
    );

    tester = new HistoryQueryItemsComponentTester();
    tester.detectChanges();

    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();

    expect(tester.southItems.length).toBe(2);
    expect(tester.tableItemNames).toEqual(['item1', 'item2']);

    // Delete first item in the list
    confirmationService.confirm.and.returnValue(of(undefined));
    historyQueryService.deleteItem.and.returnValue(of(undefined));
    const deleteBtn = tester.southItems[0].button('.delete-south-item');
    deleteBtn?.click();

    expect(tester.southItems.length).toBe(1);
    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(historyQueryService.deleteItem).toHaveBeenCalledTimes(1);
    expect(tester.tableItemNames).toEqual(['item2']);

    // Empty filter and make sure the items are correct
    filterInput?.fillWith('');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();
    expect(tester.southItems.length).toBe(2);
    expect(tester.tableItemNames).toEqual(['foo-bar', 'item2']);
  }));
});
