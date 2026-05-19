import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, test } from 'vitest';
import { of } from 'rxjs';
import { UnsavedChangesConfirmationService } from './unsaved-changes-confirmation.service';
import { ModalService } from './modal.service';
import { UnsavedChangesConfirmationModalComponent } from './form/unsaved-changes-confirmation-modal.component';
import { createMock, MockObject } from '../../test/vitest-create-mock';

describe('UnsavedChangesConfirmationService', () => {
  let service: UnsavedChangesConfirmationService;
  let modalService: MockObject<ModalService>;

  beforeEach(() => {
    modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [UnsavedChangesConfirmationService, { provide: ModalService, useValue: modalService }]
    });
    service = TestBed.inject(UnsavedChangesConfirmationService);
  });

  test('should be created', () => {
    expect(service).toBeTruthy();
  });

  test('should open unsaved changes confirmation modal', () => {
    const mockModalRef = { result: of(true) };
    modalService.open.mockReturnValue(mockModalRef as any);

    const result = service.confirmUnsavedChanges();

    expect(modalService.open).toHaveBeenCalledWith(UnsavedChangesConfirmationModalComponent, { backdrop: 'static' });
    expect(result).toBe(mockModalRef.result);
  });

  test('should return modal result observable', () => {
    return new Promise<void>(resolve => {
      const mockModalRef = { result: of(false) };
      modalService.open.mockReturnValue(mockModalRef as any);

      service.confirmUnsavedChanges().subscribe(result => {
        expect(result).toBe(false);
        resolve();
      });
    });
  });
});
