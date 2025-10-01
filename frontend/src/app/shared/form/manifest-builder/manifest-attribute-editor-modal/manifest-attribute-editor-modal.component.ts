import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../../save-button/save-button.component';
import { OIBUS_ATTRIBUTE_TYPES, OIBusArrayAttribute, OIBusAttribute } from '../../../../../../../backend/shared/model/form.model';
import { ValErrorDelayDirective } from '../../val-error-delay.directive';
import { ValidationErrorsComponent } from 'ngx-valdemort';
import { ManifestAttributesArrayComponent } from '../manifest-attributes-array/manifest-attributes-array.component';

@Component({
  selector: 'oib-manifest-attribute-editor-modal',
  templateUrl: './manifest-attribute-editor-modal.component.html',
  styleUrl: './manifest-attribute-editor-modal.component.scss',
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    SaveButtonComponent,
    ValErrorDelayDirective,
    ValidationErrorsComponent,
    ManifestAttributesArrayComponent,
    TranslatePipe
  ]
})
export class ManifestAttributeEditorModalComponent {
  private activeModal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private translateService = inject(TranslateService);

  mode: 'create' | 'edit' = 'create';
  attribute: OIBusAttribute | null = null;

  // Context tracking for nested editing
  private contextPathSegments: Array<string> = [];
  private depth = 0;

  state = new ObservableState();
  availableTypes = OIBUS_ATTRIBUTE_TYPES.filter((t: string) => t !== 'transformer-array');

  // Configuration for nested attributes (used by ManifestAttributesArrayComponent)
  nestedAttributesConfig: OIBusArrayAttribute = {
    type: 'array' as const,
    key: 'attributes',
    translationKey: 'configuration.oibus.manifest.transformers.attributes.nested-attributes',
    paginate: false,
    numberOfElementPerPage: 20,
    validators: [],
    rootAttribute: {
      type: 'object' as const,
      key: 'attribute',
      translationKey: 'configuration.oibus.manifest.transformers.attributes.attribute',
      attributes: [
        {
          type: 'string-select' as const,
          key: 'type',
          translationKey: 'configuration.oibus.manifest.transformers.attributes.type',
          selectableValues: [],
          defaultValue: 'string',
          validators: [],
          displayProperties: { row: 0, columns: 4, displayInViewMode: true }
        },
        {
          type: 'string' as const,
          key: 'key',
          translationKey: 'configuration.oibus.manifest.transformers.attributes.key',
          defaultValue: '',
          validators: [],
          displayProperties: { row: 0, columns: 4, displayInViewMode: true }
        },
        {
          type: 'string' as const,
          key: 'translationKey',
          translationKey: 'configuration.oibus.manifest.transformers.attributes.translation-key',
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
    defaultValue_number: [null as number | null],
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
    attributes: this.fb.control<Array<OIBusAttribute>>([])
  });

  /**
   * Set the context path for this editor instance
   * Called before prepareForCreation or prepareForEdition
   */
  setContextPath(path: Array<string>, depth = 0) {
    this.contextPathSegments = [...path];
    this.depth = depth;
    this.initializeNestedAttributesConfig();
  }

  private initializeNestedAttributesConfig() {
    const typeAttributes = this.nestedAttributesConfig.rootAttribute.attributes.find((a: any) => a.key === 'type') as any;
    if (typeAttributes) {
      typeAttributes.selectableValues = [...this.availableTypes];
    }
  }

  /**
   * Prepare modal for creating a new attribute
   */
  prepareForCreation(contextPath: Array<string> = [], depth = 0) {
    this.mode = 'create';
    this.attribute = null;
    this.setContextPath(contextPath, depth);
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

  /**
   * Prepare modal for editing an existing attribute
   */
  prepareForEdition(attribute: OIBusAttribute, contextPath: Array<string> = [], depth = 0) {
    this.mode = 'edit';
    this.attribute = attribute;
    this.setContextPath(contextPath, depth);
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

    switch (attribute.type) {
      case 'string':
        formValue.defaultValue_string = attribute.defaultValue ?? '';
        break;
      case 'number':
        formValue.defaultValue_number = attribute.defaultValue ?? null;
        formValue.unit = attribute.unit ?? '';
        break;
      case 'boolean':
        formValue.defaultValue_boolean = attribute.defaultValue ?? false;
        break;
      case 'code':
        formValue.contentType = attribute.contentType ?? 'json';
        formValue.defaultValue_code = attribute.defaultValue ?? '';
        break;
      case 'string-select':
        formValue.defaultValue_string = attribute.defaultValue ?? '';
        formValue.selectableValuesCsv = (attribute.selectableValues ?? []).join(',');
        break;
      case 'timezone':
        formValue.defaultValue_timezone = attribute.defaultValue ?? '';
        break;
      case 'scan-mode':
        formValue.acceptableType = attribute.acceptableType ?? 'POLL';
        break;
      case 'object':
        formValue.visible = attribute.displayProperties?.visible ?? true;
        formValue.wrapInBox = attribute.displayProperties?.wrapInBox ?? false;
        formValue.attributes = attribute.attributes ?? [];
        break;
      case 'array':
        formValue.paginate = attribute.paginate ?? false;
        formValue.numberOfElementPerPage = attribute.numberOfElementPerPage ?? 20;
        formValue.attributes = attribute.rootAttribute?.attributes ?? [];
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
            translationKey: formValue.translationKey,
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

  get nestedAttributesContext(): Array<string> {
    const key = this.currentAttributeKey;
    if (!key) {
      // In create mode with empty key, expose a placeholder '' for the current element
      return [...this.contextPathSegments, ''];
    }
    return [...this.contextPathSegments, key];
  }

  get nestedAttributesTitle(): string {
    const base = this.translateService.instant('configuration.oibus.manifest.transformers.attributes.nested-attributes');
    const key = this.currentAttributeKey;
    const depthIndicator = this.depth > 0 ? ` (Level ${this.depth + 1})` : '';

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
    const contextHash = this.contextPathSegments.join('-') || 'root';
    const depthSuffix = this.depth > 0 ? `-depth-${this.depth}` : '';
    return `manifest-attribute-form-${contextHash}${depthSuffix}`;
  }

  private get currentAttributeKey(): string | null {
    const keyControl = this.form.get('key');
    const key = keyControl?.value;
    if (key) {
      return key;
    }
    return this.attribute?.key ?? null;
  }

  get attributesControl(): FormControl<Array<any>> {
    return this.form.get('attributes') as FormControl<Array<any>>;
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

  // Type Checking Helpers (for template)
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

  /**
   * Called when nested attributes are modified
   * Ensures the form state is properly updated
   */
  onNestedAttributeChange(): void {
    this.form.markAsDirty();
    this.form.updateValueAndValidity();
  }
}
