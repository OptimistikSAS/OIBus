import { ImportHistoryQueryItemsModalComponent } from './import-history-query-items-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { SouthConnectorItemManifest } from '../../../../../shared/model/south-connector.model';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { HistoryQueryItemDTO } from '../../../../../shared/model/history-query.model';
import { SouthItemSettings } from '../../../../../shared/model/south-settings.model';

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

  const southItemSchema: SouthConnectorItemManifest = {
    scanMode: { subscriptionOnly: false, acceptSubscription: true },
    settings: [],
    schema: []
  } as SouthConnectorItemManifest;
  const allItems: Array<HistoryQueryItemDTO<SouthItemSettings>> = [
    {
      id: 'id1',
      enabled: true,
      name: 'item',
      settings: {} as SouthItemSettings
    },
    {
      id: 'id2',
      enabled: true,
      name: 'item2',
      settings: {} as SouthItemSettings
    }
  ];

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });

    tester = new ImportSouthItemsModalComponentTester();
    tester.componentInstance.prepare(
      southItemSchema,
      allItems,
      [{ name: 'item1' } as HistoryQueryItemDTO<SouthItemSettings>],
      [{ item: { name: 'item2' } as HistoryQueryItemDTO<SouthItemSettings>, error: '' }]
    );
    tester.detectChanges();
  });

  it('should save if valid', fakeAsync(() => {
    tester.save.click();
    expect(fakeActiveModal.close).toHaveBeenCalledWith([{ name: 'item1' }]);
  }));

  it('should cancel', () => {
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
