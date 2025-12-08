import { ImportSouthItemsModalComponent } from './import-south-items-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { SouthFolderScannerItemSettings } from '../../../../../../backend/shared/model/south-settings.model';
import testData from '../../../../../../backend/src/tests/utils/test-data';
import { SouthConnectorDTO } from '../../../../../../backend/shared/model/south-connector.model';

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
  const southConnector = testData.south.list[0] as SouthConnectorDTO;

  beforeEach(async () => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });

    tester = new ImportSouthItemsModalComponentTester();
    tester.componentInstance.prepare(
      testData.south.manifest,
      southConnector.items.map(element => ({ ...element, scanModeId: element.scanMode.id })),
      [
        {
          id: '',
          name: 'item999',
          enabled: true,
          settings: { regex: '*', minAge: 100, preserveFiles: true } as SouthFolderScannerItemSettings,
          scanMode: testData.scanMode.list[0]
        }
      ],
      [{ item: { name: 'item2' }, error: '' }],
      testData.scanMode.list
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
        settings: { regex: '*', minAge: 100, preserveFiles: true } as SouthFolderScannerItemSettings,
        scanMode: testData.scanMode.list[0]
      }
    ]);
  }));

  it('should cancel', () => {
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
