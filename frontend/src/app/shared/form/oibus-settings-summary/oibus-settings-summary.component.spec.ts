import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { OIBusObjectAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { OIBusSettingsSummaryComponent } from './oibus-settings-summary.component';
import { SettingSummary, summarizeSettings } from './settings-summary';

const displayProperties = { row: 0, columns: 6, displayInViewMode: true };
const items = 'configuration.oibus.manifest.south.items';

const settingsAttribute: OIBusObjectAttribute = {
  type: 'object',
  key: 'settings',
  translationKey: `${items}.settings`,
  validators: [],
  enablingConditions: [],
  displayProperties: { visible: true, wrapInBox: false },
  attributes: [
    {
      type: 'string-select',
      key: 'mode',
      translationKey: `${items}.opcua.mode`,
      selectableValues: ['ha', 'da'],
      defaultValue: null,
      validators: [],
      displayProperties
    },
    {
      type: 'number',
      key: 'minAge',
      translationKey: `${items}.ftp.min-age`,
      defaultValue: null,
      unit: 'ms',
      validators: [],
      displayProperties
    },
    { type: 'secret', key: 'password', translationKey: `${items}.name`, validators: [], displayProperties },
    { type: 'scan-mode', key: 'scanMode', translationKey: `${items}.scan-mode`, acceptableType: 'POLL', validators: [], displayProperties },
    { type: 'boolean', key: 'recursive', translationKey: `${items}.ftp.recursive`, defaultValue: false, validators: [], displayProperties },
    {
      type: 'code',
      key: 'query',
      translationKey: `${items}.sqlite.query`,
      contentType: 'sql',
      defaultValue: null,
      validators: [],
      displayProperties
    },
    {
      type: 'object',
      key: 'trackingInstant',
      translationKey: `${items}.sqlite.tracking-instant.title`,
      validators: [],
      enablingConditions: [],
      displayProperties: { visible: true, wrapInBox: true },
      attributes: [
        {
          type: 'boolean',
          key: 'trackInstant',
          translationKey: `${items}.sqlite.tracking-instant.track-instant`,
          defaultValue: false,
          validators: [],
          displayProperties
        }
      ]
    },
    {
      type: 'array',
      key: 'queryParams',
      translationKey: `${items}.rest.query-params.title`,
      paginate: false,
      numberOfElementPerPage: 20,
      validators: [],
      rootAttribute: {
        type: 'object',
        key: 'queryParam',
        translationKey: `${items}.rest.query-params.title`,
        validators: [],
        enablingConditions: [],
        displayProperties: { visible: true, wrapInBox: false },
        attributes: [
          {
            type: 'string',
            key: 'key',
            translationKey: `${items}.rest.query-params.key`,
            defaultValue: null,
            validators: [],
            displayProperties
          },
          {
            type: 'string',
            key: 'value',
            translationKey: `${items}.rest.query-params.value`,
            defaultValue: null,
            validators: [],
            displayProperties
          }
        ]
      }
    }
  ]
};

@Component({
  template: `<oib-oibus-settings-summary [settings]="settings()" [previous]="previous()" />`,
  imports: [OIBusSettingsSummaryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  private readonly translateService = inject(TranslateService);
  readonly value = signal<Record<string, unknown>>({
    mode: 'ha',
    minAge: 1000,
    password: 'secret',
    scanMode: testData.scanMode.list[1].id,
    query: 'SELECT * FROM logs',
    trackingInstant: { trackInstant: true },
    queryParams: [{ key: 'from', value: '@StartTime' }]
  });
  /** The paths of the settings with an error */
  readonly invalidPaths = signal<Array<string>>([]);
  readonly settings = computed(() => this.summarize(this.value()));
  readonly previous = signal<Array<SettingSummary> | null>(null);

  summarize(value: Record<string, unknown>) {
    const invalidPaths = this.invalidPaths();
    return summarizeSettings(settingsAttribute, value, {
      translateService: this.translateService,
      scanModes: testData.scanMode.list,
      isInvalid: path => invalidPaths.includes(path.join('.'))
    });
  }
}

class OIBusSettingsSummaryComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);

  entry(label: string) {
    return this.root.getByCss('.oib-summary-entry').filter({ has: page.getByText(label, { exact: true }) });
  }

  /** The value shown for a label */
  setting(label: string) {
    return this.entry(label).getByRole('definition');
  }
}

describe('OIBusSettingsSummaryComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
  });

  test('should show each setting in a readable way', async () => {
    const tester = new OIBusSettingsSummaryComponentTester();

    await expect.element(tester.setting('Mode')).toHaveTextContent('HA');
    await expect.element(tester.setting('Min age')).toHaveTextContent('1000 ms');
    await expect.element(tester.setting('Name')).toHaveTextContent('••••••••');
    await expect.element(tester.setting('Schedule')).toHaveTextContent(testData.scanMode.list[1].name);
    await expect.element(tester.setting('Query')).toHaveTextContent('SELECT * FROM logs');
    await expect.element(tester.setting('Track instant')).toHaveTextContent('Yes');
    await expect.element(tester.root.getByText('Tracking instant', { exact: true })).toBeInTheDocument();
    await expect.element(tester.setting('Query parameters')).toHaveTextContent('KeyValuefrom@StartTime');
  });

  test('should leave out the settings missing from the value, and mark the empty ones', async () => {
    const tester = new OIBusSettingsSummaryComponentTester();

    // the form leaves out of its value the settings disabled by an enabling condition
    await expect.element(tester.root.getByRole('term').filter({ hasText: 'Scan sub-folders' })).not.toBeInTheDocument();

    tester.fixture.componentInstance.value.update(value => ({ ...value, password: '', query: null }));

    await expect.element(tester.setting('Name')).toHaveTextContent('–');
    await expect.element(tester.setting('Query')).toHaveTextContent('–');
  });

  test('should mark what changed since a previous version, and show what it was', async () => {
    const tester = new OIBusSettingsSummaryComponentTester();
    const component = tester.fixture.componentInstance;
    await expect.element(tester.entry('Min age')).not.toHaveClass('oib-summary-changed');

    component.previous.set(component.summarize({ ...component.value(), minAge: 500, trackingInstant: { trackInstant: false } }));

    await expect.element(tester.entry('Min age')).toHaveClass('oib-summary-changed');
    await expect.element(tester.setting('Min age')).toHaveTextContent('1000 ms Was 500 ms');
    await expect.element(tester.entry('Min age').getByText('Changed')).toBeInTheDocument();
    await expect.element(tester.entry('Track instant').getByCss('.oib-summary-previous')).toHaveTextContent('Was No');
    await expect.element(tester.entry('Mode')).not.toHaveClass('oib-summary-changed');
  });

  test('should leave out the settings turned off by an attribute of another group, when asked', () => {
    const attribute: OIBusObjectAttribute = {
      ...settingsAttribute,
      attributes: [settingsAttribute.attributes[0], settingsAttribute.attributes[1]],
      enablingConditions: [{ referralPathFromRoot: 'trackingInstant.trackInstant', targetPathFromRoot: 'minAge', values: [true] }]
    };
    const keys = (value: Record<string, unknown>) =>
      summarizeSettings(attribute, value, { translateService: TestBed.inject(TranslateService), applyEnablingConditions: true }).map(
        setting => setting.labelKey
      );

    const mode = `${items}.opcua.mode.title`;
    expect(keys({ mode: 'ha', minAge: 1000, trackingInstant: { trackInstant: false } })).toEqual([mode]);
    expect(keys({ mode: 'ha', minAge: 1000, trackingInstant: { trackInstant: true } })).toEqual([mode, `${items}.ftp.min-age`]);
    expect(keys({ mode: 'ha', minAge: 1000 })).toEqual([mode]);
  });

  test('should flag the settings with an error', async () => {
    const tester = new OIBusSettingsSummaryComponentTester();

    tester.fixture.componentInstance.invalidPaths.set(['trackingInstant.trackInstant']);

    await expect.element(tester.entry('Track instant')).toHaveClass('oib-summary-invalid');
    await expect.element(tester.entry('Mode')).not.toHaveClass('oib-summary-invalid');
  });
});
