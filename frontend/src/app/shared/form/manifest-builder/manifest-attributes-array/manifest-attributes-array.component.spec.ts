import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { OIBusAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../../test/vitest-create-mock';
import { MockModalService, provideModalTesting } from '../../../mock-modal.service.testing';
import { ManifestAttributeEditorModalComponent } from '../manifest-attribute-editor-modal/manifest-attribute-editor-modal.component';
import { ManifestAttributesArrayComponent } from './manifest-attributes-array.component';

const attribute = (key: string, type: 'string' | 'number' = 'string'): OIBusAttribute =>
  type === 'string'
    ? {
        type,
        key,
        translationKey: key,
        validators: [],
        defaultValue: null,
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      }
    : {
        type,
        key,
        translationKey: key,
        validators: [],
        defaultValue: null,
        unit: null,
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      };

@Component({
  template: `<oib-manifest-attributes-array
    label="Attributes"
    [control]="control"
    [contextPath]="['root']"
    (nestedChange)="changes = changes + 1"
  />`,
  imports: [ManifestAttributesArrayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  readonly control = new FormControl<Array<OIBusAttribute>>([attribute('name'), attribute('port', 'number')], { nonNullable: true });
  changes = 0;
}

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly host = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly rows = this.root.getByCss('tbody tr');
  readonly addButton = this.root.getByRole('button', { name: 'Add an element' });

  row(index: number) {
    return this.rows.nth(index);
  }

  async expectRow(index: number, key: string, type: string) {
    const cells = this.row(index).getByRole('cell');
    await expect.element(cells.nth(0)).toHaveTextContent(key);
    await expect.element(cells.nth(1)).toHaveTextContent(type);
  }
}

describe('ManifestAttributesArrayComponent', () => {
  let tester: TestComponentTester;
  let modalService: MockModalService<unknown>;
  let fakeEditor: MockObject<ManifestAttributeEditorModalComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting(), provideModalTesting()] });
    modalService = TestBed.inject(MockModalService);
    fakeEditor = createMock(ManifestAttributeEditorModalComponent);
    tester = new TestComponentTester();
  });

  test('should display the attributes by key and type', async () => {
    await expect.element(tester.root.getByText('Attributes')).toBeInTheDocument();
    await expect.element(tester.rows).toHaveLength(2);
    const headers = tester.root.getByCss('thead th');
    expect(headers.elements().map(header => header.textContent!.trim())).toEqual(['Key', 'Type', '']);
    await tester.expectRow(0, 'name', 'String');
    await tester.expectRow(1, 'port', 'Number');
  });

  test('should display the attributes set from outside', async () => {
    tester.host.control.setValue([]);

    await expect.element(tester.rows).toHaveLength(0);
    await expect.element(tester.root.getByText('No attributes defined')).toBeInTheDocument();
  });

  test('should add an attribute', async () => {
    modalService.mockClosedModal(fakeEditor, attribute('added'));

    await tester.addButton.click();

    await expect.element(tester.rows).toHaveLength(3);
    expect(fakeEditor.prepareForCreation).toHaveBeenCalledWith(['root'], 1);
    expect(tester.host.control.value[2]).toEqual(attribute('added'));
    expect(tester.host.control.dirty).toBe(true);
    expect(tester.host.changes).toBe(1);
  });

  test('should copy an attribute', async () => {
    modalService.mockClosedModal(fakeEditor, attribute('name_copy'));

    await tester.row(0).getByRole('button', { name: 'Copy element' }).click();

    await expect.element(tester.rows).toHaveLength(3);
    expect(fakeEditor.prepareForEdition).toHaveBeenCalledWith({ ...attribute('name'), key: 'name_copy' }, ['root'], 1);
    expect(tester.host.control.value.map(element => element.key)).toEqual(['name', 'port', 'name_copy']);
    expect(tester.host.changes).toBe(1);
  });

  test('should edit an attribute', async () => {
    modalService.mockClosedModal(fakeEditor, attribute('renamed', 'number'));

    await tester.row(0).getByRole('button', { name: 'Edit element' }).click();

    await tester.expectRow(0, 'renamed', 'Number');
    expect(fakeEditor.prepareForEdition).toHaveBeenCalledWith(attribute('name'), ['root'], 1);
    expect(tester.host.control.value).toEqual([attribute('renamed', 'number'), attribute('port', 'number')]);
    expect(tester.host.control.dirty).toBe(true);
    expect(tester.host.changes).toBe(1);
  });

  test('should not change the attributes when the edition is cancelled', async () => {
    modalService.mockDismissedModal(fakeEditor);

    await tester.row(0).getByRole('button', { name: 'Edit element' }).click();

    await vi.waitFor(() => expect(fakeEditor.prepareForEdition).toHaveBeenCalled());
    expect(tester.host.control.value.length).toBe(2);
    expect(tester.host.control.dirty).toBe(false);
    expect(tester.host.changes).toBe(0);
  });

  test('should delete an attribute', async () => {
    await tester.row(0).getByRole('button', { name: 'Delete element' }).click();

    await expect.element(tester.rows).toHaveLength(1);
    expect(tester.host.control.value).toEqual([attribute('port', 'number')]);
    expect(tester.host.control.dirty).toBe(true);
    expect(tester.host.changes).toBe(1);
  });

  test('should paginate the attributes', async () => {
    tester.host.control.setValue(Array.from({ length: 25 }, (_, index) => attribute(`attribute${index + 1}`)));

    await expect.element(tester.rows).toHaveLength(20);
    await tester.root.getByRole('link', { name: '2' }).click();

    await expect.element(tester.rows).toHaveLength(5);
    await tester.expectRow(0, 'attribute21', 'String');
  });
});
