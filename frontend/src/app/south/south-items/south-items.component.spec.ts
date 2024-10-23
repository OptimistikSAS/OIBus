import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ComponentTester, createMock, TestInput } from 'ngx-speculoos';
import { SouthConnectorService } from '../../services/south-connector.service';
import {
  SouthConnectorDTO,
  SouthConnectorItemDTO,
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

const items: Array<SouthConnectorItemDTO<SouthItemSettings>> = [
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
    name: 'item2',
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
];

@Component({
  template: `<oib-south-items [southConnector]="southConnector" [scanModes]="scanModes" [southManifest]="manifest" />`,
  standalone: true,
  imports: [SouthItemsComponent]
})
class TestComponent {
  southConnector: SouthConnectorDTO<SouthSettings, SouthItemSettings> = {
    id: 'southId',
    name: 'South Connector',
    items: items
  } as SouthConnectorDTO<SouthSettings, SouthItemSettings>;
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
    southConnectorService.deleteAllItems.and.returnValue(of(undefined));
    southConnectorService.exportItems.and.returnValue(of(undefined));

    tester = new SouthItemsComponentTester();
    tester.detectChanges();
  });

  it('should display items', () => {
    expect(tester.southItems.length).toBe(3);
    const item = tester.southItems[0];
    expect(item.elements('td')[1]).toContainText('item1');
    expect(item.elements('td')[2]).toContainText('Every mn');
    expect(item.elements('td')[3]).toContainText('sql');
  });

  it('should enable south item', () => {
    tester.toggleButtons[0].click();
    expect(southConnectorService.disableItem).toHaveBeenCalledWith('southId', items[0].id);
    expect(notificationService.success).toHaveBeenCalledWith('south.items.disabled', { name: items[0].name });
  });

  it('should disable south item', () => {
    tester.toggleButtons[1].click();
    expect(southConnectorService.enableItem).toHaveBeenCalledWith('southId', items[1].id);
    expect(notificationService.success).toHaveBeenCalledWith('south.items.enabled', { name: items[1].name });
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
    tester = new SouthItemsComponentTester();
    tester.detectChanges();
    confirmationService.confirm.and.returnValue(of(undefined));
    southConnectorService.deleteItem.and.returnValue(of(undefined));

    expect(tester.southItems.length).toBe(3);

    tester.southItems[0].button('.delete-south-item')!.click();

    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(southConnectorService.deleteItem).toHaveBeenCalledTimes(1);
  });

  it('should reset sorting after deletion of an item', () => {
    tester = new SouthItemsComponentTester();
    tester.detectChanges();
    confirmationService.confirm.and.returnValue(of(undefined));
    southConnectorService.deleteItem.and.returnValue(of(undefined));

    // Sort items descending
    tester.sortByNameBtn.click(); // Ascending
    tester.sortByNameBtn.click(); // Descending
    expect(tester.tableItemNames).toEqual(['item3', 'item2', 'item1']);

    // Delete first item
    tester.southItems[0].button('.delete-south-item')!.click();
  });

  it('should filter items', fakeAsync(() => {
    tester = new SouthItemsComponentTester();
    tester.detectChanges();

    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();

    expect(tester.southItems.length).toBe(3);
    expect(tester.tableItemNames).toEqual(items.map(i => i.name));
  }));

  it('should not reset sorting after filtering', fakeAsync(() => {
    tester = new SouthItemsComponentTester();
    tester.detectChanges();

    // Sort items descending
    tester.sortByNameBtn.click(); // Ascending
    tester.sortByNameBtn.click(); // Descending
    expect(tester.tableItemNames).toEqual(['item3', 'item2', 'item1']);

    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item');
    tick(300); // skip the 200ms debounce time
    tester.detectChanges();

    expect(tester.southItems.length).toBe(3);
    expect(tester.tableItemNames).toEqual(['item3', 'item2', 'item1']);
  }));

  it('should be able to delete item when filtering', fakeAsync(() => {
    tester = new SouthItemsComponentTester();
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
    southConnectorService.deleteItem.and.returnValue(of(undefined));
    tester.southItems[0].button('.delete-south-item')!.click();

    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(southConnectorService.deleteItem).toHaveBeenCalledTimes(1);
  }));
});
