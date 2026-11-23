import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { provideNgbConfigTesting } from '../../shared/form/oi-ngb-testing';
import { ChangePasswordFieldsComponent, createChangePasswordForm, toChangePasswordCommand } from './change-password-fields.component';

@Component({
  template: `
    <form [formGroup]="form">
      <oib-change-password-fields [form]="form" />
      <button type="submit">Submit</button>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ChangePasswordFieldsComponent]
})
class TestComponent {
  readonly form = createChangePasswordForm(inject(NonNullableFormBuilder));
}

class ChangePasswordFieldsComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly currentPassword = this.root.getByLabelText('Current password');
  readonly newPassword = this.root.getByLabelText('New password', { exact: true });
  readonly newPasswordConfirmation = this.root.getByLabelText('New password confirmation');
  readonly submitButton = this.root.getByRole('button', { name: 'Submit' });
  readonly notIdenticalError = this.root.getByText('The new password and its confirmation must be identical');

  get form() {
    return this.fixture.componentInstance.form;
  }

  async fillForm(currentPassword: string, newPassword: string, confirmation: string) {
    await this.currentPassword.fill(currentPassword);
    await this.newPassword.fill(newPassword);
    await this.newPasswordConfirmation.fill(confirmation);
  }
}

describe('ChangePasswordFieldsComponent', () => {
  let tester: ChangePasswordFieldsComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideNgbConfigTesting()]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent);
    tester = new ChangePasswordFieldsComponentTester();
  });

  test('should display empty password fields', async () => {
    await expect.element(tester.currentPassword).toHaveValue('');
    await expect.element(tester.newPassword).toHaveValue('');
    await expect.element(tester.newPasswordConfirmation).toHaveValue('');
  });

  test('should require the three passwords', async () => {
    await tester.submitButton.click();

    await expect.element(tester.root.getByText('This field is required')).toHaveLength(3);
    expect(tester.form.valid).toBe(false);
  });

  test('should refuse a new password shorter than 8 characters', async () => {
    await tester.fillForm('current', 'short', 'short');
    await tester.submitButton.click();

    await expect.element(tester.root.getByText('This field must have at least 8 characters')).toBeVisible();
    expect(tester.form.valid).toBe(false);
  });

  test('should refuse a new password longer than 128 characters', async () => {
    const tooLong = 'a'.repeat(129);
    await tester.fillForm('current', tooLong, tooLong);
    await tester.submitButton.click();

    await expect.element(tester.root.getByText('This field must have at most 128 characters')).toBeVisible();
    expect(tester.form.valid).toBe(false);
  });

  test('should require the confirmation to be identical to the new password', async () => {
    await tester.fillForm('current', 'new password', 'other');
    await tester.submitButton.click();

    await expect.element(tester.notIdenticalError).toBeVisible();
    expect(tester.form.valid).toBe(false);

    await tester.newPasswordConfirmation.fill('new password');
    await expect.element(tester.notIdenticalError).not.toBeInTheDocument();
    expect(tester.form.valid).toBe(true);
  });

  test('should give the command of the entered passwords', async () => {
    await tester.fillForm('current', 'new password', 'new password');

    expect(toChangePasswordCommand(tester.form)).toEqual({ currentPassword: 'current', newPassword: 'new password' });
  });
});
