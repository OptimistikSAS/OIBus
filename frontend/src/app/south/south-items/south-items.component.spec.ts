import { TestBed } from '@angular/core/testing';
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

  get tableItemNames() {
    return this.elements<HTMLTableCellElement>('tbody tr.south-item td:nth-child(2)').map(e => e.nativeElement.innerText);
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
});
