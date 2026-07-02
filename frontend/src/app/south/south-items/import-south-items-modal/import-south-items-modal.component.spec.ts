import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';

import { ImportSouthItemsModalComponent } from './import-south-items-modal.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import testData from '../../../../../../backend/src/tests/utils/test-data';

const manifest = testData.south.manifest;

class ImportSouthItemsModalComponentTester {
  readonly fixture = TestBed.createComponent(ImportSouthItemsModalComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly saveButton = this.root.getByCss('#save-button');
  readonly cancelButton = this.root.getByCss('#cancel-button');
}

const createZonedFile = (content: string, filename = 'test.csv'): File => {
  const blob = new Blob([content], { type: 'text/csv' });
  const file = new File([blob], filename, { type: 'text/csv' });
  vi.spyOn(file, 'text').mockResolvedValue(content);
  return file;
};

describe('ImportSouthItemsModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let tester: ImportSouthItemsModalComponentTester;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: activeModal }]
    });
    tester = new ImportSouthItemsModalComponentTester();
  });

  test('should render after prepare', async () => {
    tester.component.prepare(manifest, [], [], [], false, true, () => of({ items: [], errors: [] }));
    tester.fixture.detectChanges();

    await expect.element(tester.root.getByCss('form, .modal-body')).toBeInTheDocument();
  });

  test('should cancel', async () => {
    tester.component.prepare(manifest, [], [], [], false, true, () => of({ items: [], errors: [] }));
    tester.fixture.detectChanges();

    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  test('should automatically run the check when a valid file is selected', async () => {
    const checkResult = {
      items: [{ name: 'item1', settings: {} } as any],
      errors: []
    };
    const checkFn = vi.fn().mockReturnValue(of(checkResult));
    tester.component.prepare(manifest, [], [], [], false, true, checkFn);
    tester.fixture.detectChanges();

    const file = createZonedFile('name,enabled\ntest,true');
    await tester.component.onFileSelected(file);
    tester.fixture.detectChanges();

    expect(checkFn).toHaveBeenCalledWith(file, ',', false);
    expect(tester.component.newItemList).toEqual(checkResult.items);
  });

  test('should disable import until the check found at least one valid item', async () => {
    const checkFn = vi.fn().mockReturnValue(of({ items: [], errors: [{ item: { name: 'bad' }, error: 'nope' }] }));
    tester.component.prepare(manifest, [], [], [], false, true, checkFn);
    tester.fixture.detectChanges();

    const file = createZonedFile('name,enabled\ntest,true');
    await tester.component.onFileSelected(file);
    tester.fixture.detectChanges();

    expect(tester.component.canImport).toBe(false);
    await expect.element(tester.saveButton).toBeDisabled();
  });

  test('should enable import once the check returns valid items', async () => {
    const checkFn = vi.fn().mockReturnValue(of({ items: [{ name: 'item1', settings: {} } as any], errors: [] }));
    tester.component.prepare(manifest, [], [], [], false, true, checkFn);
    tester.fixture.detectChanges();

    const file = createZonedFile('name,enabled\ntest,true');
    await tester.component.onFileSelected(file);
    tester.fixture.detectChanges();

    expect(tester.component.canImport).toBe(true);
    await expect.element(tester.saveButton).not.toBeDisabled();
  });

  test('should surface an error from the backend check', async () => {
    const checkFn = vi.fn().mockReturnValue(throwError(() => ({ error: { message: 'server error' } })));
    tester.component.prepare(manifest, [], [], [], false, true, checkFn);
    tester.fixture.detectChanges();

    const file = createZonedFile('name,enabled\ntest,true');
    await tester.component.onFileSelected(file);
    tester.fixture.detectChanges();

    expect(tester.component.checkError).toBe('server error');
    expect(tester.component.newItemList).toEqual([]);
  });

  test('should re-run the check when the erase existing toggle changes', async () => {
    const checkFn = vi.fn().mockReturnValue(of({ items: [{ name: 'item1', settings: {} } as any], errors: [] }));
    tester.component.prepare(manifest, [], [], [], false, true, checkFn);
    tester.fixture.detectChanges();

    const file = createZonedFile('name,enabled\ntest,true');
    await tester.component.onFileSelected(file);
    tester.component.form.controls.eraseExisting.setValue(true);
    await tester.component.onEraseExistingChange();

    expect(checkFn).toHaveBeenLastCalledWith(file, ',', true);
  });

  test('should close with the checked items and erase flag on submit', async () => {
    const checkResult = { items: [{ name: 'item1', settings: {} } as any], errors: [] };
    tester.component.prepare(manifest, [], [], [], false, true, () => of(checkResult));
    tester.fixture.detectChanges();

    const file = createZonedFile('name,enabled\ntest,true');
    await tester.component.onFileSelected(file);
    tester.component.form.controls.eraseExisting.setValue(true);
    tester.fixture.detectChanges();

    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith({ items: checkResult.items, eraseExisting: true });
  });

  test('should hide the erase existing toggle when showEraseOption is false', async () => {
    tester.component.prepare(manifest, [], [], [], false, false, () => of({ items: [], errors: [] }));
    tester.fixture.detectChanges();

    await expect.element(tester.root.getByCss('#erase-existing')).not.toBeInTheDocument();
  });
});
