import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ComponentTester, createMock, TestInput } from 'ngx-speculoos';
import { SouthConnectorService } from '../../services/south-connector.service';
import { SouthConnectorDTO, SouthConnectorItemDTO, SouthConnectorManifest } from '../../../../../shared/model/south-connector.model';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { SouthItemsComponent } from './south-items.component';
import { Component } from '@angular/core';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';

@Component({
  template: `<oib-south-items [southConnector]="southConnector" [scanModes]="scanModes" [southManifest]="manifest" [inMemory]="false" />`,
  standalone: true,
  imports: [SouthItemsComponent]
})
class TestComponent {
  southConnector: SouthConnectorDTO = {
    id: 'southId',
    name: 'South Connector'
  } as SouthConnectorDTO;
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

class SouthItemsComponentTester extends ComponentTester<TestComponent> {
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

describe('SouthItemsComponent', () => {
  let tester: SouthItemsComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  const items: Array<SouthConnectorItemDTO> = [
    {
      id: 'id1',
      name: 'item1',
      enabled: true,
      connectorId: 'southId',
      settings: {
        query: 'sql'
      },
      scanModeId: 'scanModeId1'
    },
    {
      id: 'id2',
      name: 'item2',
      enabled: false,
      connectorId: 'southId',
      settings: {
        query: 'sql'
      },
      scanModeId: 'scanModeId1'
    }
  ];

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

    southConnectorService.listItems.and.returnValue(of(items));
    southConnectorService.enableItem.and.returnValue(of(undefined));
    southConnectorService.disableItem.and.returnValue(of(undefined));
    southConnectorService.deleteAllItems.and.returnValue(of(undefined));
    southConnectorService.exportItems.and.returnValue(of(undefined));

    tester = new SouthItemsComponentTester();
    tester.detectChanges();
  });

  it('should display items', () => {
    expect(tester.southItems.length).toBe(2);
    const item = tester.southItems[0];
    expect(item.elements('td')[1]).toContainText('item1');
    expect(item.elements('td')[2]).toContainText('Every mn');
    expect(item.elements('td')[3]).toContainText('sql');
  });

  it('should enable south item', () => {
    tester.toggleButtons[0].click();
    expect(southConnectorService.disableItem).toHaveBeenCalledWith('southId', items[0].id);
    expect(notificationService.success).toHaveBeenCalledWith('south.items.disabled', { name: items[0].name });
    expect(southConnectorService.listItems).toHaveBeenCalledTimes(2);
  });

  it('should disable south item', () => {
    tester.toggleButtons[1].click();
    expect(southConnectorService.enableItem).toHaveBeenCalledWith('southId', items[1].id);
    expect(notificationService.success).toHaveBeenCalledWith('south.items.enabled', { name: items[1].name });
    expect(southConnectorService.listItems).toHaveBeenCalledTimes(2);
  });

  it('should delete all', () => {
    confirmationService.confirm.and.returnValue(of(undefined));

    tester.deleteAllButton.click();
    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(southConnectorService.deleteAllItems).toHaveBeenCalledTimes(1);
    expect(notificationService.success).toHaveBeenCalledWith('south.items.all-deleted');
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
    southConnectorService.listItems.and.returnValues(
      // initial call, where 3 items are present
      of([
        {
          id: 'id3',
          name: 'item3',
          enabled: false,
          connectorId: 'southId',
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

    tester = new SouthItemsComponentTester();
    tester.detectChanges();
    confirmationService.confirm.and.returnValue(of(undefined));
    southConnectorService.deleteItem.and.returnValue(of(undefined));

    const deleteBtn = tester.southItems[0].button('.delete-south-item');
    expect(tester.southItems.length).toBe(3);

    deleteBtn?.click();

    expect(tester.southItems.length).toBe(2);
    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(southConnectorService.deleteItem).toHaveBeenCalledTimes(1);
    expect(tester.tableItemNames).toEqual(items.map(i => i.name));

    // 1st call is when the tester is first created in the beforeEach
    // 2nd call is when the tester is recreated here
    // 3rd call is after the item is deleted and the list is recreated
    expect(southConnectorService.listItems).toHaveBeenCalledTimes(3);
  });

  it('should reset sorting after deletion of an item', () => {
    // Setup for deletion
    southConnectorService.listItems.and.returnValues(
      // initial call, where 3 items are present
      of([
        {
          id: 'id3',
          name: 'item3',
          enabled: false,
          connectorId: 'southId',
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
    tester = new SouthItemsComponentTester();
    tester.detectChanges();
    confirmationService.confirm.and.returnValue(of(undefined));
    southConnectorService.deleteItem.and.returnValue(of(undefined));

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
    southConnectorService.listItems.and.returnValue(
      of([
        {
          id: 'id3',
          name: 'foo-bar',
          enabled: false,
          connectorId: 'southId',
          settings: {
            query: 'sql'
          },
          scanModeId: 'scanModeId1'
        },
        ...items
      ])
    );

    tester = new SouthItemsComponentTester();
    tester.detectChanges();

    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();

    expect(tester.southItems.length).toBe(2);
    expect(tester.tableItemNames).toEqual(items.map(i => i.name));
  }));

  it('should not reset sorting after filtering', fakeAsync(() => {
    southConnectorService.listItems.and.returnValue(
      of([
        {
          id: 'id3',
          name: 'foo-bar',
          enabled: false,
          connectorId: 'southId',
          settings: {
            query: 'sql'
          },
          scanModeId: 'scanModeId1'
        },
        ...items
      ])
    );

    tester = new SouthItemsComponentTester();
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
        connectorId: 'southId',
        settings: {
          query: 'sql'
        },
        scanModeId: 'scanModeId1'
      },
      ...items
    ];
    southConnectorService.listItems.and.returnValues(
      // initial call, where 3 items are present
      of(extendedItems),
      // second call, where the second item is deleted
      of([extendedItems[0], extendedItems[2]])
    );

    tester = new SouthItemsComponentTester();
    tester.detectChanges();

    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();

    expect(tester.southItems.length).toBe(2);
    expect(tester.tableItemNames).toEqual(['item1', 'item2']);

    // Delete first item in the list
    confirmationService.confirm.and.returnValue(of(undefined));
    southConnectorService.deleteItem.and.returnValue(of(undefined));
    const deleteBtn = tester.southItems[0].button('.delete-south-item');
    deleteBtn?.click();

    expect(tester.southItems.length).toBe(1);
    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(southConnectorService.deleteItem).toHaveBeenCalledTimes(1);
    expect(tester.tableItemNames).toEqual(['item2']);

    // Empty filter and make sure the items are correct
    filterInput?.fillWith('');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();
    expect(tester.southItems.length).toBe(2);
    expect(tester.tableItemNames).toEqual(['foo-bar', 'item2']);
  }));
});
