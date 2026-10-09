import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';

import { beforeEach, describe, expect, test } from 'vitest';

import { OIBusCodeAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { OIBusFormControlTester, renderOIBusFormControl } from '../oibus-form-control.testing';
import { OIBusCodeFormControlComponent } from './oibus-code-form-control.component';

describe('OIBusCodeFormControlComponent', () => {
  const codeAttribute: OIBusCodeAttribute = {
    type: 'code',
    key: 'query',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.tracking-instant.field-name',
    contentType: 'sql',
    defaultValue: null,
    validators: [],
    displayProperties: { row: 0, columns: 4, displayInViewMode: true }
  };
  let control: FormControl<string | null>;
  let tester: OIBusFormControlTester<OIBusCodeFormControlComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    control = new FormControl<string | null>('SELECT 1');
    tester = await renderOIBusFormControl(OIBusCodeFormControlComponent, { codeAttribute }, 'query', control);
  });

  test('should display the label and the value of the control, and update it', async () => {
    await expect.element(tester.root.getByText('Field name')).toBeInTheDocument();
    const editor = tester.root.getByRole('textbox');
    await expect.element(editor).toHaveTextContent('SELECT 1');

    await editor.fill('SELECT 2');

    expect(control.value).toBe('SELECT 2');
  });

  test('should display a value patched from outside', async () => {
    control.setValue('SELECT 3');

    await expect.element(tester.root.getByRole('textbox')).toHaveTextContent('SELECT 3');
  });

  test('should not be editable when its control is disabled', async () => {
    control.disable();

    await expect.element(tester.root.getByRole('textbox')).toHaveAttribute('contenteditable', 'false');
  });
});
