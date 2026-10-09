import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';

import { beforeEach, describe, expect, test } from 'vitest';

import { Instant } from '@oibus/shared/common/types';
import { OIBusInstantAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { provideCurrentUser } from '../../current-user-testing';
import { provideNgbConfigTesting } from '../oi-ngb-testing';
import { OIBusFormControlTester, renderOIBusFormControl } from '../oibus-form-control.testing';
import { OIBusInstantFormControlComponent } from './oibus-instant-form-control.component';

describe('OIBusInstantFormControlComponent', () => {
  const instantAttribute: OIBusInstantAttribute = {
    type: 'instant',
    key: 'startTime',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.tracking-instant.field-name',
    validators: [],
    displayProperties: { row: 0, columns: 4, displayInViewMode: true }
  };
  let control: FormControl<Instant | null>;
  let tester: OIBusFormControlTester<OIBusInstantFormControlComponent>;

  beforeEach(async () => {
    // the default timezone of the current user is Europe/Paris
    TestBed.configureTestingModule({ providers: [provideNgbConfigTesting(), provideI18nTesting(), provideCurrentUser()] });
    control = new FormControl<Instant | null>('2019-10-02T14:15:00.000Z');
    tester = await renderOIBusFormControl(OIBusInstantFormControlComponent, { instantAttribute }, 'startTime', control);
  });

  test('should display the value of the control and update it', async () => {
    const picker = tester.root.getByCss('oib-datetimepicker');
    await expect.element(picker).toHaveDisplayedDate('02/10/2019 16:15');

    await picker.fillWithDate('03/10/2019', '05', '06');

    expect(control.value).toBe('2019-10-03T03:06:00.000Z');
  });

  test('should display a value patched from outside', async () => {
    control.setValue('2025-06-07T08:09:00.000Z');

    await expect.element(tester.root.getByCss('oib-datetimepicker')).toHaveDisplayedDate('07/06/2025 10:09');
  });
});
