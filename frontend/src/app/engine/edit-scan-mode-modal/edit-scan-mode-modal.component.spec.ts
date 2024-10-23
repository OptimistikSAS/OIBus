import { EditScanModeModalComponent } from './edit-scan-mode-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, flush, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { ScanModeService } from '../../services/scan-mode.service';
import { ScanModeCommandDTO, ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

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
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: ScanModeService, useValue: scanModeService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new EditScanModeModalComponentTester();
  });

  describe('create mode', () => {
    beforeEach(() => {
      scanModeService.verifyCron.and.returnValue(of({ nextExecutions: [], humanReadableForm: '' }));
      tester.componentInstance.prepareForCreation();
      tester.detectChanges();
    });

    it('should have an empty form', () => {
      expect(tester.name).toHaveValue('');
      expect(tester.description).toHaveValue('');
      expect(tester.cron).toHaveValue('');
    });

    it('should not save if invalid', fakeAsync(() => {
      // bad name
      tester.name.fillWith('');
      flush();

      tester.save.click();

      expect(tester.validationErrors.length).toBe(2);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();

      // bad cron
      scanModeService.verifyCron.and.returnValue(throwError(() => ({ error: { message: 'bad cron' } })));
      tester.name.fillWith('test');
      tester.cron.fillWith('* * *');
      flush();

      tester.save.click();

      expect(tester.validationErrors.length).toBe(1);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
      expect(tester.validationErrors[0].nativeElement.textContent).toContain('bad cron');
    }));

    it('should save if valid', fakeAsync(() => {
      tester.name.fillWith('test');
      tester.description.fillWith('desc');
      tester.cron.fillWith('* * * * * *');
      flush();

      tester.detectChanges();

      const createdScanMode = {
        id: 'id1'
      } as ScanModeDTO;
      scanModeService.create.and.returnValue(of(createdScanMode));

      tester.save.click();

      const expectedCommand: ScanModeCommandDTO = {
        name: 'test',
        description: 'desc',
        cron: '* * * * * *'
      };

      expect(scanModeService.create).toHaveBeenCalledWith(expectedCommand);
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
      scanModeService.verifyCron.and.returnValue(of({ nextExecutions: [], humanReadableForm: '' }));
      scanModeService.get.and.returnValue(of(scanModeToUpdate));

      tester.componentInstance.prepareForEdition(scanModeToUpdate);
      tester.detectChanges();
    });

    it('should have a populated form', () => {
      expect(tester.name).toHaveValue(scanModeToUpdate.name);
      expect(tester.description).toHaveValue(scanModeToUpdate.description);
      expect(tester.cron).toHaveValue(scanModeToUpdate.cron);
    });

    it('should not save if invalid', fakeAsync(() => {
      // bad name
      tester.name.fillWith('');
      flush();

      tester.save.click();

      expect(tester.validationErrors.length).toBe(1);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();

      // bad cron
      scanModeService.verifyCron.and.returnValue(throwError(() => ({ error: { message: 'bad cron' } })));
      tester.name.fillWith('test');
      tester.cron.fillWith('* * *');
      flush();

      tester.save.click();

      expect(tester.validationErrors.length).toBe(1);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
      expect(tester.validationErrors[0].nativeElement.textContent).toContain('bad cron');
    }));

    it('should save if valid', fakeAsync(() => {
      scanModeService.update.and.returnValue(of(undefined));

      tester.name.fillWith('Scan Mode 1 (updated)');
      tester.description.fillWith('A longer and updated description of my Scan Mode');
      tester.cron.fillWith('*/10 * * * * *');
      flush();
      tester.save.click();

      const expectedCommand: ScanModeCommandDTO = {
        name: 'Scan Mode 1 (updated)',
        description: 'A longer and updated description of my Scan Mode',
        cron: '*/10 * * * * *'
      };

      expect(scanModeService.update).toHaveBeenCalledWith('id1', expectedCommand);
      expect(scanModeService.get).toHaveBeenCalledWith('id1');
      expect(fakeActiveModal.close).toHaveBeenCalledWith(scanModeToUpdate);
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });
});
