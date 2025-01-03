import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ComponentTester, createMock, TestInput } from 'ngx-speculoos';
import { SouthConnectorService } from '../../services/south-connector.service';
import {
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorManifest
} from '../../../../../backend/shared/model/south-connector.model';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { SouthItemsComponent } from './south-items.component';
import { Component } from '@angular/core';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';

const testSouthConnector: SouthConnectorDTO<SouthSettings, SouthItemSettings> = {
  id: 'southId',
  name: 'South Connector',
  items: [
    {
      id: 'id1',
      name: 'item1',
      enabled: true,
      settings: {
        query: 'sql'
      } as SouthItemSettings,
      scanModeId: 'scanModeId1'
    },
    {
      id: 'id2',
      name: 'item1-copy',
      enabled: false,
      settings: {
        query: 'sql'
      } as SouthItemSettings,
      scanModeId: 'scanModeId1'
    },
    {
      id: 'id3',
      name: 'item3',
      enabled: false,
      settings: {
        query: 'sql'
      } as SouthItemSettings,
      scanModeId: 'scanModeId1'
    }
  ]
} as SouthConnectorDTO<SouthSettings, SouthItemSettings>;

@Component({
  template: `<oib-south-items
    [southId]="southConnector.id"
    [southConnector]="southConnector"
    [scanModes]="scanModes"
    [southManifest]="manifest"
    [saveChangesDirectly]="saveChangesDirectly"
    (inMemoryItems)="updateInMemoryItems($event)"
  />`,
  imports: [SouthItemsComponent]
})
class TestComponent {
  _southConnectorService!: SouthConnectorService;

  southConnector = structuredClone(testSouthConnector);
  scanModes: Array<ScanModeDTO> = [
    {
      id: 'scanModeId1',
      name: 'Every mn',
      description: '',
      cron: ''
    }
  ];
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
  inMemoryItems: Array<SouthConnectorItemCommandDTO<SouthItemSettings>> = [];
  updateInMemoryItems(items: Array<SouthConnectorItemCommandDTO<SouthItemSettings>> | null) {
    if (items) {
      this.inMemoryItems = items;
    } else {
      this._southConnectorService.get(this.southConnector!.id).subscribe(southConnector => {
        this.southConnector!.items = southConnector.items;
        this.southConnector = JSON.parse(JSON.stringify(this.southConnector)); // Used to force a refresh in south item list
      });
    }
  }
}

class SouthItemsComponentTester extends ComponentTester<TestComponent> {
  constructor(readonly _southConnectorService: SouthConnectorService) {
    super(TestComponent);
    this.componentInstance._southConnectorService = _southConnectorService;
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
    return this.button('button:has( > span[translate="south.items.name"])')!;
  }

  get sortByScanModeBtn() {
    return this.button('button:has( > span[translate="south.items.scan-mode"])')!;
  }

  get tableItemNames() {
    return this.elements<HTMLTableCellElement>('tbody tr.south-item td:nth-child(2)').map(e => e.nativeElement.innerText);
  }

  get tableScanModeNames() {
    return this.elements<HTMLTableCellElement>('tbody tr.south-item td:nth-child(3)').map(e => e.nativeElement.innerText);
  }
}

describe('SouthItemsComponent with saving changes directly', () => {
  let tester: SouthItemsComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClient(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    southConnectorService.enableItem.and.returnValue(of(undefined));
    southConnectorService.disableItem.and.returnValue(of(undefined));
    southConnectorService.deleteItem.and.returnValue(of(undefined));
    southConnectorService.deleteAllItems.and.returnValue(of(undefined));
    southConnectorService.exportItems.and.returnValue(of(undefined));
    southConnectorService.get.and.returnValue(of(testSouthConnector));

    confirmationService.confirm.and.returnValue(of(undefined));

    tester = new SouthItemsComponentTester(southConnectorService);
    tester.componentInstance.saveChangesDirectly = true;
    tester.detectChanges();
  });

  it('should display items', () => {
    expect(tester.southItems.length).toBe(3);
    const item = tester.southItems[0];
    expect(item.elements('td')[1]).toContainText(testSouthConnector.items[0].name);
    expect(item.elements('td')[2]).toContainText('Every mn');
    expect(item.elements('td')[3]).toContainText('sql');
  });

  it('should enable south item', () => {
    const btnIdx = 1; // second one is disabled by default
    tester.toggleButtons[btnIdx].click();
    expect(southConnectorService.enableItem).toHaveBeenCalledWith('southId', testSouthConnector.items[btnIdx].id);
    expect(notificationService.success).toHaveBeenCalledWith('south.items.enabled', { name: testSouthConnector.items[btnIdx].name });
  });

  it('should disable south item', () => {
    const btnIdx = 0; // first one is enabled by default
    tester.toggleButtons[btnIdx].click();
    expect(southConnectorService.disableItem).toHaveBeenCalledWith('southId', testSouthConnector.items[btnIdx].id);
    expect(notificationService.success).toHaveBeenCalledWith('south.items.disabled', { name: testSouthConnector.items[btnIdx].name });
  });

  it('should delete all', () => {
    southConnectorService.get.and.returnValue(of({ ...testSouthConnector, items: [] }));

    tester.deleteAllButton.click();

    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(southConnectorService.deleteAllItems).toHaveBeenCalledTimes(1);
    expect(notificationService.success).toHaveBeenCalledWith('south.items.all-deleted');
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

    // Ascending (this call reverses the list to the original sorting, if omitted, tests fail)
    tester.sortByNameBtn.click();
    expectedOrder.reverse();
    expect(tester.tableItemNames).toEqual(expectedOrder);
  });

  it('should sort items by scan mode', () => {
    const expectedOrder = tester.tableScanModeNames;

    // Ascending
    tester.sortByScanModeBtn.click();
    expect(tester.tableScanModeNames).toEqual(expectedOrder);

    // Descending
    tester.sortByScanModeBtn.click();
    expectedOrder.reverse();
    expect(tester.tableScanModeNames).toEqual(expectedOrder);

    // Unset
    tester.sortByScanModeBtn.click();
    expect(tester.tableScanModeNames).toEqual(expectedOrder);

    // Ascending (this call reverses the list to the original sorting, if omitted, tests fail)
    tester.sortByScanModeBtn.click();
    expectedOrder.reverse();
    expect(tester.tableScanModeNames).toEqual(expectedOrder);
  });

  it('should delete one item', () => {
    // mock API response to delete first item
    southConnectorService.get.and.returnValue(of({ ...testSouthConnector, items: testSouthConnector.items.slice(1) }));

    tester.southItems[0].button('.delete-south-item')!.click();

    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(southConnectorService.deleteItem).toHaveBeenCalledTimes(1);
    expect(tester.tableItemNames).toEqual(['item1-copy', 'item3']);
  });

  it('should reset sorting after deletion of an item', () => {
    // Sort items descending
    tester.sortByNameBtn.click(); // Ascending
    tester.sortByNameBtn.click(); // Descending
    expect(tester.tableItemNames).toEqual(['item3', 'item1-copy', 'item1']);

    // mock API response to delete third item
    southConnectorService.get.and.returnValue(of({ ...testSouthConnector, items: testSouthConnector.items.slice(0, 2) }));

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
    filterInput?.fillWith('item');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();

    expect(tester.tableItemNames).toEqual(['item3', 'item1-copy', 'item1']);
  }));

  it('should be able to delete item when filtering', fakeAsync(() => {
    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item3');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();

    expect(tester.tableItemNames).toEqual(['item3']);

    // Delete the third item in the list
    southConnectorService.get.and.returnValue(of({ ...testSouthConnector, items: testSouthConnector.items.slice(0, 2) }));
    tester.southItems[0].button('.delete-south-item')!.click();

    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(southConnectorService.deleteItem).toHaveBeenCalledTimes(1);
    expect(tester.southItems).toEqual([]);

    // Empty filter and make sure the items are correct
    filterInput?.fillWith('');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();
    expect(tester.tableItemNames).toEqual(['item1', 'item1-copy']);
  }));
});

describe('SouthItemsComponent without saving changes directly', () => {
  let tester: SouthItemsComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClient(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    southConnectorService.enableItem.and.returnValue(of(undefined));
    southConnectorService.disableItem.and.returnValue(of(undefined));
    southConnectorService.deleteItem.and.returnValue(of(undefined));
    southConnectorService.deleteAllItems.and.returnValue(of(undefined));
    southConnectorService.exportItems.and.returnValue(of(undefined));
    southConnectorService.get.and.returnValue(of(testSouthConnector));

    confirmationService.confirm.and.returnValue(of(undefined));

    tester = new SouthItemsComponentTester(southConnectorService);
    tester.componentInstance.saveChangesDirectly = false;
    tester.detectChanges();
  });

  it('should display items', () => {
    expect(tester.southItems.length).toBe(3);
    const item = tester.southItems[0];
    expect(item.elements('td')[1]).toContainText(testSouthConnector.items[0].name);
    expect(item.elements('td')[2]).toContainText('Every mn');
    expect(item.elements('td')[3]).toContainText('sql');
  });

  it('should not have option to enable/disable south item', () => {
    expect(tester.toggleButtons.length).toBe(0);
  });

  it('should delete all', () => {
    tester.deleteAllButton.click();

    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(southConnectorService.deleteAllItems).not.toHaveBeenCalled();
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

    // Ascending (this call reverses the list to the original sorting, if omitted, tests fail)
    tester.sortByNameBtn.click();
    expectedOrder.reverse();
    expect(tester.tableItemNames).toEqual(expectedOrder);
  });

  it('should sort items by scan mode', () => {
    const expectedOrder = tester.tableScanModeNames;

    // Ascending
    tester.sortByScanModeBtn.click();
    expect(tester.tableScanModeNames).toEqual(expectedOrder);

    // Descending
    tester.sortByScanModeBtn.click();
    expectedOrder.reverse();
    expect(tester.tableScanModeNames).toEqual(expectedOrder);

    // Unset
    tester.sortByScanModeBtn.click();
    expect(tester.tableScanModeNames).toEqual(expectedOrder);

    // Ascending (this call reverses the list to the original sorting, if omitted, tests fail)
    tester.sortByScanModeBtn.click();
    expectedOrder.reverse();
    expect(tester.tableScanModeNames).toEqual(expectedOrder);
  });

  it('should delete one item', () => {
    tester.southItems[0].button('.delete-south-item')!.click();

    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(southConnectorService.deleteItem).not.toHaveBeenCalled();
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
    filterInput?.fillWith('item');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();

    expect(tester.tableItemNames).toEqual(['item3', 'item1-copy', 'item1']);
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
    expect(southConnectorService.deleteItem).not.toHaveBeenCalled();
    expect(tester.southItems).toEqual([]);

    // Empty filter and make sure the items are correct
    filterInput?.fillWith('');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();
    expect(tester.tableItemNames).toEqual(['item1', 'item1-copy']);
  }));
});
