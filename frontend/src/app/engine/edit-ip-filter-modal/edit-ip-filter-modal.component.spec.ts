import { EditIpFilterModalComponent } from './edit-ip-filter-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { IpFilterService } from '../../services/ip-filter.service';
import { IPFilterCommandDTO, IPFilterDTO } from '../../../../../backend/shared/model/ip-filter.model';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

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

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    ipFilterService = createMock(IpFilterService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: IpFilterService, useValue: ipFilterService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new EditIpFilterModalComponentTester();
  });

  describe('create mode', () => {
    beforeEach(() => {
      tester.componentInstance.prepareForCreation();
      tester.detectChanges();
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

    it('should save if valid', fakeAsync(() => {
      tester.address.fillWith('127.0.0.1');
      tester.description.fillWith('desc');

      tester.detectChanges();

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

    beforeEach(() => {
      ipFilterService.get.and.returnValue(of(ipFilterToUpdate));

      tester.componentInstance.prepareForEdition(ipFilterToUpdate);
      tester.detectChanges();
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
      expect(ipFilterService.get).toHaveBeenCalledWith('id1');
      expect(fakeActiveModal.close).toHaveBeenCalledWith(ipFilterToUpdate);
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });
});
