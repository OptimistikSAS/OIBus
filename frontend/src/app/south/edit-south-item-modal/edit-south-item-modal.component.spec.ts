import { EditSouthItemModalComponent } from './edit-south-item-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { MockI18nModule } from '../../../i18n/mock-i18n.spec';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { SouthConnectorService } from '../../services/south-connector.service';
import { SouthConnectorDTO, OibusItemCommandDTO, OibusItemDTO, OibusItemManifest } from '../../../../../shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';

class EditSouthItemModalComponentTester extends ComponentTester<EditSouthItemModalComponent> {
  constructor() {
    super(EditSouthItemModalComponent);
  }

  get name() {
    return this.input('#name')!;
  }

  get scanMode() {
    return this.select('#OibScanMode-item-scan-mode')!;
  }

  get validationErrors() {
    return this.elements('val-errors div');
  }

  get save() {
    return this.button('#save-button')!;
  }

  get cancel() {
    return this.button('#cancel-button')!;
  }
}

describe('EditSouthItemModalComponent', () => {
  let tester: EditSouthItemModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;

  const southConnector: SouthConnectorDTO = {
    id: 'southId1',
    type: 'SQL',
    name: 'South Connector 1',
    description: 'My South connector description',
    enabled: true,
    settings: {}
  };

  const southItemSchema: OibusItemManifest = {
    scanMode: { subscriptionOnly: false, acceptSubscription: true },
    settings: [],
    schema: {} as unknown
  } as OibusItemManifest;
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
    southConnectorService = createMock(SouthConnectorService);

    TestBed.configureTestingModule({
      imports: [
        MockI18nModule,
        ReactiveFormsModule,
        HttpClientTestingModule,
        EditSouthItemModalComponent,
        DefaultValidationErrorsComponent
      ],
      providers: [
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: SouthConnectorService, useValue: southConnectorService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new EditSouthItemModalComponentTester();
  });

  describe('create mode', () => {
    beforeEach(() => {
      tester.componentInstance.prepareForCreation(southConnector, southItemSchema, scanModes);
      tester.detectChanges();
    });

    it('should have an empty form', () => {
      expect(tester.name).toHaveValue('');
      expect(tester.scanMode).toHaveSelectedIndex(-1);
    });

    it('should not save if invalid', () => {
      tester.save.click();

      // name, scan mode
      expect(tester.validationErrors.length).toBe(2);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
    });

    it('should save if valid', fakeAsync(() => {
      tester.name.fillWith('MyName');
      tester.scanMode.selectLabel('scanMode2');

      tester.detectChanges();

      const createdSouthItem = {
        id: 'id1',
        connectorId: 'southId1'
      } as OibusItemDTO;
      southConnectorService.createSouthItem.and.returnValue(of(createdSouthItem));

      tester.save.click();

      const expectedCommand: OibusItemCommandDTO = {
        name: 'MyName',
        scanModeId: 'scanModeId2',
        settings: {}
      };

      expect(southConnectorService.createSouthItem).toHaveBeenCalledWith('southId1', expectedCommand);
      expect(fakeActiveModal.close).toHaveBeenCalledWith(createdSouthItem);
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    const southItem: OibusItemDTO = {
      id: 'id1',
      name: 'myName',
      connectorId: 'southId1',
      scanModeId: 'scanModeId1',
      settings: {}
    };

    beforeEach(() => {
      southConnectorService.getSouthConnectorItem.and.returnValue(of(southItem));
      southConnectorService.updateSouthItem.and.returnValue(of(undefined));

      tester.componentInstance.prepareForEdition(southConnector, southItemSchema, scanModes, southItem);
      tester.detectChanges();
    });

    it('should have a populated form', () => {
      expect(tester.name).toHaveValue(southItem.name);
    });

    it('should not save if invalid', () => {
      tester.name.fillWith('');
      tester.save.click();

      // name
      expect(tester.validationErrors.length).toBe(1);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
    });

    it('should save if valid', fakeAsync(() => {
      tester.name.fillWith('South Item 1 (updated)');
      tester.scanMode.selectLabel('Subscribe');
      tester.save.click();

      const expectedCommand: OibusItemCommandDTO = {
        name: 'South Item 1 (updated)',
        scanModeId: 'scanModeId1',
        settings: {}
      };

      expect(southConnectorService.updateSouthItem).toHaveBeenCalledWith('southId1', 'id1', expectedCommand);
      expect(southConnectorService.getSouthConnectorItem).toHaveBeenCalledWith('southId1', 'id1');
      expect(fakeActiveModal.close).toHaveBeenCalledWith(southItem);
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });
});
