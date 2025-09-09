import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../../save-button/save-button.component';
import { OIBusAttribute, OIBUS_ATTRIBUTE_TYPES } from '../../../../../../../backend/shared/model/form.model';
import { ScanModeDTO } from '../../../../../../../backend/shared/model/scan-mode.model';
import { CertificateDTO } from '../../../../../../../backend/shared/model/certificate.model';
import { ValErrorDelayDirective } from '../../val-error-delay.directive';
import { ValidationErrorsComponent } from 'ngx-valdemort';

@Component({
  selector: 'oib-manifest-attribute-editor-modal',
  templateUrl: './manifest-attribute-editor-modal.component.html',
  styleUrl: './manifest-attribute-editor-modal.component.scss',
  imports: [ReactiveFormsModule, TranslateDirective, SaveButtonComponent, ValErrorDelayDirective, ValidationErrorsComponent]
})
export class ManifestAttributeEditorModalComponent {
  private activeModal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);

  mode: 'create' | 'edit' = 'create';
  scanModes: Array<ScanModeDTO> = [];
  certificates: Array<CertificateDTO> = [];
  attribute: OIBusAttribute | null = null;

  state = new ObservableState();
  availableTypes = OIBUS_ATTRIBUTE_TYPES.filter((t: string) => t !== 'transformer-array');

  form = this.fb.group({
    type: ['string', [Validators.required]],
    key: ['', [Validators.required]],
    translationKey: ['', [Validators.required]],
    // Common display properties
    row: [0],
    columns: [4],
    displayInViewMode: [true],
    // Type-specific properties
    defaultValue_string: [''],
    defaultValue_number: [null],
    defaultValue_boolean: [false],
    defaultValue_code: [''],
    defaultValue_timezone: [''],
    unit: [''],
    contentType: ['json'],
    selectableValuesCsv: [''],
    acceptableType: ['POLL'],
    // Object/Array specific
    visible: [true],
    wrapInBox: [false],
    paginate: [false],
    numberOfElementPerPage: [20]
  });

  prepareForCreation(scanModes: Array<ScanModeDTO>, certificates: Array<CertificateDTO>) {
    this.mode = 'create';
    this.scanModes = scanModes;
    this.certificates = certificates;
    this.attribute = null;
    this.form.reset({
      type: 'string',
      key: '',
      translationKey: '',
      row: 0,
      columns: 4,
      displayInViewMode: true,
      defaultValue_string: '',
      defaultValue_number: null,
      defaultValue_boolean: false,
      defaultValue_code: '',
      defaultValue_timezone: '',
      unit: '',
      contentType: 'json',
      selectableValuesCsv: '',
      acceptableType: 'POLL',
      visible: true,
      wrapInBox: false,
      paginate: false,
      numberOfElementPerPage: 20
    });
  }

  prepareForEdition(scanModes: Array<ScanModeDTO>, certificates: Array<CertificateDTO>, attribute: OIBusAttribute) {
    this.mode = 'edit';
    this.scanModes = scanModes;
    this.certificates = certificates;
    this.attribute = attribute;
    this.populateForm(attribute);
  }

  private populateForm(attribute: OIBusAttribute) {
    const formValue: any = {
      type: attribute.type,
      key: attribute.key,
      translationKey: attribute.translationKey,
      row: (attribute as any).displayProperties?.row ?? 0,
      columns: (attribute as any).displayProperties?.columns ?? 4,
      displayInViewMode: (attribute as any).displayProperties?.displayInViewMode ?? true
    };

    // Type-specific values
    switch (attribute.type) {
      case 'string':
        formValue.defaultValue_string = (attribute as any).defaultValue ?? '';
        break;
      case 'number':
        formValue.defaultValue_number = (attribute as any).defaultValue ?? null;
        formValue.unit = (attribute as any).unit ?? '';
        break;
      case 'boolean':
        formValue.defaultValue_boolean = (attribute as any).defaultValue ?? false;
        break;
      case 'code':
        formValue.contentType = (attribute as any).contentType ?? 'json';
        formValue.defaultValue_code = (attribute as any).defaultValue ?? '';
        break;
      case 'string-select':
        formValue.defaultValue_string = (attribute as any).defaultValue ?? '';
        formValue.selectableValuesCsv = ((attribute as any).selectableValues ?? []).join(',');
        break;
      case 'timezone':
        formValue.defaultValue_timezone = (attribute as any).defaultValue ?? '';
        break;
      case 'scan-mode':
        formValue.acceptableType = (attribute as any).acceptableType ?? 'POLL';
        break;
      case 'object':
        formValue.visible = (attribute as any).displayProperties?.visible ?? true;
        formValue.wrapInBox = (attribute as any).displayProperties?.wrapInBox ?? false;
        break;
      case 'array':
        formValue.paginate = (attribute as any).paginate ?? false;
        formValue.numberOfElementPerPage = (attribute as any).numberOfElementPerPage ?? 20;
        break;
    }

    this.form.patchValue(formValue);
  }

  onTypeChange() {
    // Reset type-specific fields when type changes
    this.form.patchValue({
      defaultValue_string: '',
      defaultValue_number: null,
      defaultValue_boolean: false,
      defaultValue_code: '',
      defaultValue_timezone: '',
      unit: '',
      contentType: 'json',
      selectableValuesCsv: '',
      acceptableType: 'POLL',
      visible: true,
      wrapInBox: false,
      paginate: false,
      numberOfElementPerPage: 20
    });
  }

  dismiss() {
    this.activeModal.dismiss();
  }

  submit() {
    if (this.form.valid) {
      const formValue = this.form.value;
      const attribute = this.buildAttributeFromForm(formValue);
      this.activeModal.close(attribute);
    }
  }

  private buildAttributeFromForm(formValue: any): OIBusAttribute {
    const baseAttribute = {
      type: formValue.type,
      key: formValue.key,
      translationKey: formValue.translationKey,
      validators: []
    };

    switch (formValue.type) {
      case 'string':
        return {
          ...baseAttribute,
          type: 'string',
          defaultValue: formValue.defaultValue_string ?? null,
          displayProperties: {
            row: Number(formValue.row ?? 0),
            columns: Number(formValue.columns ?? 4),
            displayInViewMode: formValue.displayInViewMode ?? true
          }
        };

      case 'number':
        return {
          ...baseAttribute,
          type: 'number',
          defaultValue:
            formValue.defaultValue_number === '' || formValue.defaultValue_number === null || formValue.defaultValue_number === undefined
              ? null
              : Number(formValue.defaultValue_number),
          unit: formValue.unit ?? null,
          displayProperties: {
            row: Number(formValue.row ?? 0),
            columns: Number(formValue.columns ?? 4),
            displayInViewMode: formValue.displayInViewMode ?? true
          }
        };

      case 'boolean':
        return {
          ...baseAttribute,
          type: 'boolean',
          defaultValue: formValue.defaultValue_boolean ?? false,
          displayProperties: {
            row: Number(formValue.row ?? 0),
            columns: Number(formValue.columns ?? 4),
            displayInViewMode: formValue.displayInViewMode ?? true
          }
        };

      case 'code':
        return {
          ...baseAttribute,
          type: 'code',
          contentType: formValue.contentType || 'json',
          defaultValue: formValue.defaultValue_code ?? '',
          displayProperties: {
            row: Number(formValue.row ?? 0),
            columns: Number(formValue.columns ?? 4),
            displayInViewMode: formValue.displayInViewMode ?? true
          }
        };

      case 'string-select':
        const values =
          typeof formValue.selectableValuesCsv === 'string'
            ? formValue.selectableValuesCsv
                .split(',')
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 0)
            : [];
        return {
          ...baseAttribute,
          type: 'string-select',
          selectableValues: values,
          defaultValue: formValue.defaultValue_string ?? null,
          displayProperties: {
            row: Number(formValue.row ?? 0),
            columns: Number(formValue.columns ?? 4),
            displayInViewMode: formValue.displayInViewMode ?? true
          }
        };

      case 'secret':
      case 'instant':
      case 'certificate':
        return {
          ...baseAttribute,
          type: formValue.type,
          displayProperties: {
            row: Number(formValue.row ?? 0),
            columns: Number(formValue.columns ?? 4),
            displayInViewMode: formValue.displayInViewMode ?? true
          }
        };

      case 'scan-mode':
        return {
          ...baseAttribute,
          type: 'scan-mode',
          acceptableType: formValue.acceptableType || 'POLL',
          displayProperties: {
            row: Number(formValue.row ?? 0),
            columns: Number(formValue.columns ?? 4),
            displayInViewMode: formValue.displayInViewMode ?? true
          }
        };

      case 'timezone':
        return {
          ...baseAttribute,
          type: 'timezone',
          defaultValue: formValue.defaultValue_timezone ?? null,
          displayProperties: {
            row: Number(formValue.row ?? 0),
            columns: Number(formValue.columns ?? 4),
            displayInViewMode: formValue.displayInViewMode ?? true
          }
        };

      case 'object':
        return {
          ...baseAttribute,
          type: 'object',
          attributes: [],
          enablingConditions: [],
          displayProperties: {
            visible: formValue.visible ?? true,
            wrapInBox: formValue.wrapInBox ?? false
          }
        };

      case 'array':
        return {
          ...baseAttribute,
          type: 'array',
          paginate: formValue.paginate ?? false,
          numberOfElementPerPage:
            formValue.numberOfElementPerPage === '' ||
            formValue.numberOfElementPerPage === null ||
            formValue.numberOfElementPerPage === undefined
              ? 20
              : Number(formValue.numberOfElementPerPage),
          rootAttribute: {
            type: 'object',
            key: 'element',
            translationKey: formValue.translationKey || 'configuration.oibus.manifest.transformers.mapping.title',
            attributes: [],
            enablingConditions: [],
            validators: [],
            displayProperties: {
              visible: true,
              wrapInBox: false
            }
          }
        };

      default:
        throw new Error(`Unsupported attribute type: ${formValue.type}`);
    }
  }

  // Helper methods for template
  isStringType(): boolean {
    return this.form.get('type')?.value === 'string';
  }

  isNumberType(): boolean {
    return this.form.get('type')?.value === 'number';
  }

  isBooleanType(): boolean {
    return this.form.get('type')?.value === 'boolean';
  }

  isCodeType(): boolean {
    return this.form.get('type')?.value === 'code';
  }

  isStringSelectType(): boolean {
    return this.form.get('type')?.value === 'string-select';
  }

  isTimezoneType(): boolean {
    return this.form.get('type')?.value === 'timezone';
  }

  isScanModeType(): boolean {
    return this.form.get('type')?.value === 'scan-mode';
  }

  isObjectType(): boolean {
    return this.form.get('type')?.value === 'object';
  }

  isArrayType(): boolean {
    return this.form.get('type')?.value === 'array';
  }

  isDisplayableType(): boolean {
    const type = this.form.get('type')?.value;
    return ['string', 'number', 'boolean', 'code', 'string-select', 'timezone', 'scan-mode', 'secret', 'instant', 'certificate'].includes(
      type || ''
    );
  }
}
