import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';

import { provideI18nTesting } from '../../i18n/mock-i18n';
import { createMock } from '../../test/vitest-create-mock';
import { ConfirmationOptions, ConfirmationService } from './confirmation.service';
import { ConfirmationModalComponent } from './confirmation-modal/confirmation-modal.component';
import { MockModalService, provideModalTesting } from './mock-modal.service.testing';

describe('ConfirmationService', () => {
  let confirmationService: ConfirmationService;
  let mockModalService: MockModalService<ConfirmationModalComponent>;
  let confirmationModalComponent: ConfirmationModalComponent;
  const commonOptions = { message: 'world', title: 'Hello' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideModalTesting(), { provide: NgbActiveModal, useValue: createMock(NgbActiveModal) }]
    });
    mockModalService = TestBed.inject(MockModalService);
    confirmationService = TestBed.inject(ConfirmationService);
    confirmationModalComponent = TestBed.runInInjectionContext(() => new ConfirmationModalComponent());
  });

  test('should create a modal instance with title, message, yes and no', async () => {
    mockModalService.mockClosedModal(confirmationModalComponent);

    const result = firstValueFrom(confirmationService.confirm({ ...commonOptions, yes: 'Yep', no: 'Nope' }));

    expect(confirmationModalComponent.title()).toBe('Hello');
    expect(confirmationModalComponent.message()).toBe('world');
    expect(confirmationModalComponent.yes()).toBe('Yep');
    expect(confirmationModalComponent.no()).toBe('Nope');
    await expect(result).resolves.toBe('');
  });

  test('should create a modal instance with i18n title, message, yes and no', async () => {
    mockModalService.mockClosedModal(confirmationModalComponent);

    const options: ConfirmationOptions = {
      titleKey: 'common.save',
      messageKey: 'common.forbidden',
      interpolateParams: { url: '/south' },
      yesKey: 'common.cancel',
      noKey: 'common.delete'
    };
    const result = firstValueFrom(confirmationService.confirm(options));

    expect(confirmationModalComponent.title()).toBe('Save');
    expect(confirmationModalComponent.message()).toBe(`You don't have the access rights for this entity.\n/south`);
    expect(confirmationModalComponent.yes()).toBe('Cancel');
    expect(confirmationModalComponent.no()).toBe('Delete');
    await expect(result).resolves.toBe('');
  });

  test('should use default title, yes and no keys', async () => {
    mockModalService.mockClosedModal(confirmationModalComponent);

    const result = firstValueFrom(confirmationService.confirm({ message: 'Hello' }));

    expect(confirmationModalComponent.title()).toBe('Confirmation');
    expect(confirmationModalComponent.message()).toBe('Hello');
    expect(confirmationModalComponent.yes()).toBe('Yes');
    expect(confirmationModalComponent.no()).toBe('No');
    await expect(result).resolves.toBe('');
  });

  test('should complete without emitting on No', async () => {
    mockModalService.mockDismissedModal(confirmationModalComponent);

    const result = firstValueFrom(confirmationService.confirm(commonOptions), { defaultValue: 'completed' });

    await expect(result).resolves.toBe('completed');
  });

  test('should emit an error on No if options says so', async () => {
    mockModalService.mockDismissedWithErrorModal(confirmationModalComponent);

    const options: ConfirmationOptions = { ...commonOptions, errorOnClose: true };

    await expect(firstValueFrom(confirmationService.confirm(options))).rejects.toBe('not-confirmed');
  });
});
