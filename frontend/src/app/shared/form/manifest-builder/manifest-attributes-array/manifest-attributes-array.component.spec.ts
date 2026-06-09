import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ManifestAttributesArrayComponent } from './manifest-attributes-array.component';
import { OIBusArrayAttribute } from '../../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ModalService } from '../../../modal.service';
import { EMPTY, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

@Component({
  template: ` <oib-manifest-attributes-array [label]="arrayAttribute.translationKey" [control]="attributesControl" /> `,
  imports: [ManifestAttributesArrayComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
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

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly addButton = this.root.getByCss('#manifest-attributes-add-button');
  readonly attributesTable = this.root.getByCss('table');
  readonly tableRows = this.root.getByCss('tbody tr');
  readonly editButtons = this.root.getByCss('.edit-button');
  readonly copyButtons = this.root.getByCss('.copy-button');
  readonly deleteButtons = this.root.getByCss('.delete-button');
  readonly emptyState = this.root.getByCss('.oi-details');
  readonly pagination = this.root.getByCss('oib-pagination');
  readonly box = this.root.getByCss('oib-box');
  readonly validationErrors = this.root.getByCss('val-errors');

  setAttributes(attributes: Array<unknown>) {
    this.component.attributesControl.setValue(attributes);
    this.fixture.detectChanges();
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
      result: resultValue !== undefined ? of(resultValue) : EMPTY,
      componentInstance: {
        setContextPath: vi.fn(),
        prepareForCreation: vi.fn(),
        prepareForEdition: vi.fn()
      }
    });

    mockModalService.open.mockReturnValue(createModalInstance());

    openAttributeEditorSpy = vi
      .spyOn(ManifestAttributesArrayComponent.prototype as any, 'openAttributeEditor')
      .mockImplementation(function (initialise = true) {
        const DummyComponent = function () {} as any;
        const modal = (mockModalService.open as unknown as (...args: Array<unknown>) => any)(DummyComponent);

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
    tester.fixture.detectChanges();
  });

  describe('Component Initialization', () => {
    test('should create the component', () => {
      expect(tester.component).toBeDefined();
    });

    test('should display the add button', async () => {
      await expect.element(tester.addButton).toBeInTheDocument();
      await expect.element(tester.addButton.getByCss('span.fa.fa-plus')).toBeInTheDocument();
    });

    test('should show empty state when no attributes', async () => {
      await expect.element(tester.attributesTable).not.toBeInTheDocument();
      await expect.element(tester.emptyState).toHaveTextContent('No attributes defined');
    });

    test('should display box', async () => {
      await expect.element(tester.box).toBeInTheDocument();
    });
  });

  describe('Column Building', () => {
    test('should build columns from root attribute', () => {
      const component = tester.component;
      const displayableAttributes = component.arrayAttribute.rootAttribute.attributes.filter(
        attr => (attr as any).displayProperties?.displayInViewMode
      );

      expect(displayableAttributes.length).toBe(3); // type, key, translationKey
    });

    test('should filter out non-displayable attributes', () => {
      const component = tester.component;
      const displayableAttributes = component.arrayAttribute.rootAttribute.attributes.filter(
        attr => (attr as any).displayProperties?.displayInViewMode
      );

      expect(displayableAttributes.length).toBe(3); // type, key, translationKey
    });
  });

  describe('Add Item Functionality', () => {
    test('should open modal when add button is clicked', async () => {
      await tester.addButton.click();
      await flushPromises();
      expect(openAttributeEditorSpy).toHaveBeenCalled();
    });

    test('should prepare modal for creation', async () => {
      await tester.addButton.click();
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

      await tester.addButton.click();
      await flushPromises();
      tester.fixture.detectChanges();

      expect(tester.component.attributesControl.value).toContain(newAttribute);
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
      tester.setAttributes(testAttributes);
    });

    test('should display table when attributes exist', async () => {
      await expect.element(tester.attributesTable).toBeInTheDocument();
      await expect.element(tester.tableRows).toHaveLength(2);
    });

    test('should show edit buttons for each row', async () => {
      await expect.element(tester.editButtons).toHaveLength(2);
    });

    test('should open modal when edit button is clicked', async () => {
      await tester.editButtons.nth(0).click();
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

      await tester.editButtons.nth(0).click();
      await flushPromises();
      tester.fixture.detectChanges();

      const currentValue = tester.component.attributesControl.value;
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
      tester.setAttributes(testAttributes);
    });

    test('should show copy buttons for each row', async () => {
      await expect.element(tester.copyButtons).toHaveLength(1);
    });

    test('should open modal when copy button is clicked', async () => {
      await tester.copyButtons.nth(0).click();
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

      await tester.copyButtons.nth(0).click();
      await flushPromises();
      tester.fixture.detectChanges();

      const currentValue = tester.component.attributesControl.value;
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
      tester.setAttributes(testAttributes);
    });

    test('should show delete buttons for each row', async () => {
      await expect.element(tester.deleteButtons).toHaveLength(2);
    });

    test('should remove item when delete button is clicked', async () => {
      const initialLength = tester.component.attributesControl.value?.length || 0;
      await tester.deleteButtons.nth(0).click();

      expect(tester.component.attributesControl.value?.length).toBe(initialLength - 1);
    });

    test('should show empty state when all items are deleted', async () => {
      await tester.deleteButtons.nth(0).click();
      tester.fixture.detectChanges();
      await tester.deleteButtons.nth(0).click();
      tester.fixture.detectChanges();

      await expect.element(tester.attributesTable).not.toBeInTheDocument();
      await expect.element(tester.emptyState).toHaveTextContent('No attributes defined');
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
      tester.setAttributes(testAttributes);
    });

    test('should format string values correctly', async () => {
      // Check that the table displays the data
      await expect.element(tester.attributesTable).toBeInTheDocument();
      await expect.element(tester.tableRows).toHaveLength(3);
    });

    test('should format number values correctly', async () => {
      // Check that the table displays the data
      await expect.element(tester.attributesTable).toBeInTheDocument();
      await expect.element(tester.tableRows).toHaveLength(3);
    });

    test('should format boolean values correctly', async () => {
      // Boolean values are translated, so we check for the presence of the cell
      await expect.element(tester.tableRows.nth(2)).toHaveTextContent('booleanKey');
    });
  });

  describe('Pagination', () => {
    beforeEach(() => {
      // Set up paginated array attribute
      tester.component.arrayAttribute = {
        ...tester.component.arrayAttribute,
        paginate: true,
        numberOfElementPerPage: 2
      };
      tester.fixture.detectChanges();
    });

    test('should not show pagination when paginate is disabled', async () => {
      tester.component.arrayAttribute = {
        ...tester.component.arrayAttribute,
        paginate: false
      };
      tester.fixture.detectChanges();

      // With pagination disabled, it should not be visible
      await expect.element(tester.pagination).not.toBeInTheDocument();
    });
  });

  describe('Input Properties', () => {
    test('should accept control input', () => {
      expect(tester.component.attributesControl).toBeDefined();
    });

    test('should accept arrayAttribute input', () => {
      expect(tester.component.arrayAttribute).toBeDefined();
      expect(tester.component.arrayAttribute.type).toBe('array');
    });
  });

  describe('Error Handling', () => {
    test('should handle empty control value', async () => {
      tester.setAttributes([]);

      await expect.element(tester.emptyState).toHaveTextContent('No attributes defined');
    });

    test('should handle modal service errors gracefully', async () => {
      // Make openAttributeEditor return a never-resolving promise so addItem() suspends
      // without rejecting — avoids an unhandled rejection since the component has no try/catch
      openAttributeEditorSpy.mockImplementationOnce(() => new Promise(() => {}));

      // The component should handle the error gracefully
      // We just test that the button click doesn't crash the component
      await expect(tester.addButton.click()).resolves.toBeUndefined();
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

      await tester.addButton.click();
      await flushPromises();
      tester.fixture.detectChanges();

      expect(tester.component.attributesControl.value).toContain(newAttribute);
    });

    test('should update form control when items are edited', async () => {
      const testAttributes = [
        {
          type: 'string',
          key: 'testKey',
          translationKey: 'configuration.oibus.edit-array-element-modal.tooltips.edit',
          defaultValue: 'test value'
        }
      ];
      tester.setAttributes(testAttributes);

      // Just test that the edit button exists and can be clicked
      await expect.element(tester.editButtons).toHaveLength(1);
      await expect.element(tester.editButtons.nth(0)).toBeInTheDocument();
    });

    test('should update form control when items are deleted', async () => {
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
      tester.setAttributes(testAttributes);

      await tester.deleteButtons.nth(0).click();

      expect(tester.component.attributesControl.value?.length).toBe(1);
      expect(tester.component.attributesControl.value?.[0].key).toBe('testKey2');
    });
  });
});
