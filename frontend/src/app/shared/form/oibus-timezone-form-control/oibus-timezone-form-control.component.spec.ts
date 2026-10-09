import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { OIBusTimezoneAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { OIBusFormControlTester, renderOIBusFormControl } from '../oibus-form-control.testing';
import { TYPEAHEAD_DEBOUNCE_TIME } from '../typeahead';
import { OIBusTimezoneFormControlComponent } from './oibus-timezone-form-control.component';

describe('OIBusTimezoneFormControlComponent', () => {
  const timezoneAttribute: OIBusTimezoneAttribute = {
    type: 'timezone',
    key: 'timezone',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.tracking-instant.date-time-input.timezone',
    defaultValue: null,
    validators: [],
    displayProperties: { row: 0, columns: 4, displayInViewMode: true }
  };
  const suggestions = page.getByCss('ngb-typeahead-window').getByRole('option');
  let control: FormControl<string | null>;
  let tester: OIBusFormControlTester<OIBusTimezoneFormControlComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    control = new FormControl<string | null>(null);
    tester = await renderOIBusFormControl(OIBusTimezoneFormControlComponent, { timezoneAttribute }, 'timezone', control);
  });

  afterEach(() => vi.useRealTimers());

  test('should suggest the matching timezones and select one', async () => {
    const field = tester.root.getByLabelText('Timezone');
    await expect.element(field).toHaveValue('');
    vi.useFakeTimers();

    await field.fill('Par');
    await vi.advanceTimersByTimeAsync(TYPEAHEAD_DEBOUNCE_TIME);

    await expect.element(suggestions).toHaveLength(2);
    expect(suggestions.elements().map(suggestion => suggestion.textContent!.trim())).toEqual(['America/Paramaribo', 'Europe/Paris']);
    await suggestions.nth(1).click();

    expect(control.value).toBe('Europe/Paris');
    await expect.element(field).toHaveValue('Europe/Paris');
  });

  test('should display a value patched from outside', async () => {
    control.setValue('Europe/Paris');

    await expect.element(tester.root.getByLabelText('Timezone')).toHaveValue('Europe/Paris');
  });
});
