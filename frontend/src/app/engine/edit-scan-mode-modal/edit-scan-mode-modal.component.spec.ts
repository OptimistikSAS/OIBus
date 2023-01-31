import { EditScanModeModalComponent } from './edit-scan-mode-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { MockI18nModule } from '../../../i18n/mock-i18n.spec';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { ScanModeService } from '../../services/scan-mode.service';
import { ScanModeCommandDTO, ScanModeDTO } from '../../../../../shared/model/scan-mode.model';

class EditScanModeModalComponentTester extends ComponentTester<EditScanModeModalComponent> {
  constructor() {
    super(EditScanModeModalComponent);
  }

  get name() {
    return this.input('#name')!;
  }

  get description() {
    return this.textarea('#description')!;
  }

  get cron() {
    return this.input('#cron')!;
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

describe('EditScanModeModalComponent', () => {
  let tester: EditScanModeModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let scanModeService: jasmine.SpyObj<ScanModeService>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    scanModeService = createMock(ScanModeService);

    TestBed.configureTestingModule({
      imports: [MockI18nModule, ReactiveFormsModule, HttpClientTestingModule, EditScanModeModalComponent, DefaultValidationErrorsComponent],
      providers: [
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: ScanModeService, useValue: scanModeService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new EditScanModeModalComponentTester();
  });

  describe('create mode', () => {
    beforeEach(() => {
      tester.componentInstance.prepareForCreation();
      tester.detectChanges();
    });

    it('should have an empty form', () => {
      expect(tester.name).toHaveValue('');
      expect(tester.description).toHaveValue('');
      expect(tester.cron).toHaveValue('');
    });

    it('should not save if invalid', () => {
      tester.save.click();

      // name, cron
      expect(tester.validationErrors.length).toBe(2);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
    });

    it('should save if valid', fakeAsync(() => {
      tester.name.fillWith('test');
      tester.description.fillWith('desc');
      tester.cron.fillWith('* * * * * *');

      tester.detectChanges();

      const createdScanMode = {
        id: 'id1'
      } as ScanModeDTO;
      scanModeService.createScanMode.and.returnValue(of(createdScanMode));

      tester.save.click();

      const expectedCommand: ScanModeCommandDTO = {
        name: 'test',
        description: 'desc',
        cron: '* * * * * *'
      };

      expect(scanModeService.createScanMode).toHaveBeenCalledWith(expectedCommand);
      expect(fakeActiveModal.close).toHaveBeenCalledWith(createdScanMode);
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    const scanModeToUpdate: ScanModeDTO = {
      id: 'id1',
      name: 'proxy1',
      description: 'My Proxy 1',
      cron: '* * * * * *'
    };

    beforeEach(() => {
      scanModeService.getScanMode.and.returnValue(of(scanModeToUpdate));

      tester.componentInstance.prepareForEdition(scanModeToUpdate);
      tester.detectChanges();
    });

    it('should have a populated form', () => {
      expect(tester.name).toHaveValue(scanModeToUpdate.name);
      expect(tester.description).toHaveValue(scanModeToUpdate.description);
    });

    it('should not save if invalid', () => {
      tester.name.fillWith('');
      tester.save.click();

      // name
      expect(tester.validationErrors.length).toBe(1);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
    });

    it('should save if valid', fakeAsync(() => {
      scanModeService.updateScanMode.and.returnValue(of(undefined));

      tester.name.fillWith('Scan Mode 1 (updated)');
      tester.description.fillWith('A longer and updated description of my Scan Mode');

      tester.save.click();

      const expectedCommand: ScanModeCommandDTO = {
        name: 'Scan Mode 1 (updated)',
        description: 'A longer and updated description of my Scan Mode',
        cron: scanModeToUpdate.cron
      };

      expect(scanModeService.updateScanMode).toHaveBeenCalledWith('id1', expectedCommand);
      expect(scanModeService.getScanMode).toHaveBeenCalledWith('id1');
      expect(fakeActiveModal.close).toHaveBeenCalledWith(scanModeToUpdate);
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });
});
