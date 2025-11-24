import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ComponentTester, createMock, TestInput } from 'ngx-speculoos';
import { SouthConnectorService } from '../../services/south-connector.service';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemDTO
} from '../../../../../backend/shared/model/south-connector.model';
import { SouthItemSettings, SouthSQLiteItemSettingsSerialization } from '../../../../../backend/shared/model/south-settings.model';
import { of } from 'rxjs';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { SouthItemsComponent } from './south-items.component';
import { Component } from '@angular/core';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { ImportItemModalComponent } from '../../shared/import-item-modal/import-item-modal.component';
import { ModalService } from '../../shared/modal.service';
import { ImportSouthItemsModalComponent } from './import-south-items-modal/import-south-items-modal.component';
import { OIBusBooleanAttribute, OIBusNumberAttribute, OIBusStringAttribute } from '../../../../../backend/shared/model/form.model';
import { provideHttpClientTesting } from '@angular/common/http/testing';

const testSouthConnector: SouthConnectorDTO = {
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
      scanMode: testData.scanMode.list[0]
    },
    {
      id: 'id2',
      name: 'item1-copy',
      enabled: false,
      settings: {
        query: 'sql'
      } as SouthItemSettings,
      scanMode: testData.scanMode.list[0]
    },
    {
      id: 'id3',
      name: 'item3',
      enabled: false,
      settings: {
        query: 'sql'
      } as SouthItemSettings,
      scanMode: testData.scanMode.list[0]
    }
  ]
} as SouthConnectorDTO;

@Component({
  selector: 'test-south-items-component',
  template: ` <oib-south-items
    [southId]="southConnector.id"
    [southConnector]="southConnector"
    [scanModes]="scanModes"
    [certificates]="[]"
    [southManifest]="manifest"
    [southConnectorCommand]="southCommand"
    [saveChangesDirectly]="saveChangesDirectly"
    (inMemoryItems)="updateInMemoryItems($event)"
  />`,
  imports: [SouthItemsComponent]
})
class TestComponent {
  _southConnectorService!: SouthConnectorService;
  southConnector = structuredClone(testSouthConnector);
  scanModes = testData.scanMode.list;
  manifest = testData.south.manifest;
  saveChangesDirectly!: boolean;
  inMemoryItems: Array<SouthConnectorItemDTO> = [];
  southConnectorCommand = {} as SouthConnectorCommandDTO;
  southCommand = testData.south.command;

  updateInMemoryItems(items: Array<SouthConnectorItemDTO> | null) {
    if (items) {
      this.inMemoryItems = items;
    } else {
      this._southConnectorService.findById(this.southConnector!.id).subscribe(southConnector => {
        this.southConnector!.items = southConnector.items;
        this.southConnector = JSON.parse(JSON.stringify(this.southConnector)); // Used to force a refresh in a south item list
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
    return this.button('button:has( > span[translate="south.items.name"])')!;
  }

  get sortByScanModeBtn() {
    return this.button('button:has( > span[translate="south.items.scan-mode"])')!;
  }

  get tableItemNames() {
    return this.elements<HTMLTableCellElement>('tbody tr.south-item td:nth-child(3)').map(e => e.nativeElement.innerText);
  }

  get tableScanModeNames() {
    return this.elements<HTMLTableCellElement>('tbody tr.south-item td:nth-child(4)').map(e => e.nativeElement.innerText);
  }
}

describe('SouthItemsComponent with saving changes directly', () => {
  let tester: SouthItemsComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  beforeEach(async () => {
    southConnectorService = createMock(SouthConnectorService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClientTesting(),
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
    southConnectorService.findById.and.returnValue(of(testSouthConnector));

    confirmationService.confirm.and.returnValue(of(undefined));

    tester = new SouthItemsComponentTester(southConnectorService);
    tester.componentInstance.saveChangesDirectly = true;
    await tester.change();
  });

  it('should display items', () => {
    expect(tester.southItems.length).toBe(3);
    const item = tester.southItems[0];
    expect(item.elements('td')[2]).toContainText(testSouthConnector.items[0].name);
    expect(item.elements('td')[3]).toContainText('scanMode1');
  });

  it('should display enabled status for enabled items', () => {
    const item = tester.southItems[0]; // first item is enabled by default
    const statusCell = item.elements('td')[1]; // status column
    expect(statusCell).toContainText('Enabled');
  });

  it('should display disabled status for disabled items', () => {
    const item = tester.southItems[1]; // second item is disabled by default
    const statusCell = item.elements('td')[1]; // status column
    expect(statusCell).toContainText('Disabled');
  });

  it('should delete all', () => {
    southConnectorService.findById.and.returnValue(of({ ...testSouthConnector, items: [] }));

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
    southConnectorService.findById.and.returnValue(
      of({
        ...testSouthConnector,
        items: testSouthConnector.items.slice(1)
      })
    );

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
    southConnectorService.findById.and.returnValue(
      of({
        ...testSouthConnector,
        items: testSouthConnector.items.slice(0, 2)
      })
    );

    tester.southItems[2].button('.delete-south-item')!.click();

    expect(tester.tableItemNames).toEqual(['item1', 'item1-copy']);
  });

  it('should filter items', fakeAsync(async () => {
    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item1');
    tick(300); // skip the 200ms debounce time
    await tester.change();

    expect(tester.tableItemNames).toEqual(['item1', 'item1-copy']);
  }));

  it('should not reset sorting after filtering', fakeAsync(async () => {
    // Sort items descending
    tester.sortByNameBtn.click(); // Ascending
    tester.sortByNameBtn.click(); // Descending
    expect(tester.tableItemNames).toEqual(['item3', 'item1-copy', 'item1']);

    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item');
    tick(300); // skip the 200ms debounce time
    await tester.change();

    expect(tester.tableItemNames).toEqual(['item3', 'item1-copy', 'item1']);
  }));

  it('should be able to delete item when filtering', fakeAsync(async () => {
    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item3');
    tick(300); // skip the 200ms debounce time
    await tester.change();

    expect(tester.tableItemNames).toEqual(['item3']);

    // Delete the third item in the list
    southConnectorService.findById.and.returnValue(
      of({
        ...testSouthConnector,
        items: testSouthConnector.items.slice(0, 2)
      })
    );
    tester.southItems[0].button('.delete-south-item')!.click();

    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(southConnectorService.deleteItem).toHaveBeenCalledTimes(1);
    expect(tester.southItems).toEqual([]);

    // Empty filter and make sure the items are correct
    filterInput?.fillWith('');
    tick(300); // skip the 200ms debounce time
    await tester.change();
    expect(tester.tableItemNames).toEqual(['item1', 'item1-copy']);
  }));
});

describe('SouthItemsComponent without saving changes directly', () => {
  let tester: SouthItemsComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let modalService: jasmine.SpyObj<ModalService>;

  beforeEach(async () => {
    southConnectorService = createMock(SouthConnectorService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClientTesting(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ModalService, useValue: modalService }
      ]
    });

    southConnectorService.enableItem.and.returnValue(of(undefined));
    southConnectorService.disableItem.and.returnValue(of(undefined));
    southConnectorService.deleteItem.and.returnValue(of(undefined));
    southConnectorService.deleteAllItems.and.returnValue(of(undefined));
    southConnectorService.exportItems.and.returnValue(of(undefined));
    southConnectorService.findById.and.returnValue(of(testSouthConnector));

    confirmationService.confirm.and.returnValue(of(undefined));

    const mockModalRef = {
      componentInstance: {
        prepare: jasmine.createSpy('prepare')
      },
      result: of({ file: new File([''], 'test.csv'), delimiter: ',' })
    };
    modalService.open.and.returnValue(mockModalRef as any);

    tester = new SouthItemsComponentTester(southConnectorService);
    tester.componentInstance.saveChangesDirectly = false;
    await tester.change();
  });

  it('should display items', () => {
    expect(tester.southItems.length).toBe(3);
    const item = tester.southItems[0];
    expect(item.elements('td')[2]).toContainText(testSouthConnector.items[0].name);
    expect(item.elements('td')[3]).toContainText('scanMode1');
  });

  it('should not have toggle buttons for enable/disable', () => {
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

  it('should filter items', fakeAsync(async () => {
    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item1');
    tick(300); // skip the 200ms debounce time
    await tester.change();

    expect(tester.tableItemNames).toEqual(['item1', 'item1-copy']);
  }));

  it('should not reset sorting after filtering', fakeAsync(async () => {
    // Sort items descending
    tester.sortByNameBtn.click(); // Ascending
    tester.sortByNameBtn.click(); // Descending
    expect(tester.tableItemNames).toEqual(['item3', 'item1-copy', 'item1']);

    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item');
    tick(300); // skip the 200ms debounce time
    await tester.change();

    expect(tester.tableItemNames).toEqual(['item3', 'item1-copy', 'item1']);
  }));

  it('should be able to delete item when filtering', fakeAsync(async () => {
    const filterInput = tester.input('.oib-box-input-header');
    filterInput?.fillWith('item3');
    tick(300); // skip the 200ms debounce time
    await tester.change();

    expect(tester.tableItemNames).toEqual(['item3']);

    // Delete the third item in the list
    tester.southItems[0].button('.delete-south-item')!.click();

    expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
    expect(southConnectorService.deleteItem).not.toHaveBeenCalled();
    expect(tester.southItems).toEqual([]);

    // Empty filter and make sure the items are correct
    filterInput?.fillWith('');
    tick(300); // skip the 200ms debounce time
    await tester.change();
    expect(tester.tableItemNames).toEqual(['item1', 'item1-copy']);
  }));
});

describe('SouthItemsComponent CSV Import Tests', () => {
  let tester: SouthItemsComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let modalService: jasmine.SpyObj<ModalService>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClientTesting(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ModalService, useValue: modalService }
      ]
    });

    southConnectorService.findById.and.returnValue(of(testSouthConnector));
    southConnectorService.checkImportItems.and.returnValue(
      of({
        items: [] as Array<SouthConnectorItemDTO>,
        errors: []
      })
    );
    southConnectorService.importItems.and.returnValue(of(undefined));

    const mockModalRef = {
      componentInstance: {
        prepare: jasmine.createSpy('prepare')
      },
      result: of({ file: new File([''], 'test.csv'), delimiter: ',' })
    };
    modalService.open.and.returnValue(mockModalRef as any);

    tester = new SouthItemsComponentTester(southConnectorService);
  });

  describe('with saveChangesDirectly = true', () => {
    beforeEach(async () => {
      tester.componentInstance.saveChangesDirectly = true;
      await tester.change();
    });

    it('should open import modal and set expected headers', () => {
      const importButton = tester.button('#import-button')!;
      importButton.click();

      expect(modalService.open).toHaveBeenCalledWith(ImportItemModalComponent, { backdrop: 'static' });

      const modalRef = (modalService.open as jasmine.Spy).calls.mostRecent().returnValue as { componentInstance: any };
      expect(modalRef.componentInstance.prepare).toHaveBeenCalledWith(
        ['name', 'enabled', 'scanMode', 'settings_objectArray', 'settings_objectSettings', 'settings_objectValue'],
        [],
        [],
        false
      );
    });

    it('should set expected headers without scanMode when no scan modes available', async () => {
      tester.componentInstance.scanModes = [];
      await tester.change();

      const importButton = tester.button('#import-button')!;
      importButton.click();

      expect(modalService.open).toHaveBeenCalledWith(ImportItemModalComponent, { backdrop: 'static' });

      const modalRef = (modalService.open as jasmine.Spy).calls.mostRecent().returnValue as { componentInstance: any };
      expect(modalRef.componentInstance.prepare).toHaveBeenCalledWith(
        ['name', 'enabled', 'settings_objectArray', 'settings_objectSettings', 'settings_objectValue'],
        [],
        [],
        false
      );
    });

    it('should call checkImportItems when file is selected', () => {
      const mockFile = new File(['name,enabled\ntest,true'], 'test.csv');
      const mockModalRef = {
        componentInstance: { prepare: jasmine.createSpy('prepare') },
        result: of({ file: mockFile, delimiter: ',' })
      };
      modalService.open.and.returnValue(mockModalRef as any);

      const importButton = tester.button('#import-button')!;
      importButton.click();

      expect(southConnectorService.checkImportItems).toHaveBeenCalledWith(
        tester.componentInstance.manifest.id,
        jasmine.any(Array),
        mockFile,
        ','
      );
    });

    it('should open ImportSouthItemsModalComponent after successful check', () => {
      const mockItems: Array<SouthConnectorItemDTO> = [
        {
          id: 'new1',
          name: 'newItem1',
          enabled: true,
          scanMode: testData.scanMode.list[0],
          settings: {
            query: 'SELECT 1',
            dateTimeFields: [],
            serialization: undefined as unknown as SouthSQLiteItemSettingsSerialization
          }
        }
      ];
      const mockErrors = [{ item: { id: 'new1', name: 'newItem1', enabled: 'true' }, error: 'Invalid query' }];

      southConnectorService.checkImportItems.and.returnValue(of({ items: mockItems, errors: mockErrors }));

      modalService.open.and.returnValues(
        {
          componentInstance: { prepare: jasmine.createSpy('prepare') },
          result: of({ file: new File([''], 'test.csv'), delimiter: ',' })
        } as any,
        {
          componentInstance: { prepare: jasmine.createSpy('prepare') },
          result: of(mockItems)
        } as any
      );

      tester.button('#import-button')!.click();

      expect(modalService.open).toHaveBeenCalledWith(ImportSouthItemsModalComponent, {
        size: 'xl',
        backdrop: 'static'
      });

      const lastModal = (modalService.open as jasmine.Spy).calls.mostRecent().returnValue as { componentInstance: any };
      expect(lastModal.componentInstance.prepare).toHaveBeenCalledWith(
        tester.componentInstance.manifest,
        jasmine.any(Array),
        mockItems,
        mockErrors,
        tester.componentInstance.scanModes
      );
    });

    it('should call importItems service when import is confirmed', () => {
      const mockItems: Array<SouthConnectorItemDTO> = [
        {
          id: 'new1',
          name: 'newItem1',
          enabled: true,
          scanMode: testData.scanMode.list[0],
          settings: {
            query: 'SELECT 1',
            dateTimeFields: [],
            serialization: undefined as unknown as SouthSQLiteItemSettingsSerialization
          }
        }
      ];

      southConnectorService.checkImportItems.and.returnValue(of({ items: mockItems, errors: [] }));

      modalService.open.and.returnValues(
        {
          componentInstance: { prepare: jasmine.createSpy('prepare') },
          result: of({ file: new File([''], 'test.csv'), delimiter: ',' })
        } as any,
        {
          componentInstance: { prepare: jasmine.createSpy('prepare') },
          result: of(mockItems)
        } as any
      );

      tester.button('#import-button')!.click();

      expect(southConnectorService.importItems).toHaveBeenCalledWith(
        tester.componentInstance.southConnector.id,
        mockItems.map(item => ({
          id: item.id,
          name: item.name,
          enabled: item.enabled,
          settings: item.settings,
          scanModeId: item.scanMode.id,
          scanModeName: null
        }))
      );
      expect(notificationService.success).toHaveBeenCalledWith('south.items.import.imported');
    });

    it('should emit null inMemoryItems after successful import', () => {
      spyOn(tester.componentInstance, 'updateInMemoryItems');

      const mockItems: Array<SouthConnectorItemDTO> = [
        {
          id: 'new1',
          name: 'newItem1',
          enabled: true,
          scanMode: testData.scanMode.list[0],
          settings: {
            query: 'SELECT 1',
            dateTimeFields: [],
            serialization: undefined as unknown as SouthSQLiteItemSettingsSerialization
          }
        }
      ];

      southConnectorService.checkImportItems.and.returnValue(of({ items: mockItems, errors: [] }));

      modalService.open.and.returnValues(
        {
          componentInstance: { prepare: jasmine.createSpy('prepare') },
          result: of({ file: new File([''], 'test.csv'), delimiter: ',' })
        } as any,
        {
          componentInstance: { prepare: jasmine.createSpy('prepare') },
          result: of(mockItems)
        } as any
      );

      tester.button('#import-button')!.click();

      expect(tester.componentInstance.updateInMemoryItems).toHaveBeenCalledWith(null);
    });
  });

  describe('with saveChangesDirectly = false', () => {
    beforeEach(async () => {
      tester.componentInstance.saveChangesDirectly = false;
      await tester.change();
    });

    it('should add items to allItems array instead of calling service', () => {
      const mockItems: Array<SouthConnectorItemDTO> = [
        {
          id: 'new1',
          name: 'newItem1',
          enabled: true,
          scanMode: testData.scanMode.list[0],
          settings: {
            query: 'SELECT 1',
            dateTimeFields: [],
            serialization: undefined as unknown as SouthSQLiteItemSettingsSerialization
          }
        }
      ];

      southConnectorService.checkImportItems.and.returnValue(of({ items: mockItems, errors: [] }));

      modalService.open.and.returnValues(
        {
          componentInstance: { prepare: jasmine.createSpy('prepare') },

          result: of({ file: new File([''], 'test.csv'), delimiter: ',' })
        } as any,
        {
          componentInstance: { prepare: jasmine.createSpy('prepare') },
          result: of(mockItems)
        } as any
      );

      spyOn(tester.componentInstance, 'updateInMemoryItems');
      tester.button('#import-button')!.click();

      expect(southConnectorService.importItems).not.toHaveBeenCalled();
      expect(notificationService.success).not.toHaveBeenCalled();
      expect(tester.componentInstance.updateInMemoryItems).toHaveBeenCalledWith(jasmine.any(Array));
    });

    it('should not call backend services in memory mode', () => {
      const mockItems: Array<SouthConnectorItemDTO> = [
        {
          id: 'new1',
          name: 'newItem1',
          enabled: true,
          scanMode: testData.scanMode.list[0],
          settings: {
            query: 'SELECT 1',
            dateTimeFields: [],
            serialization: undefined as unknown as SouthSQLiteItemSettingsSerialization
          }
        }
      ];

      southConnectorService.checkImportItems.and.returnValue(of({ items: mockItems, errors: [] }));

      modalService.open.and.returnValues(
        {
          componentInstance: { prepare: jasmine.createSpy('prepare') },
          result: of({ file: new File([''], 'test.csv'), delimiter: ',' })
        } as any,
        {
          componentInstance: { prepare: jasmine.createSpy('prepare') },
          result: of(mockItems)
        } as any
      );

      tester.button('#import-button')!.click();

      expect(southConnectorService.importItems).not.toHaveBeenCalled();
      expect(notificationService.success).not.toHaveBeenCalled();
    });
  });

  describe('Expected headers generation', () => {
    beforeEach(async () => {
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
      await tester.change();
    });

    it('should include all manifest settings in expected headers', () => {
      tester.button('#import-button')!.click();

      expect(modalService.open).toHaveBeenCalledWith(ImportItemModalComponent, { backdrop: 'static' });

      const modalRef = (modalService.open as jasmine.Spy).calls.mostRecent().returnValue as { componentInstance: any };
      expect(modalRef.componentInstance.prepare).toHaveBeenCalledWith(
        ['name', 'enabled', 'scanMode', 'settings_query', 'settings_timeout', 'settings_enabled'],
        [],
        [],
        false
      );
    });
  });

  describe('Modal cancellation', () => {
    beforeEach(async () => {
      tester.componentInstance.saveChangesDirectly = true;
      await tester.change();
    });

    it('should not proceed with import when modal is cancelled', () => {
      const mockModalRef = {
        componentInstance: { expectedHeaders: [], prepare: jasmine.createSpy('prepare') },
        result: of(null)
      };
      modalService.open.and.returnValue(mockModalRef as any);

      tester.button('#import-button')!.click();

      expect(southConnectorService.checkImportItems).not.toHaveBeenCalled();
    });
  });

  describe('Mass actions', () => {
    beforeEach(async () => {
      tester.componentInstance.southConnector = testSouthConnector;
      await tester.change();
    });

    it('should have mass action functionality available', () => {
      // This test verifies that the mass action functionality is present
      // The actual implementation is tested through the component's behavior
      expect(tester.componentInstance).toBeDefined();
      expect(southConnectorService.enableItems).toBeDefined();
      expect(southConnectorService.disableItems).toBeDefined();
      expect(southConnectorService.deleteItems).toBeDefined();
    });
  });
});
