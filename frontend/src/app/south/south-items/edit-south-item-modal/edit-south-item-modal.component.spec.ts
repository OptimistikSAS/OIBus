import { EditSouthItemModalComponent } from './edit-south-item-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { SouthConnectorItemDTO } from '../../../../../../backend/shared/model/south-connector.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { SouthFolderScannerItemSettings } from '../../../../../../backend/shared/model/south-settings.model';
import testData from '../../../../../../backend/src/tests/utils/test-data';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { of } from 'rxjs';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { provideHttpClientTesting } from '@angular/common/http/testing';

class EditSouthItemModalComponentTester extends ComponentTester<EditSouthItemModalComponent> {
  constructor() {
    super(EditSouthItemModalComponent);
  }

  get name() {
    return this.input('#name')!;
  }

  get scanMode() {
    return this.select('#scan-mode')!;
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
  let unsavedChangesConfirmationService: jasmine.SpyObj<UnsavedChangesConfirmationService>;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;

  const southId = 'southId';
  const southConnectorCommand = testData.south.command;
  const manifest = testData.south.manifest;
  const allItems: Array<SouthConnectorItemDTO> = [
    {
      id: 'id1',
      enabled: true,
      name: 'item',
      scanMode: testData.scanMode.list[0],
      settings: { regex: '*', minAge: 100, preserveFiles: true } as SouthFolderScannerItemSettings,
      group: null
    },
    {
      id: 'id2',
      enabled: true,
      name: 'item2',
      scanMode: testData.scanMode.list[0],
      settings: { regex: '*', minAge: 100, preserveFiles: true } as SouthFolderScannerItemSettings,
      group: null
    }
  ];
  const scanModes = testData.scanMode.list;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    unsavedChangesConfirmationService = createMock(UnsavedChangesConfirmationService);
    southConnectorService = createMock(SouthConnectorService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClientTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesConfirmationService },
        { provide: SouthConnectorService, useValue: southConnectorService }
      ]
    });

    southConnectorService.getGroups.and.returnValue(of([]));

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new EditSouthItemModalComponentTester();
  });

  describe('create mode', () => {
    beforeEach(async () => {
      tester.componentInstance.prepareForCreation(allItems, scanModes, [], southId, southConnectorCommand, manifest);
      await tester.change();
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

    it('should save if valid', fakeAsync(async () => {
      tester.name.fillWith('MyName');
      tester.scanMode.selectLabel('scanMode2');

      await tester.change();

      tester.save.click();
      expect(fakeActiveModal.close).toHaveBeenCalledWith({
        id: '',
        enabled: true,
        name: 'MyName',
        scanMode: testData.scanMode.list[1],
        settings: {
          objectArray: [],
          objectSettings: {},
          objectValue: 1
        },
        group: null
      });
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });

    it('should return true from canDismiss when form is pristine', () => {
      const result = tester.componentInstance.canDismiss();
      expect(result).toBe(true);
    });

    it('should return observable from canDismiss when form is dirty', async () => {
      tester.name.fillWith('test name');
      await tester.change();

      unsavedChangesConfirmationService.confirmUnsavedChanges.and.returnValue(of(true));

      const result = tester.componentInstance.canDismiss();

      expect(result).toBeInstanceOf(Object); // Observable
      expect(unsavedChangesConfirmationService.confirmUnsavedChanges).toHaveBeenCalled();
    });

    it('should call unsaved changes service when form is dirty and canDismiss is called', async () => {
      // Make form dirty
      tester.name.fillWith('test name');
      await tester.change();

      unsavedChangesConfirmationService.confirmUnsavedChanges.and.returnValue(of(false));

      const result = tester.componentInstance.canDismiss();

      if (typeof result !== 'boolean') {
        result.subscribe(canDismiss => {
          expect(canDismiss).toBe(false);
        });
      }

      expect(unsavedChangesConfirmationService.confirmUnsavedChanges).toHaveBeenCalled();
    });

    it('should allow dismissal when user confirms leaving', async () => {
      tester.name.fillWith('test name');
      await tester.change();

      unsavedChangesConfirmationService.confirmUnsavedChanges.and.returnValue(of(true));

      const result = tester.componentInstance.canDismiss();

      if (typeof result !== 'boolean') {
        result.subscribe(canDismiss => {
          expect(canDismiss).toBe(true);
        });
      }
    });

    it('should prevent dismissal when user cancels leaving', async () => {
      tester.name.fillWith('test name');
      await tester.change();

      unsavedChangesConfirmationService.confirmUnsavedChanges.and.returnValue(of(false));

      const result = tester.componentInstance.canDismiss();

      if (typeof result !== 'boolean') {
        result.subscribe(canDismiss => {
          expect(canDismiss).toBe(false);
        });
      }
    });
  });

  describe('copy mode', () => {
    const southItem: SouthConnectorItemDTO = {
      id: 'id1',
      name: 'myName',
      enabled: true,
      scanMode: testData.scanMode.list[0],
      settings: { regex: '*', minAge: 100, preserveFiles: true } as SouthFolderScannerItemSettings,
      group: null
    };

    it('should duplicate item', async () => {
      tester.componentInstance.prepareForCopy(allItems, scanModes, [], southItem, southId, southConnectorCommand, manifest);
      await tester.change();
      expect(tester.name).toHaveValue('myName-copy');

      tester.name.fillWith('MyName-2');
      tester.scanMode.selectLabel('scanMode2');

      await tester.change();

      tester.save.click();
      expect(fakeActiveModal.close).toHaveBeenCalledWith({
        id: '',
        enabled: true,
        name: 'MyName-2',
        scanMode: testData.scanMode.list[1],
        settings: {
          objectArray: [],
          objectSettings: {},
          objectValue: 1
        },
        group: null
      });
    });
  });

  describe('edit mode', () => {
    const southItem: SouthConnectorItemDTO = {
      id: 'id1',
      name: 'myName',
      enabled: true,
      scanMode: testData.scanMode.list[0],
      settings: { regex: '*', minAge: 100, preserveFiles: true } as SouthFolderScannerItemSettings,
      group: null
    };

    beforeEach(async () => {
      tester.componentInstance.prepareForEdition(allItems, scanModes, [], southItem, southId, southConnectorCommand, manifest, 0);
      await tester.change();
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
      tester.scanMode.selectLabel('scanMode2');
      tester.save.click();

      expect(fakeActiveModal.close).toHaveBeenCalledWith({
        id: 'id1',
        enabled: false,
        name: 'South Item 1 (updated)',
        scanMode: { id: 'scanModeId2', name: 'scanMode2', description: 'my second scanMode', cron: '0 * * * * *' },
        settings: {
          objectArray: [],
          objectSettings: {},
          objectValue: 1
        },
        group: null
      });
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });
});
