import { ComponentTester, createMock } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ExportArrayModalComponent } from './export-array-modal.component';

class ExportArrayModalComponentTester extends ComponentTester<ExportArrayModalComponent> {
  constructor() {
    super(ExportArrayModalComponent);
  }

  get save() {
    return this.button('#save-button')!;
  }

  get cancel() {
    return this.button('#cancel-button')!;
  }
}

describe('ExportArrayModalComponent', () => {
  let tester: ExportArrayModalComponentTester;
  let fakeActiveModal: NgbActiveModal;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });

    tester = new ExportArrayModalComponentTester();
    tester.detectChanges();
  });

  it('should prepare filename with the array key when provided', () => {
    const dateTime = tester.componentInstance.dateTime;

    tester.componentInstance.prepare('my-array');

    expect(tester.componentInstance.fileName).toEqual(`my-array-export-${dateTime}`);
  });

  it('should prepare default filename when array key is missing', () => {
    const dateTime = tester.componentInstance.dateTime;

    tester.componentInstance.prepare(undefined);

    expect(tester.componentInstance.fileName).toEqual(`array-export-${dateTime}`);
  });

  it('should not close the modal when the form is invalid', async () => {
    await tester.save.click();

    expect(fakeActiveModal.close).not.toHaveBeenCalled();
  });

  it('should close the modal with converted delimiter when the form is valid', async () => {
    tester.componentInstance.exportForm.setValue({ delimiter: 'TAB', fileName: 'custom-name' });
    tester.detectChanges();

    await tester.save.click();

    expect(tester.componentInstance.selectedDelimiter).toBe('  ');
    expect(fakeActiveModal.close).toHaveBeenCalledWith({ delimiter: '  ', fileName: 'custom-name' });
  });

  it('should close the modal on cancel without payload', () => {
    tester.cancel.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith();
  });
});
