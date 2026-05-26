import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test } from 'vitest';
import { ExportItemModalComponent } from './export-item-modal.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { page } from 'vitest/browser';

class ExportSouthItemModalComponentTester {
  readonly fixture = TestBed.createComponent(ExportItemModalComponent);
  readonly saveButton = page.getByCss('#save-button');
  readonly cancelButton = page.getByCss('#cancel-button');
  readonly delimiter = page.getByCss('#delimiter');
  readonly filename = page.getByCss('#filename');
}

describe('ExportSouthItemModalComponent', () => {
  let tester: ExportSouthItemModalComponentTester;
  let fakeActiveModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });
    tester = new ExportSouthItemModalComponentTester();
    tester.fixture.detectChanges();
  });

  test('should send a delimiter', async () => {
    await tester.delimiter.selectOptions('Comma ,');
    await tester.filename.fill('south-item');
    await tester.saveButton.click();
    expect(fakeActiveModal.close).toHaveBeenCalledWith({ delimiter: ',', filename: 'south-item' });
  });

  test('should cancel', async () => {
    await tester.cancelButton.click();
    expect(fakeActiveModal.close).toHaveBeenCalled();
  });
});
