import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { OIBusAttribute, OIBusObjectAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock } from '../../../../test/vitest-create-mock';
import { DownloadService } from '../../../services/download.service';
import { EngineService } from '../../../services/engine.service';
import { provideCurrentUser } from '../../current-user-testing';
import { provideModalTesting } from '../../mock-modal.service.testing';
import { addAttributeToForm } from '../dynamic-form.builder';
import { provideNgbConfigTesting } from '../oi-ngb-testing';
import { OIBusObjectFormControlComponent } from './oibus-object-form-control.component';

const NAME_LABEL = 'Name';
const ENABLED_LABEL = 'Enabled';

const displayProperties = { row: 0, columns: 6, displayInViewMode: true };

const nameAttribute: OIBusAttribute = {
  type: 'string',
  key: 'name',
  translationKey: 'configuration.oibus.manifest.south.items.name',
  validators: [],
  defaultValue: null,
  displayProperties
};

const enabledAttribute: OIBusAttribute = {
  type: 'boolean',
  key: 'enabled',
  translationKey: 'configuration.oibus.manifest.south.items.enabled',
  validators: [],
  defaultValue: false,
  displayProperties
};

/** An object whose `name` field is enabled by its `enabled` sibling */
const objectAttribute: OIBusObjectAttribute = {
  type: 'object',
  key: 'settings',
  translationKey: 'configuration.oibus.manifest.south.items.settings',
  validators: [],
  attributes: [nameAttribute, enabledAttribute],
  enablingConditions: [{ referralPathFromRoot: 'enabled', targetPathFromRoot: 'name', values: [true] }],
  displayProperties: { visible: true, wrapInBox: false }
};

@Component({
  selector: 'oib-test-oibus-object-form-control-host-component',
  template: `
    <form [formGroup]="form">
      <ng-container formGroupName="settings">
        <oib-oibus-object-form-control
          [scanModes]="scanModes"
          [certificates]="certificates"
          [group]="form.controls.settings"
          [objectAttribute]="objectAttribute()"
        />
      </ng-container>
    </form>
  `,
  imports: [OIBusObjectFormControlComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestHostComponent {
  readonly scanModes = testData.scanMode.list;
  readonly certificates = testData.certificates.list;
  readonly objectAttribute = signal(objectAttribute);
  readonly form = new FormGroup({ settings: new FormGroup({}) });
}

class TestHostComponentTester {
  readonly fixture = TestBed.createComponent(TestHostComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly settings: FormGroup = this.fixture.componentInstance.form.controls.settings;
  readonly name = this.root.getByLabelText(NAME_LABEL);
  readonly enabled = this.root.getByLabelText(ENABLED_LABEL);

  /** Builds the form controls of the object, as the parents do, before it is rendered */
  constructor(attribute: OIBusObjectAttribute = objectAttribute) {
    const fb = TestBed.inject(NonNullableFormBuilder);
    attribute.attributes.forEach(child => addAttributeToForm(fb, this.settings, child));
    this.fixture.componentInstance.objectAttribute.set(attribute);
  }
}

describe('OIBusObjectFormControlComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideNgbConfigTesting(),
        provideCurrentUser(),
        provideModalTesting(),
        { provide: DownloadService, useValue: createMock(DownloadService) },
        { provide: EngineService, useValue: createMock(EngineService, { getInfo: () => of(testData.engine.oIBusInfo) }) }
      ]
    });
  });

  test('should only display the field enabled by its sibling when the condition is met', async () => {
    const tester = new TestHostComponentTester();

    await expect.element(tester.enabled).not.toBeChecked();
    await expect.element(tester.name).not.toBeInTheDocument();

    await tester.enabled.click();
    await expect.element(tester.name).toBeVisible();
    await tester.name.fill('my name');

    await tester.enabled.click();
    await expect.element(tester.name).not.toBeInTheDocument();
    expect(tester.settings.value).toEqual({ enabled: false });
  });

  test('should display the field enabled when the form is patched from outside', async () => {
    const tester = new TestHostComponentTester();
    await expect.element(tester.enabled).toBeInTheDocument();
    await expect.element(tester.name).not.toBeInTheDocument();

    tester.settings.patchValue({ enabled: true, name: 'patched' });

    await expect.element(tester.name).toHaveValue('patched');
    await expect.element(tester.enabled).toBeChecked();
  });

  test('should hide the fields of the attributes not enabled on the platform of the engine', async () => {
    const tester = new TestHostComponentTester({
      ...objectAttribute,
      enablingConditions: [],
      attributes: [
        { ...nameAttribute, validators: [{ type: 'PLATFORM', arguments: ['linux'] }] },
        { ...enabledAttribute, validators: [{ type: 'PLATFORM', arguments: [testData.engine.oIBusInfo.platform] }] }
      ]
    });

    await expect.element(tester.enabled).toBeInTheDocument();
    await expect.element(tester.name).not.toBeInTheDocument();
    expect(tester.settings.controls['name'].disabled).toBe(true);
  });

  test('should display nothing when not visible', async () => {
    const tester = new TestHostComponentTester({ ...objectAttribute, displayProperties: { visible: false, wrapInBox: false } });

    await expect.element(tester.enabled).not.toBeInTheDocument();
  });

  test.each([
    { wrapInBox: true, title: 1 },
    { wrapInBox: false, title: 0 }
  ])('should display the fields in a box with a title: $wrapInBox', async ({ wrapInBox, title }) => {
    const tester = new TestHostComponentTester({ ...objectAttribute, displayProperties: { visible: true, wrapInBox } });

    await expect.element(tester.enabled).toBeInTheDocument();
    await expect.element(tester.root.getByText('Settings', { exact: true })).toHaveLength(title);
  });

  test('should display a form control per attribute type', async () => {
    const translationKey = 'configuration.oibus.manifest.south.items.name';
    const tester = new TestHostComponentTester({
      ...objectAttribute,
      enablingConditions: [],
      attributes: [
        { type: 'string', key: 'string', translationKey, validators: [], defaultValue: null, displayProperties },
        { type: 'code', key: 'code', translationKey, contentType: 'json', validators: [], defaultValue: null, displayProperties },
        {
          type: 'string-select',
          key: 'stringSelect',
          translationKey: 'configuration.oibus.manifest.south.items.mssql.tracking-instant.date-time-input.type',
          selectableValues: ['iso-string'],
          validators: [],
          defaultValue: null,
          displayProperties
        },
        { type: 'secret', key: 'secret', translationKey, validators: [], displayProperties },
        { type: 'number', key: 'number', translationKey, unit: null, validators: [], defaultValue: null, displayProperties },
        { type: 'boolean', key: 'boolean', translationKey, validators: [], defaultValue: false, displayProperties },
        { type: 'instant', key: 'instant', translationKey, validators: [], displayProperties },
        { type: 'scan-mode', key: 'scanMode', translationKey, acceptableType: 'POLL', validators: [], displayProperties },
        { type: 'certificate', key: 'certificate', translationKey, validators: [], displayProperties },
        { type: 'timezone', key: 'timezone', translationKey, validators: [], defaultValue: null, displayProperties },
        {
          type: 'object',
          key: 'object',
          translationKey,
          validators: [],
          attributes: [{ ...enabledAttribute, key: 'nestedEnabled' }],
          enablingConditions: [],
          displayProperties: { visible: true, wrapInBox: false }
        },
        {
          type: 'array',
          key: 'array',
          translationKey,
          validators: [],
          paginate: false,
          numberOfElementPerPage: 20,
          rootAttribute: {
            type: 'object',
            key: 'item',
            translationKey: 'configuration.oibus.manifest.south.items.item',
            validators: [],
            attributes: [],
            enablingConditions: [],
            displayProperties: { visible: true, wrapInBox: false }
          }
        }
      ]
    });

    for (const selector of [
      'string',
      'code',
      'string-select',
      'secret',
      'number',
      'boolean',
      'instant',
      'scan-mode',
      'certificate',
      'timezone',
      'object',
      'array'
    ]) {
      await expect.element(tester.root.getByCss(`oib-oibus-${selector}-form-control`).first()).toBeInTheDocument();
    }
    // the nested object is rendered in its own form group
    await tester.root.getByLabelText(ENABLED_LABEL).click();
    expect(tester.settings.value.object).toEqual({ nestedEnabled: true });
    await expect.element(tester.root.getByText('Item', { exact: true })).toBeInTheDocument();
  });
});
