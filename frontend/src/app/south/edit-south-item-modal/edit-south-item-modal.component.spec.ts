import { EditSouthItemModalComponent } from './edit-south-item-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import {
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemManifest
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

  get enabled() {
    return this.input('#item-enabled')!;
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

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new EditSouthItemModalComponentTester();
  });

  describe('create mode', () => {
    beforeEach(() => {
      tester.componentInstance.prepareForCreation(southItemSchema, allItems, scanModes);
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

      const command: SouthConnectorItemCommandDTO = {
        id: '',
        enabled: true,
        name: 'MyName',
        scanModeId: 'scanModeId2',
        settings: {}
      };
      tester.save.click();
      expect(fakeActiveModal.close).toHaveBeenCalledWith(command);
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
      tester.componentInstance.prepareForCopy(southItemSchema, scanModes, southItem);
      tester.detectChanges();
      expect(tester.name).toHaveValue('myName-copy');

      tester.name.fillWith('MyName-2');
      tester.scanMode.selectLabel('scanMode2');

      tester.detectChanges();

      const command: SouthConnectorItemCommandDTO = {
        id: '',
        enabled: true,
        name: 'MyName-2',
        scanModeId: 'scanModeId2',
        settings: {}
      };
      tester.save.click();
      expect(fakeActiveModal.close).toHaveBeenCalledWith(command);
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
      tester.componentInstance.prepareForEdition(southItemSchema, allItems, scanModes, southItem);
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

    it('should not save if name already taken', () => {
      tester.name.fillWith('item2');
      tester.save.click();
      // mustBeUnique
      expect(tester.validationErrors.length).toBe(1);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
    });

    it('should not display error if name is same as current item', () => {
      tester.name.fillWith('item');
      tester.save.click();
      // no error since it's the same item
      expect(tester.validationErrors.length).toBe(0);
      expect(fakeActiveModal.close).toHaveBeenCalled();
    });

    it('should save if valid', fakeAsync(() => {
      tester.name.fillWith('South Item 1 (updated)');
      tester.enabled.uncheck();
      tester.scanMode.selectLabel('Subscribe');
      tester.save.click();
      const command: SouthConnectorItemCommandDTO = {
        id: 'id1',
        enabled: false,
        name: 'South Item 1 (updated)',
        scanModeId: 'subscription',
        settings: {}
      };
      expect(fakeActiveModal.close).toHaveBeenCalledWith(command);
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });
});
