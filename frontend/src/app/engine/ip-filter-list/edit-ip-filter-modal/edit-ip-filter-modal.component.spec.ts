import { EditIpFilterModalComponent } from './edit-ip-filter-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { IpFilterService } from '../../../services/ip-filter.service';
import { IPFilterCommandDTO, IPFilterDTO } from '../../../../../../backend/shared/model/ip-filter.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';

class EditIpFilterModalComponentTester extends ComponentTester<EditIpFilterModalComponent> {
  constructor() {
    super(EditIpFilterModalComponent);
  }

  get address() {
    return this.input('#address')!;
  }

  get description() {
    return this.textarea('#description')!;
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

describe('EditIpFilterModalComponent', () => {
  let tester: EditIpFilterModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let ipFilterService: jasmine.SpyObj<IpFilterService>;
  let unsavedChangesConfirmationService: jasmine.SpyObj<UnsavedChangesConfirmationService>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    ipFilterService = createMock(IpFilterService);
    unsavedChangesConfirmationService = createMock(UnsavedChangesConfirmationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: IpFilterService, useValue: ipFilterService },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesConfirmationService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new EditIpFilterModalComponentTester();
  });

  describe('create mode', () => {
    beforeEach(async () => {
      tester.componentInstance.prepareForCreation();
      await tester.change();
    });

    it('should have an empty form', () => {
      expect(tester.address).toHaveValue('');
      expect(tester.description).toHaveValue('');
    });

    it('should not save if invalid', () => {
      tester.save.click();

      // address
      expect(tester.validationErrors.length).toBe(1);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
    });

    it('should save if valid', fakeAsync(async () => {
      tester.address.fillWith('127.0.0.1');
      tester.description.fillWith('desc');

      await tester.change();

      const createdProxy = {
        id: 'id1'
      } as IPFilterDTO;
      ipFilterService.create.and.returnValue(of(createdProxy));

      tester.save.click();

      const expectedCommand: IPFilterCommandDTO = {
        address: '127.0.0.1',
        description: 'desc'
      };

      expect(ipFilterService.create).toHaveBeenCalledWith(expectedCommand);
      expect(fakeActiveModal.close).toHaveBeenCalledWith(createdProxy);
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    const ipFilterToUpdate: IPFilterDTO = {
      id: 'id1',
      address: '127.0.0.1',
      description: 'My IP Filter 1'
    };

    beforeEach(async () => {
      ipFilterService.findById.and.returnValue(of(ipFilterToUpdate));

      tester.componentInstance.prepareForEdition(ipFilterToUpdate);
      await tester.change();
    });

    it('should have a populated form', () => {
      expect(tester.address).toHaveValue(ipFilterToUpdate.address);
      expect(tester.description).toHaveValue(ipFilterToUpdate.description);
    });

    it('should not save if invalid', () => {
      tester.address.fillWith('');
      tester.save.click();

      // address
      expect(tester.validationErrors.length).toBe(1);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
    });

    it('should save if valid', fakeAsync(() => {
      ipFilterService.update.and.returnValue(of(undefined));

      tester.address.fillWith('192.168.0.1');
      tester.description.fillWith('A longer and updated description of my IP filter');

      tester.save.click();

      const expectedCommand: IPFilterCommandDTO = {
        address: '192.168.0.1',
        description: 'A longer and updated description of my IP filter'
      };

      expect(ipFilterService.update).toHaveBeenCalledWith('id1', expectedCommand);
      expect(ipFilterService.findById).toHaveBeenCalledWith('id1');
      expect(fakeActiveModal.close).toHaveBeenCalledWith(ipFilterToUpdate);
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('unsaved changes', () => {
    beforeEach(async () => {
      tester.componentInstance.prepareForCreation();
      await tester.change();
    });

    it('should return true from canDismiss when form is pristine', () => {
      const result = tester.componentInstance.canDismiss();
      expect(result).toBe(true);
    });

    it('should return observable from canDismiss when form is dirty', async () => {
      tester.address.fillWith('test address');
      await tester.change();

      unsavedChangesConfirmationService.confirmUnsavedChanges.and.returnValue(of(true));

      const result = tester.componentInstance.canDismiss();

      expect(result).toBeInstanceOf(Object); // Observable
      expect(unsavedChangesConfirmationService.confirmUnsavedChanges).toHaveBeenCalled();
    });

    it('should allow dismissal when user confirms leaving', async () => {
      tester.address.fillWith('test address');
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
      tester.address.fillWith('test address');
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
});
