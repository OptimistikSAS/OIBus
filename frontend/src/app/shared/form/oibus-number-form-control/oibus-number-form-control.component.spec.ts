import { TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';

import { beforeEach, describe, expect, test } from 'vitest';

import { OIBusNumberAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { renderOIBusFormControl } from '../oibus-form-control.testing';
import { OIBusNumberFormControlComponent } from './oibus-number-form-control.component';

describe('OIBusNumberFormControlComponent', () => {
  const numberAttribute: OIBusNumberAttribute = {
    type: 'number',
    key: 'fieldName',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.tracking-instant.field-name',
    defaultValue: null,
    unit: null,
    validators: [{ type: 'REQUIRED', arguments: [] }],
    displayProperties: { row: 0, columns: 4, displayInViewMode: true }
  };
  let control: FormControl<number | null>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    control = new FormControl<number | null>(12, Validators.required);
  });

  test('should display the value of the control and update it', async () => {
    const tester = await renderOIBusFormControl(OIBusNumberFormControlComponent, { numberAttribute }, 'fieldName', control);
    const field = tester.root.getByLabelText('Field name');
    await expect.element(field).toHaveValue(12);

    await field.fill('123');

    expect(control.value).toBe(123);
    await expect.element(tester.root.getByCss('.input-group-text')).not.toBeInTheDocument();
  });

  test('should display the unit', async () => {
    const tester = await renderOIBusFormControl(
      OIBusNumberFormControlComponent,
      { numberAttribute: { ...numberAttribute, unit: 'ms' } },
      'fieldName',
      control
    );

    await expect.element(tester.root.getByLabelText('Field name')).toHaveValue(12);
    await expect.element(tester.root.getByCss('.input-group-text')).toHaveTextContent('ms');
  });

  test('should display the validation errors when the form is marked as touched from outside', async () => {
    const tester = await renderOIBusFormControl(OIBusNumberFormControlComponent, { numberAttribute }, 'fieldName', control);
    control.setValue(null);

    tester.form.markAllAsTouched();

    await expect.element(tester.root.getByText('This field is required')).toBeVisible();
  });

  test('should be disabled with its control', async () => {
    const tester = await renderOIBusFormControl(OIBusNumberFormControlComponent, { numberAttribute }, 'fieldName', control);

    control.disable();

    await expect.element(tester.root.getByLabelText('Field name')).toBeDisabled();
  });
});
