import { TestBed } from '@angular/core/testing';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ConfirmationService } from '../confirmation.service';
import { noAnimation } from '../test-utils';

describe('ConfirmationModalComponent and ConfirmationService', () => {
  let confirmationService: ConfirmationService;
  const modalWindow = page.getByRole('dialog');
  const modalTitle = modalWindow.getByRole('heading');
  const modalBody = modalWindow.getByCss('.modal-body');
  const yesButton = modalWindow.getByRole('button', { name: 'Yes' });
  const noButton = modalWindow.getByRole('button', { name: 'No' });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), noAnimation]
    });
    confirmationService = TestBed.inject(ConfirmationService);
  });

  afterEach(() => TestBed.inject(NgbModal).dismissAll());

  test('should display a modal dialog when confirming and use default title key', async () => {
    confirmationService.confirm({ message: 'Really?' });
    await expect.element(modalTitle).toHaveTextContent('Confirmation');
    await expect.element(modalBody).toHaveTextContent('Really?');
    await expect.element(yesButton).toBeVisible();
    await expect.element(noButton).toBeVisible();
  });

  test('should honor the title option', async () => {
    confirmationService.confirm({ message: 'Really?', title: 'foo' });
    await expect.element(modalTitle).toHaveTextContent('foo');
  });

  test('should honor the titleKey option', async () => {
    confirmationService.confirm({ message: 'Really?', titleKey: 'common.save' });
    await expect.element(modalTitle).toHaveTextContent('Save');
  });

  test('should honor the messageKey option', async () => {
    confirmationService.confirm({ messageKey: 'common.save' });
    await expect.element(modalBody).toHaveTextContent('Save');
  });

  test('should honor the yes and no options', async () => {
    confirmationService.confirm({ message: 'Really?', yes: 'Sure', noKey: 'common.cancel' });
    await expect.element(modalWindow.getByRole('button', { name: 'Sure' })).toBeVisible();
    await expect.element(modalWindow.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('should emit when confirming', async () => {
    const result = firstValueFrom(confirmationService.confirm({ message: 'Really?' }));
    await yesButton.click();
    await expect(result).resolves.toBeUndefined();
    await expect.element(modalWindow).not.toBeInTheDocument();
  });

  test('should error when not confirming and errorOnClose is true', async () => {
    // the expectation is set up before clicking, so that the rejection is handled as soon as it happens
    const rejection = expect(firstValueFrom(confirmationService.confirm({ message: 'Really?', errorOnClose: true }))).rejects.toBe(
      'not confirmed'
    );
    await noButton.click();
    await rejection;
    await expect.element(modalWindow).not.toBeInTheDocument();
  });

  test('should complete without emitting when not confirming and errorOnClose is not set', async () => {
    const result = firstValueFrom(confirmationService.confirm({ message: 'Really?' }), { defaultValue: 'completed' });
    await noButton.click();
    await expect(result).resolves.toBe('completed');
    await expect.element(modalWindow).not.toBeInTheDocument();
  });
});
