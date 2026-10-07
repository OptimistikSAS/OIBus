import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { OIBusArrayAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../../test/vitest-create-mock';
import { ImportArrayValidationModalComponent } from './import-array-validation-modal.component';

interface ImportError {
  element: Record<string, string>;
  error: string;
}

class ImportArrayValidationModalComponentTester {
  readonly fixture = TestBed.createComponent(ImportArrayValidationModalComponent);
  readonly componentInstance = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly okButton = this.root.getByRole('button', { name: 'OK' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });
  readonly errorSection = this.root.getByText("These items have errors and won't be imported");
  readonly validSection = this.root.getByText('These items will be created');
  readonly errorRows = this.root.getByCss('table').filter({ hasText: 'Error' }).getByCss('tbody tr');
  readonly validTable = this.root.getByCss('table').filter({ hasNotText: 'Error' });
  readonly validRows = this.validTable.getByCss('tbody tr');

  constructor(newElements: Array<Record<string, unknown>>, errors: Array<ImportError> = []) {
    this.componentInstance.prepare(arrayAttribute, newElements, errors);
  }
}

const arrayAttribute: OIBusArrayAttribute = {
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
      }
    ],
    enablingConditions: [],
    displayProperties: { visible: true, wrapInBox: false }
  },
  paginate: false,
  numberOfElementPerPage: 25
};

const items = (count: number, prefix = 'item') => Array.from({ length: count }, (_, index) => ({ name: `${prefix}${index + 1}` }));

describe('ImportArrayValidationModalComponent', () => {
  let fakeActiveModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });
  });

  test('should list the new elements with one column per field, sorted by name', async () => {
    const tester = new ImportArrayValidationModalComponentTester([
      { name: 'item1', zField: 'z', aField: 'a' },
      { name: 'item2', mField: 'm' }
    ]);

    await expect.element(tester.validRows).toHaveLength(2);
    const headers = tester.validTable.getByCss('thead th');
    await expect.element(headers).toHaveLength(5);
    expect(headers.elements().map(header => header.textContent!.trim())).toEqual(['Name', 'aField', 'mField', 'name', 'zField']);
    await expect.element(tester.errorSection).not.toBeInTheDocument();
  });

  test('should display nested and object values', async () => {
    const tester = new ImportArrayValidationModalComponentTester([
      { name: 'item1', nested_value: 'flat', object: { key: 'value' }, empty: null }
    ]);

    const cells = tester.validRows.nth(0).getByRole('cell');
    await expect.element(cells).toHaveLength(5);
    expect(cells.elements().map(cell => cell.textContent!.trim())).toEqual(['item1', '', 'item1', 'flat', '{"key":"value"}']);
  });

  test('should list the elements in error', async () => {
    const tester = new ImportArrayValidationModalComponentTester(
      [],
      [
        { element: { name: 'badItem1' }, error: 'Error 1' },
        { element: { name: 'badItem2' }, error: 'Error 2' }
      ]
    );

    await expect.element(tester.errorRows).toHaveLength(2);
    await expect.element(tester.errorRows.nth(0)).toMatchTextContent('badItem1 Error 1');
    await expect.element(tester.validSection).not.toBeInTheDocument();
  });

  test('should paginate the new elements', async () => {
    const tester = new ImportArrayValidationModalComponentTester(items(25));
    await expect.element(tester.validRows).toHaveLength(20);

    await tester.root.getByRole('link', { name: '2' }).click();

    await expect.element(tester.validRows).toHaveLength(5);
    await expect.element(tester.validRows.nth(0)).toMatchTextContent('item21');
  });

  test('should paginate the elements in error', async () => {
    const errors = items(25, 'bad').map(element => ({ element, error: 'invalid' }));
    const tester = new ImportArrayValidationModalComponentTester([], errors);
    await expect.element(tester.errorRows).toHaveLength(20);

    await tester.root.getByRole('link', { name: '2' }).click();

    await expect.element(tester.errorRows).toHaveLength(5);
    await expect.element(tester.errorRows.nth(0)).toMatchTextContent('bad21');
  });

  test('should close with the new elements', async () => {
    const newElements = items(2);
    const tester = new ImportArrayValidationModalComponentTester(newElements, [{ element: { name: 'bad' }, error: 'Error' }]);

    await tester.okButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith(newElements);
  });

  test('should disable OK when there is no new element', async () => {
    const tester = new ImportArrayValidationModalComponentTester([], [{ element: { name: 'bad' }, error: 'Error' }]);

    await expect.element(tester.okButton).toBeDisabled();
  });

  test('should dismiss on cancel', async () => {
    const tester = new ImportArrayValidationModalComponentTester(items(1));

    await tester.cancelButton.click();

    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });

  test.each([
    { label: 'a string', element: { name: 'test' }, column: 'name', expected: 'test' },
    { label: 'a number', element: { count: 42 }, column: 'count', expected: '42' },
    { label: 'a boolean', element: { active: true }, column: 'active', expected: 'true' },
    { label: 'an object as JSON', element: { nested: { key: 'value' } }, column: 'nested', expected: '{"key":"value"}' },
    { label: 'a missing field as empty', element: { name: 'test' }, column: 'missing', expected: '' },
    { label: 'a null value as empty', element: { value: null }, column: 'value', expected: '' },
    { label: 'a nested path', element: { nested: { value: 'test' } }, column: 'nested_value', expected: 'test' },
    { label: 'a deep nested path', element: { level1: { level2: { level3: 'deep' } } }, column: 'level1_level2_level3', expected: 'deep' },
    { label: 'a flat key containing underscores', element: { nested_value: 'flat' }, column: 'nested_value', expected: 'flat' }
  ])('should format $label', ({ element, column, expected }) => {
    const tester = new ImportArrayValidationModalComponentTester([]);

    expect(tester.componentInstance.getFieldValue(element, column)).toBe(expected);
  });
});
