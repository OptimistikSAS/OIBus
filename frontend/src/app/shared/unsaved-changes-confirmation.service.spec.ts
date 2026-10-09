import { TestBed } from '@angular/core/testing';

import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createMock } from '../../test/vitest-create-mock';
import { UnsavedChangesConfirmationModalComponent } from './form/unsaved-changes-confirmation-modal.component';
import { MockModalService, provideModalTesting } from './mock-modal.service.testing';
import { UnsavedChangesConfirmationService } from './unsaved-changes-confirmation.service';

describe('UnsavedChangesConfirmationService', () => {
  let service: UnsavedChangesConfirmationService;
  let modalService: MockModalService<UnsavedChangesConfirmationModalComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideModalTesting()] });
    modalService = TestBed.inject(MockModalService);
    service = TestBed.inject(UnsavedChangesConfirmationService);
  });

  test.each([true, false])('should open a static modal and return its result (%s)', async leave => {
    modalService.mockClosedModal(createMock(UnsavedChangesConfirmationModalComponent), leave);
    vi.spyOn(modalService, 'open');

    const result = await firstValueFrom(service.confirmUnsavedChanges());

    expect(modalService.open).toHaveBeenCalledWith(UnsavedChangesConfirmationModalComponent, { backdrop: 'static' });
    expect(result).toBe(leave);
  });
});
