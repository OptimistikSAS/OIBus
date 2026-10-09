import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, ValidationErrors } from '@angular/forms';

import { ValdemortModule } from 'ngx-valdemort';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { DefaultValidationErrorsComponent } from './default-validation-errors.component';

@Component({
  selector: 'oib-test-default-validation-errors-component',
  template: `
    <oib-default-validation-errors />
    <input aria-label="Field" [formControl]="control" />
    <val-errors [control]="control" [label]="label()" />
  `,
  imports: [ValdemortModule, ReactiveFormsModule, DefaultValidationErrorsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  readonly control = new FormControl('');
  readonly label = signal<string | null>(null);
}

describe('DefaultValidationErrorsComponent', () => {
  let host: TestComponent;
  const errors = page.getByCss('val-errors');

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const fixture = TestBed.createComponent(TestComponent);
    host = fixture.componentInstance;
    // the control is validated when bound to the input: set the errors after
    await fixture.whenStable();
  });

  test.each([
    { errors: { ngbDate: true }, expected: 'This field is not a valid date' },
    { errors: { required: true }, expected: 'This field is required' },
    { errors: { minlength: { requiredLength: 1000 } }, expected: 'This field must have at least 1,000 characters' },
    { errors: { maxlength: { requiredLength: 10 } }, expected: 'This field must have at most 10 characters' },
    { errors: { pattern: true }, expected: "This field doesn't have the required format" },
    { errors: { email: true }, expected: 'This field must be a valid email address' },
    { errors: { min: { min: 1500 } }, expected: 'This field must be at least 1,500' },
    { errors: { max: { max: 12 } }, expected: 'This field must be at most 12' },
    { errors: { ascendingDates: true }, expected: 'The end date must be after the start date' },
    { errors: { ascendingLimits: true }, expected: 'Limit values must be descending' },
    { errors: { invalidPeriod: true }, expected: 'The period is not valid' },
    { errors: { invalidPositiveInteger: true }, expected: 'The number must be a positive integer' },
    { errors: { nullPeriod: true }, expected: 'The period can not be null' },
    { errors: { invalidRegex: true }, expected: 'The regular expression is not valid' },
    { errors: { invalidJson: true }, expected: 'The json is not valid' },
    { errors: { cronErrorMessage: 'Invalid cron' }, expected: 'Invalid cron' },
    { errors: { mustBeUnique: true }, expected: 'Must be unique' },
    { errors: { intervalTooSmall: { min: 10 } }, expected: 'The interval must be at least 10 ms' },
    { errors: { timeOfDayIncomplete: true }, expected: 'Both the start and end times must be set, or neither' },
    { errors: { timeOfDayEmpty: true }, expected: 'The start and end times must be different' },
    { errors: { resolvePendingChanges: true }, expected: 'Please validate or discard pending changes before saving' },
    { errors: { badStartDateRange: true }, expected: 'Start time must be before end time' },
    { errors: { badEndDateRange: true }, expected: 'End time must be after start time' },
    { errors: { duplicateFieldNames: true }, expected: 'Duplicate field names detected' },
    { errors: { onlyOneReference: true }, expected: 'Only one element can be marked as reference' },
    {
      errors: { mqttTopicOverlap: { conflictingTopics: 'a/#, a/b' } },
      expected: 'MQTT topic subscriptions cannot overlap. Conflicting topics: a/#, a/b'
    }
  ] satisfies Array<{ errors: ValidationErrors; expected: string }>)(
    'should display the $errors error',
    async ({ errors: controlErrors, expected }) => {
      host.control.setErrors(controlErrors);
      host.control.markAsTouched();

      await expect.element(errors).toHaveTextContent(expected);
    }
  );

  test('should display the label in the error message', async () => {
    host.label.set('The name');
    host.control.setErrors({ required: true });
    host.control.markAsTouched();

    await expect.element(errors).toHaveTextContent('The name is required');
  });

  test('should display only the first error, once the control is touched', async () => {
    host.control.setErrors({ ngbDate: true, required: true });
    await expect.element(errors).toHaveTextContent('');

    host.control.markAsTouched();

    await expect.element(errors).toHaveTextContent('This field is not a valid date');
  });
});
