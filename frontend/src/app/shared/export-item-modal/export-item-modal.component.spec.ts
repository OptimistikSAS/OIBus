import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { ExportItemModalComponent } from './export-item-modal.component';

class ExportItemModalComponentTester {
  readonly fixture = TestBed.createComponent(ExportItemModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });
  readonly delimiter = this.root.getByLabelText('Delimiter');
  readonly filename = this.root.getByLabelText('Filename');
}

describe('ExportItemModalComponent', () => {
  let tester: ExportItemModalComponentTester;
  let fakeActiveModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });
    tester = new ExportItemModalComponentTester();
  });

  afterEach(() => vi.useRealTimers());

  test('should prepare a timestamped file name', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2024-03-04T05:06:07.089Z'));

    tester.fixture.componentInstance.prepare('south-items');

    await expect.element(tester.filename).toHaveValue('south-items_2024_03_04_05_06_07_089.csv');
    await expect.element(tester.delimiter).toHaveDisplayValue('Comma ,');
  });

  test('should close with the delimiter and the file name', async () => {
    tester.fixture.componentInstance.prepare('south-items');

    await tester.delimiter.selectOptions('Semi colon ;');
    await tester.filename.fill('export.csv');
    await tester.saveButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith({ delimiter: ';', filename: 'export.csv' });
  });

  test('should not close without file name', async () => {
    await expect.element(tester.filename).toHaveValue('');

    await tester.saveButton.click();

    expect(fakeActiveModal.close).not.toHaveBeenCalled();
  });

  test('should cancel', async () => {
    await tester.cancelButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith();
  });
});
