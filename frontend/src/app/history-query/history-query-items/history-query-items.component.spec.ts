import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ComponentTester, createMock, TestInput } from 'ngx-speculoos';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { Component } from '@angular/core';
import { HistoryQueryItemsComponent } from './history-query-items.component';
import { HistoryQueryDTO, HistoryQueryItemCommandDTO, HistoryQueryItemDTO } from '../../../../../backend/shared/model/history-query.model';
import { HistoryQueryService } from '../../services/history-query.service';
import {
  SouthItemSettings,
  SouthSettings,
  SouthSQLiteItemSettingsSerialization
} from '../../../../../backend/shared/model/south-settings.model';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';
import { ModalService } from '../../shared/modal.service';
import { ImportItemModalComponent } from '../../shared/import-item-modal/import-item-modal.component';
import { ImportHistoryQueryItemsModalComponent } from './import-history-query-items-modal/import-history-query-items-modal.component';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { OIBusBooleanAttribute, OIBusNumberAttribute, OIBusStringAttribute } from '../../../../../backend/shared/model/form.model';

const testHistoryQuery: HistoryQueryDTO = {
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
      scanMode: { id: 'scanModeId1', name: 'scan mode', description: '', cron: '* * * *' },
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
  manifest = testData.south.manifest;
  saveChangesDirectly!: boolean;
  inMemoryItems: Array<HistoryQueryItemCommandDTO> = [];
  updateInMemoryItems(items: Array<HistoryQueryItemCommandDTO> | null) {
    if (items) {
      this.inMemoryItems = items;
    } else {
      this._historyQueryService.findById(this.historyQuery!.id).subscribe(historyQuery => {
        this.historyQuery!.items = historyQuery.items;
        this.historyQuery = JSON.parse(JSON.stringify(this.historyQuery)); // Used to force a refresh in a history query item list
      });
    }
  }
  southCommand = testData.south.command;
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
    return this.elements('.form-check.form-switch .form-check-input')! as Array<TestInput>;
  }

  get deleteAllButton() {
    return this.button('#delete-all')!;
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
    return this.elements<HTMLTableCellElement>('tbody tr.south-item td:nth-child(3)').map(e => e.nativeElement.innerText);
  }
}

describe('HistoryQueryItemsComponent with saving changes directly', () => {
  let tester: HistoryQueryItemsComponentTester;
  let historyQueryService: jasmine.SpyObj<HistoryQueryService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let modalService: jasmine.SpyObj<ModalService>;

  beforeEach(() => {
    historyQueryService = createMock(HistoryQueryService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClient(),
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ModalService, useValue: modalService }
      ]
    });

    historyQueryService.enableItem.and.returnValue(of(undefined));
    historyQueryService.disableItem.and.returnValue(of(undefined));
    historyQueryService.deleteItem.and.returnValue(of(undefined));
    historyQueryService.deleteAllItems.and.returnValue(of(undefined));
    historyQueryService.exportItems.and.returnValue(of(undefined));
    historyQueryService.findById.and.returnValue(of(testHistoryQuery));

    confirmationService.confirm.and.returnValue(of(undefined));

    modalService.open.and.returnValue({
      componentInstance: {
        prepareForCreation: jasmine.createSpy(),
        prepareForEdition: jasmine.createSpy(),
        prepareForCopy: jasmine.createSpy(),
        canDismiss: jasmine.createSpy().and.returnValue(true)
      },
      result: of({})
    } as any);

    tester = new HistoryQueryItemsComponentTester(historyQueryService);
    tester.componentInstance.saveChangesDirectly = true;
    tester.detectChanges();
  });

  it('should display items', () => {
    expect(tester.southItems.length).toBe(3);
    const item = tester.southItems[0];
    expect(item.elements('td')[2]).toContainText(testHistoryQuery.items[0].name);
  });

  it('should enable history item', () => {
    const btnIdx = 1; // the second one is disabled by default
    tester.toggleButtons[btnIdx].click();
    expect(historyQueryService.enableItem).toHaveBeenCalledWith(testHistoryQuery.id, testHistoryQuery.items[btnIdx].id);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.items.enabled', { name: testHistoryQuery.items[btnIdx].name });
  });

  it('should disable history item', () => {
    const btnIdx = 0; // the first one is enabled by default
    tester.toggleButtons[btnIdx].click();
    expect(historyQueryService.disableItem).toHaveBeenCalledWith(testHistoryQuery.id, testHistoryQuery.items[btnIdx].id);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.items.disabled', { name: testHistoryQuery.items[btnIdx].name });
  });

  it('should delete all', () => {
    historyQueryService.findById.and.returnValue(of({ ...testHistoryQuery, items: [] }));

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
    historyQueryService.findById.and.returnValue(of({ ...testHistoryQuery, items: testHistoryQuery.items.slice(1) }));

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
    historyQueryService.findById.and.returnValue(of({ ...testHistoryQuery, items: testHistoryQuery.items.slice(0, 2) }));

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
    historyQueryService.findById.and.returnValue(of({ ...testHistoryQuery, items: testHistoryQuery.items.slice(0, 2) }));
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

  it('should open edit modal with beforeDismiss configuration', () => {
    const editButton = tester.southItems[0].button('.edit-south-item')!;
    editButton.click();

    expect(modalService.open).toHaveBeenCalledWith(
      jasmine.any(Function),
      jasmine.objectContaining({
        size: 'xl',
        beforeDismiss: jasmine.any(Function)
      })
    );
  });

  it('should open add modal with beforeDismiss configuration', () => {
    const addButton = tester.button('button.btn-sm:nth-child(1)')!;
    addButton.click();

    expect(modalService.open).toHaveBeenCalledWith(
      jasmine.any(Function),
      jasmine.objectContaining({
        size: 'xl',
        beforeDismiss: jasmine.any(Function)
      })
    );
  });
});

describe('HistoryQueryItemsComponent without saving changes directly', () => {
  let tester: HistoryQueryItemsComponentTester;
  let historyQueryService: jasmine.SpyObj<HistoryQueryService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let modalService: jasmine.SpyObj<ModalService>;

  beforeEach(() => {
    historyQueryService = createMock(HistoryQueryService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClient(),
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ModalService, useValue: modalService }
      ]
    });

    historyQueryService.enableItem.and.returnValue(of(undefined));
    historyQueryService.disableItem.and.returnValue(of(undefined));
    historyQueryService.deleteItem.and.returnValue(of(undefined));
    historyQueryService.deleteAllItems.and.returnValue(of(undefined));
    historyQueryService.exportItems.and.returnValue(of(undefined));
    historyQueryService.findById.and.returnValue(of(testHistoryQuery));

    confirmationService.confirm.and.returnValue(of(undefined));

    modalService.open.and.returnValue({
      componentInstance: {
        prepareForCreation: jasmine.createSpy(),
        prepareForEdition: jasmine.createSpy(),
        prepareForCopy: jasmine.createSpy(),
        canDismiss: jasmine.createSpy().and.returnValue(true)
      },
      result: of({})
    } as any);

    tester = new HistoryQueryItemsComponentTester(historyQueryService);
    tester.componentInstance.saveChangesDirectly = false;
    tester.detectChanges();
  });

  it('should display items', () => {
    expect(tester.southItems.length).toBe(3);
    const item = tester.southItems[0];
    expect(item.elements('td')[2]).toContainText(testHistoryQuery.items[0].name);
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

describe('HistoryQueryItemsComponent CSV Import Tests', () => {
  let tester: HistoryQueryItemsComponentTester;
  let historyQueryService: jasmine.SpyObj<HistoryQueryService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let modalService: jasmine.SpyObj<ModalService>;

  beforeEach(() => {
    historyQueryService = createMock(HistoryQueryService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClient(),
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ModalService, useValue: modalService }
      ]
    });

    historyQueryService.findById.and.returnValue(of(testHistoryQuery));
    historyQueryService.checkImportItems.and.returnValue(
      of({
        items: [] as Array<HistoryQueryItemDTO>,
        errors: [] as Array<{ item: HistoryQueryItemDTO; error: string }>
      })
    );
    historyQueryService.importItems.and.returnValue(of(undefined));

    const mockModalRef = {
      componentInstance: {
        expectedHeaders: [],
        prepare: jasmine.createSpy('prepare')
      },
      result: of({ file: new File([''], 'test.csv'), delimiter: ',' })
    };
    modalService.open.and.returnValue(mockModalRef as any);

    tester = new HistoryQueryItemsComponentTester(historyQueryService);
  });

  describe('with saveChangesDirectly = true', () => {
    beforeEach(() => {
      tester.componentInstance.saveChangesDirectly = true;
      tester.detectChanges();
    });

    it('should open import modal and set expected headers', () => {
      const importButton = tester.button('#import-button')!;
      importButton.click();

      expect(modalService.open).toHaveBeenCalledWith(ImportItemModalComponent, { backdrop: 'static' });

      const modalRef = (modalService.open as jasmine.Spy).calls.mostRecent().returnValue as { componentInstance: any };
      expect(modalRef.componentInstance.expectedHeaders).toEqual([
        'name',
        'enabled',
        'settings_objectArray',
        'settings_objectSettings',
        'settings_objectValue'
      ]);
    });

    it('should call checkImportItems when file is selected', () => {
      const mockFile = new File(['name,enabled\ntest,true'], 'test.csv');
      const mockModalRef = {
        componentInstance: { expectedHeaders: [] },
        result: of({ file: mockFile, delimiter: ',' })
      };
      modalService.open.and.returnValue(mockModalRef as any);

      const importButton = tester.button('#import-button')!;
      importButton.click();

      expect(historyQueryService.checkImportItems).toHaveBeenCalledWith(
        tester.componentInstance.manifest.id,
        jasmine.any(Array),
        mockFile,
        ','
      );
    });

    it('should open ImportHistoryQueryItemsModalComponent after successful check', () => {
      const mockItems: Array<HistoryQueryItemDTO> = [
        {
          id: 'new1',
          name: 'newItem1',
          enabled: true,
          settings: { query: 'SELECT 1', dateTimeFields: [], serialization: undefined as unknown as SouthSQLiteItemSettingsSerialization }
        }
      ];
      const mockErrors = [{ item: mockItems[0], error: 'Invalid query' }];

      historyQueryService.checkImportItems.and.returnValue(of({ items: mockItems, errors: mockErrors }));

      modalService.open.and.returnValues(
        {
          componentInstance: { expectedHeaders: [] },
          result: of({ file: new File([''], 'test.csv'), delimiter: ',' })
        } as any,
        {
          componentInstance: { prepare: jasmine.createSpy('prepare') },
          result: of(mockItems)
        } as any
      );

      tester.button('#import-button')!.click();

      expect(modalService.open).toHaveBeenCalledWith(ImportHistoryQueryItemsModalComponent, { size: 'xl', backdrop: 'static' });

      const lastModal = (modalService.open as jasmine.Spy).calls.mostRecent().returnValue as { componentInstance: any };
      expect(lastModal.componentInstance.prepare).toHaveBeenCalledWith(
        tester.componentInstance.manifest,
        jasmine.any(Array),
        mockItems,
        mockErrors
      );
    });

    it('should call importItems service when import is confirmed', () => {
      const mockItems: Array<HistoryQueryItemDTO> = [
        {
          id: 'new1',
          name: 'newItem1',
          enabled: true,
          settings: { query: 'SELECT 1', dateTimeFields: [], serialization: undefined as unknown as SouthSQLiteItemSettingsSerialization }
        }
      ];

      const mockCommandItems: Array<HistoryQueryItemCommandDTO> = [
        {
          id: 'new1',
          name: 'newItem1',
          enabled: true,
          settings: { query: 'SELECT 1', dateTimeFields: [], serialization: undefined as unknown as SouthSQLiteItemSettingsSerialization }
        }
      ];

      historyQueryService.checkImportItems.and.returnValue(of({ items: mockItems, errors: [] }));

      modalService.open.and.returnValues(
        {
          componentInstance: { expectedHeaders: [] },
          result: of({ file: new File([''], 'test.csv'), delimiter: ',' })
        } as any,
        {
          componentInstance: { prepare: jasmine.createSpy('prepare') },
          result: of(mockCommandItems)
        } as any
      );

      tester.button('#import-button')!.click();

      expect(historyQueryService.importItems).toHaveBeenCalledWith(tester.componentInstance.historyQuery.id, mockCommandItems);
      expect(notificationService.success).toHaveBeenCalledWith('history-query.items.imported');
    });

    it('should emit null inMemoryItems after successful import', () => {
      spyOn(tester.componentInstance, 'updateInMemoryItems');

      const mockItems: Array<HistoryQueryItemDTO> = [
        {
          id: 'new1',
          name: 'newItem1',
          enabled: true,
          settings: { query: 'SELECT 1', dateTimeFields: [], serialization: undefined as unknown as SouthSQLiteItemSettingsSerialization }
        }
      ];

      const mockCommandItems: Array<HistoryQueryItemCommandDTO> = [
        {
          id: 'new1',
          name: 'newItem1',
          enabled: true,
          settings: { query: 'SELECT 1', dateTimeFields: [], serialization: undefined as unknown as SouthSQLiteItemSettingsSerialization }
        }
      ];

      historyQueryService.checkImportItems.and.returnValue(of({ items: mockItems, errors: [] }));

      modalService.open.and.returnValues(
        {
          componentInstance: { expectedHeaders: [] },
          result: of({ file: new File([''], 'test.csv'), delimiter: ',' })
        } as any,
        {
          componentInstance: { prepare: jasmine.createSpy('prepare') },
          result: of(mockCommandItems)
        } as any
      );

      tester.button('#import-button')!.click();

      expect(tester.componentInstance.updateInMemoryItems).toHaveBeenCalledWith(null);
    });
  });

  describe('with saveChangesDirectly = false', () => {
    beforeEach(() => {
      tester.componentInstance.saveChangesDirectly = false;
      tester.detectChanges();
    });

    it('should add items to allItems array instead of calling service', () => {
      const mockItems: Array<HistoryQueryItemDTO> = [
        {
          id: 'new1',
          name: 'newItem1',
          enabled: true,
          settings: { query: 'SELECT 1', dateTimeFields: [], serialization: undefined as unknown as SouthSQLiteItemSettingsSerialization }
        },
        {
          id: 'new2',
          name: 'newItem2',
          enabled: false,
          settings: { query: 'SELECT 1', dateTimeFields: [], serialization: undefined as unknown as SouthSQLiteItemSettingsSerialization }
        }
      ];

      const mockCommandItems: Array<HistoryQueryItemCommandDTO> = [
        {
          id: 'new1',
          name: 'newItem1',
          enabled: true,
          settings: { query: 'SELECT 1', dateTimeFields: [], serialization: undefined as unknown as SouthSQLiteItemSettingsSerialization }
        },
        {
          id: 'new2',
          name: 'newItem2',
          enabled: false,
          settings: { query: 'SELECT 1', dateTimeFields: [], serialization: undefined as unknown as SouthSQLiteItemSettingsSerialization }
        }
      ];

      historyQueryService.checkImportItems.and.returnValue(of({ items: mockItems, errors: [] }));

      modalService.open.and.returnValues(
        {
          componentInstance: { expectedHeaders: [] },
          result: of({ file: new File([''], 'test.csv'), delimiter: ',' })
        } as any,
        {
          componentInstance: { prepare: jasmine.createSpy('prepare') },
          result: of(mockCommandItems)
        } as any
      );

      spyOn(tester.componentInstance, 'updateInMemoryItems');
      tester.button('#import-button')!.click();

      expect(historyQueryService.importItems).not.toHaveBeenCalled();
      expect(notificationService.success).not.toHaveBeenCalled();
      expect(tester.componentInstance.updateInMemoryItems).toHaveBeenCalledWith(jasmine.any(Array));
    });

    it('should not call backend services in memory mode', () => {
      const mockItems: Array<HistoryQueryItemDTO> = [
        {
          id: 'new1',
          name: 'newItem1',
          enabled: true,
          settings: { query: 'SELECT 1', dateTimeFields: [], serialization: undefined as unknown as SouthSQLiteItemSettingsSerialization }
        }
      ];

      const mockCommandItems: Array<HistoryQueryItemCommandDTO> = [
        {
          id: 'new1',
          name: 'newItem1',
          enabled: true,
          settings: { query: 'SELECT 1', dateTimeFields: [], serialization: undefined as unknown as SouthSQLiteItemSettingsSerialization }
        }
      ];

      historyQueryService.checkImportItems.and.returnValue(of({ items: mockItems, errors: [] }));

      modalService.open.and.returnValues(
        {
          componentInstance: { expectedHeaders: [] },
          result: of({ file: new File([''], 'test.csv'), delimiter: ',' })
        } as any,
        {
          componentInstance: { prepare: jasmine.createSpy('prepare') },
          result: of(mockCommandItems)
        } as any
      );

      tester.button('#import-button')!.click();

      expect(historyQueryService.importItems).not.toHaveBeenCalled();
      expect(notificationService.success).not.toHaveBeenCalled();
    });
  });

  describe('Expected headers generation', () => {
    beforeEach(() => {
      tester.componentInstance.saveChangesDirectly = true;
      const specificManifest = structuredClone(testData.south.manifest);
      specificManifest.items.rootAttribute.attributes = [
        {
          type: 'object',
          key: 'settings',
          translationKey: 'configuration.oibus.manifest.south.items.settings',
          displayProperties: {
            visible: true,
            wrapInBox: true
          },
          enablingConditions: [],
          validators: [],
          attributes: [
            {
              key: 'query',
              type: 'string',
              translationKey: 'configuration.oibus.manifest.south.items.settings'
            } as OIBusStringAttribute,
            {
              key: 'timeout',
              type: 'number',
              translationKey: 'configuration.oibus.manifest.south.items.settings'
            } as OIBusNumberAttribute,
            {
              key: 'enabled',
              type: 'boolean',
              translationKey: 'configuration.oibus.manifest.south.items.settings'
            } as OIBusBooleanAttribute
          ]
        }
      ];
      tester.componentInstance.manifest = specificManifest;
      tester.detectChanges();
    });

    it('should include all manifest settings in expected headers', () => {
      tester.button('#import-button')!.click();

      expect(modalService.open).toHaveBeenCalledWith(ImportItemModalComponent, { backdrop: 'static' });

      const modalRef = (modalService.open as jasmine.Spy).calls.mostRecent().returnValue as { componentInstance: any };
      expect(modalRef.componentInstance.expectedHeaders).toEqual([
        'name',
        'enabled',
        'settings_query',
        'settings_timeout',
        'settings_enabled'
      ]);
    });

    it('should not include scanMode in headers since history query items do not have scan modes', () => {
      tester.button('#import-button')!.click();
      const modalRef = (modalService.open as jasmine.Spy).calls.mostRecent().returnValue as { componentInstance: any };

      expect(modalRef.componentInstance.expectedHeaders).not.toContain('scanMode');
    });
  });

  describe('Modal cancellation', () => {
    beforeEach(() => {
      tester.componentInstance.saveChangesDirectly = true;
      tester.detectChanges();
    });

    it('should not proceed with import when modal is cancelled', () => {
      const mockModalRef = {
        componentInstance: { expectedHeaders: [] },
        result: of(null)
      };
      modalService.open.and.returnValue(mockModalRef as any);

      tester.button('#import-button')!.click();

      expect(historyQueryService.checkImportItems).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      tester.componentInstance.saveChangesDirectly = true;
      tester.detectChanges();
    });

    it('should handle service errors gracefully', () => {
      const mockFile = new File(['name,enabled\ntest,true'], 'test.csv');
      const mockModalRef = {
        componentInstance: { expectedHeaders: [] },
        result: of({ file: mockFile, delimiter: ',' })
      };

      historyQueryService.checkImportItems.and.throwError('Service error');
      modalService.open.and.returnValue(mockModalRef as any);

      expect(() => {
        tester.button('#import-button')!.click();
      }).not.toThrow();
    });
  });

  describe('Mass actions', () => {
    beforeEach(() => {
      tester.componentInstance.historyQuery = testHistoryQuery;
      tester.detectChanges();
    });

    it('should have mass action functionality available', () => {
      expect(tester.componentInstance).toBeDefined();
      expect(historyQueryService.enableItems).toBeDefined();
      expect(historyQueryService.disableItems).toBeDefined();
      expect(historyQueryService.deleteItems).toBeDefined();
    });
  });
});
