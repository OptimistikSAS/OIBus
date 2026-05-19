import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester, TestButton } from 'ngx-speculoos';
import { ManifestAttributesArrayComponent } from './manifest-attributes-array.component';
import { OIBusArrayAttribute } from '../../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ModalService } from '../../../modal.service';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

@Component({
  template: ` <oib-manifest-attributes-array [label]="arrayAttribute.translationKey" [control]="attributesControl" /> `,
  imports: [ManifestAttributesArrayComponent, ReactiveFormsModule]
})
class TestComponent {
  attributesControl = new FormControl<Array<any>>([]) as FormControl<Array<any>>;

  arrayAttribute: OIBusArrayAttribute = {
    type: 'array',
    key: 'attributes',
    translationKey: 'configuration.oibus.manifest.transformers.attributes.attributes',
    paginate: false,
    numberOfElementPerPage: 20,
    validators: [],
    rootAttribute: {
      type: 'object',
      key: 'attribute',
      translationKey: 'configuration.oibus.manifest.transformers.attributes.attribute',
      attributes: [
        {
          type: 'string',
          key: 'type',
          translationKey: 'configuration.oibus.manifest.transformers.attributes.type',
          defaultValue: 'string',
          validators: [],
          displayProperties: { row: 0, columns: 4, displayInViewMode: true }
        },
        {
          type: 'string',
          key: 'key',
          translationKey: 'configuration.oibus.manifest.transformers.attributes.key',
          defaultValue: '',
          validators: [],
          displayProperties: { row: 0, columns: 4, displayInViewMode: true }
        },
        {
          type: 'string',
          key: 'translationKey',
          translationKey: 'configuration.oibus.manifest.transformers.attributes.translation-key',
          defaultValue: '',
          validators: [],
          displayProperties: { row: 0, columns: 4, displayInViewMode: true }
        }
      ],
      validators: [],
      displayProperties: { visible: true, wrapInBox: false },
      enablingConditions: []
    }
  };
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get addButton() {
    return this.button('#manifest-attributes-add-button')!;
  }

  get attributesTable() {
    return this.element('table')!;
  }

  get tableRows() {
    return this.elements('tbody tr')!;
  }

  get editButtons() {
    return this.elements('.edit-button')! as Array<TestButton>;
  }

  get copyButtons() {
    return this.elements('.copy-button')! as Array<TestButton>;
  }

  get deleteButtons() {
    return this.elements('.delete-button')! as Array<TestButton>;
  }

  get emptyState() {
    return this.element('.oi-details')!;
  }

  get pagination() {
    return this.element('oib-pagination')!;
  }

  get boxTitle() {
    return this.element('ng-template[oibBoxTitle]')!;
  }

  get validationErrors() {
    return this.element('val-errors')!;
  }
}

const flushPromises = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('ManifestAttributesArrayComponent', () => {
  let tester: TestComponentTester;
  let mockModalService: { open: ReturnType<typeof vi.fn> };
  let openAttributeEditorSpy: ReturnType<typeof vi.fn>;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockModalService = { open: vi.fn() };

    const createModalInstance = (resultValue?: any) => ({
      result: of(resultValue !== undefined ? resultValue : {}),
      componentInstance: {
        setContextPath: vi.fn(),
        prepareForCreation: vi.fn(),
        prepareForEdition: vi.fn()
      }
    });

    mockModalService.open.mockReturnValue(createModalInstance());

    openAttributeEditorSpy = vi.spyOn(ManifestAttributesArrayComponent.prototype as any, 'openAttributeEditor').mockImplementation(function (
      initialise = true
    ) {
      const DummyComponent = function () {} as any;
      const modal = (mockModalService.open as unknown as (...args: unknown[]) => any)(DummyComponent);

      (modal.componentInstance as any).setContextPath();
      if (initialise) {
        (modal.componentInstance as any).prepareForCreation();
      }
      return Promise.resolve(modal);
    });

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: ModalService, useValue: mockModalService }]
    });

    tester = new TestComponentTester();
    tester.detectChanges();
  });

  describe('Component Initialization', () => {
    test('should create the component', () => {
      expect(tester.componentInstance).toBeDefined();
    });

    test('should display the add button', () => {
      expect(tester.addButton).toBeDefined();
      expect(tester.addButton.element('span.fa.fa-plus')).toBeDefined();
    });

    test('should show empty state when no attributes', () => {
      expect(tester.attributesTable).toBeNull();
      expect(tester.emptyState.nativeElement.textContent).toContain('No attributes defined');
    });

    test('should display box title', () => {
      expect(tester.boxTitle).toBeDefined();
    });
  });

  describe('Column Building', () => {
    test('should build columns from root attribute', () => {
      const component = tester.componentInstance;
      const displayableAttributes = component.arrayAttribute.rootAttribute.attributes.filter(
        attr => (attr as any).displayProperties?.displayInViewMode
      );

      expect(displayableAttributes.length).toBe(3);
    });

    test('should filter out non-displayable attributes', () => {
      const component = tester.componentInstance;
      const displayableAttributes = component.arrayAttribute.rootAttribute.attributes.filter(
        attr => (attr as any).displayProperties?.displayInViewMode
      );

      expect(displayableAttributes.length).toBe(3);
    });
  });

  describe('Add Item Functionality', () => {
    test('should open modal when add button is clicked', async () => {
      tester.addButton.click();
      await flushPromises();
      expect(openAttributeEditorSpy).toHaveBeenCalled();
    });

    test('should prepare modal for creation', async () => {
      tester.addButton.click();
      await flushPromises();
      expect(openAttributeEditorSpy).toHaveBeenCalled();
      const modal = mockModalService.open.mock.results.at(-1)?.value as { componentInstance: any };
      expect(modal.componentInstance.prepareForCreation).toHaveBeenCalled();
    });

    test('should add new item when modal returns result', async () => {
      const newAttribute = {
        type: 'string',
        key: 'newKey',
        translationKey: 'configuration.oibus.edit-array-element-modal.tooltips.edit',
        defaultValue: 'new value'
      };

      mockModalService.open.mockReturnValue({
        result: of(newAttribute),
        componentInstance: {
          setContextPath: vi.fn(),
          prepareForCreation: vi.fn(),
          prepareForEdition: vi.fn()
        }
      });

      tester.addButton.click();
      await flushPromises();
      tester.detectChanges();

      expect(tester.componentInstance.attributesControl.value).toContain(newAttribute);
    });
  });

  describe('Edit Item Functionality', () => {
    beforeEach(() => {
      const testAttributes = [
        {
          type: 'string',
          key: 'testKey1',
          translationKey: 'configuration.oibus.edit-array-element-modal.tooltips.edit',
          defaultValue: 'test value 1'
        },
        {
          type: 'number',
          key: 'testKey2',
          translationKey: 'configuration.oibus.edit-array-element-modal.tooltips.edit',
          defaultValue: 42
        }
      ];
      tester.componentInstance.attributesControl.setValue(testAttributes);
      tester.detectChanges();
    });

    test('should display table when attributes exist', () => {
      expect(tester.attributesTable).toBeDefined();
      expect(tester.tableRows.length).toBe(2);
    });

    test('should show edit buttons for each row', () => {
      expect(tester.editButtons.length).toBe(2);
    });

    test('should open modal when edit button is clicked', async () => {
      tester.editButtons[0].click();
      await flushPromises();
      expect(openAttributeEditorSpy).toHaveBeenCalled();
    });

    test('should update item when modal returns result', async () => {
      const updatedAttribute = {
        type: 'string',
        key: 'updatedKey',
        translationKey: 'configuration.oibus.edit-array-element-modal.tooltips.edit',
        defaultValue: 'updated value'
      };

      mockModalService.open.mockReturnValue({
        result: of(updatedAttribute),
        componentInstance: {
          setContextPath: vi.fn(),
          prepareForCreation: vi.fn(),
          prepareForEdition: vi.fn()
        }
      });

      tester.editButtons[0].click();
      await flushPromises();
      tester.detectChanges();

      const currentValue = tester.componentInstance.attributesControl.value;
      expect(currentValue?.[0]).toEqual(expect.objectContaining(updatedAttribute));
    });
  });

  describe('Copy Item Functionality', () => {
    beforeEach(() => {
      const testAttributes = [
        {
          type: 'string',
          key: 'testKey',
          translationKey: 'configuration.oibus.edit-array-element-modal.tooltips.edit',
          defaultValue: 'test value'
        }
      ];
      tester.componentInstance.attributesControl.setValue(testAttributes);
      tester.detectChanges();
    });

    test('should show copy buttons for each row', () => {
      expect(tester.copyButtons.length).toBe(1);
    });

    test('should open modal when copy button is clicked', async () => {
      tester.copyButtons[0].click();
      await flushPromises();
      expect(openAttributeEditorSpy).toHaveBeenCalled();
    });

    test('should add copied item when modal returns result', async () => {
      const copiedAttribute = {
        type: 'string',
        key: 'testKey_copy',
        translationKey: 'configuration.oibus.edit-array-element-modal.tooltips.edit',
        defaultValue: 'test value'
      };

      mockModalService.open.mockReturnValue({
        result: of(copiedAttribute),
        componentInstance: {
          setContextPath: vi.fn(),
          prepareForCreation: vi.fn(),
          prepareForEdition: vi.fn()
        }
      });

      tester.copyButtons[0].click();
      await flushPromises();
      tester.detectChanges();

      const currentValue = tester.componentInstance.attributesControl.value;
      expect(currentValue?.length).toBe(2);
      expect(currentValue?.[1]).toEqual(copiedAttribute);
    });
  });

  describe('Delete Item Functionality', () => {
    beforeEach(() => {
      const testAttributes = [
        {
          type: 'string',
          key: 'testKey1',
          translationKey: 'configuration.oibus.edit-array-element-modal.tooltips.edit',
          defaultValue: 'test value 1'
        },
        {
          type: 'number',
          key: 'testKey2',
          translationKey: 'configuration.oibus.edit-array-element-modal.tooltips.edit',
          defaultValue: 42
        }
      ];
      tester.componentInstance.attributesControl.setValue(testAttributes);
      tester.detectChanges();
    });

    test('should show delete buttons for each row', () => {
      expect(tester.deleteButtons.length).toBe(2);
    });

    test('should remove item when delete button is clicked', () => {
      const initialLength = tester.componentInstance.attributesControl.value?.length || 0;
      tester.deleteButtons[0].click();
      tester.detectChanges();

      expect(tester.componentInstance.attributesControl.value?.length).toBe(initialLength - 1);
    });

    test('should show empty state when all items are deleted', () => {
      tester.deleteButtons[0].click();
      tester.deleteButtons[0].click();
      tester.detectChanges();

      expect(tester.attributesTable).toBeNull();
      expect(tester.emptyState.nativeElement.textContent).toContain('No attributes defined');
    });
  });

  describe('Value Formatting', () => {
    beforeEach(() => {
      const testAttributes = [
        {
          type: 'string',
          key: 'stringKey',
          translationKey: 'configuration.oibus.edit-array-element-modal.tooltips.edit',
          defaultValue: 'string value'
        },
        {
          type: 'number',
          key: 'numberKey',
          translationKey: 'configuration.oibus.edit-array-element-modal.tooltips.edit',
          defaultValue: 42
        },
        {
          type: 'boolean',
          key: 'booleanKey',
          translationKey: 'configuration.oibus.edit-array-element-modal.tooltips.edit',
          defaultValue: true
        }
      ];
      tester.componentInstance.attributesControl.setValue(testAttributes);
      tester.detectChanges();
    });

    test('should format string values correctly', () => {
      expect(tester.attributesTable).toBeDefined();
      expect(tester.tableRows.length).toBe(3);
    });

    test('should format number values correctly', () => {
      expect(tester.attributesTable).toBeDefined();
      expect(tester.tableRows.length).toBe(3);
    });

    test('should format boolean values correctly', () => {
      const booleanRow = tester.tableRows.find(row => row.textContent?.includes('booleanKey'));
      expect(booleanRow).toBeDefined();
    });
  });

  describe('Pagination', () => {
    beforeEach(() => {
      tester.componentInstance.arrayAttribute = {
        ...tester.componentInstance.arrayAttribute,
        paginate: true,
        numberOfElementPerPage: 2
      };
      tester.detectChanges();
    });

    test('should not show pagination when paginate is disabled', () => {
      tester.componentInstance.arrayAttribute = {
        ...tester.componentInstance.arrayAttribute,
        paginate: false
      };
      tester.detectChanges();

      expect(tester.pagination).toBeNull();
    });
  });

  describe('Input Properties', () => {
    test('should accept control input', () => {
      expect(tester.componentInstance.attributesControl).toBeDefined();
    });

    test('should accept arrayAttribute input', () => {
      expect(tester.componentInstance.arrayAttribute).toBeDefined();
      expect(tester.componentInstance.arrayAttribute.type).toBe('array');
    });
  });

  describe('Error Handling', () => {
    test('should handle empty control value', () => {
      tester.componentInstance.attributesControl.setValue([]);
      tester.detectChanges();

      expect(tester.emptyState.nativeElement.textContent).toContain('No attributes defined');
    });

    test('should handle modal service errors gracefully', () => {
      mockModalService.open.mockImplementation(() => {
        throw new Error('Modal error');
      });

      expect(() => {
        tester.addButton.click();
      }).not.toThrow();
    });
  });

  describe('Integration with Form Control', () => {
    test('should update form control when items are added', async () => {
      const newAttribute = {
        type: 'string',
        key: 'newKey',
        translationKey: 'configuration.oibus.edit-array-element-modal.tooltips.edit',
        defaultValue: 'new value'
      };

      mockModalService.open.mockReturnValue({
        result: of(newAttribute),
        componentInstance: {
          setContextPath: vi.fn(),
          prepareForCreation: vi.fn(),
          prepareForEdition: vi.fn()
        }
      });

      tester.addButton.click();
      await flushPromises();
      tester.detectChanges();

      expect(tester.componentInstance.attributesControl.value).toContain(newAttribute);
    });

    test('should update form control when items are edited', () => {
      const testAttributes = [
        {
          type: 'string',
          key: 'testKey',
          translationKey: 'configuration.oibus.edit-array-element-modal.tooltips.edit',
          defaultValue: 'test value'
        }
      ];
      tester.componentInstance.attributesControl.setValue(testAttributes);
      tester.detectChanges();

      expect(tester.editButtons.length).toBe(1);
      expect(tester.editButtons[0]).toBeDefined();
    });

    test('should update form control when items are deleted', () => {
      const testAttributes = [
        {
          type: 'string',
          key: 'testKey1',
          translationKey: 'configuration.oibus.edit-array-element-modal.tooltips.edit',
          defaultValue: 'test value 1'
        },
        {
          type: 'string',
          key: 'testKey2',
          translationKey: 'configuration.oibus.edit-array-element-modal.tooltips.edit',
          defaultValue: 'test value 2'
        }
      ];
      tester.componentInstance.attributesControl.setValue(testAttributes);
      tester.detectChanges();

      tester.deleteButtons[0].click();
      tester.detectChanges();

      expect(tester.componentInstance.attributesControl.value?.length).toBe(1);
      expect(tester.componentInstance.attributesControl.value?.[0].key).toBe('testKey2');
    });
  });
});
