import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';

import { beforeEach, describe, expect, test } from 'vitest';

import { OIBusStringSelectAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { OIBusFormControlTester, renderOIBusFormControl } from '../oibus-form-control.testing';
import { OIBusStringSelectFormControlComponent } from './oibus-string-select-form-control.component';

describe('OIBusStringSelectFormControlComponent', () => {
  const stringSelectAttribute: OIBusStringSelectAttribute = {
    type: 'string-select',
    key: 'type',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.tracking-instant.date-time-input.type',
    selectableValues: ['iso-string', 'unix-epoch'],
    defaultValue: null,
    validators: [],
    displayProperties: { row: 0, columns: 4, displayInViewMode: true }
  };
  let control: FormControl<string | null>;
  let tester: OIBusFormControlTester<OIBusStringSelectFormControlComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    control = new FormControl<string | null>('unix-epoch');
    tester = await renderOIBusFormControl(OIBusStringSelectFormControlComponent, { stringSelectAttribute }, 'type', control);
  });

  test('should display an empty option and a translated option for each selectable value', async () => {
    const options = tester.root.getByRole('option');
    await expect.element(options).toHaveLength(3);
    await expect.element(options.nth(0)).toHaveTextContent('');
    await expect.element(options.nth(1)).toHaveTextContent('ISO String');
    await expect.element(options.nth(2)).toHaveTextContent('UNIX epoch (s)');
  });

  test('should display the value of the control and update it', async () => {
    const select = tester.root.getByLabelText('Type');
    await expect.element(select).toHaveDisplayValue('UNIX epoch (s)');

    await select.selectOptions('ISO String');

    expect(control.value).toBe('iso-string');
  });

  test('should display a value patched from outside', async () => {
    control.setValue('iso-string');

    await expect.element(tester.root.getByLabelText('Type')).toHaveDisplayValue('ISO String');
  });
});
