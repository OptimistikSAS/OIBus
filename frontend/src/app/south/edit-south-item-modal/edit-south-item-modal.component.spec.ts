import { EditSouthItemModalComponent } from './edit-south-item-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { SouthConnectorService } from '../../services/south-connector.service';
import {
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemManifest,
  SouthConnectorDTO
} from '../../../../../shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

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
    history: {
      maxInstantPerItem: false,
      maxReadInterval: 0,
      readDelay: 200
    },
    settings: []
  };

  const southItemSchema: SouthConnectorItemManifest = {
    scanMode: { subscriptionOnly: false, acceptSubscription: true },
    settings: [],
    schema: []
  } as SouthConnectorItemManifest;
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
      providers: [
        provideI18nTesting(),
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
      expect(tester.scanMode).toHaveSelectedIndex(0);
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
      } as SouthConnectorItemDTO;
      southConnectorService.createItem.and.returnValue(of(createdSouthItem));

      tester.save.click();

      const expectedCommand: SouthConnectorItemCommandDTO = {
        name: 'MyName',
        scanModeId: 'scanModeId2',
        settings: {}
      };

      expect(southConnectorService.createItem).toHaveBeenCalledWith('southId1', expectedCommand);
      expect(fakeActiveModal.close).toHaveBeenCalledWith(createdSouthItem);
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('copy mode', () => {
    const southItem: SouthConnectorItemDTO = {
      id: 'id1',
      name: 'myName',
      enabled: true,
      connectorId: 'southId1',
      scanModeId: 'scanModeId1',
      settings: {}
    };

    it('should duplicate item', () => {
      tester.componentInstance.prepareForCopy(southConnector, southItemSchema, scanModes, southItem);
      tester.detectChanges();
      expect(tester.name).toHaveValue('myName-copy');

      tester.name.fillWith('MyName-2');
      tester.scanMode.selectLabel('scanMode2');

      tester.detectChanges();

      const createdSouthItem = {
        id: 'id1',
        connectorId: 'southId1'
      } as SouthConnectorItemDTO;
      southConnectorService.createItem.and.returnValue(of(createdSouthItem));

      tester.save.click();

      const expectedCommand: SouthConnectorItemCommandDTO = {
        name: 'MyName-2',
        scanModeId: 'scanModeId2',
        settings: {}
      };

      expect(southConnectorService.createItem).toHaveBeenCalledWith('southId1', expectedCommand);
      expect(fakeActiveModal.close).toHaveBeenCalledWith(createdSouthItem);
    });
  });

  describe('edit mode', () => {
    const southItem: SouthConnectorItemDTO = {
      id: 'id1',
      name: 'myName',
      enabled: true,
      connectorId: 'southId1',
      scanModeId: 'scanModeId1',
      settings: {}
    };

    beforeEach(() => {
      southConnectorService.getItem.and.returnValue(of(southItem));
      southConnectorService.updateItem.and.returnValue(of(undefined));

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

      const expectedCommand: SouthConnectorItemCommandDTO = {
        name: 'South Item 1 (updated)',
        scanModeId: 'scanModeId1',
        settings: {}
      };

      expect(southConnectorService.updateItem).toHaveBeenCalledWith('southId1', 'id1', expectedCommand);
      expect(southConnectorService.getItem).toHaveBeenCalledWith('southId1', 'id1');
      expect(fakeActiveModal.close).toHaveBeenCalledWith(southItem);
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });
});
