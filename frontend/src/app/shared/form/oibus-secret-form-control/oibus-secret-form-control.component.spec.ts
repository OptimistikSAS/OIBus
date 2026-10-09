import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';

import { beforeEach, describe, expect, test } from 'vitest';

import { OIBusSecretAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { renderOIBusFormControl } from '../oibus-form-control.testing';
import { OIBUS_FORM_MODE } from '../oibus-form-mode.token';
import { OIBusSecretFormControlComponent } from './oibus-secret-form-control.component';

describe('OIBusSecretFormControlComponent', () => {
  const secretAttribute: OIBusSecretAttribute = {
    type: 'secret',
    key: 'fieldName',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.tracking-instant.field-name',
    validators: [],
    displayProperties: { row: 0, columns: 4, displayInViewMode: true }
  };
  let control: FormControl<string | null>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    control = new FormControl<string | null>(null);
  });

  test('should update the control without placeholder in create mode', async () => {
    const tester = await renderOIBusFormControl(OIBusSecretFormControlComponent, { secretAttribute }, 'fieldName', control);
    const field = tester.root.getByLabelText('Field name');
    await expect.element(field).toHaveAttribute('type', 'password');
    await expect.element(field).not.toHaveAttribute('placeholder');

    await field.fill('my-secret');

    expect(control.value).toBe('my-secret');
  });

  test('should display a placeholder in edit mode', async () => {
    TestBed.overrideProvider(OIBUS_FORM_MODE, { useValue: () => 'edit' });
    const tester = await renderOIBusFormControl(OIBusSecretFormControlComponent, { secretAttribute }, 'fieldName', control);

    await expect
      .element(tester.root.getByLabelText('Field name'))
      .toHaveAttribute('placeholder', 'Leave empty to keep the existing secret');
  });
});
