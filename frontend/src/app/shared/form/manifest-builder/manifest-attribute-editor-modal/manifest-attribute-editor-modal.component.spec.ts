import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { ManifestAttributeEditorModalComponent } from './manifest-attribute-editor-modal.component';
import { OIBusAttribute } from '../../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test, vi } from 'vitest';

@Component({
  template: ` <oib-manifest-attribute-editor-modal /> `,
  imports: [ManifestAttributeEditorModalComponent]
})
class TestComponent {}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get modalComponent(): ManifestAttributeEditorModalComponent | undefined {
    return this.debugElement.query(p => p.componentInstance instanceof ManifestAttributeEditorModalComponent)?.componentInstance;
  }

  get typeSelect() {
    return this.select('select[formControlName="type"]');
  }

  get keyInput() {
    return this.input('input[formControlName="key"]')!;
  }

  get translationKeyInput() {
    return this.input('input[formControlName="translationKey"]')!;
  }

  get rowInput() {
    return this.input('input[formControlName="row"]')!;
  }

  get columnsInput() {
    return this.input('input[formControlName="columns"]')!;
  }

  get displayInViewModeCheckbox() {
    return this.input('#display-in-view-mode')!;
  }

  get defaultValueStringInput() {
    return this.input('input[formControlName="defaultValue_string"]')!;
  }

  get defaultValueNumberInput() {
    return this.input('input[formControlName="defaultValue_number"]')!;
  }

  get defaultValueBooleanCheckbox() {
    return this.input('#default-value-boolean')!;
  }

  get defaultValueCodeTextarea() {
    return this.element('textarea[formControlName="defaultValue_code"]')!;
  }

  get defaultValueTimezoneInput() {
    return this.input('input[formControlName="defaultValue_timezone"]')!;
  }

  get unitInput() {
    return this.input('input[formControlName="unit"]')!;
  }

  get contentTypeSelect() {
    return this.select('select[formControlName="contentType"]')!;
  }

  get selectableValuesInput() {
    return this.input('input[formControlName="selectableValuesCsv"]')!;
  }

  get acceptableTypeSelect() {
    return this.select('select[formControlName="acceptableType"]')!;
  }

  get objectVisibleCheckbox() {
    return this.input('#object-visible')!;
  }

  get objectWrapInBoxCheckbox() {
    return this.input('#object-wrap-in-box')!;
  }

  get arrayPaginateCheckbox() {
    return this.input('#array-paginate')!;
  }

  get numberOfElementsInput() {
    return this.input('input[formControlName="numberOfElementPerPage"]')!;
  }

  get cancelButton() {
    return this.button('#cancel-button')!;
  }

  get form() {
    return this.element('form')!;
  }

  get validationErrors() {
    return this.elements('.invalid-feedback')!;
  }

  isStringSectionVisible() {
    return this.defaultValueStringInput !== null;
  }

  isNumberSectionVisible() {
    return this.defaultValueNumberInput !== null && this.unitInput !== null;
  }

  isBooleanSectionVisible() {
    return this.defaultValueBooleanCheckbox !== null;
  }

  isCodeSectionVisible() {
    return this.contentTypeSelect !== null && this.defaultValueCodeTextarea !== null;
  }

  isStringSelectSectionVisible() {
    return this.selectableValuesInput !== null;
  }

  isTimezoneSectionVisible() {
    return this.defaultValueTimezoneInput !== null;
  }

  isScanModeSectionVisible() {
    return this.acceptableTypeSelect !== null;
  }

  isObjectSectionVisible() {
    return this.objectVisibleCheckbox !== null && this.objectWrapInBoxCheckbox !== null;
  }

  isArraySectionVisible() {
    return this.arrayPaginateCheckbox !== null && this.numberOfElementsInput !== null;
  }

  isDisplayPropertiesVisible() {
    return this.rowInput !== null && this.columnsInput !== null && this.displayInViewModeCheckbox !== null;
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
    tester.detectChanges();
  });

  describe('Component Initialization', () => {
    test('should create the component', () => {
      expect(tester.componentInstance).toBeDefined();
    });

    test('should initialize with default values', () => {
      expect(tester.typeSelect).toBeDefined();
      expect(tester.typeSelect!.nativeElement.value).toBe('string');
      expect(tester.keyInput.nativeElement).toHaveValue('');
      expect(tester.translationKeyInput.nativeElement).toHaveValue('');
      expect(tester.rowInput.nativeElement.value).toBe('0');
      expect(tester.columnsInput.nativeElement.value).toBe('4');
      expect(tester.displayInViewModeCheckbox.nativeElement).toBeChecked();
    });

    test('should display all available attribute types', () => {
      expect(tester.typeSelect).toBeDefined();
      expect(tester.typeSelect!.element('option')).toBeDefined();
    });
  });

  describe('Modal Preparation', () => {
    test('should prepare for creation mode', () => {
      expect(tester.modalComponent).toBeDefined();
      tester.modalComponent!.prepareForCreation();
      tester.detectChanges();

      expect(tester.modalComponent?.mode).toBe('create');
      expect(tester.modalComponent?.attribute).toBeNull();
      expect(tester.typeSelect).toBeDefined();
      expect(tester.typeSelect!.nativeElement.value).toBe('string');
      expect(tester.keyInput.nativeElement).toHaveValue('');
    });

    test('should prepare for edit mode', () => {
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

      tester.modalComponent!.prepareForEdition(testAttribute);
      tester.detectChanges();

      expect(tester.modalComponent?.mode).toBe('edit');
      expect(tester.modalComponent?.attribute).toEqual(testAttribute);
      expect(tester.typeSelect).toBeDefined();
      expect(tester.typeSelect!.nativeElement.value).toBe('string');
      expect(tester.keyInput.nativeElement).toHaveValue('testKey');
      expect(tester.translationKeyInput.nativeElement).toHaveValue('test.translation.key');
      expect(tester.defaultValueStringInput.nativeElement).toHaveValue('test value');
      expect(tester.rowInput.nativeElement.value).toBe('1');
      expect(tester.columnsInput.nativeElement.value).toBe('6');
      expect(tester.displayInViewModeCheckbox.nativeElement).not.toBeChecked();
    });
  });

  describe('Type-specific Form Sections', () => {
    beforeEach(() => {
      tester.modalComponent!.prepareForCreation();
      tester.detectChanges();
    });

    test('should show string-specific fields for string type', () => {
      tester.typeSelect!.selectValue('string');
      tester.detectChanges();

      expect(tester.isStringSectionVisible()).toBe(true);
      expect(tester.isDisplayPropertiesVisible()).toBe(true);
      expect(tester.isNumberSectionVisible()).toBe(false);
      expect(tester.isBooleanSectionVisible()).toBe(false);
    });

    test('should show number-specific fields for number type', () => {
      tester.typeSelect!.selectValue('number');
      tester.detectChanges();

      expect(tester.isNumberSectionVisible()).toBe(true);
      expect(tester.isDisplayPropertiesVisible()).toBe(true);
      expect(tester.isStringSectionVisible()).toBe(false);
      expect(tester.isBooleanSectionVisible()).toBe(false);
    });

    test('should show boolean-specific fields for boolean type', () => {
      tester.typeSelect!.selectValue('boolean');
      tester.detectChanges();

      expect(tester.isBooleanSectionVisible()).toBe(true);
      expect(tester.isDisplayPropertiesVisible()).toBe(true);
      expect(tester.isStringSectionVisible()).toBe(false);
      expect(tester.isNumberSectionVisible()).toBe(false);
    });

    test('should show code-specific fields for code type', () => {
      tester.typeSelect!.selectValue('code');
      tester.detectChanges();

      expect(tester.isCodeSectionVisible()).toBe(true);
      expect(tester.isDisplayPropertiesVisible()).toBe(true);
      expect(tester.isStringSectionVisible()).toBe(false);
      expect(tester.isNumberSectionVisible()).toBe(false);
    });

    test('should show string-select-specific fields for string-select type', () => {
      tester.typeSelect!.selectValue('string-select');
      tester.detectChanges();

      expect(tester.isStringSelectSectionVisible()).toBe(true);
      expect(tester.isDisplayPropertiesVisible()).toBe(true);
      expect(tester.isStringSectionVisible()).toBe(true);
      expect(tester.isNumberSectionVisible()).toBe(false);
    });

    test('should show timezone-specific fields for timezone type', () => {
      tester.typeSelect!.selectValue('timezone');
      tester.detectChanges();

      expect(tester.isTimezoneSectionVisible()).toBe(true);
      expect(tester.isDisplayPropertiesVisible()).toBe(true);
      expect(tester.isStringSectionVisible()).toBe(false);
      expect(tester.isNumberSectionVisible()).toBe(false);
    });

    test('should show scan-mode-specific fields for scan-mode type', () => {
      tester.typeSelect!.selectValue('scan-mode');
      tester.detectChanges();

      expect(tester.isScanModeSectionVisible()).toBe(true);
      expect(tester.isDisplayPropertiesVisible()).toBe(true);
      expect(tester.isStringSectionVisible()).toBe(false);
      expect(tester.isNumberSectionVisible()).toBe(false);
    });

    test('should show object-specific fields for object type', () => {
      tester.typeSelect!.selectValue('object');
      tester.detectChanges();

      expect(tester.isObjectSectionVisible()).toBe(true);
      expect(tester.isDisplayPropertiesVisible()).toBe(false);
      expect(tester.isStringSectionVisible()).toBe(false);
      expect(tester.isNumberSectionVisible()).toBe(false);
    });

    test('should show array-specific fields for array type', () => {
      tester.typeSelect!.selectValue('array');
      tester.detectChanges();

      expect(tester.isArraySectionVisible()).toBe(true);
      expect(tester.isDisplayPropertiesVisible()).toBe(false);
      expect(tester.isStringSectionVisible()).toBe(false);
      expect(tester.isNumberSectionVisible()).toBe(false);
    });
  });

  describe('Type Change Handling', () => {
    beforeEach(() => {
      tester.modalComponent!.prepareForCreation();
      tester.detectChanges();
    });

    test('should reset type-specific fields when changing type', () => {
      tester.typeSelect!.selectValue('number');
      tester.defaultValueNumberInput.fillWith('42');
      tester.unitInput.fillWith('ms');
      tester.detectChanges();

      tester.typeSelect!.selectValue('string');
      tester.detectChanges();

      expect(tester.defaultValueStringInput.nativeElement).toHaveValue('');
      expect(tester.isNumberSectionVisible()).toBe(false);
      expect(tester.isStringSectionVisible()).toBe(true);
    });

    test('should maintain common fields when changing type', () => {
      tester.keyInput.fillWith('testKey');
      tester.translationKeyInput.fillWith('test.translation.key');
      tester.rowInput.fillWith('2');
      tester.columnsInput.fillWith('8');
      tester.detectChanges();

      tester.typeSelect!.selectValue('boolean');
      tester.detectChanges();

      expect(tester.keyInput.nativeElement).toHaveValue('testKey');
      expect(tester.translationKeyInput.nativeElement).toHaveValue('test.translation.key');
      expect(tester.rowInput.nativeElement.value).toBe('2');
      expect(tester.columnsInput.nativeElement.value).toBe('8');
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      tester.modalComponent!.prepareForCreation();
      tester.detectChanges();
    });

    test('should validate required fields', () => {
      tester.keyInput.fillWith('');
      tester.translationKeyInput.fillWith('');
      tester.detectChanges();

      expect(tester.form.nativeElement).toHaveClass('ng-invalid');
    });

    test('should be valid with required fields filled', () => {
      tester.keyInput.fillWith('testKey');
      tester.translationKeyInput.fillWith('test.translation.key');
      tester.detectChanges();

      expect(tester.form.nativeElement).toHaveClass('ng-valid');
    });

    test('should validate column range', () => {
      tester.columnsInput.fillWith('0');
      tester.detectChanges();

      expect(tester.form.nativeElement).toHaveClass('ng-invalid');
    });

    test('should validate row minimum value', () => {
      tester.rowInput.fillWith('-1');
      tester.detectChanges();

      expect(tester.form.nativeElement).toHaveClass('ng-invalid');
    });
  });

  describe('Modal Actions', () => {
    beforeEach(() => {
      tester.modalComponent!.prepareForCreation();
      tester.detectChanges();
    });

    test('should dismiss modal when cancel button is clicked', () => {
      tester.cancelButton.click();

      expect(mockActiveModal.dismiss).toHaveBeenCalled();
    });

    test('should close modal with attribute when form is valid and submitted', () => {
      tester.keyInput.fillWith('testKey');
      tester.translationKeyInput.fillWith('test.translation.key');
      tester.detectChanges();

      tester.modalComponent!.submit();

      expect(mockActiveModal.close).toHaveBeenCalled();
      const closedAttribute = mockActiveModal.close.mock.calls.at(-1)![0];
      expect(closedAttribute.type).toBe('string');
      expect(closedAttribute.key).toBe('testKey');
    });

    test('should not close modal when form is invalid', () => {
      tester.keyInput.fillWith('');
      tester.detectChanges();

      tester.modalComponent!.submit();

      expect(mockActiveModal.close).not.toHaveBeenCalled();
    });
  });

  describe('Helper Methods', () => {
    beforeEach(() => {
      tester.modalComponent!.prepareForCreation();
      tester.detectChanges();
    });

    test('should correctly identify string type', () => {
      tester.typeSelect!.selectValue('string');
      tester.detectChanges();

      expect(tester.modalComponent!.isStringType()).toBe(true);
      expect(tester.modalComponent!.isNumberType()).toBe(false);
    });

    test('should correctly identify number type', () => {
      tester.typeSelect!.selectValue('number');
      tester.detectChanges();

      expect(tester.modalComponent!.isNumberType()).toBe(true);
      expect(tester.modalComponent!.isStringType()).toBe(false);
    });

    test('should correctly identify displayable types', () => {
      const displayableTypes = ['string', 'number', 'boolean', 'code', 'string-select', 'timezone', 'scan-mode'];

      displayableTypes.forEach(type => {
        tester.typeSelect!.selectValue(type);
        tester.detectChanges();
        expect(tester.modalComponent!.isDisplayableType()).toBe(true);
      });

      tester.typeSelect!.selectValue('object');
      tester.detectChanges();
      expect(tester.modalComponent!.isDisplayableType()).toBe(false);

      tester.typeSelect!.selectValue('array');
      tester.detectChanges();
      expect(tester.modalComponent!.isDisplayableType()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      tester.modalComponent!.prepareForCreation();
      tester.detectChanges();
    });

    test('should handle empty number values', () => {
      tester.typeSelect!.selectValue('number');
      tester.defaultValueNumberInput.fillWith('');
      tester.detectChanges();

      const attribute = tester.modalComponent!['buildAttributeFromForm'](tester.modalComponent!.form.value);
      expect((attribute as any).defaultValue).toBeNull();
    });

    test('should handle empty selectable values for string-select', () => {
      tester.typeSelect!.selectValue('string-select');
      tester.selectableValuesInput.fillWith('');
      tester.detectChanges();

      const attribute = tester.modalComponent!['buildAttributeFromForm'](tester.modalComponent!.form.value);
      expect((attribute as any).selectableValues).toEqual([]);
    });

    test('should handle comma-separated selectable values with spaces', () => {
      tester.typeSelect!.selectValue('string-select');
      tester.selectableValuesInput.fillWith('value1, value2 , value3');
      tester.detectChanges();

      const attribute = tester.modalComponent!['buildAttributeFromForm'](tester.modalComponent!.form.value);
      expect((attribute as any).selectableValues).toEqual(['value1', 'value2', 'value3']);
    });

    test('should handle default values for array pagination', () => {
      tester.typeSelect!.selectValue('array');
      tester.numberOfElementsInput.fillWith('');
      tester.detectChanges();

      const attribute = tester.modalComponent!['buildAttributeFromForm'](tester.modalComponent!.form.value);
      expect((attribute as any).numberOfElementPerPage).toBe(20);
    });
  });
});
