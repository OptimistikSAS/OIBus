import { EditHistoryQueryItemModalComponent } from './edit-history-query-item-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { HistoryQueryItemDTO } from '../../../../../../backend/shared/model/history-query.model';
import { SouthItemSettings } from '../../../../../../backend/shared/model/south-settings.model';
import { provideHttpClient } from '@angular/common/http';
import testData from '../../../../../../backend/src/tests/utils/test-data';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { of } from 'rxjs';

class EditHistoryQueryItemModalComponentTester extends ComponentTester<EditHistoryQueryItemModalComponent> {
  constructor() {
    super(EditHistoryQueryItemModalComponent);
  }

  get name() {
    return this.input('#name')!;
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

describe('EditHistoryQueryItemModalComponent', () => {
  let tester: EditHistoryQueryItemModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let unsavedChangesConfirmationService: jasmine.SpyObj<UnsavedChangesConfirmationService>;

  const historyId = 'historyId';
  const southConnectorCommand = testData.south.command;
  const manifest = testData.south.manifest;
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
    unsavedChangesConfirmationService = createMock(UnsavedChangesConfirmationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClient(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesConfirmationService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new EditHistoryQueryItemModalComponentTester();
  });

  describe('create mode', () => {
    beforeEach(() => {
      tester.componentInstance.prepareForCreation(allItems, historyId, southConnectorCommand, manifest);
      tester.detectChanges();
    });

    it('should have an empty form', () => {
      expect(tester.name).toHaveValue('');
    });

    it('should not save if invalid', () => {
      tester.save.click();

      // name
      expect(tester.validationErrors.length).toBe(1);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
    });

    it('should save if valid', fakeAsync(() => {
      tester.name.fillWith('MyName');
      tester.detectChanges();

      tester.save.click();
      expect(fakeActiveModal.close).toHaveBeenCalledWith({
        id: '',
        enabled: true,
        name: 'MyName',
        settings: { objectArray: [], objectSettings: {}, objectValue: 1 }
      });
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('copy mode', () => {
    const southItem: HistoryQueryItemDTO<SouthItemSettings> = {
      id: 'id1',
      name: 'myName',
      enabled: true,
      settings: {} as SouthItemSettings
    };

    it('should duplicate item', () => {
      tester.componentInstance.prepareForCopy(allItems, southItem, historyId, southConnectorCommand, manifest);
      tester.detectChanges();
      expect(tester.name).toHaveValue('myName-copy');

      tester.name.fillWith('MyName-2');

      tester.detectChanges();

      tester.save.click();
      expect(fakeActiveModal.close).toHaveBeenCalledWith({
        id: '',
        enabled: true,
        name: 'MyName-2',
        settings: { objectArray: [], objectSettings: {}, objectValue: 1 }
      });
    });
  });

  describe('edit mode', () => {
    const southItem: HistoryQueryItemDTO<SouthItemSettings> = {
      id: 'id1',
      name: 'myName',
      enabled: true,
      settings: {} as SouthItemSettings
    };

    beforeEach(() => {
      tester.componentInstance.prepareForEdition(allItems, southItem, historyId, southConnectorCommand, manifest, 0);
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
      tester.save.click();
      expect(fakeActiveModal.close).toHaveBeenCalledWith({
        id: 'id1',
        enabled: false,
        name: 'South Item 1 (updated)',
        settings: { objectArray: [], objectSettings: {}, objectValue: 1 }
      });
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('unsaved changes', () => {
    beforeEach(() => {
      tester.componentInstance.prepareForCreation(allItems, historyId, southConnectorCommand, manifest);
      tester.detectChanges();
    });

    it('should return true from canDismiss when form is pristine', () => {
      const result = tester.componentInstance.canDismiss();
      expect(result).toBe(true);
    });

    it('should return observable from canDismiss when form is dirty', () => {
      tester.name.fillWith('test name');
      tester.detectChanges();

      unsavedChangesConfirmationService.confirmUnsavedChanges.and.returnValue(of(true));

      const result = tester.componentInstance.canDismiss();

      expect(result).toBeInstanceOf(Object);
      expect(unsavedChangesConfirmationService.confirmUnsavedChanges).toHaveBeenCalled();
    });

    it('should allow dismissal when user confirms leaving', () => {
      tester.name.fillWith('test name');
      tester.detectChanges();

      unsavedChangesConfirmationService.confirmUnsavedChanges.and.returnValue(of(true));

      const result = tester.componentInstance.canDismiss();

      if (typeof result !== 'boolean') {
        result.subscribe(canDismiss => {
          expect(canDismiss).toBe(true);
        });
      }
    });

    it('should prevent dismissal when user cancels leaving', () => {
      tester.name.fillWith('test name');
      tester.detectChanges();

      unsavedChangesConfirmationService.confirmUnsavedChanges.and.returnValue(of(false));

      const result = tester.componentInstance.canDismiss();

      if (typeof result !== 'boolean') {
        result.subscribe(canDismiss => {
          expect(canDismiss).toBe(false);
        });
      }
    });
  });
});
