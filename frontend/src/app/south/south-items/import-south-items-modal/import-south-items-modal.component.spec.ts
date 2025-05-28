import { ImportSouthItemsModalComponent } from './import-south-items-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { SouthConnectorItemDTO } from '../../../../../../backend/shared/model/south-connector.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { SouthItemSettings } from '../../../../../../backend/shared/model/south-settings.model';
import testData from '../../../../../../backend/src/tests/utils/test-data';

class ImportSouthItemsModalComponentTester extends ComponentTester<ImportSouthItemsModalComponent> {
  constructor() {
    super(ImportSouthItemsModalComponent);
  }

  get save() {
    return this.button('#save-button')!;
  }

  get cancel() {
    return this.button('#cancel-button')!;
  }
}

describe('ImportSouthItemsModalComponent', () => {
  let tester: ImportSouthItemsModalComponentTester;
  let fakeActiveModal: NgbActiveModal;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });

    tester = new ImportSouthItemsModalComponentTester();
    tester.componentInstance.prepare(
      testData.south.manifest,
      testData.south.list[0].items,
      [
        {
          id: '',
          name: 'item999',
          enabled: true,
          settings: {} as SouthItemSettings,
          scanModeId: testData.scanMode.list[0].id
        }
      ],
      [{ item: { name: 'item2' } as SouthConnectorItemDTO<SouthItemSettings>, error: '' }],
      testData.scanMode.list
    );
    tester.detectChanges();
  });

  it('should save if valid', fakeAsync(() => {
    tester.save.click();
    expect(fakeActiveModal.close).toHaveBeenCalledWith([
      {
        id: '',
        name: 'item999',
        enabled: true,
        settings: {} as SouthItemSettings,
        scanModeId: testData.scanMode.list[0].id
      }
    ]);
  }));

  it('should cancel', () => {
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
