import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { EditSouthItemGroupModalComponent } from './edit-south-item-group-modal.component';
import { SouthItemGroupDTO } from '../../../../../../backend/shared/model/south-connector.model';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { of } from 'rxjs';
import testData from '../../../../../../backend/src/tests/utils/test-data';

class EditSouthItemGroupModalComponentTester extends ComponentTester<EditSouthItemGroupModalComponent> {
  constructor() {
    super(EditSouthItemGroupModalComponent);
  }

  get name() {
    return this.input('#name')!;
  }

  get scanMode() {
    return this.select('#scan-mode')!;
  }

  get shareTrackedInstant() {
    return this.input('#share-tracked-instant')!;
  }

  get overlap() {
    return this.input('#overlap')!;
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

describe('EditSouthItemGroupModalComponent', () => {
  let tester: EditSouthItemGroupModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let unsavedChangesConfirmationService: jasmine.SpyObj<UnsavedChangesConfirmationService>;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;

  const southId = 'southId1';
  const scanModes = testData.scanMode.list;
  const manifest = testData.south.manifest;
  const existingGroups: Array<SouthItemGroupDTO> = [
    {
      id: 'group1',
      name: 'Existing Group',
      scanMode: scanModes[0],
      shareTrackedInstant: false,
      overlap: null
    }
  ];

  beforeEach(async () => {
    fakeActiveModal = createMock(NgbActiveModal);
    unsavedChangesConfirmationService = createMock(UnsavedChangesConfirmationService);
    southConnectorService = createMock(SouthConnectorService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesConfirmationService },
        { provide: SouthConnectorService, useValue: southConnectorService }
      ]
    });

    tester = new EditSouthItemGroupModalComponentTester();
  });

  describe('create mode', () => {
    beforeEach(async () => {
      tester.componentInstance.prepareForCreation(southId, scanModes, manifest, existingGroups);
      await tester.change();
    });

    it('should initialize form with empty values', () => {
      expect(tester.name).toHaveValue('');
      expect(tester.componentInstance.form!.controls.scanMode.value).toBeNull();
      expect(tester.shareTrackedInstant).not.toBeChecked();
    });

    it('should require name', async () => {
      tester.name.fillWith('');
      await tester.change();
      tester.save.click();
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
    });

    it('should require scan mode', async () => {
      tester.name.fillWith('New Group');
      await tester.change();
      tester.save.click();
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
    });

    it('should validate name uniqueness', async () => {
      tester.name.fillWith('Existing Group');
      await tester.change();
      expect(tester.componentInstance.form!.controls.name.hasError('mustBeUnique')).toBe(true);
    });

    it('should create group successfully', fakeAsync(async () => {
      const newGroup: SouthItemGroupDTO = {
        id: 'newGroup',
        name: 'New Group',
        scanMode: scanModes[0],
        shareTrackedInstant: false,
        overlap: null
      };
      southConnectorService.createGroup.and.returnValue(of(newGroup));

      tester.name.fillWith('New Group');
      tester.scanMode.selectLabel(scanModes[0].name);
      await tester.change();
      tester.save.click();

      expect(southConnectorService.createGroup).toHaveBeenCalledWith(southId, {
        name: 'New Group',
        scanModeId: scanModes[0].id,
        shareTrackedInstant: false,
        overlap: null
      });
      expect(fakeActiveModal.close).toHaveBeenCalledWith(newGroup);
    }));

    it('should create group with historian capabilities', fakeAsync(async () => {
      const manifestWithHistory = { ...manifest, modes: { ...manifest.modes, history: true } };
      tester.componentInstance.prepareForCreation(southId, scanModes, manifestWithHistory, existingGroups);
      await tester.change();

      const newGroup: SouthItemGroupDTO = {
        id: 'newGroup',
        name: 'New Group',
        scanMode: scanModes[0],
        shareTrackedInstant: true,
        overlap: 100
      };
      southConnectorService.createGroup.and.returnValue(of(newGroup));

      tester.name.fillWith('New Group');
      tester.scanMode.selectLabel(scanModes[0].name);
      tester.shareTrackedInstant.check();
      tester.overlap.fillWith('100');
      await tester.change();
      tester.save.click();

      expect(southConnectorService.createGroup).toHaveBeenCalledWith(southId, {
        name: 'New Group',
        scanModeId: scanModes[0].id,
        shareTrackedInstant: true,
        overlap: 100
      });
    }));

    it('should validate overlap is non-negative', async () => {
      const manifestWithHistory = { ...manifest, modes: { ...manifest.modes, history: true } };
      tester.componentInstance.prepareForCreation(southId, scanModes, manifestWithHistory, existingGroups);
      await tester.change();

      tester.name.fillWith('New Group');
      tester.scanMode.selectLabel(scanModes[0].name);
      tester.overlap.fillWith('-1');
      await tester.change();

      expect(tester.componentInstance.form!.controls.overlap.hasError('min')).toBe(true);
    });

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });

    it('should confirm unsaved changes before dismissing', () => {
      tester.name.fillWith('New Group');
      unsavedChangesConfirmationService.confirmUnsavedChanges.and.returnValue(of(true));

      tester.componentInstance.canDismiss();
      expect(unsavedChangesConfirmationService.confirmUnsavedChanges).toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    const groupToEdit: SouthItemGroupDTO = {
      id: 'group1',
      name: 'Group to Edit',
      scanMode: scanModes[0],
      shareTrackedInstant: false,
      overlap: null
    };

    beforeEach(async () => {
      tester.componentInstance.prepareForEdition(southId, scanModes, manifest, groupToEdit, existingGroups);
      await tester.change();
    });

    it('should initialize form with group values', () => {
      expect(tester.name).toHaveValue('Group to Edit');
      expect(tester.componentInstance.form!.controls.scanMode.value).toBe(scanModes[0].id);
    });

    it('should allow editing same group name', async () => {
      tester.name.fillWith('Group to Edit');
      await tester.change();
      expect(tester.componentInstance.form!.controls.name.hasError('mustBeUnique')).toBe(false);
    });

    it('should update group successfully', fakeAsync(async () => {
      const updatedGroup: SouthItemGroupDTO = {
        id: 'group1',
        name: 'Updated Group',
        scanMode: scanModes[1],
        shareTrackedInstant: true,
        overlap: 50
      };
      southConnectorService.updateGroup.and.returnValue(of(undefined));
      southConnectorService.getGroup.and.returnValue(of(updatedGroup));

      tester.name.fillWith('Updated Group');
      tester.scanMode.selectLabel(scanModes[1].name);
      await tester.change();
      tester.save.click();

      expect(southConnectorService.updateGroup).toHaveBeenCalledWith(southId, 'group1', {
        name: 'Updated Group',
        scanModeId: scanModes[1].id,
        shareTrackedInstant: false,
        overlap: null
      });
      expect(southConnectorService.getGroup).toHaveBeenCalledWith(southId, 'group1');
      expect(fakeActiveModal.close).toHaveBeenCalledWith(updatedGroup);
    }));

    it('should not require confirmation if form is not dirty', () => {
      const result = tester.componentInstance.canDismiss();
      expect(result).toBe(true);
      expect(unsavedChangesConfirmationService.confirmUnsavedChanges).not.toHaveBeenCalled();
    });
  });
});
