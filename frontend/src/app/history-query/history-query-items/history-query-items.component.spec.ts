import { TestBed } from '@angular/core/testing';
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
  template: `<oib-history-query-items
    [inMemory]="false"
    [historyQuery]="historyQuery"
    [southConnectorItemSchema]="manifest.items"
  ></oib-history-query-items>`,
  standalone: true,
  imports: [HistoryQueryItemsComponent]
})
class TestComponent {
  historyQuery: HistoryQueryDTO = {
    id: 'historyId',
    name: 'History query',
    description: 'My History query description',
    enabled: true,
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
    },
    northSettings: {
      host: 'localhost'
    },
    caching: {
      scanModeId: 'scanModeId1',
      retryInterval: 1000,
      retryCount: 3,
      groupCount: 1000,
      maxSendCount: 10000,
      sendFileImmediately: true,
      maxSize: 30
    },
    archive: {
      enabled: false,
      retentionDuration: 0
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

  get importButton() {
    return this.button('#import-button')!;
  }

  get fileInput() {
    return this.input('#file')!;
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

  it('should export items', () => {
    confirmationService.confirm.and.returnValue(of(undefined));

    tester.exportButton.click();
    expect(historyQueryService.exportItems).toHaveBeenCalledWith('historyId', 'History query');
  });

  it('should select a file', () => {
    spyOn(tester.fileInput.nativeElement, 'click');
    tester.importButton.click();
    expect(tester.fileInput.nativeElement.click).toHaveBeenCalled();
  });

  it('should trigger the upload', () => {
    historyQueryService.uploadItems.and.returnValue(of(undefined));

    const event = new Event('change');
    tester.fileInput.dispatchEvent(event);
    expect(historyQueryService.uploadItems).toHaveBeenCalled();
  });
});
