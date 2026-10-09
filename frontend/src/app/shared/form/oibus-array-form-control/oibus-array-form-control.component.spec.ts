import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { OIBusArrayAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { DownloadService } from '../../../services/download.service';
import { DefaultValidationErrorsComponent } from '../../default-validation-errors/default-validation-errors.component';
import { ExportItemModalComponent } from '../../export-item-modal/export-item-modal.component';
import { ImportItemModalComponent } from '../../import-item-modal/import-item-modal.component';
import { MockModalService, provideModalTesting } from '../../mock-modal.service.testing';
import { ImportArrayValidationModalComponent } from './import-array-validation-modal/import-array-validation-modal.component';
import { ArrayElement, OIBusArrayFormControlComponent } from './oibus-array-form-control.component';
import { OIBusEditArrayElementModalComponent } from './oibus-edit-array-element-modal/oibus-edit-array-element-modal.component';

const displayProperties = { row: 0, columns: 6, displayInViewMode: true };

const arrayAttribute: OIBusArrayAttribute = {
  type: 'array',
  paginate: false,
  numberOfElementPerPage: 2,
  key: 'items',
  translationKey: 'configuration.oibus.manifest.south.items.title',
  validators: [],
  rootAttribute: {
    type: 'object',
    key: 'item',
    translationKey: 'configuration.oibus.manifest.south.items.item',
    validators: [],
    attributes: [
      {
        type: 'string',
        key: 'name',
        translationKey: 'configuration.oibus.manifest.south.items.name',
        defaultValue: null,
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties
      },
      {
        type: 'boolean',
        key: 'enabled',
        translationKey: 'configuration.oibus.manifest.south.items.enabled',
        defaultValue: false,
        validators: [],
        displayProperties
      }
    ],
    enablingConditions: [],
    displayProperties: { visible: true, wrapInBox: false }
  }
};

@Component({
  selector: 'oib-test-oibus-array-form-control-component',
  template: `<oib-default-validation-errors />
    <form [formGroup]="form">
      <ng-container formGroupName="settings">
        <oib-oibus-array-form-control
          [control]="form.controls.settings.controls.items"
          [arrayAttribute]="arrayAttribute()"
          [parentGroup]="form"
          [scanModes]="scanModes"
          [certificates]="certificates"
        />
      </ng-container>
    </form>`,
  imports: [OIBusArrayFormControlComponent, ReactiveFormsModule, DefaultValidationErrorsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  readonly form = new FormGroup({
    settings: new FormGroup({
      items: new FormControl<Array<ArrayElement>>(
        [
          { id: 'id1', name: 'item1', enabled: true },
          { id: 'id2', name: 'item2', enabled: false }
        ],
        { nonNullable: true }
      )
    })
  });
  readonly scanModes = testData.scanMode.list;
  readonly certificates = testData.certificates.list;
  readonly arrayAttribute = signal(arrayAttribute);
}

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly control = this.component.form.controls.settings.controls.items;
  readonly rows = this.root.getByCss('tbody tr');
  readonly addButton = this.root.getByRole('button', { name: 'Add an element' });
  readonly exportButton = this.root.getByRole('button', { name: 'Export' });
  readonly importButton = this.root.getByRole('button', { name: 'Import' });

  constructor(attribute: OIBusArrayAttribute = arrayAttribute) {
    this.component.arrayAttribute.set(attribute);
  }

  row(index: number) {
    return this.rows.nth(index);
  }
}

describe('OIBusArrayFormControlComponent', () => {
  let modalService: MockModalService<unknown>;
  let downloadService: MockObject<DownloadService>;

  beforeEach(() => {
    downloadService = createMock(DownloadService);
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideModalTesting(), { provide: DownloadService, useValue: downloadService }]
    });
    modalService = TestBed.inject(MockModalService);
  });

  test('should display the elements', async () => {
    const tester = new TestComponentTester();

    await expect.element(tester.rows).toHaveLength(2);
    const headers = tester.root.getByCss('thead th');
    expect(headers.elements().map(header => header.textContent!.trim())).toEqual(['Name', 'Enabled', '']);
    await expect.element(tester.row(0)).toHaveTextContent('item1 Yes');
    await expect.element(tester.row(1)).toHaveTextContent('item2 No');
  });

  test('should display the value patched from outside', async () => {
    const tester = new TestComponentTester();
    await expect.element(tester.rows).toHaveLength(2);

    tester.control.setValue([]);

    await expect.element(tester.rows).toHaveLength(0);
    await expect.element(tester.root.getByText('No items')).toBeInTheDocument();
    await expect.element(tester.exportButton).toBeDisabled();
  });

  test('should display the validation errors when the form is marked as touched from outside', async () => {
    const tester = new TestComponentTester();
    tester.control.addValidators(() => ({ mustBeUnique: true }));
    tester.control.updateValueAndValidity();

    tester.component.form.markAllAsTouched();

    await expect.element(tester.root.getByText('Must be unique')).toBeVisible();
  });

  test('should add an element', async () => {
    const tester = new TestComponentTester();
    const fakeModal = createMock(OIBusEditArrayElementModalComponent);
    modalService.mockClosedModal(fakeModal, { name: 'item3', enabled: true });

    await tester.addButton.click();

    expect(fakeModal.prepareForCreation).toHaveBeenCalledWith(
      testData.scanMode.list,
      testData.certificates.list,
      tester.component.form,
      arrayAttribute.rootAttribute
    );
    await expect.element(tester.rows).toHaveLength(3);
    await expect.element(tester.row(2)).toMatchTextContent(/^item3 Yes/);
    expect(tester.control.value[2]).toEqual({ name: 'item3', enabled: true });
  });

  test('should copy an element', async () => {
    const tester = new TestComponentTester();
    const fakeModal = createMock(OIBusEditArrayElementModalComponent);
    modalService.mockClosedModal(fakeModal, { name: 'item1-copy', enabled: true });

    await tester.row(0).getByRole('button', { name: 'Copy element' }).click();

    expect(fakeModal.prepareForCopy).toHaveBeenCalledWith(
      testData.scanMode.list,
      testData.certificates.list,
      tester.component.form,
      { id: 'id1', name: 'item1', enabled: true },
      arrayAttribute.rootAttribute
    );
    await expect.element(tester.rows).toHaveLength(3);
    expect(tester.control.value.map(element => element['name'])).toEqual(['item1', 'item2', 'item1-copy']);
  });

  test('should edit an element, keeping its id', async () => {
    const tester = new TestComponentTester();
    const fakeModal = createMock(OIBusEditArrayElementModalComponent);
    modalService.mockClosedModal(fakeModal, { name: 'renamed', enabled: true });

    await tester.row(1).getByRole('button', { name: 'Edit element' }).click();

    expect(fakeModal.prepareForEdition).toHaveBeenCalledWith(
      testData.scanMode.list,
      testData.certificates.list,
      tester.component.form,
      { id: 'id2', name: 'item2', enabled: false },
      arrayAttribute.rootAttribute
    );
    await expect.element(tester.row(1)).toMatchTextContent(/^renamed Yes/);
    expect(tester.control.value).toEqual([
      { id: 'id1', name: 'item1', enabled: true },
      { id: 'id2', name: 'renamed', enabled: true }
    ]);
  });

  test('should not change the elements when the edition is cancelled', async () => {
    const tester = new TestComponentTester();
    modalService.mockDismissedModal(createMock(OIBusEditArrayElementModalComponent));

    await tester.row(1).getByRole('button', { name: 'Edit element' }).click();

    expect(tester.control.value.length).toBe(2);
    await expect.element(tester.row(1)).toMatchTextContent(/^item2 No/);
  });

  test('should delete an element', async () => {
    const tester = new TestComponentTester();

    await tester.row(0).getByRole('button', { name: 'Delete element' }).click();

    await expect.element(tester.rows).toHaveLength(1);
    expect(tester.control.value).toEqual([{ id: 'id2', name: 'item2', enabled: false }]);
  });

  test('should paginate the elements', async () => {
    const tester = new TestComponentTester({ ...arrayAttribute, paginate: true });
    tester.control.setValue([...tester.control.value, { id: 'id3', name: 'item3', enabled: true }]);

    await expect.element(tester.rows).toHaveLength(2);
    await tester.root.getByRole('link', { name: '2' }).click();

    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.row(0)).toMatchTextContent(/^item3 Yes/);

    // back to the first page when the elements change
    await tester.row(0).getByRole('button', { name: 'Delete element' }).click();
    await expect.element(tester.rows).toHaveLength(2);
    await expect.element(tester.root.getByRole('link', { name: '2' })).not.toBeInTheDocument();
  });

  test('should export the elements', async () => {
    const tester = new TestComponentTester();
    const fakeModal = createMock(ExportItemModalComponent);
    modalService.mockClosedModal(fakeModal, { delimiter: ';', filename: 'items.csv' });

    await tester.exportButton.click();

    expect(fakeModal.prepare).toHaveBeenCalledWith('items');
    expect(downloadService.downloadFile).toHaveBeenCalledWith({ blob: expect.any(Blob), name: 'items.csv' });
    const { blob } = downloadService.downloadFile.mock.lastCall![0];
    expect(await blob.text()).toBe('name;enabled\r\nitem1;true\r\nitem2;false');
  });

  test.each([
    { eraseExisting: false, expected: ['item1', 'item2', 'item3'] },
    { eraseExisting: true, expected: ['item3'] }
  ])('should import elements (erase existing: $eraseExisting)', async ({ eraseExisting, expected }) => {
    const tester = new TestComponentTester();
    const file = new File(['name,enabled\nitem3,true'], 'items.csv', { type: 'text/csv' });
    const fakeImportModal = createMock(ImportItemModalComponent);
    const fakeValidationModal = createMock(ImportArrayValidationModalComponent);
    modalService.mockClosedModal(fakeImportModal, { file, delimiter: ',', eraseExisting });
    // the validation modal is opened once the import modal is closed
    const openImportModal = modalService.open.bind(modalService);
    vi.spyOn(modalService, 'open').mockImplementationOnce((type, options) => {
      const modal = openImportModal(type, options);
      modalService.mockClosedModal(fakeValidationModal, [{ name: 'item3', enabled: true }]);
      return modal;
    });

    await tester.importButton.click();

    expect(fakeImportModal.prepare).toHaveBeenCalledWith(['name'], ['enabled'], [], false, true);
    await vi.waitFor(() =>
      expect(fakeValidationModal.prepare).toHaveBeenCalledWith(arrayAttribute, [{ name: 'item3', enabled: true }], [])
    );
    await expect.element(tester.rows).toHaveLength(expected.length);
    expect(tester.control.value.map(element => element['name'])).toEqual(expected);
  });

  test('should report the elements of the file already in the array', async () => {
    const tester = new TestComponentTester();
    const file = new File(['name,enabled\nitem1,true'], 'items.csv', { type: 'text/csv' });
    const fakeValidationModal = createMock(ImportArrayValidationModalComponent);
    modalService.mockClosedModal(createMock(ImportItemModalComponent), { file, delimiter: ',', eraseExisting: false });
    const openImportModal = modalService.open.bind(modalService);
    vi.spyOn(modalService, 'open').mockImplementationOnce((type, options) => {
      const modal = openImportModal(type, options);
      modalService.mockDismissedModal(fakeValidationModal);
      return modal;
    });

    await tester.importButton.click();

    await vi.waitFor(() =>
      expect(fakeValidationModal.prepare).toHaveBeenCalledWith(
        arrayAttribute,
        [],
        [{ element: { name: 'item1', enabled: 'true' }, error: 'Row 1: Element name "item1" already exists in the array' }]
      )
    );
    expect(tester.control.value.length).toBe(2);
  });
});
