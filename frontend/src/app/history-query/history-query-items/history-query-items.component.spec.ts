import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ComponentTester, createMock, TestInput } from 'ngx-speculoos';
import { SouthConnectorCommandDTO, SouthConnectorManifest } from '../../../../../backend/shared/model/south-connector.model';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { Component } from '@angular/core';
import { HistoryQueryItemsComponent } from './history-query-items.component';
import { HistoryQueryDTO, HistoryQueryItemCommandDTO } from '../../../../../backend/shared/model/history-query.model';
import { HistoryQueryService } from '../../services/history-query.service';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';

const testHistoryQuery: HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings> = {
  id: 'historyId',
  name: 'History query',
  description: 'My History query description',
  status: 'PENDING',
  southType: 'opcua',
  northType: 'file-writer',
  startTime: '2023-01-01T00:00:00.000Z',
  endTime: '2023-01-01T00:00:00.000Z',
  southSettings: {
    database: 'my database'
  } as SouthSettings,
  northSettings: {
    host: 'localhost'
  } as NorthSettings,
  caching: {
    trigger: {
      scanModeId: 'scanModeId1',
      numberOfElements: 1_000,
      numberOfFiles: 1
    },
    throttling: {
      runMinDelay: 200,
      maxSize: 30,
      maxNumberOfElements: 10_000
    },
    error: {
      retryInterval: 1_000,
      retryCount: 3,
      retentionDuration: 24
    },
    archive: {
      enabled: false,
      retentionDuration: 0
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
      name: 'item1-copy',
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
  ],
  northTransformers: []
};

@Component({
  template: `<oib-history-query-items
    [historyId]="historyQuery.id"
    [historyQuery]="historyQuery"
    [southManifest]="manifest"
    [southConnectorCommand]="southCommand"
    [saveChangesDirectly]="saveChangesDirectly"
    (inMemoryItems)="updateInMemoryItems($event)"
  />`,
  imports: [HistoryQueryItemsComponent]
})
class TestComponent {
  _historyQueryService!: HistoryQueryService;

  historyQuery = structuredClone(testHistoryQuery);
  manifest: SouthConnectorManifest = {
    id: 'mssql',
    category: 'database',
    settings: [],
    items: {
      scanMode: 'POLL',
      settings: [
        {
          translationKey: 'south.items.mssql.query',
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
      lastPoint: false
    }
  };
  saveChangesDirectly!: boolean;
  inMemoryItems: Array<HistoryQueryItemCommandDTO<SouthItemSettings>> = [];
  updateInMemoryItems(items: Array<HistoryQueryItemCommandDTO<SouthItemSettings>> | null) {
    if (items) {
      this.inMemoryItems = items;
    } else {
      this._historyQueryService.get(this.historyQuery!.id).subscribe(historyQuery => {
        this.historyQuery!.items = historyQuery.items;
        this.historyQuery = JSON.parse(JSON.stringify(this.historyQuery)); // Used to force a refresh in history query item list
      });
    }
  }
  southCommand: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings> = {
    name: 'test',
    settings: {}
  } as SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
}

class HistoryQueryItemsComponentTester extends ComponentTester<TestComponent> {
  constructor(readonly _historyQueryService: HistoryQueryService) {
    super(TestComponent);
    this.componentInstance._historyQueryService = _historyQueryService;
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

describe('HistoryQueryItemsComponent with saving changes directly', () => {
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
    historyQueryService.deleteItem.and.returnValue(of(undefined));
    historyQueryService.deleteAllItems.and.returnValue(of(undefined));
    historyQueryService.exportItems.and.returnValue(of(undefined));
    historyQueryService.get.and.returnValue(of(testHistoryQuery));

    confirmationService.confirm.and.returnValue(of(undefined));

    tester = new HistoryQueryItemsComponentTester(historyQueryService);
    tester.componentInstance.saveChangesDirectly = true;
    tester.detectChanges();
  });

  it('should display items', () => {
    expect(tester.southItems.length).toBe(3);
    const item = tester.southItems[0];
    expect(item.elements('td')[1]).toContainText(testHistoryQuery.items[0].name);
    expect(item.elements('td')[2]).toContainText('sql');
  });

  it('should enable history item', () => {
    const btnIdx = 1; // second one is disabled by default
    tester.toggleButtons[btnIdx].click();
    expect(historyQueryService.enableItem).toHaveBeenCalledWith(testHistoryQuery.id, testHistoryQuery.items[btnIdx].id);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.items.enabled', { name: testHistoryQuery.items[btnIdx].name });
  });

  it('should disable history item', () => {
    const btnIdx = 0; // first one is enabled by default
    tester.toggleButtons[btnIdx].click();
    expect(historyQueryService.disableItem).toHaveBeenCalledWith(testHistoryQuery.id, testHistoryQuery.items[btnIdx].id);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.items.disabled', { name: testHistoryQuery.items[btnIdx].name });
  });

  it('should delete all', () => {
    historyQueryService.get.and.returnValue(of({ ...testHistoryQuery, items: [] }));

    tester.deleteAllButton.click();

    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(historyQueryService.deleteAllItems).toHaveBeenCalledTimes(1);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.items.all-deleted');
    expect(tester.southItems.length).toBe(0);
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

    // Ascending
    tester.sortByNameBtn.click();
    expectedOrder.reverse();
    expect(tester.tableItemNames).toEqual(expectedOrder);
  });

  it('should delete one item', () => {
    // mock API response to delete first item
    historyQueryService.get.and.returnValue(of({ ...testHistoryQuery, items: testHistoryQuery.items.slice(1) }));

    tester.southItems[0].button('.delete-south-item')!.click();

    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(historyQueryService.deleteItem).toHaveBeenCalledTimes(1);
    expect(tester.tableItemNames).toEqual(['item1-copy', 'item3']);
  });

  it('should reset sorting after deletion of an item', () => {
    // Sort items descending
    tester.sortByNameBtn.click(); // Ascending
    tester.sortByNameBtn.click(); // Descending
    expect(tester.tableItemNames).toEqual(['item3', 'item1-copy', 'item1']);

    // mock API response to delete third item
    historyQueryService.get.and.returnValue(of({ ...testHistoryQuery, items: testHistoryQuery.items.slice(0, 2) }));

    tester.southItems[2].button('.delete-south-item')!.click();

    expect(tester.tableItemNames).toEqual(['item1', 'item1-copy']);
  });

  it('should filter items', fakeAsync(() => {
    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item1');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();

    expect(tester.tableItemNames).toEqual(['item1', 'item1-copy']);
  }));

  it('should not reset sorting after filtering', fakeAsync(() => {
    // Sort items descending
    tester.sortByNameBtn.click(); // Ascending
    tester.sortByNameBtn.click(); // Descending
    expect(tester.tableItemNames).toEqual(['item3', 'item1-copy', 'item1']);

    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item1');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();

    expect(tester.tableItemNames).toEqual(['item1-copy', 'item1']);
  }));

  it('should be able to delete item when filtering', fakeAsync(() => {
    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item3');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();

    expect(tester.tableItemNames).toEqual(['item3']);

    // Delete the third item in the list
    historyQueryService.get.and.returnValue(of({ ...testHistoryQuery, items: testHistoryQuery.items.slice(0, 2) }));
    tester.southItems[0].button('.delete-south-item')!.click();

    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(historyQueryService.deleteItem).toHaveBeenCalledTimes(1);
    expect(tester.southItems).toEqual([]);

    // Empty filter and make sure the items are correct
    filterInput?.fillWith('');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();
    expect(tester.tableItemNames).toEqual(['item1', 'item1-copy']);
  }));
});

describe('HistoryQueryItemsComponent without saving changes directly', () => {
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
    historyQueryService.deleteItem.and.returnValue(of(undefined));
    historyQueryService.deleteAllItems.and.returnValue(of(undefined));
    historyQueryService.exportItems.and.returnValue(of(undefined));
    historyQueryService.get.and.returnValue(of(testHistoryQuery));

    confirmationService.confirm.and.returnValue(of(undefined));

    tester = new HistoryQueryItemsComponentTester(historyQueryService);
    tester.componentInstance.saveChangesDirectly = false;
    tester.detectChanges();
  });

  it('should display items', () => {
    expect(tester.southItems.length).toBe(3);
    const item = tester.southItems[0];
    expect(item.elements('td')[1]).toContainText(testHistoryQuery.items[0].name);
    expect(item.elements('td')[2]).toContainText('sql');
  });

  it('should not have option to enable/disable history item', () => {
    expect(tester.toggleButtons.length).toBe(0);
  });

  it('should delete all', () => {
    tester.deleteAllButton.click();

    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(historyQueryService.deleteAllItems).not.toHaveBeenCalled();
    expect(notificationService.success).not.toHaveBeenCalled();
    expect(tester.southItems.length).toBe(0);
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

    // Ascending
    tester.sortByNameBtn.click();
    expectedOrder.reverse();
    expect(tester.tableItemNames).toEqual(expectedOrder);
  });

  it('should delete one item', () => {
    tester.southItems[0].button('.delete-south-item')!.click();

    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(historyQueryService.deleteItem).not.toHaveBeenCalled();
    expect(tester.tableItemNames).toEqual(['item1-copy', 'item3']);
  });

  it('should reset sorting after deletion of an item', () => {
    // Sort items descending
    tester.sortByNameBtn.click(); // Ascending
    tester.sortByNameBtn.click(); // Descending
    expect(tester.tableItemNames).toEqual(['item3', 'item1-copy', 'item1']);

    tester.southItems[0].button('.delete-south-item')!.click();

    expect(tester.tableItemNames).toEqual(['item1', 'item1-copy']);
  });

  it('should filter items', fakeAsync(() => {
    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item1');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();

    expect(tester.tableItemNames).toEqual(['item1', 'item1-copy']);
  }));

  it('should not reset sorting after filtering', fakeAsync(() => {
    // Sort items descending
    tester.sortByNameBtn.click(); // Ascending
    tester.sortByNameBtn.click(); // Descending
    expect(tester.tableItemNames).toEqual(['item3', 'item1-copy', 'item1']);

    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item1');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();

    expect(tester.tableItemNames).toEqual(['item1-copy', 'item1']);
  }));

  it('should be able to delete item when filtering', fakeAsync(() => {
    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item3');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();

    expect(tester.tableItemNames).toEqual(['item3']);

    // Delete the third item in the list
    tester.southItems[0].button('.delete-south-item')!.click();

    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(historyQueryService.deleteItem).not.toHaveBeenCalled();
    expect(tester.southItems).toEqual([]);

    // Empty filter and make sure the items are correct
    filterInput?.fillWith('');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();
    expect(tester.tableItemNames).toEqual(['item1', 'item1-copy']);
  }));
});
