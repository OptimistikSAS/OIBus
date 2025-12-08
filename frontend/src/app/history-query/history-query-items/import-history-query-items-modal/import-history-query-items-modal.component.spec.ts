import { ImportHistoryQueryItemsModalComponent } from './import-history-query-items-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { HistoryQueryItemDTO } from '../../../../../../backend/shared/model/history-query.model';
import { SouthFolderScannerItemSettings } from '../../../../../../backend/shared/model/south-settings.model';
import testData from '../../../../../../backend/src/tests/utils/test-data';

class ImportSouthItemsModalComponentTester extends ComponentTester<ImportHistoryQueryItemsModalComponent> {
  constructor() {
    super(ImportHistoryQueryItemsModalComponent);
  }

  get save() {
    return this.button('#save-button')!;
  }

  get cancel() {
    return this.button('#cancel-button')!;
  }
}

describe('ImportHistoryQueryItemsModalComponent', () => {
  let tester: ImportSouthItemsModalComponentTester;
  let fakeActiveModal: NgbActiveModal;

  const manifest = testData.south.manifest;

  beforeEach(async () => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });

    tester = new ImportSouthItemsModalComponentTester();
    tester.componentInstance.prepare(
      manifest,
      testData.historyQueries.list[0].items as any,
      [
        {
          id: '',
          name: 'item999',
          enabled: true,
          settings: {
            regex: '*',
            minAge: 100,
            preserveFiles: true
          } as SouthFolderScannerItemSettings
        }
      ],
      [{ item: { name: 'item2' } as HistoryQueryItemDTO, error: '' }]
    );
    await tester.change();
  });

  it('should save if valid', fakeAsync(() => {
    tester.save.click();
    expect(fakeActiveModal.close).toHaveBeenCalledWith([
      {
        id: '',
        name: 'item999',
        enabled: true,
        settings: {
          regex: '*',
          minAge: 100,
          preserveFiles: true
        } as SouthFolderScannerItemSettings
      }
    ]);
  }));

  it('should cancel', () => {
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
