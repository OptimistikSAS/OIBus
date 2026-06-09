import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { noAnimation } from '../test-utils';
import { ConfirmationService } from '../confirmation.service';

@Component({ selector: 'oib-test-confirmation', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class TestComponent {}

describe('ConfirmationModalComponent and ConfirmationService', () => {
  let confirmationService: ConfirmationService;
  const modalWindow = page.getByCss('ngb-modal-window');
  const modalTitle = page.getByCss('.modal-title');
  const modalBody = page.getByCss('.modal-body');
  const yesButton = page.getByCss('#yes-button');
  const noButton = page.getByCss('#no-button');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), noAnimation]
    });
    confirmationService = TestBed.inject(ConfirmationService);
    const fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    const win = document.querySelector('ngb-modal-window');
    if (win) win.parentElement!.removeChild(win);
    const backdrop = document.querySelector('ngb-modal-backdrop');
    if (backdrop) backdrop.parentElement!.removeChild(backdrop);
  });

  test('should display a modal dialog when confirming and use default title key', async () => {
    confirmationService.confirm({ message: 'Really?' });
    await expect.element(modalWindow).toBeInTheDocument();
    await expect.element(modalTitle).toHaveTextContent('Confirmation');
    await expect.element(modalBody).toHaveTextContent('Really?');
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

  test('should emit when confirming', async () => {
    const result = firstValueFrom(confirmationService.confirm({ message: 'Really?' }));
    await yesButton.click();
    await result;
    await expect.element(modalWindow).not.toBeInTheDocument();
  });

  test('should error when not confirming and errorOnClose is true', async () => {
    let errorEmitted = false;
    confirmationService.confirm({ message: 'Really?', errorOnClose: true }).subscribe({ error: () => (errorEmitted = true) });
    await noButton.click();
    expect(errorEmitted).toBe(true);
    await expect.element(modalWindow).not.toBeInTheDocument();
  });

  test('should complete without error when not confirming and errorOnClose is not set', async () => {
    const result = firstValueFrom(confirmationService.confirm({ message: 'Really?' }), { defaultValue: undefined });
    await noButton.click();
    await result;
    await expect.element(modalWindow).not.toBeInTheDocument();
  });
});
