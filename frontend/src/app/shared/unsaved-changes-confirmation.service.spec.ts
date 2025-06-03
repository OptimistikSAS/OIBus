import { TestBed } from '@angular/core/testing';
import { UnsavedChangesConfirmationService } from './unsaved-changes-confirmation.service';
import { ModalService } from './modal.service';
import { UnsavedChangesConfirmationModalComponent } from './form/unsaved-changes-confirmation-modal.component';
import { createMock } from 'ngx-speculoos';
import { of } from 'rxjs';

describe('UnsavedChangesConfirmationService', () => {
  let service: UnsavedChangesConfirmationService;
  let modalService: jasmine.SpyObj<ModalService>;

  beforeEach(() => {
    modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [UnsavedChangesConfirmationService, { provide: ModalService, useValue: modalService }]
    });

    service = TestBed.inject(UnsavedChangesConfirmationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should open unsaved changes confirmation modal', () => {
    const mockModalRef = {
      result: of(true)
    };
    modalService.open.and.returnValue(mockModalRef as any);

    const result = service.confirmUnsavedChanges();

    expect(modalService.open).toHaveBeenCalledWith(UnsavedChangesConfirmationModalComponent, {
      backdrop: 'static'
    });
    expect(result).toBe(mockModalRef.result);
  });

  it('should return modal result observable', done => {
    const mockModalRef = {
      result: of(false)
    };
    modalService.open.and.returnValue(mockModalRef as any);

    service.confirmUnsavedChanges().subscribe(result => {
      expect(result).toBe(false);
      done();
    });
  });
});
