import { ImportArrayValidationModalComponent } from './import-array-validation-modal.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { OIBusArrayAttribute } from '../../../../../../../backend/shared/model/form.model';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { createMock, MockObject } from '../../../../../test/vitest-create-mock';

class ImportArrayValidationModalComponentTester {
  readonly fixture = TestBed.createComponent(ImportArrayValidationModalComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.getByCss(`#${this.fixture.nativeElement.id}`);
  readonly saveButton = this.root.getByCss('#save-button');
  readonly cancelButton = this.root.getByCss('#cancel-button');
  readonly tableRows = this.root.getByCss('tbody tr');

  prepare(
    arrayAttribute: OIBusArrayAttribute,
    newElements: Array<Record<string, unknown>>,
    errors: Array<{ element: Record<string, string>; error: string }>
  ) {
    this.component.prepare(arrayAttribute, newElements, errors);
    this.fixture.detectChanges();
  }
}

describe('ImportArrayValidationModalComponent', () => {
  let tester: ImportArrayValidationModalComponentTester;
  let fakeActiveModal: MockObject<NgbActiveModal>;

  const mockArrayAttribute: OIBusArrayAttribute = {
    type: 'array',
    key: 'testArray',
    translationKey: 'test.array',
    validators: [],
    rootAttribute: {
      type: 'object',
      key: 'testItem',
      translationKey: 'test.item',
      validators: [],
      attributes: [
        {
          type: 'string',
          key: 'name',
          translationKey: 'test.name',
          validators: [],
          defaultValue: null,
          displayProperties: { row: 0, columns: 12, displayInViewMode: true }
        },
        {
          type: 'string',
          key: 'fieldName',
          translationKey: 'test.fieldName',
          validators: [],
          defaultValue: null,
          displayProperties: { row: 0, columns: 12, displayInViewMode: true }
        },
        {
          type: 'object',
          key: 'nested',
          translationKey: 'test.nested',
          validators: [],
          displayProperties: { visible: true, wrapInBox: false },
          attributes: [
            {
              type: 'string',
              key: 'value',
              translationKey: 'test.value',
              validators: [],
              defaultValue: null,
              displayProperties: { row: 0, columns: 12, displayInViewMode: true }
            }
          ],
          enablingConditions: []
        }
      ],
      enablingConditions: [],
      displayProperties: { visible: true, wrapInBox: false }
    },
    paginate: false,
    numberOfElementPerPage: 25
  };

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });

    tester = new ImportArrayValidationModalComponentTester();
  });

  describe('Component initialization', () => {
    test('should create', () => {
      tester.fixture.detectChanges();
      expect(tester.component).toBeTruthy();
    });

    test('should initialize with empty lists', () => {
      tester.fixture.detectChanges();
      expect(tester.component.newElementList).toEqual([]);
      expect(tester.component.errorList).toEqual([]);
      expect(tester.component.columns).toEqual([]);
    });
  });

  describe('prepare method', () => {
    test('should initialize component with provided data', () => {
      const newElements = [
        { name: 'item1', fieldName: 'field1', nested_value: 'nested1' },
        { name: 'item2', fieldName: 'field2', nested_value: 'nested2' }
      ];
      const errors = [{ element: { name: 'badItem' }, error: 'Invalid format' }];

      tester.prepare(mockArrayAttribute, newElements, errors);

      expect(tester.component.arrayAttribute).toBe(mockArrayAttribute);
      expect(tester.component.newElementList).toEqual(newElements);
      expect(tester.component.errorList).toEqual(errors);
      expect(tester.component.columns).toEqual(['fieldName', 'name', 'nested_value']);
      expect(tester.component.displayedElementsNew.totalElements).toBe(2);
      expect(tester.component.displayedElementsError.totalElements).toBe(1);
    });

    test('should extract and sort columns correctly', () => {
      const newElements = [
        { zField: 'z', aField: 'a', mField: 'm' },
        { zField: 'z2', bField: 'b' }
      ];

      tester.prepare(mockArrayAttribute, newElements, []);

      expect(tester.component.columns).toEqual(['aField', 'bField', 'mField', 'zField']);
    });

    test('should handle empty newItems list', () => {
      tester.prepare(mockArrayAttribute, [], []);

      expect(tester.component.newElementList).toEqual([]);
      expect(tester.component.columns).toEqual([]);
      expect(tester.component.displayedElementsNew.totalElements).toBe(0);
    });
  });

  describe('cancel method', () => {
    test('should dismiss modal', () => {
      tester.fixture.detectChanges();
      tester.component.cancel();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });

    test('should dismiss modal when cancel button is clicked', async () => {
      tester.prepare(mockArrayAttribute, [{ name: 'test' }], []);

      await tester.cancelButton.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('submit method', () => {
    test('should close modal with newElementList', () => {
      const newElements = [{ name: 'item1' }, { name: 'item2' }];
      tester.prepare(mockArrayAttribute, newElements, []);
      tester.component.submit();

      expect(fakeActiveModal.close).toHaveBeenCalledWith(newElements);
    });

    test('should close modal when save button is clicked', async () => {
      const newElements = [{ name: 'item1' }];
      tester.prepare(mockArrayAttribute, newElements, []);

      await tester.saveButton.click();
      expect(fakeActiveModal.close).toHaveBeenCalledWith(newElements);
    });

    test('should disable save button when newElementList is empty', async () => {
      tester.prepare(mockArrayAttribute, [], []);

      await expect.element(tester.saveButton).toBeDisabled();
    });

    test('should enable save button when newElementList has elements', async () => {
      tester.prepare(mockArrayAttribute, [{ name: 'item1' }], []);

      await expect.element(tester.saveButton).not.toBeDisabled();
    });
  });

  describe('getFieldValue method', () => {
    beforeEach(() => {
      tester.fixture.detectChanges();
      tester.component.prepare(mockArrayAttribute, [], []);
    });

    test('should return string value directly', () => {
      const item = { name: 'test' };
      expect(tester.component.getFieldValue(item, 'name')).toBe('test');
    });

    test('should return number as string', () => {
      const item = { count: 42 };
      expect(tester.component.getFieldValue(item, 'count')).toBe('42');
    });

    test('should return boolean as string', () => {
      const item = { active: true };
      expect(tester.component.getFieldValue(item, 'active')).toBe('true');
    });

    test('should stringify object values', () => {
      const item = { nested: { key: 'value' } };
      const result = tester.component.getFieldValue(item, 'nested');
      expect(result).toBe('{"key":"value"}');
    });

    test('should return empty string for undefined', () => {
      const item = { existing: 'value' };
      expect(tester.component.getFieldValue(item, 'nonexistent')).toBe('');
    });

    test('should return empty string for null', () => {
      const item = { value: null };
      expect(tester.component.getFieldValue(item, 'value')).toBe('');
    });

    test('should handle nested paths with underscore separator', () => {
      const item = { nested_value: 'test' };
      expect(tester.component.getFieldValue(item, 'nested_value')).toBe('test');
    });

    test('should handle deeply nested paths', () => {
      const item = { level1: { level2: { level3: 'deep' } } };
      expect(tester.component.getFieldValue(item, 'level1_level2_level3')).toBe('deep');
    });
  });

  describe('getValueByPath method (via getFieldValue)', () => {
    beforeEach(() => {
      tester.fixture.detectChanges();
      tester.component.prepare(mockArrayAttribute, [], []);
    });

    test('should return value for simple path via getFieldValue', () => {
      const item = { key: 'value' };
      expect(tester.component.getFieldValue(item, 'key')).toBe('value');
    });

    test('should return value for nested path via getFieldValue', () => {
      const item = { level1: { level2: 'nested' } };
      expect(tester.component.getFieldValue(item, 'level1_level2')).toBe('nested');
    });

    test('should return empty string for nonexistent path via getFieldValue', () => {
      const item = { existing: 'value' };
      expect(tester.component.getFieldValue(item, 'nonexistent')).toBe('');
    });
  });

  describe('pagination', () => {
    test('should paginate new items correctly', () => {
      const newItems: Array<Record<string, unknown>> = [];
      for (let i = 0; i < 25; i++) {
        newItems.push({ name: `item${i}`, id: i });
      }

      tester.fixture.detectChanges();
      tester.component.prepare(mockArrayAttribute, newItems, []);

      expect(tester.component.displayedElementsNew.totalElements).toBe(25);
      expect(tester.component.displayedElementsNew.totalPages).toBe(2);
      expect(tester.component.displayedElementsNew.content.length).toBe(20);

      tester.component.changePageNew(1);
      expect(tester.component.displayedElementsNew.number).toBe(1);
      expect(tester.component.displayedElementsNew.content.length).toBe(5);
    });

    test('should paginate error items correctly', () => {
      const errors: Array<{ element: Record<string, string>; error: string }> = [];
      for (let i = 0; i < 25; i++) {
        errors.push({ element: { name: `item${i}` }, error: `Error ${i}` });
      }

      tester.fixture.detectChanges();
      tester.component.prepare(mockArrayAttribute, [], errors);

      expect(tester.component.displayedElementsError.totalElements).toBe(25);
      expect(tester.component.displayedElementsError.totalPages).toBe(2);
      expect(tester.component.displayedElementsError.content.length).toBe(20);

      tester.component.changePageError(1);
      expect(tester.component.displayedElementsError.number).toBe(1);
      expect(tester.component.displayedElementsError.content.length).toBe(5);
    });

    test('should handle empty pagination for new items', () => {
      tester.fixture.detectChanges();
      tester.component.prepare(mockArrayAttribute, [], []);

      expect(tester.component.displayedElementsNew.totalElements).toBe(0);
      expect(tester.component.displayedElementsNew.totalPages).toBe(0);
      expect(tester.component.displayedElementsNew.content.length).toBe(0);
    });

    test('should handle empty pagination for error items', () => {
      tester.fixture.detectChanges();
      tester.component.prepare(mockArrayAttribute, [], []);

      expect(tester.component.displayedElementsError.totalElements).toBe(0);
      expect(tester.component.displayedElementsError.totalPages).toBe(0);
      expect(tester.component.displayedElementsError.content.length).toBe(0);
    });
  });

  describe('extractColumns', () => {
    test('should extract unique columns from items', () => {
      const items = [
        { name: 'item1', field: 'field1' },
        { name: 'item2', field: 'field2', extra: 'extra' }
      ];

      tester.fixture.detectChanges();
      tester.component.prepare(mockArrayAttribute, items, []);

      const columns = tester.component.columns;
      expect(columns).toContain('name');
      expect(columns).toContain('field');
      expect(columns).toContain('extra');
      expect(columns.length).toBe(3);
    });

    test('should handle items with no common columns', () => {
      const items = [{ field1: 'value1' }, { field2: 'value2' }, { field3: 'value3' }];

      tester.fixture.detectChanges();
      tester.component.prepare(mockArrayAttribute, items, []);

      expect(tester.component.columns).toEqual(['field1', 'field2', 'field3']);
    });

    test('should handle empty items array', () => {
      tester.fixture.detectChanges();
      tester.component.prepare(mockArrayAttribute, [], []);

      expect(tester.component.columns).toEqual([]);
    });
  });

  describe('integration with template', () => {
    test('should display new items in table', async () => {
      const newItems = [
        { name: 'item1', fieldName: 'field1' },
        { name: 'item2', fieldName: 'field2' }
      ];

      tester.prepare(mockArrayAttribute, newItems, []);

      await expect.element(tester.tableRows).toHaveLength(2);
    });

    test('should display error items in table', () => {
      const errors = [
        { element: { name: 'badItem1' }, error: 'Error 1' },
        { element: { name: 'badItem2' }, error: 'Error 2' }
      ];

      tester.fixture.detectChanges();
      tester.component.prepare(mockArrayAttribute, [], errors);
      tester.fixture.detectChanges();

      expect(tester.component.displayedElementsError.totalElements).toBe(2);
      expect(tester.component.displayedElementsError.content.length).toBe(2);
    });

    test('should not display error section when there are no errors', () => {
      tester.fixture.detectChanges();
      tester.component.prepare(mockArrayAttribute, [{ name: 'item1' }], []);
      tester.fixture.detectChanges();

      expect(tester.component.displayedElementsError.totalElements).toBe(0);
      expect(tester.component.displayedElementsNew.totalElements).toBe(1);
    });

    test('should not display new items section when there are no new items', () => {
      tester.fixture.detectChanges();
      tester.component.prepare(mockArrayAttribute, [], [{ element: { name: 'bad' }, error: 'Error' }]);
      tester.fixture.detectChanges();

      expect(tester.component.displayedElementsNew.totalElements).toBe(0);
      expect(tester.component.displayedElementsError.totalElements).toBe(1);
    });
  });
});
