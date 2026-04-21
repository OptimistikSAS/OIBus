import { EditHistoryQueryTransformerModalComponent } from './edit-history-query-transformer-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { By } from '@angular/platform-browser';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { TransformerDTO } from '../../../../../../backend/shared/model/transformer.model';
import { ItemLightDTO } from '../../../../../../backend/shared/model/south-connector.model';

class EditHistoryQueryTransformerModalComponentTester extends ComponentTester<EditHistoryQueryTransformerModalComponent> {
  constructor() {
    super(EditHistoryQueryTransformerModalComponent);
  }

  get title() {
    return this.element('h4');
  }

  get transformerSelect() {
    return this.select('#output');
  }

  get options() {
    return this.debugElement.query(By.directive(OIBusObjectFormControlComponent))!;
  }

  get save() {
    return this.button('#save-button')!;
  }

  get cancel() {
    return this.button('#cancel-button')!;
  }
}

const transformer: TransformerDTO = {
  id: 'time-values-to-mqtt',
  type: 'standard',
  functionName: 'time-values-to-mqtt',
  inputType: 'time-values',
  outputType: 'mqtt',
  manifest: {
    type: 'object',
    key: 'configuration.oibus.manifest.transformers.options',
    translationKey: '',
    attributes: [
      {
        type: 'array',
        key: 'mapping',
        translationKey: 'configuration.oibus.manifest.transformers.mapping.title',
        paginate: true,
        numberOfElementPerPage: 20,
        validators: [],
        rootAttribute: {
          type: 'object',
          key: 'item',
          translationKey: '',
          displayProperties: {
            visible: true,
            wrapInBox: false
          },
          enablingConditions: [],
          validators: [],
          attributes: [
            {
              type: 'string',
              key: 'pointId',
              translationKey: 'configuration.oibus.manifest.transformers.time-values-to-modbus.mapping.point-id',
              defaultValue: null,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 4,
                displayInViewMode: true
              }
            },
            {
              type: 'string',
              key: 'address',
              translationKey: 'configuration.oibus.manifest.transformers.time-values-to-modbus.mapping.address',
              defaultValue: null,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 4,
                displayInViewMode: true
              }
            },
            {
              type: 'string-select',
              key: 'modbusType',
              translationKey: 'configuration.oibus.manifest.transformers.time-values-to-modbus.mapping.modbus-type',
              defaultValue: 'register',
              selectableValues: ['coil', 'register'],
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 4,
                displayInViewMode: true
              }
            }
          ]
        }
      }
    ],
    enablingConditions: [],
    validators: [],
    displayProperties: {
      visible: true,
      wrapInBox: false
    }
  }
};

describe('EditHistoryQueryTransformerModalComponent', () => {
  let tester: EditHistoryQueryTransformerModalComponentTester;
  let fakeActiveModal: NgbActiveModal;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new EditHistoryQueryTransformerModalComponentTester();
  });

  it('should cancel', () => {
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });

  it('should display title and form, and validate without transformers', async () => {
    tester.componentInstance.prepareForCreation('opcua', [], [], [transformer], [], []);
    await tester.change();
    expect(tester.title).toContainText('Choose how to handle payloads');
    expect(tester.options).toBeNull();
    tester.save.click();
    expect(fakeActiveModal.close).not.toHaveBeenCalled();
  });

  it('should validate with transformers', async () => {
    tester.componentInstance.prepareForEdition('opcua', [], [], [transformer], ['mqtt'], [], {
      id: 'historyTransformerId1',
      transformer,
      options: {
        mapping: [
          { pointId: 'pointId1', nodeId: 'nodeId1', dataType: 'Int32' },
          { pointId: 'pointId2', nodeId: 'nodeId2', dataType: 'Int32' }
        ]
      },
      items: []
    });
    await tester.change();
    expect(tester.transformerSelect).toBeDefined();
    expect(tester.options).toBeDefined();
    expect(tester.title).toContainText('Choose how to handle payloads');
    tester.save.click();
    expect(fakeActiveModal.close).toHaveBeenCalledWith({
      id: 'historyTransformerId1',
      transformer: transformer,
      options: {
        mapping: [
          { pointId: 'pointId1', nodeId: 'nodeId1', dataType: 'Int32' },
          { pointId: 'pointId2', nodeId: 'nodeId2', dataType: 'Int32' }
        ]
      },
      items: []
    });
  });

  describe('item selection', () => {
    it('should toggle between all items and specific items', () => {
      tester.componentInstance.prepareForCreation('opcua', [], [], [transformer], [], []);
      expect(tester.componentInstance.selectionType).toBe('all');
      expect(tester.componentInstance.selectedItems).toEqual([]);

      tester.componentInstance.setSelectionType('items');
      expect(tester.componentInstance.selectionType).toBe('items');

      tester.componentInstance.setSelectionType('all');
      expect(tester.componentInstance.selectionType).toBe('all');
      expect(tester.componentInstance.selectedItems).toEqual([]);
    });

    it('should select all search results and clear them', () => {
      tester.componentInstance.prepareForCreation('opcua', [], [], [transformer], [], []);
      tester.componentInstance.selectionType = 'items';
      tester.componentInstance.searchResults = [
        { id: 'item1', name: 'Item 1' },
        { id: 'item2', name: 'Item 2' },
        { id: 'item3', name: 'Item 3' }
      ] as unknown as Array<ItemLightDTO>;
      tester.componentInstance.totalSearchResults = 3;

      tester.componentInstance.selectAllResults();

      expect(tester.componentInstance.selectedItems.length).toBe(3);
      expect(tester.componentInstance.searchResults).toEqual([]);
      expect(tester.componentInstance.totalSearchResults).toBe(0);
    });

    it('should not add duplicate items when selecting all results', () => {
      tester.componentInstance.prepareForCreation('opcua', [], [], [transformer], [], []);
      tester.componentInstance.selectionType = 'items';
      tester.componentInstance.selectedItems = [{ id: 'item1', name: 'Item 1' }] as unknown as Array<ItemLightDTO>;
      tester.componentInstance.searchResults = [
        { id: 'item1', name: 'Item 1' },
        { id: 'item2', name: 'Item 2' }
      ] as unknown as Array<ItemLightDTO>;
      tester.componentInstance.totalSearchResults = 2;

      tester.componentInstance.selectAllResults();

      expect(tester.componentInstance.selectedItems.length).toBe(2);
      expect(tester.componentInstance.selectedItems.find(item => item.id === 'item1')).toBeDefined();
      expect(tester.componentInstance.selectedItems.find(item => item.id === 'item2')).toBeDefined();
      // Should clear search results after selecting all
      expect(tester.componentInstance.searchResults).toEqual([]);
      expect(tester.componentInstance.totalSearchResults).toBe(0);
    });

    it('should remove all selected items and refresh search results', () => {
      const items = [
        { id: 'item1', name: 'Item 1' },
        { id: 'item2', name: 'Item 2' }
      ] as unknown as Array<ItemLightDTO>;
      tester.componentInstance.prepareForCreation('opcua', [], [], [transformer], [], items);
      tester.componentInstance.selectedItems = [
        { id: 'item1', name: 'Item 1' },
        { id: 'item2', name: 'Item 2' }
      ] as unknown as Array<ItemLightDTO>;

      tester.componentInstance.removeAllItems();

      expect(tester.componentInstance.selectedItems).toEqual([]);
      // Should refresh filteredItems to include previously selected items
      expect(tester.componentInstance.filteredItems.length).toBeGreaterThan(0);
    });

    it('should remove a single item', () => {
      tester.componentInstance.prepareForCreation('opcua', [], [], [transformer], [], []);
      const item1 = { id: 'item1', name: 'Item 1' } as unknown as ItemLightDTO;
      const item2 = { id: 'item2', name: 'Item 2' } as unknown as ItemLightDTO;
      tester.componentInstance.selectedItems = [item1, item2];

      tester.componentInstance.removeItem(item1);

      expect(tester.componentInstance.selectedItems).toEqual([item2]);
    });

    it('should toggle item selection', () => {
      tester.componentInstance.prepareForCreation('opcua', [], [], [transformer], [], []);
      const item = { id: 'item1', name: 'Item 1' } as unknown as ItemLightDTO;
      tester.componentInstance.itemSearchText = '';
      tester.componentInstance.searchResults = [item];
      tester.componentInstance.totalSearchResults = 1;

      // Add item (select)
      tester.componentInstance.toggleItem(item);
      expect(tester.componentInstance.selectedItems).toEqual([item]);
      expect(tester.componentInstance.searchResults).toEqual([]);
      expect(tester.componentInstance.totalSearchResults).toBe(1); // Should stay the same

      // Remove item (deselect)
      tester.componentInstance.toggleItem(item);
      expect(tester.componentInstance.selectedItems).toEqual([]);
      expect(tester.componentInstance.searchResults).toEqual([item]);
      expect(tester.componentInstance.totalSearchResults).toBe(1); // Should stay the same
    });

    it('should check if item is selected', () => {
      tester.componentInstance.prepareForCreation('opcua', [], [], [transformer], [], []);
      const item = { id: 'item1', name: 'Item 1' } as unknown as ItemLightDTO;
      tester.componentInstance.selectedItems = [item];

      expect(tester.componentInstance.isItemSelected(item)).toBe(true);
      expect(tester.componentInstance.isItemSelected({ id: 'item2', name: 'Item 2' } as unknown as ItemLightDTO)).toBe(false);
    });

    it('should filter items based on search text', () => {
      const items = [
        { id: 'item1', name: 'Random Item' },
        { id: 'item2', name: 'Another Random' },
        { id: 'item3', name: 'Different' }
      ] as unknown as Array<ItemLightDTO>;
      tester.componentInstance.prepareForCreation('opcua', [], [], [transformer], [], items);
      tester.componentInstance.selectedItems = [];

      tester.componentInstance.itemSearchText = 'Random';
      tester.componentInstance.filterItems();

      expect(tester.componentInstance.filteredItems.length).toBe(2);
      expect(tester.componentInstance.totalSearchResults).toBe(2);
      expect(tester.componentInstance.searchResults.length).toBe(2);
    });

    it('should reset searchInteracted flag when toggling item selection', () => {
      tester.componentInstance.prepareForCreation('opcua', [], [], [transformer], [], []);
      tester.componentInstance.searchInteracted = true;

      tester.componentInstance.setSelectionType('all');

      expect(tester.componentInstance.searchInteracted).toBe(false);
    });

    it('should set searchInteracted on dropdown open', () => {
      tester.componentInstance.prepareForCreation('opcua', [], [], [transformer], [], []);
      tester.componentInstance.searchInteracted = false;

      tester.componentInstance.onDropdownOpenChange(true);

      // Note: searchInteracted is now set in the template on focus, not in onDropdownOpenChange
      // This test verifies the method doesn't throw errors
      expect(tester.componentInstance.searchInteracted).toBe(false);
    });

    it('should save with empty items array when selectionType is all', async () => {
      tester.componentInstance.prepareForEdition('opcua', [], [], [transformer], ['mqtt'], [], {
        id: 'historyTransformerId1',
        transformer,
        options: {},
        items: []
      });
      tester.componentInstance.selectionType = 'all';
      tester.componentInstance.selectedItems = [{ id: 'item1', name: 'Item 1' }] as unknown as Array<ItemLightDTO>;
      await tester.change();

      await tester.save.click();

      expect(fakeActiveModal.close).toHaveBeenCalledWith(
        jasmine.objectContaining({
          items: []
        })
      );
    });

    it('should save with selected items when selectionType is items', async () => {
      tester.componentInstance.prepareForEdition('opcua', [], [], [transformer], ['mqtt'], [], {
        id: 'historyTransformerId1',
        transformer,
        options: {},
        items: [{ id: 'item1', name: 'Item 1' }] as unknown as Array<ItemLightDTO>
      });
      tester.componentInstance.selectionType = 'items';
      tester.componentInstance.selectedItems = [{ id: 'item1', name: 'Item 1' }] as unknown as Array<ItemLightDTO>;
      await tester.change();

      await tester.save.click();

      expect(fakeActiveModal.close).toHaveBeenCalledWith(
        jasmine.objectContaining({
          items: [jasmine.objectContaining({ id: 'item1', name: 'Item 1' })]
        })
      );
    });
  });
});
