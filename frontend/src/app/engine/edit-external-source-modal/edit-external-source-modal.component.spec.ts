import { EditExternalSourceModalComponent } from './edit-external-source-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { MockI18nModule } from '../../../i18n/mock-i18n.spec';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { ExternalSourceService } from '../../services/external-source.service';
import { ExternalSourceCommandDTO, ExternalSourceDTO } from '../../model/external-sources.model';

class EditExternalSourceModalComponentTester extends ComponentTester<EditExternalSourceModalComponent> {
  constructor() {
    super(EditExternalSourceModalComponent);
  }

  get reference() {
    return this.input('#reference')!;
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

describe('EditExternalSourceModalComponent', () => {
  let tester: EditExternalSourceModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let externalSourceService: jasmine.SpyObj<ExternalSourceService>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    externalSourceService = createMock(ExternalSourceService);

    TestBed.configureTestingModule({
      imports: [
        MockI18nModule,
        ReactiveFormsModule,
        HttpClientTestingModule,
        EditExternalSourceModalComponent,
        DefaultValidationErrorsComponent
      ],
      providers: [
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: ExternalSourceService, useValue: externalSourceService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new EditExternalSourceModalComponentTester();
  });

  describe('create mode', () => {
    beforeEach(() => {
      tester.componentInstance.prepareForCreation();
      tester.detectChanges();
    });

    it('should have an empty form', () => {
      expect(tester.reference).toHaveValue('');
      expect(tester.description).toHaveValue('');
    });

    it('should not save if invalid', () => {
      tester.save.click();

      // reference
      expect(tester.validationErrors.length).toBe(1);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
    });

    it('should save if valid', fakeAsync(() => {
      tester.reference.fillWith('ref');
      tester.description.fillWith('desc');

      tester.detectChanges();

      const createdExternalSource = {
        id: 'id1'
      } as ExternalSourceDTO;
      externalSourceService.createExternalSource.and.returnValue(of(createdExternalSource));

      tester.save.click();

      const expectedCommand: ExternalSourceCommandDTO = {
        reference: 'ref',
        description: 'desc'
      };

      expect(externalSourceService.createExternalSource).toHaveBeenCalledWith(expectedCommand);
      expect(fakeActiveModal.close).toHaveBeenCalledWith(createdExternalSource);
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    const externalSourceToUpdate: ExternalSourceDTO = {
      id: 'id1',
      reference: 'ref1',
      description: 'My External source 1'
    };

    beforeEach(() => {
      externalSourceService.getExternalSource.and.returnValue(of(externalSourceToUpdate));

      tester.componentInstance.prepareForEdition(externalSourceToUpdate);
      tester.detectChanges();
    });

    it('should have a populated form', () => {
      expect(tester.reference).toHaveValue(externalSourceToUpdate.reference);
      expect(tester.description).toHaveValue(externalSourceToUpdate.description);
    });

    it('should not save if invalid', () => {
      tester.reference.fillWith('');
      tester.save.click();

      // reference
      expect(tester.validationErrors.length).toBe(1);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
    });

    it('should save if valid', fakeAsync(() => {
      externalSourceService.updateExternalSource.and.returnValue(of(undefined));

      tester.reference.fillWith('External source 1 (updated)');
      tester.description.fillWith('A longer and updated description of my external source');

      tester.save.click();

      const expectedCommand: ExternalSourceCommandDTO = {
        reference: 'External source 1 (updated)',
        description: 'A longer and updated description of my external source'
      };

      expect(externalSourceService.updateExternalSource).toHaveBeenCalledWith('id1', expectedCommand);
      expect(externalSourceService.getExternalSource).toHaveBeenCalledWith('id1');
      expect(fakeActiveModal.close).toHaveBeenCalledWith(externalSourceToUpdate);
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });
});
