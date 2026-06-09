import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ManifestAttributeEditorModalComponent } from './manifest-attribute-editor-modal.component';
import { OIBusAttribute } from '../../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

@Component({
  template: ` <oib-manifest-attribute-editor-modal /> `,
  imports: [ManifestAttributeEditorModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {}

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.getByCss(`#${this.fixture.nativeElement.id}`);
  readonly typeSelect = this.root.getByCss('select[formControlName="type"]');
  readonly keyInput = this.root.getByCss('input[formControlName="key"]');
  readonly translationKeyInput = this.root.getByCss('input[formControlName="translationKey"]');
  readonly rowInput = this.root.getByCss('input[formControlName="row"]');
  readonly columnsInput = this.root.getByCss('input[formControlName="columns"]');
  readonly displayInViewModeCheckbox = this.root.getByCss('#display-in-view-mode');
  readonly defaultValueStringInput = this.root.getByCss('input[formControlName="defaultValue_string"]');
  readonly defaultValueNumberInput = this.root.getByCss('input[formControlName="defaultValue_number"]');
  readonly defaultValueBooleanCheckbox = this.root.getByCss('#default-value-boolean');
  readonly defaultValueCodeTextarea = this.root.getByCss('textarea[formControlName="defaultValue_code"]');
  readonly defaultValueTimezoneInput = this.root.getByCss('input[formControlName="defaultValue_timezone"]');
  readonly unitInput = this.root.getByCss('input[formControlName="unit"]');
  readonly contentTypeSelect = this.root.getByCss('select[formControlName="contentType"]');
  readonly selectableValuesInput = this.root.getByCss('input[formControlName="selectableValuesCsv"]');
  readonly acceptableTypeSelect = this.root.getByCss('select[formControlName="acceptableType"]');
  readonly objectVisibleCheckbox = this.root.getByCss('#object-visible');
  readonly objectWrapInBoxCheckbox = this.root.getByCss('#object-wrap-in-box');
  readonly arrayPaginateCheckbox = this.root.getByCss('#array-paginate');
  readonly numberOfElementsInput = this.root.getByCss('input[formControlName="numberOfElementPerPage"]');
  readonly cancelButton = this.root.getByCss('#cancel-button');
  readonly form = this.root.getByCss('form');

  get modal(): ManifestAttributeEditorModalComponent {
    return this.fixture.debugElement.query(By.directive(ManifestAttributeEditorModalComponent)).componentInstance;
  }
}

describe('ManifestAttributeEditorModalComponent', () => {
  let tester: TestComponentTester;
  let mockActiveModal: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: mockActiveModal }]
    });

    tester = new TestComponentTester();
    tester.fixture.detectChanges();
  });

  describe('Component Initialization', () => {
    test('should create the component', () => {
      expect(tester.component).toBeDefined();
    });

    test('should initialize with default values', async () => {
      await expect.element(tester.typeSelect).toBeInTheDocument();
      await expect.element(tester.typeSelect).toHaveValue('string');
      await expect.element(tester.keyInput).toHaveValue('');
      await expect.element(tester.translationKeyInput).toHaveValue('');
      await expect.element(tester.rowInput).toHaveValue(0);
      await expect.element(tester.columnsInput).toHaveValue(4);
      await expect.element(tester.displayInViewModeCheckbox).toBeChecked();
    });

    test('should display all available attribute types', async () => {
      await expect.element(tester.typeSelect).toBeInTheDocument();
      expect(tester.typeSelect.getByCss('option').elements().length).toBeGreaterThan(0);
    });
  });

  describe('Modal Preparation', () => {
    test('should prepare for creation mode', async () => {
      expect(tester.modal).toBeDefined();
      tester.modal!.prepareForCreation();

      expect(tester.modal?.mode).toBe('create');
      expect(tester.modal?.attribute).toBeNull();
      await expect.element(tester.typeSelect).toBeInTheDocument();
      await expect.element(tester.typeSelect).toHaveValue('string');
      await expect.element(tester.keyInput).toHaveValue('');
    });

    test('should prepare for edit mode', async () => {
      const testAttribute: OIBusAttribute = {
        type: 'string',
        key: 'testKey',
        translationKey: 'test.translation.key',
        defaultValue: 'test value',
        validators: [],
        displayProperties: {
          row: 1,
          columns: 6,
          displayInViewMode: false
        }
      };

      tester.modal!.prepareForEdition(testAttribute);

      expect(tester.modal?.mode).toBe('edit');
      expect(tester.modal?.attribute).toEqual(testAttribute);
      await expect.element(tester.typeSelect).toBeInTheDocument();
      await expect.element(tester.typeSelect).toHaveValue('string');
      await expect.element(tester.keyInput).toHaveValue('testKey');
      await expect.element(tester.translationKeyInput).toHaveValue('test.translation.key');
      await expect.element(tester.defaultValueStringInput).toHaveValue('test value');
      await expect.element(tester.rowInput).toHaveValue(1);
      await expect.element(tester.columnsInput).toHaveValue(6);
      await expect.element(tester.displayInViewModeCheckbox).not.toBeChecked();
    });
  });

  describe('Type-specific Form Sections', () => {
    beforeEach(() => {
      tester.modal!.prepareForCreation();
    });

    test('should show string-specific fields for string type', async () => {
      await tester.typeSelect.selectOptions('string');

      await expect.element(tester.defaultValueStringInput).toBeInTheDocument();
      await expect.element(tester.rowInput).toBeInTheDocument();
      await expect.element(tester.columnsInput).toBeInTheDocument();
      await expect.element(tester.displayInViewModeCheckbox).toBeInTheDocument();
      await expect.element(tester.defaultValueNumberInput).not.toBeInTheDocument();
      await expect.element(tester.unitInput).not.toBeInTheDocument();
      await expect.element(tester.defaultValueBooleanCheckbox).not.toBeInTheDocument();
    });

    test('should show number-specific fields for number type', async () => {
      await tester.typeSelect.selectOptions('number');
      tester.fixture.detectChanges();

      await expect.element(tester.defaultValueNumberInput).toBeInTheDocument();
      await expect.element(tester.unitInput).toBeInTheDocument();
      await expect.element(tester.rowInput).toBeInTheDocument();
      await expect.element(tester.columnsInput).toBeInTheDocument();
      await expect.element(tester.displayInViewModeCheckbox).toBeInTheDocument();
      await expect.element(tester.defaultValueStringInput).not.toBeInTheDocument();
      await expect.element(tester.defaultValueBooleanCheckbox).not.toBeInTheDocument();
    });

    test('should show boolean-specific fields for boolean type', async () => {
      await tester.typeSelect.selectOptions('boolean');
      tester.fixture.detectChanges();

      await expect.element(tester.defaultValueBooleanCheckbox).toBeInTheDocument();
      await expect.element(tester.rowInput).toBeInTheDocument();
      await expect.element(tester.columnsInput).toBeInTheDocument();
      await expect.element(tester.displayInViewModeCheckbox).toBeInTheDocument();
      await expect.element(tester.defaultValueStringInput).not.toBeInTheDocument();
      await expect.element(tester.defaultValueNumberInput).not.toBeInTheDocument();
      await expect.element(tester.unitInput).not.toBeInTheDocument();
    });

    test('should show code-specific fields for code type', async () => {
      await tester.typeSelect.selectOptions('code');
      tester.fixture.detectChanges();

      await expect.element(tester.contentTypeSelect).toBeInTheDocument();
      await expect.element(tester.defaultValueCodeTextarea).toBeInTheDocument();
      await expect.element(tester.rowInput).toBeInTheDocument();
      await expect.element(tester.columnsInput).toBeInTheDocument();
      await expect.element(tester.displayInViewModeCheckbox).toBeInTheDocument();
      await expect.element(tester.defaultValueStringInput).not.toBeInTheDocument();
      await expect.element(tester.defaultValueNumberInput).not.toBeInTheDocument();
      await expect.element(tester.unitInput).not.toBeInTheDocument();
    });

    test('should show string-select-specific fields for string-select type', async () => {
      await tester.typeSelect.selectOptions('string-select');
      tester.fixture.detectChanges();

      await expect.element(tester.selectableValuesInput).toBeInTheDocument();
      await expect.element(tester.defaultValueStringInput).toBeInTheDocument();
      await expect.element(tester.rowInput).toBeInTheDocument();
      await expect.element(tester.columnsInput).toBeInTheDocument();
      await expect.element(tester.displayInViewModeCheckbox).toBeInTheDocument();
      await expect.element(tester.defaultValueNumberInput).not.toBeInTheDocument();
      await expect.element(tester.unitInput).not.toBeInTheDocument();
    });

    test('should show timezone-specific fields for timezone type', async () => {
      await tester.typeSelect.selectOptions('timezone');
      tester.fixture.detectChanges();

      await expect.element(tester.defaultValueTimezoneInput).toBeInTheDocument();
      await expect.element(tester.rowInput).toBeInTheDocument();
      await expect.element(tester.columnsInput).toBeInTheDocument();
      await expect.element(tester.displayInViewModeCheckbox).toBeInTheDocument();
      await expect.element(tester.defaultValueStringInput).not.toBeInTheDocument();
      await expect.element(tester.defaultValueNumberInput).not.toBeInTheDocument();
      await expect.element(tester.unitInput).not.toBeInTheDocument();
    });

    test('should show scan-mode-specific fields for scan-mode type', async () => {
      await tester.typeSelect.selectOptions('scan-mode');
      tester.fixture.detectChanges();

      await expect.element(tester.acceptableTypeSelect).toBeInTheDocument();
      await expect.element(tester.rowInput).toBeInTheDocument();
      await expect.element(tester.columnsInput).toBeInTheDocument();
      await expect.element(tester.displayInViewModeCheckbox).toBeInTheDocument();
      await expect.element(tester.defaultValueStringInput).not.toBeInTheDocument();
      await expect.element(tester.defaultValueNumberInput).not.toBeInTheDocument();
      await expect.element(tester.unitInput).not.toBeInTheDocument();
    });

    test('should show object-specific fields for object type', async () => {
      await tester.typeSelect.selectOptions('object');
      tester.fixture.detectChanges();

      await expect.element(tester.objectVisibleCheckbox).toBeInTheDocument();
      await expect.element(tester.objectWrapInBoxCheckbox).toBeInTheDocument();
      await expect.element(tester.rowInput).not.toBeInTheDocument();
      await expect.element(tester.columnsInput).not.toBeInTheDocument();
      await expect.element(tester.displayInViewModeCheckbox).not.toBeInTheDocument();
      await expect.element(tester.defaultValueStringInput).not.toBeInTheDocument();
      await expect.element(tester.defaultValueNumberInput).not.toBeInTheDocument();
      await expect.element(tester.unitInput).not.toBeInTheDocument();
    });

    test('should show array-specific fields for array type', async () => {
      await tester.typeSelect.selectOptions('array');
      tester.fixture.detectChanges();

      await expect.element(tester.arrayPaginateCheckbox).toBeInTheDocument();
      await expect.element(tester.numberOfElementsInput).toBeInTheDocument();
      await expect.element(tester.rowInput).not.toBeInTheDocument();
      await expect.element(tester.columnsInput).not.toBeInTheDocument();
      await expect.element(tester.displayInViewModeCheckbox).not.toBeInTheDocument();
      await expect.element(tester.defaultValueStringInput).not.toBeInTheDocument();
      await expect.element(tester.defaultValueNumberInput).not.toBeInTheDocument();
      await expect.element(tester.unitInput).not.toBeInTheDocument();
    });
  });

  describe('Type Change Handling', () => {
    beforeEach(() => {
      tester.modal!.prepareForCreation();
    });

    test('should reset type-specific fields when changing type', async () => {
      await tester.typeSelect.selectOptions('number');
      tester.fixture.detectChanges();
      await tester.defaultValueNumberInput.fill('42');
      await tester.unitInput.fill('ms');

      await tester.typeSelect.selectOptions('string');
      tester.fixture.detectChanges();

      await expect.element(tester.defaultValueStringInput).toHaveValue('');
      await expect.element(tester.defaultValueNumberInput).not.toBeInTheDocument();
      await expect.element(tester.unitInput).not.toBeInTheDocument();
      await expect.element(tester.defaultValueStringInput).toBeInTheDocument();
    });

    test('should maintain common fields when changing type', async () => {
      await tester.keyInput.fill('testKey');
      await tester.translationKeyInput.fill('test.translation.key');
      await tester.rowInput.fill('2');
      await tester.columnsInput.fill('8');

      await tester.typeSelect.selectOptions('boolean');

      await expect.element(tester.keyInput).toHaveValue('testKey');
      await expect.element(tester.translationKeyInput).toHaveValue('test.translation.key');
      await expect.element(tester.rowInput).toHaveValue(2);
      await expect.element(tester.columnsInput).toHaveValue(8);
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      tester.modal!.prepareForCreation();
    });

    test('should validate required fields', async () => {
      await tester.keyInput.fill('');
      await tester.translationKeyInput.fill('');

      await expect.element(tester.form).toHaveClass('ng-invalid');
    });

    test('should be valid with required fields filled', async () => {
      await tester.keyInput.fill('testKey');
      await tester.translationKeyInput.fill('test.translation.key');
      tester.fixture.detectChanges();

      await expect.element(tester.form).toHaveClass('ng-valid');
    });

    test('should validate column range', async () => {
      await tester.columnsInput.fill('0');

      await expect.element(tester.form).toHaveClass('ng-invalid');
    });

    test('should validate row minimum value', async () => {
      await tester.rowInput.fill('-1');

      await expect.element(tester.form).toHaveClass('ng-invalid');
    });
  });

  describe('Modal Actions', () => {
    beforeEach(() => {
      tester.modal!.prepareForCreation();
    });

    test('should dismiss modal when cancel button is clicked', async () => {
      await tester.cancelButton.click();

      expect(mockActiveModal.dismiss).toHaveBeenCalled();
    });

    test('should close modal with attribute when form is valid and submitted', async () => {
      await tester.keyInput.fill('testKey');
      await tester.translationKeyInput.fill('test.translation.key');

      tester.modal!.submit();

      expect(mockActiveModal.close).toHaveBeenCalled();
      const closedAttribute = mockActiveModal.close.mock.calls.at(-1)![0];
      expect(closedAttribute.type).toBe('string');
      expect(closedAttribute.key).toBe('testKey');
    });

    test('should not close modal when form is invalid', async () => {
      await tester.keyInput.fill('');

      tester.modal!.submit();

      expect(mockActiveModal.close).not.toHaveBeenCalled();
    });
  });

  describe('Helper Methods', () => {
    beforeEach(() => {
      tester.modal!.prepareForCreation();
    });

    test('should correctly identify string type', async () => {
      await tester.typeSelect.selectOptions('string');

      expect(tester.modal!.isStringType()).toBe(true);
      expect(tester.modal!.isNumberType()).toBe(false);
    });

    test('should correctly identify number type', async () => {
      await tester.typeSelect.selectOptions('number');

      expect(tester.modal!.isNumberType()).toBe(true);
      expect(tester.modal!.isStringType()).toBe(false);
    });

    test('should correctly identify displayable types', async () => {
      const displayableTypes = ['string', 'number', 'boolean', 'code', 'string-select', 'timezone', 'scan-mode'];

      for (const type of displayableTypes) {
        await tester.typeSelect.selectOptions(type);
        expect(tester.modal!.isDisplayableType()).toBe(true);
      }

      await tester.typeSelect.selectOptions('object');
      expect(tester.modal!.isDisplayableType()).toBe(false);

      await tester.typeSelect.selectOptions('array');
      expect(tester.modal!.isDisplayableType()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      tester.modal!.prepareForCreation();
    });

    test('should handle empty number values', async () => {
      await tester.typeSelect.selectOptions('number');
      tester.fixture.detectChanges();
      await tester.defaultValueNumberInput.fill('');

      const attribute = tester.modal!['buildAttributeFromForm'](tester.modal!.form.value);
      expect((attribute as any).defaultValue).toBeNull();
    });

    test('should handle empty selectable values for string-select', async () => {
      await tester.typeSelect.selectOptions('string-select');
      tester.fixture.detectChanges();
      await tester.selectableValuesInput.fill('');

      const attribute = tester.modal!['buildAttributeFromForm'](tester.modal!.form.value);
      expect((attribute as any).selectableValues).toEqual([]);
    });

    test('should handle comma-separated selectable values with spaces', async () => {
      await tester.typeSelect.selectOptions('string-select');
      tester.fixture.detectChanges();
      await tester.selectableValuesInput.fill('value1, value2 , value3');

      const attribute = tester.modal!['buildAttributeFromForm'](tester.modal!.form.value);
      expect((attribute as any).selectableValues).toEqual(['value1', 'value2', 'value3']);
    });

    test('should handle default values for array pagination', async () => {
      await tester.typeSelect.selectOptions('array');
      tester.fixture.detectChanges();
      await tester.numberOfElementsInput.fill('');

      const attribute = tester.modal!['buildAttributeFromForm'](tester.modal!.form.value);
      expect((attribute as any).numberOfElementPerPage).toBe(20);
    });
  });
});
