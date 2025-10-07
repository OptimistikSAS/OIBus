import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateDirective, TranslateService } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../../save-button/save-button.component';
import { OIBusAttribute, OIBUS_ATTRIBUTE_TYPES } from '../../../../../../../backend/shared/model/form.model';
import { ScanModeDTO } from '../../../../../../../backend/shared/model/scan-mode.model';
import { CertificateDTO } from '../../../../../../../backend/shared/model/certificate.model';
import { ValErrorDelayDirective } from '../../val-error-delay.directive';
import { ValidationErrorsComponent } from 'ngx-valdemort';
import { ManifestAttributesArrayComponent } from '../manifest-attributes-array/manifest-attributes-array.component';

@Component({
  selector: 'oib-manifest-nested-attributes-modal',
  templateUrl: './manifest-nested-attributes-modal.component.html',
  styleUrl: './manifest-nested-attributes-modal.component.scss',
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    SaveButtonComponent,
    ValErrorDelayDirective,
    ValidationErrorsComponent,
    ManifestAttributesArrayComponent
  ]
})
export class ManifestNestedAttributesModalComponent {
  private activeModal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private translateService = inject(TranslateService);

  mode: 'create' | 'edit' = 'create';
  scanModes: Array<ScanModeDTO> = [];
  certificates: Array<CertificateDTO> = [];
  attribute: OIBusAttribute | null = null;
  private contextPathSegments: Array<string> = [];
  recursionDepth = 0;
  isNestedAttributeEditor = false;

  state = new ObservableState();
  availableTypes = OIBUS_ATTRIBUTE_TYPES.filter((t: string) => t !== 'transformer-array');

  // Configuration for nested attributes
  nestedAttributesConfig = {
    type: 'array' as const,
    key: 'attributes',
    translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.nested-attributes',
    paginate: false,
    numberOfElementPerPage: 20,
    validators: [],
    rootAttribute: {
      type: 'object' as const,
      key: 'attribute',
      translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.attribute',
      attributes: [
        {
          type: 'string-select' as const,
          key: 'type',
          translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.type',
          selectableValues: [],
          defaultValue: 'string',
          validators: [],
          displayProperties: { row: 0, columns: 4, displayInViewMode: true }
        },
        {
          type: 'string' as const,
          key: 'key',
          translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.key',
          defaultValue: '',
          validators: [],
          displayProperties: { row: 0, columns: 4, displayInViewMode: true }
        },
        {
          type: 'string' as const,
          key: 'translationKey',
          translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.translation-key',
          defaultValue: '',
          validators: [],
          displayProperties: { row: 0, columns: 4, displayInViewMode: true }
        }
      ],
      enablingConditions: [],
      validators: [],
      displayProperties: { visible: true, wrapInBox: false }
    }
  };

  setContextPath(path: Array<string>, depth = 0) {
    this.contextPathSegments = [...path];
    this.recursionDepth = depth;
    this.initializeNestedAttributesConfig();
  }

  private initializeNestedAttributesConfig() {
    // Set selectable types for the nested attributes config
    const typeAttr = this.nestedAttributesConfig.rootAttribute.attributes.find((a: any) => a.key === 'type') as any;
    if (typeAttr) {
      typeAttr.selectableValues = [...this.availableTypes];
    }
  }

  get nestedAttributesContext(): Array<string> {
    const key = this.currentAttributeKey;
    if (!key) {
      // In create mode with empty key, expose a placeholder '' for the current element
      return [...this.contextPathSegments, ''];
    }
    return [...this.contextPathSegments, key];
  }

  get nestedAttributesTitle(): string {
    const base = this.translateService.instant('configuration.oibus.manifest.transformers.manifest-builder.nested-attributes');
    const key = this.currentAttributeKey;
    const depthIndicator = this.recursionDepth > 0 ? ` (Level ${this.recursionDepth + 1})` : '';
    if (key) {
      return `${base} (${key})${depthIndicator}`;
    } else if (this.mode === 'create') {
      return `${base} (New Attribute)${depthIndicator}`;
    } else {
      return `${base}${depthIndicator}`;
    }
  }

  get nestedAttributesPath(): string | null {
    const segments = this.nestedAttributesContext.filter(segment => !!segment);
    if (segments.length === 0) return null;

    return segments.map(segment => `<span>${segment}</span>`).join(' <i class="fa fa-solid fa-angle-right path-separator"></i> ');
  }

  get uniqueFormId(): string {
    const contextHash = this.contextPathSegments.join('-');
    const depthSuffix = this.recursionDepth > 0 ? `-depth-${this.recursionDepth}` : '';
    return `manifest-nested-attribute-form-${contextHash}${depthSuffix}`;
  }

  onGlobalKeydown(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key !== 'Enter' || keyboardEvent.shiftKey) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    if (this.isSubmitControl(target) || target instanceof HTMLTextAreaElement) {
      return;
    }

    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
  }

  onNestedEnter(event: Event) {
    this.onGlobalKeydown(event);
  }

  private isSubmitControl(target: HTMLElement): boolean {
    if (target instanceof HTMLButtonElement) {
      return true;
    }

    if (target instanceof HTMLInputElement) {
      const type = (target.type || '').toLowerCase();
      return type === 'submit' || type === 'button';
    }

    return target.closest('button[oib-save-button]') !== null;
  }

  private get currentAttributeKey(): string | null {
    const keyControl = this.form.get('key');
    const key = keyControl?.value;
    if (key) {
      return key;
    }
    return this.attribute?.key ?? null;
  }

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
    numberOfElementPerPage: [20],
    // Nested attributes for object and array types
    attributes: this.fb.control<Array<any>>([])
  });

  prepareForCreation(scanModes: Array<ScanModeDTO>, certificates: Array<CertificateDTO>, contextPath: Array<string> = [], depth = 0) {
    this.mode = 'create';
    this.scanModes = scanModes;
    this.certificates = certificates;
    this.attribute = null;
    this.setContextPath(contextPath, depth);
    this.isNestedAttributeEditor = depth > 0;
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
      numberOfElementPerPage: 20,
      attributes: []
    });
    this.attributesControl.setValue([]);
  }

  prepareForEdition(
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    attribute: OIBusAttribute,
    contextPath: Array<string> = [],
    depth = 0
  ) {
    this.mode = 'edit';
    this.scanModes = scanModes;
    this.certificates = certificates;
    this.attribute = attribute;
    this.setContextPath(contextPath, depth);
    this.isNestedAttributeEditor = depth > 0;
    this.attributesControl.setValue([]);
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
        this.attributesControl.setValue([...((attribute as any).attributes ?? [])]);
        break;
      case 'array':
        formValue.paginate = (attribute as any).paginate ?? false;
        formValue.numberOfElementPerPage = (attribute as any).numberOfElementPerPage ?? 20;
        this.attributesControl.setValue([...((attribute as any).rootAttribute?.attributes ?? [])]);
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
      numberOfElementPerPage: 20,
      attributes: []
    });
    this.attributesControl.setValue([]);
  }

  dismiss() {
    this.activeModal.dismiss();
  }

  submit() {
    if (this.form.valid) {
      const formValue = this.form.value;
      const attribute = this.buildAttributeFromForm(formValue);

      if (this.isNestedAttributeEditor) {
        // For nested attribute editors, we need to handle the save differently
        // Instead of closing the modal, we should update the nested attributes array
        // and return to the parent modal
        this.handleNestedAttributeSave(attribute);
      } else {
        // For top-level attribute editors, close the modal normally
        this.activeModal.close(attribute);
      }
    }
  }

  private handleNestedAttributeSave(attribute: OIBusAttribute) {
    // This method handles saving nested attributes within a nested context
    // We need to update the nested attributes array and return to the parent modal
    // For now, we'll just close the modal with the attribute
    // The parent component will handle adding it to the nested attributes array
    this.activeModal.close(attribute);
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
          attributes: formValue.attributes || [],
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
            attributes: formValue.attributes || [],
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

  get attributesControl(): FormControl<Array<any>> {
    return this.form.get('attributes') as FormControl<Array<any>>;
  }

  hasNestedAttributes(): boolean {
    return this.isObjectType() || this.isArrayType();
  }
}
