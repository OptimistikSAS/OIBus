import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { OIBusAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../../test/vitest-create-mock';
import { DefaultValidationErrorsComponent } from '../../../default-validation-errors/default-validation-errors.component';
import { ManifestAttributeEditorModalComponent } from './manifest-attribute-editor-modal.component';

class ManifestAttributeEditorModalComponentTester {
  readonly fixture = TestBed.createComponent(ManifestAttributeEditorModalComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 3 });
  readonly type = this.root.getByLabelText('Type');
  readonly key = this.root.getByLabelText('Key', { exact: true });
  readonly translationKey = this.root.getByLabelText('Translation key');
  readonly row = this.root.getByLabelText('Row');
  readonly columns = this.root.getByLabelText('Columns');
  readonly displayInViewMode = this.root.getByLabelText('Display in View Mode');
  readonly defaultValue = this.root.getByLabelText('Default Value');
  readonly unit = this.root.getByLabelText('Unit');
  readonly booleanDefaultValue = this.root.getByLabelText('Yes');
  readonly nestedTitle = this.root.getByRole('heading', { level: 5 });
  readonly nestedPath = this.root.getByCss('.nested-attributes-path');
  readonly info = this.root.getByRole('alert');
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly closeButton = this.root.getByRole('button', { name: 'Close' });
}

const displayProperties = { row: 1, columns: 6, displayInViewMode: false };
const nested: OIBusAttribute = {
  type: 'string',
  key: 'nested',
  translationKey: 'nested.key',
  validators: [],
  defaultValue: null,
  displayProperties
};

describe('ManifestAttributeEditorModalComponent', () => {
  let tester: ManifestAttributeEditorModalComponentTester;
  let fakeActiveModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });
    // registers the default validation error messages
    TestBed.createComponent(DefaultValidationErrorsComponent);
    tester = new ManifestAttributeEditorModalComponentTester();
  });

  describe('creation', () => {
    beforeEach(() => tester.component.prepareForCreation());

    test('should display an empty string attribute', async () => {
      await expect.element(tester.title).toHaveTextContent('Create Attribute');
      await expect.element(tester.type).toHaveDisplayValue('String');
      await expect.element(tester.key).toHaveValue('');
      await expect.element(tester.row).toHaveValue(0);
      await expect.element(tester.columns).toHaveValue(4);
      await expect.element(tester.displayInViewMode).toBeChecked();
      await expect.element(tester.defaultValue).toHaveValue('');
    });

    test('should not save an invalid attribute', async () => {
      await tester.key.fill('myKey');

      await tester.saveButton.click();

      expect(fakeActiveModal.close).not.toHaveBeenCalled();
      await expect.element(tester.root.getByText('This field is required')).toBeInTheDocument();
    });

    test('should create a number attribute', async () => {
      await tester.type.selectOptions('Number');
      await tester.key.fill('port');
      await tester.translationKey.fill('my.port');
      await tester.row.fill('2');
      await tester.columns.fill('3');
      await tester.displayInViewMode.click();
      await tester.defaultValue.fill('8080');
      await tester.unit.fill('ms');

      await tester.saveButton.click();

      expect(fakeActiveModal.close).toHaveBeenCalledWith({
        type: 'number',
        key: 'port',
        translationKey: 'my.port',
        validators: [],
        defaultValue: 8080,
        unit: 'ms',
        displayProperties: { row: 2, columns: 3, displayInViewMode: false }
      });
    });

    test('should reset the type-specific fields when the type changes', async () => {
      await tester.type.selectOptions('Number');
      await tester.unit.fill('ms');

      await tester.type.selectOptions('String');
      await tester.type.selectOptions('Number');

      await expect.element(tester.unit).toHaveValue('');
    });

    test.each(['Secret', 'Instant', 'Certificate'])('should only display the common fields for the %s type', async type => {
      await tester.type.selectOptions(type);

      await expect.element(tester.row).toBeInTheDocument();
      await expect.element(tester.defaultValue).not.toBeInTheDocument();
    });

    test('should display the nested attributes of a new object', async () => {
      await tester.type.selectOptions('Object');

      await expect.element(tester.row).not.toBeInTheDocument();
      await expect.element(tester.nestedTitle).toHaveTextContent('Nested Attributes (New Attribute)');
      await expect.element(tester.nestedPath).not.toBeInTheDocument();
      await expect.element(tester.root.getByText('No attributes defined')).toBeInTheDocument();

      await tester.key.fill('obj');

      await expect.element(tester.nestedTitle).toHaveTextContent('Nested Attributes (obj)');
      await expect.element(tester.nestedPath).toHaveTextContent('obj');
    });

    test('should not submit the form when pressing Enter in a field', async () => {
      await tester.key.fill('myKey');
      await tester.translationKey.fill('my.key');

      await userEvent.keyboard('{Enter}');
      expect(fakeActiveModal.close).not.toHaveBeenCalled();

      await tester.saveButton.click();
      expect(fakeActiveModal.close).toHaveBeenCalledWith(expect.objectContaining({ type: 'string', key: 'myKey' }));
    });

    test('should dismiss', async () => {
      await tester.closeButton.click();

      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });

    test('should throw for an unsupported type', () => {
      // the type cannot be selected in the UI (and has no info message to display)
      tester.component.form.patchValue({ type: 'transformer-array', key: 'key', translationKey: 'key' }, { emitEvent: false });

      expect(() => tester.component.submit()).toThrow('Unsupported attribute type: transformer-array');
    });
  });

  describe('edition', () => {
    test.each<{ attribute: OIBusAttribute; expected?: OIBusAttribute }>([
      { attribute: { type: 'string', key: 'k', translationKey: 't', validators: [], defaultValue: 'value', displayProperties } },
      {
        attribute: { type: 'number', key: 'k', translationKey: 't', validators: [], defaultValue: 3, unit: null, displayProperties },
        expected: { type: 'number', key: 'k', translationKey: 't', validators: [], defaultValue: 3, unit: '', displayProperties }
      },
      { attribute: { type: 'boolean', key: 'k', translationKey: 't', validators: [], defaultValue: true, displayProperties } },
      {
        attribute: {
          type: 'code',
          key: 'k',
          translationKey: 't',
          validators: [],
          contentType: 'sql',
          defaultValue: 'SELECT',
          displayProperties
        }
      },
      {
        attribute: {
          type: 'string-select',
          key: 'k',
          translationKey: 't',
          validators: [],
          selectableValues: ['a', 'b'],
          defaultValue: 'b',
          displayProperties
        }
      },
      { attribute: { type: 'timezone', key: 'k', translationKey: 't', validators: [], defaultValue: 'UTC', displayProperties } },
      {
        attribute: { type: 'scan-mode', key: 'k', translationKey: 't', validators: [], acceptableType: 'SUBSCRIPTION', displayProperties }
      },
      { attribute: { type: 'secret', key: 'k', translationKey: 't', validators: [], displayProperties } },
      { attribute: { type: 'instant', key: 'k', translationKey: 't', validators: [], displayProperties } },
      { attribute: { type: 'certificate', key: 'k', translationKey: 't', validators: [], displayProperties } },
      {
        attribute: {
          type: 'object',
          key: 'k',
          translationKey: 'configuration.oibus.manifest.transformers.attributes.attribute',
          validators: [],
          attributes: [nested],
          enablingConditions: [],
          displayProperties: { visible: false, wrapInBox: true }
        }
      },
      {
        attribute: {
          type: 'array',
          key: 'k',
          translationKey: 'configuration.oibus.manifest.transformers.attributes.attribute',
          validators: [],
          paginate: true,
          numberOfElementPerPage: 5,
          rootAttribute: {
            type: 'object',
            key: 'element',
            translationKey: 'configuration.oibus.manifest.transformers.attributes.attribute',
            validators: [],
            attributes: [nested],
            enablingConditions: [],
            displayProperties: { visible: true, wrapInBox: false }
          }
        }
      }
    ])('should edit a $attribute.type attribute', async ({ attribute, expected }) => {
      tester.component.prepareForEdition(attribute);

      await expect.element(tester.title).toHaveTextContent('Edit Attribute');
      await expect.element(tester.key).toHaveValue('k');
      await tester.saveButton.click();

      expect(fakeActiveModal.close).toHaveBeenCalledWith(expected ?? attribute);
    });

    test('should display the fields of the edited attribute', async () => {
      tester.component.prepareForEdition({
        type: 'number',
        key: 'port',
        translationKey: 'my.port',
        validators: [],
        defaultValue: 8080,
        unit: 'ms',
        displayProperties
      });

      await expect.element(tester.type).toHaveDisplayValue('Number');
      await expect.element(tester.translationKey).toHaveValue('my.port');
      await expect.element(tester.row).toHaveValue(1);
      await expect.element(tester.columns).toHaveValue(6);
      await expect.element(tester.displayInViewMode).not.toBeChecked();
      await expect.element(tester.defaultValue).toHaveValue(8080);
      await expect.element(tester.unit).toHaveValue('ms');
    });

    test('should display the nested attributes of an object in its context', async () => {
      tester.component.prepareForEdition(
        {
          type: 'object',
          key: 'obj',
          translationKey: 'configuration.oibus.manifest.transformers.attributes.attribute',
          validators: [],
          attributes: [nested],
          enablingConditions: [],
          displayProperties: { visible: true, wrapInBox: false }
        },
        ['root', 'parent'],
        2
      );

      await expect.element(tester.nestedTitle).toHaveTextContent('Nested Attributes (obj) (Level 3)');
      await expect.element(tester.nestedPath).toHaveTextContent('root parent obj');
      await expect.element(tester.root.getByText('Attribute', { exact: true })).toBeInTheDocument();
      await expect.element(tester.root.getByRole('cell', { name: 'nested', exact: true })).toBeInTheDocument();
      await expect.element(tester.root.getByCss('form#manifest-attribute-form-root-parent-depth-2')).toBeInTheDocument();
    });

    test('should display the nested attributes title without key', async () => {
      tester.component.prepareForEdition({
        type: 'array',
        key: '',
        translationKey: 'configuration.oibus.manifest.transformers.attributes.attribute',
        validators: [],
        paginate: false,
        numberOfElementPerPage: 20,
        rootAttribute: {
          type: 'object',
          key: 'element',
          translationKey: 't',
          validators: [],
          attributes: [],
          enablingConditions: [],
          displayProperties: { visible: true, wrapInBox: false }
        }
      });

      await expect.element(tester.nestedTitle).toHaveTextContent('Nested Attributes');
      await expect.element(tester.root.getByCss('form#manifest-attribute-form-root')).toBeInTheDocument();
    });
  });
});
