import { ImportSouthItemsModalComponent } from './import-south-items-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { SouthConnectorItemDTO, SouthConnectorItemManifest } from '../../../../../shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

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

  const southItemSchema: SouthConnectorItemManifest = {
    scanMode: { subscriptionOnly: false, acceptSubscription: true },
    settings: [],
    schema: []
  } as SouthConnectorItemManifest;
  const allItems: Array<SouthConnectorItemDTO> = [
    {
      id: 'id1',
      enabled: true,
      name: 'item',
      connectorId: 'southId',
      scanModeId: 'scanModeId1',
      settings: {}
    },
    {
      id: 'id2',
      enabled: true,
      name: 'item2',
      connectorId: 'southId',
      scanModeId: 'scanModeId1',
      settings: {}
    }
  ];
  const scanModes: Array<ScanModeDTO> = [
    {
      id: 'scanModeId1',
      name: 'scanMode1',
      description: 'my first scanMode',
      cron: '* * * * * *'
    },
    {
      id: 'scanModeId2',
      name: 'scanMode2',
      description: 'my second scanMode',
      cron: '* * * * * *'
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
      [{ name: 'item1' } as SouthConnectorItemDTO],
      [{ item: { name: 'item2' } as SouthConnectorItemDTO, message: '' }],
      scanModes
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
