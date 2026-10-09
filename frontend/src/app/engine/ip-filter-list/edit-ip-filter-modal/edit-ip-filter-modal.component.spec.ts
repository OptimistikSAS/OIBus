import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { isObservable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { IPFilterDTO } from '@oibus/shared/api/ip-filter.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { catchUnhandledErrors } from '../../../../test/unhandled-errors';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { IpFilterService } from '../../../services/ip-filter.service';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { EditIpFilterModalComponent } from './edit-ip-filter-modal.component';

class EditIpFilterModalComponentTester {
  readonly fixture = TestBed.createComponent(EditIpFilterModalComponent);
  readonly componentInstance = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading');
  readonly address = this.root.getByLabelText('Address');
  readonly description = this.root.getByLabelText('Description');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });
}

const ipFilter: IPFilterDTO = testData.ipFilters.list[0];

describe('EditIpFilterModalComponent', () => {
  let ipFilterService: MockObject<IpFilterService>;
  let activeModal: MockObject<NgbActiveModal>;
  let unsavedChangesConfirmationService: MockObject<UnsavedChangesConfirmationService>;

  beforeEach(() => {
    ipFilterService = createMock(IpFilterService);
    activeModal = createMock(NgbActiveModal);
    unsavedChangesConfirmationService = createMock(UnsavedChangesConfirmationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: IpFilterService, useValue: ipFilterService },
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesConfirmationService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  describe('create mode', () => {
    let tester: EditIpFilterModalComponentTester;

    beforeEach(() => {
      tester = new EditIpFilterModalComponentTester();
      tester.componentInstance.prepareForCreation();
    });

    test('should display an empty form', async () => {
      await expect.element(tester.title).toHaveTextContent('Create an IP filter');
      await expect.element(tester.address).toHaveValue('');
      await expect.element(tester.description).toHaveValue('');
    });

    test('should not create an ip filter without address', async () => {
      await tester.saveButton.click();

      await expect.element(tester.root.getByText('This field is required')).toBeInTheDocument();
      expect(ipFilterService.create).not.toHaveBeenCalled();
    });

    test('should create an ip filter', async () => {
      const createdFilter: IPFilterDTO = { ...ipFilter, id: 'new-id', address: '10.0.0.1' };
      ipFilterService.create.mockReturnValue(of(createdFilter));

      await tester.address.fill('10.0.0.1');
      await tester.description.fill('test');
      await tester.saveButton.click();

      expect(ipFilterService.create).toHaveBeenCalledWith({ address: '10.0.0.1', description: 'test' });
      expect(activeModal.close).toHaveBeenCalledWith(createdFilter);
    });

    test('should keep the modal open when the creation fails', async () => {
      const unhandledError = catchUnhandledErrors();
      ipFilterService.create.mockReturnValue(throwError(() => new Error('boom')));

      await tester.address.fill('10.0.0.1');
      await tester.saveButton.click();

      await vi.waitFor(() => expect(unhandledError).toHaveBeenCalledWith(new Error('boom')));
      expect(activeModal.close).not.toHaveBeenCalled();
      await expect.element(tester.saveButton).toBeEnabled();
    });

    test('should cancel', async () => {
      await tester.cancelButton.click();

      expect(activeModal.dismiss).toHaveBeenCalled();
    });

    test('should allow dismissal without confirmation when the form is pristine', () => {
      expect(tester.componentInstance.canDismiss()).toBe(true);
    });

    test('should ask for a confirmation before dismissing a modified form', async () => {
      unsavedChangesConfirmationService.confirmUnsavedChanges.mockReturnValue(of(true));
      await tester.address.fill('10.0.0.1');

      expect(isObservable(tester.componentInstance.canDismiss())).toBe(true);
      expect(unsavedChangesConfirmationService.confirmUnsavedChanges).toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    let tester: EditIpFilterModalComponentTester;

    beforeEach(() => {
      ipFilterService.update.mockReturnValue(of(undefined));
      tester = new EditIpFilterModalComponentTester();
      tester.componentInstance.prepareForEdition(ipFilter);
    });

    test('should populate the form', async () => {
      await expect.element(tester.title).toHaveTextContent('Edit IP filter');
      await expect.element(tester.address).toHaveValue('192.168.1.1');
      await expect.element(tester.description).toHaveValue('my first ip filter');
      expect(tester.componentInstance.canDismiss()).toBe(true);
    });

    test('should update an ip filter', async () => {
      const updatedFilter: IPFilterDTO = { ...ipFilter, address: 'new-address' };
      ipFilterService.findById.mockReturnValue(of(updatedFilter));

      await tester.address.fill('new-address');
      await tester.saveButton.click();

      expect(ipFilterService.update).toHaveBeenCalledWith('ipFilterId1', { address: 'new-address', description: 'my first ip filter' });
      expect(ipFilterService.findById).toHaveBeenCalledWith('ipFilterId1');
      expect(activeModal.close).toHaveBeenCalledWith(updatedFilter);
    });

    test('should keep the modal open when the update fails', async () => {
      const unhandledError = catchUnhandledErrors();
      ipFilterService.update.mockReturnValue(throwError(() => new Error('boom')));

      await tester.saveButton.click();

      await vi.waitFor(() => expect(unhandledError).toHaveBeenCalledWith(new Error('boom')));
      expect(ipFilterService.findById).not.toHaveBeenCalled();
      expect(activeModal.close).not.toHaveBeenCalled();
    });
  });
});
