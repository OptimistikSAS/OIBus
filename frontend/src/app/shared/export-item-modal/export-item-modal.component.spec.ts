import { TestBed } from '@angular/core/testing';
import { ComponentTester } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test } from 'vitest';
import { ExportItemModalComponent } from './export-item-modal.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';

class ExportSouthItemModalComponentTester extends ComponentTester<ExportItemModalComponent> {
  constructor() {
    super(ExportItemModalComponent);
  }

  get saveButton() {
    return this.button('#save-button')!;
  }

  get cancelButton() {
    return this.button('#cancel-button')!;
  }

  get delimiter() {
    return this.select('#delimiter')!;
  }

  get filename() {
    return this.input('#filename')!;
  }
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
  });

  test('should send a delimiter', async () => {
    await tester.change();
    tester.delimiter.selectLabel('Comma ,');
    tester.filename.fillWith('south-item');
    tester.saveButton.click();
    expect(fakeActiveModal.close).toHaveBeenCalledWith({ delimiter: ',', filename: 'south-item' });
  });

  test('should cancel', async () => {
    await tester.change();
    tester.cancelButton.click();
    expect(fakeActiveModal.close).toHaveBeenCalled();
  });
});
