import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';

import { beforeEach, describe, expect, test } from 'vitest';

import { OIBusBooleanAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { OIBusFormControlTester, renderOIBusFormControl } from '../oibus-form-control.testing';
import { OIBusBooleanFormControlComponent } from './oibus-boolean-form-control.component';

describe('OIBusBooleanFormControlComponent', () => {
  const booleanAttribute: OIBusBooleanAttribute = {
    type: 'boolean',
    key: 'fieldName',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.tracking-instant.field-name',
    defaultValue: false,
    validators: [],
    displayProperties: { row: 0, columns: 4, displayInViewMode: true }
  };
  let control: FormControl<boolean>;
  let tester: OIBusFormControlTester<OIBusBooleanFormControlComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    control = new FormControl<boolean>(true, { nonNullable: true });
    tester = await renderOIBusFormControl(OIBusBooleanFormControlComponent, { booleanAttribute }, 'fieldName', control);
  });

  test('should display the value of the control and update it', async () => {
    const checkbox = tester.root.getByLabelText('Field name');
    await expect.element(checkbox).toBeChecked();

    await checkbox.click();

    expect(control.value).toBe(false);
  });

  test('should display a value patched from outside', async () => {
    control.setValue(false);

    await expect.element(tester.root.getByLabelText('Field name')).not.toBeChecked();
  });

  test('should be disabled with its control', async () => {
    control.disable();

    await expect.element(tester.root.getByLabelText('Field name')).toBeDisabled();
  });
});
