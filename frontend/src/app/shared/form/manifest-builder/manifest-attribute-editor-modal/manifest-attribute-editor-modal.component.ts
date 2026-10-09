import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ValidationErrorsComponent } from 'ngx-valdemort';

import { OIBUS_ATTRIBUTE_TYPES, OIBusAttribute, OIBusAttributeType } from '@oibus/shared/connector/form.model';

import { ObservableState, SaveButtonComponent } from '../../../save-button/save-button.component';
import { ValErrorDelayDirective } from '../../val-error-delay.directive';
import { ManifestAttributesArrayComponent } from '../manifest-attributes-array/manifest-attributes-array.component';

const DISPLAYABLE_TYPES: ReadonlyArray<OIBusAttributeType> = [
  'string',
  'number',
  'boolean',
  'code',
  'string-select',
  'timezone',
  'scan-mode',
  'secret',
  'instant',
  'certificate'
];

@Component({
  selector: 'oib-manifest-attribute-editor-modal',
  templateUrl: './manifest-attribute-editor-modal.component.html',
  styleUrl: './manifest-attribute-editor-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  private readonly activeModal = inject(NgbActiveModal);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly translateService = inject(TranslateService);

  readonly mode = signal<'create' | 'edit'>('create');
  readonly attribute = signal<OIBusAttribute | null>(null);

  // Context tracking for nested editing
  private readonly contextPathSegments = signal<Array<string>>([]);
  private readonly depth = signal(0);

  readonly state = new ObservableState();
  readonly availableTypes = OIBUS_ATTRIBUTE_TYPES.filter(type => type !== 'transformer-array');

  readonly form = this.fb.group({
    type: ['string' as OIBusAttributeType, [Validators.required]],
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
    contentType: ['json' as 'json' | 'sql'],
    selectableValuesCsv: [''],
    acceptableType: ['POLL' as 'POLL' | 'SUBSCRIPTION_AND_POLL' | 'SUBSCRIPTION'],
    // Object/Array specific
    visible: [true],
    wrapInBox: [false],
    paginate: [false],
    numberOfElementPerPage: [20 as number | null],
    // Nested attributes for object and array types
    attributes: this.fb.control<Array<OIBusAttribute>>([])
  });
  readonly attributesControl = this.form.controls.attributes;

  private readonly type = toSignal(this.form.controls.type.valueChanges, { initialValue: this.form.controls.type.value });
  private readonly key = toSignal(this.form.controls.key.valueChanges, { initialValue: this.form.controls.key.value });

  readonly isStringType = computed(() => this.type() === 'string');
  readonly isNumberType = computed(() => this.type() === 'number');
  readonly isBooleanType = computed(() => this.type() === 'boolean');
  readonly isCodeType = computed(() => this.type() === 'code');
  readonly isStringSelectType = computed(() => this.type() === 'string-select');
  readonly isTimezoneType = computed(() => this.type() === 'timezone');
  readonly isScanModeType = computed(() => this.type() === 'scan-mode');
  readonly isObjectType = computed(() => this.type() === 'object');
  readonly isArrayType = computed(() => this.type() === 'array');
  readonly isDisplayableType = computed(() => DISPLAYABLE_TYPES.includes(this.type()));
  readonly infoTranslationKey = computed(() => `configuration.oibus.manifest.transformers.attributes.${this.type()}-info`);

  private readonly currentAttributeKey = computed(() => this.key() || this.attribute()?.key || null);

  /** The path of the edited attribute, with a placeholder '' for a new attribute without key */
  readonly nestedAttributesContext = computed(() => [...this.contextPathSegments(), this.currentAttributeKey() ?? '']);

  readonly nestedAttributesTitle = computed(() => {
    const base = this.translateService.instant('configuration.oibus.manifest.transformers.attributes.nested-attributes');
    const key = this.currentAttributeKey();
    const depthIndicator = this.depth() > 0 ? ` (Level ${this.depth() + 1})` : '';

    if (key) {
      return `${base} (${key})${depthIndicator}`;
    } else if (this.mode() === 'create') {
      return `${base} (New Attribute)${depthIndicator}`;
    } else {
      return `${base}${depthIndicator}`;
    }
  });

  readonly nestedAttributesPath = computed(() => {
    const segments = this.nestedAttributesContext().filter(segment => !!segment);
    if (segments.length === 0) return null;

    return segments.map(segment => `<span>${segment}</span>`).join(' <i class="fa-solid fa-angle-right path-separator"></i> ');
  });

  /** Nested editors are opened in other modals: their form ids must be unique */
  readonly uniqueFormId = computed(() => {
    const contextHash = this.contextPathSegments().join('-') || 'root';
    const depthSuffix = this.depth() > 0 ? `-depth-${this.depth()}` : '';
    return `manifest-attribute-form-${contextHash}${depthSuffix}`;
  });

  /**
   * Set the context path for this editor instance
   * Called before prepareForCreation or prepareForEdition
   */
  setContextPath(path: Array<string>, depth = 0) {
    this.contextPathSegments.set([...path]);
    this.depth.set(depth);
  }

  /**
   * Prepare modal for creating a new attribute
   */
  prepareForCreation(contextPath: Array<string> = [], depth = 0) {
    this.mode.set('create');
    this.attribute.set(null);
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
  }

  /**
   * Prepare modal for editing an existing attribute
   */
  prepareForEdition(attribute: OIBusAttribute, contextPath: Array<string> = [], depth = 0) {
    this.mode.set('edit');
    this.attribute.set(attribute);
    this.setContextPath(contextPath, depth);
    this.attributesControl.setValue([]);
    this.populateForm(attribute);
  }

  private populateForm(attribute: OIBusAttribute) {
    const formValue: Parameters<typeof this.form.patchValue>[0] = {
      type: attribute.type,
      key: attribute.key,
      translationKey: attribute.translationKey
    };
    if (attribute.type !== 'object' && attribute.type !== 'array') {
      formValue.row = attribute.displayProperties?.row ?? 0;
      formValue.columns = attribute.displayProperties?.columns ?? 4;
      formValue.displayInViewMode = attribute.displayProperties?.displayInViewMode ?? true;
    } else {
      formValue.row = 0;
      formValue.columns = 4;
      formValue.displayInViewMode = true;
    }

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
      this.activeModal.close(this.buildAttributeFromForm());
    }
  }

  private buildAttributeFromForm(): OIBusAttribute {
    const formValue = this.form.getRawValue();
    const baseAttribute = {
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
          defaultValue: formValue.defaultValue_number === null ? null : Number(formValue.defaultValue_number),
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
        const values = formValue.selectableValuesCsv
          .split(',')
          .map(value => value.trim())
          .filter(value => value.length > 0);
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
          numberOfElementPerPage: formValue.numberOfElementPerPage === null ? 20 : Number(formValue.numberOfElementPerPage),
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

  /**
   * Called when nested attributes are modified
   * Ensures the form state is properly updated
   */
  onNestedAttributeChange(): void {
    this.form.markAsDirty();
    this.form.updateValueAndValidity();
  }
}
