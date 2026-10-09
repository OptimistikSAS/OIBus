import { TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';

import { beforeEach, describe, expect, test } from 'vitest';

import { OIBusStringAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { OIBusFormControlTester, renderOIBusFormControl } from '../oibus-form-control.testing';
import { OIBusStringFormControlComponent } from './oibus-string-form-control.component';

describe('OIBusStringFormControlComponent', () => {
  const stringAttribute: OIBusStringAttribute = {
    type: 'string',
    key: 'fieldName',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.tracking-instant.field-name',
    defaultValue: null,
    validators: [{ type: 'REQUIRED', arguments: [] }],
    displayProperties: { row: 0, columns: 4, displayInViewMode: true }
  };
  let control: FormControl<string | null>;
  let tester: OIBusFormControlTester<OIBusStringFormControlComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    control = new FormControl<string | null>('initial', Validators.required);
    tester = await renderOIBusFormControl(OIBusStringFormControlComponent, { stringAttribute }, 'fieldName', control);
  });

  test('should display the value of the control and update it', async () => {
    const field = tester.root.getByLabelText('Field name');
    await expect.element(field).toHaveValue('initial');

    await field.fill('updated');

    expect(control.value).toBe('updated');
  });

  test('should display a value patched from outside', async () => {
    control.setValue('patched');

    await expect.element(tester.root.getByLabelText('Field name')).toHaveValue('patched');
  });

  test('should display the validation errors when the form is marked as touched from outside', async () => {
    control.setValue('');
    await expect.element(tester.root.getByText('This field is required')).not.toBeInTheDocument();

    tester.form.markAllAsTouched();

    await expect.element(tester.root.getByText('This field is required')).toBeVisible();
    await expect.element(tester.root.getByLabelText('Field name')).toHaveClass('is-invalid');
  });

  test('should be disabled with its control', async () => {
    control.disable();

    await expect.element(tester.root.getByLabelText('Field name')).toBeDisabled();
  });
});
