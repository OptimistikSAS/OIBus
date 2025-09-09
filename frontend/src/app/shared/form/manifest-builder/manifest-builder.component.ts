import { Component, forwardRef, inject, OnInit } from '@angular/core';
import { ControlValueAccessor, FormBuilder, FormControl, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
  OIBUS_ATTRIBUTE_TYPES,
  OIBusArrayAttribute,
  OIBusAttribute,
  OIBusObjectAttribute
} from '../../../../../../backend/shared/model/form.model';
import { ManifestAttributesArrayComponent } from './manifest-attributes-array/manifest-attributes-array.component';

@Component({
  selector: 'oib-manifest-builder',
  templateUrl: './manifest-builder.component.html',
  styleUrl: './manifest-builder.component.scss',
  imports: [ReactiveFormsModule, TranslateModule, ManifestAttributesArrayComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ManifestBuilderComponent),
      multi: true
    }
  ]
})
export class ManifestBuilderComponent implements OnInit, ControlValueAccessor {
  private fb = inject(FormBuilder);

  private onChange: (value: OIBusObjectAttribute | null) => void = () => {};
  private onTouched: () => void = () => {};
  private currentValue: OIBusObjectAttribute | null = null;

  availableTypes = OIBUS_ATTRIBUTE_TYPES.filter(t => t !== 'transformer-array');

  // Table data for attributes (each element is a flat object edited via the modal)
  attributesControl: FormControl<Array<any>> = this.fb.control<Array<any>>([]) as FormControl<Array<any>>;

  // Top-level display properties
  form = this.fb.group({
    visible: [true],
    wrapInBox: [false]
  });

  // Element editor manifest for a single attribute
  attributeElementManifest: OIBusObjectAttribute = {
    type: 'object',
    key: 'attribute',
    translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.attribute',
    attributes: [
      {
        type: 'string-select',
        key: 'type',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.type',
        selectableValues: [],
        defaultValue: 'string',
        validators: [],
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      },
      {
        type: 'string',
        key: 'key',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.key',
        defaultValue: '',
        validators: [],
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      },
      {
        type: 'string',
        key: 'translationKey',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.translation-key',
        defaultValue: '',
        validators: [],
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      },
      // Common layout props for displayable (non object/array)
      {
        type: 'number',
        key: 'row',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.row',
        defaultValue: 0,
        validators: [],
        displayProperties: { row: 1, columns: 4, displayInViewMode: false },
        unit: ''
      },
      {
        type: 'number',
        key: 'columns',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.columns',
        defaultValue: 4,
        validators: [],
        displayProperties: { row: 1, columns: 4, displayInViewMode: false },
        unit: ''
      },
      {
        type: 'boolean',
        key: 'displayInViewMode',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.display-in-view-mode',
        defaultValue: true,
        validators: [],
        displayProperties: { row: 1, columns: 4, displayInViewMode: false }
      },
      // String
      {
        type: 'string',
        key: 'defaultValue_string',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.default-value',
        defaultValue: '',
        validators: [],
        displayProperties: { row: 2, columns: 6, displayInViewMode: false }
      },
      // Number
      {
        type: 'number',
        key: 'defaultValue_number',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.default-value',
        defaultValue: null,
        validators: [],
        displayProperties: { row: 2, columns: 3, displayInViewMode: false },
        unit: ''
      },
      {
        type: 'string',
        key: 'unit',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.unit',
        defaultValue: '',
        validators: [],
        displayProperties: { row: 2, columns: 3, displayInViewMode: false }
      },
      // Boolean
      {
        type: 'boolean',
        key: 'defaultValue_boolean',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.default-value',
        defaultValue: false,
        validators: [],
        displayProperties: { row: 2, columns: 6, displayInViewMode: false }
      },
      // Code
      {
        type: 'string-select',
        key: 'contentType',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.content-type',
        selectableValues: ['json', 'sql'],
        defaultValue: 'json',
        validators: [],
        displayProperties: { row: 2, columns: 3, displayInViewMode: false }
      },
      {
        type: 'string',
        key: 'defaultValue_code',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.default-value',
        defaultValue: '',
        validators: [],
        displayProperties: { row: 2, columns: 3, displayInViewMode: false }
      },
      // String select
      {
        type: 'string',
        key: 'selectableValuesCsv',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.selectable-values',
        defaultValue: '',
        validators: [],
        displayProperties: { row: 2, columns: 6, displayInViewMode: false }
      },
      // Scan mode
      {
        type: 'string-select',
        key: 'acceptableType',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.acceptable-type',
        selectableValues: ['POLL', 'SUBSCRIPTION', 'SUBSCRIPTION_AND_POLL'],
        defaultValue: 'POLL',
        validators: [],
        displayProperties: { row: 2, columns: 6, displayInViewMode: false }
      },
      // Timezone
      {
        type: 'string',
        key: 'defaultValue_timezone',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.default-value',
        defaultValue: '',
        validators: [],
        displayProperties: { row: 2, columns: 6, displayInViewMode: false }
      },
      // Object specific
      {
        type: 'boolean',
        key: 'visible',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.visible',
        defaultValue: true,
        validators: [],
        displayProperties: { row: 3, columns: 6, displayInViewMode: false }
      },
      {
        type: 'boolean',
        key: 'wrapInBox',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.wrap-in-box',
        defaultValue: false,
        validators: [],
        displayProperties: { row: 3, columns: 6, displayInViewMode: false }
      },
      // Array specific
      {
        type: 'boolean',
        key: 'paginate',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.paginate',
        defaultValue: false,
        validators: [],
        displayProperties: { row: 4, columns: 6, displayInViewMode: false }
      },
      {
        type: 'number',
        key: 'numberOfElementPerPage',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.number-of-elements-per-page',
        defaultValue: 20,
        validators: [],
        unit: '', // Added required 'unit' property for OIBusNumberAttribute
        displayProperties: { row: 4, columns: 6, displayInViewMode: false }
      },
      // Nested attributes (for object and array root)
      {
        type: 'array',
        key: 'attributes',
        translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.nested-attributes',
        paginate: false,
        numberOfElementPerPage: 20,
        validators: [],
        rootAttribute: {
          type: 'object',
          key: 'attribute',
          translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.attribute',
          attributes: [],
          enablingConditions: [],
          validators: [],
          displayProperties: { visible: true, wrapInBox: false }
        }
      }
    ],
    validators: [],
    displayProperties: { visible: true, wrapInBox: false },
    enablingConditions: []
  };

  // Array attribute used by the oib-array component
  arrayAttribute: OIBusArrayAttribute = {
    type: 'array',
    key: 'attributes',
    translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.attributes',
    paginate: false,
    numberOfElementPerPage: 20,
    validators: [],
    rootAttribute: this.attributeElementManifest
  };

  ngOnInit() {
    // set selectable types once component is constructed
    const typeAttr = this.attributeElementManifest.attributes.find(a => a.key === 'type') as any;
    if (typeAttr) {
      typeAttr.selectableValues = [...this.availableTypes];
    }

    // finalize recursion: nested attributes array uses same element manifest
    const nestedArrayAttr = this.attributeElementManifest.attributes.find(a => a.key === 'attributes') as any;
    if (nestedArrayAttr) {
      nestedArrayAttr.rootAttribute = this.attributeElementManifest;
    }

    this.initializeForm();
    this.setupAutoSave();
  }

  private initializeForm() {
    const manifest = this.currentValue;
    const defaultManifest: OIBusObjectAttribute = {
      type: 'object',
      key: 'options',
      translationKey: 'configuration.oibus.manifest.transformers.options',
      attributes: [],
      enablingConditions: [],
      validators: [],
      displayProperties: { visible: true, wrapInBox: false }
    };
    const value = manifest ?? defaultManifest;
    this.currentValue = value;

    this.form.patchValue({
      visible: value.displayProperties.visible,
      wrapInBox: value.displayProperties.wrapInBox
    });

    // Map manifest attributes to flat editor objects used by oib-array
    const flatAttributes = (value.attributes || []).map(attr => this.flattenAttribute(attr));
    this.attributesControl.setValue(flatAttributes, { emitEvent: false });
  }

  generateManifest(): OIBusObjectAttribute {
    const formValue = this.form.value;

    // Deduplicate by key to avoid duplicates in the resulting manifest
    const seen = new Set<string>();
    const flat = (this.attributesControl.value || []).filter((attr: any) => {
      if (!attr?.key) {
        return false;
      }
      if (seen.has(attr.key)) {
        return false;
      }
      seen.add(attr.key);
      return true;
    });
    const attributes: Array<OIBusAttribute> = flat.map((attr: any) => this.buildAttributeFromForm(attr));

    return {
      type: 'object',
      key: 'options',
      translationKey: 'configuration.oibus.manifest.transformers.options',
      attributes,
      enablingConditions: [],
      validators: [],
      displayProperties: {
        visible: formValue.visible ?? true,
        wrapInBox: formValue.wrapInBox ?? false
      }
    };
  }

  private flattenAttribute(attribute: OIBusAttribute): any {
    const base: any = {
      type: (attribute as any).type,
      key: (attribute as any).key,
      translationKey: (attribute as any).translationKey
    };

    switch (attribute.type) {
      case 'string':
        return {
          ...base,
          defaultValue_string: (attribute as any).defaultValue ?? '',
          row: (attribute as any).displayProperties?.row ?? 0,
          columns: (attribute as any).displayProperties?.columns ?? 4,
          displayInViewMode: (attribute as any).displayProperties?.displayInViewMode ?? true
        };
      case 'number':
        return {
          ...base,
          defaultValue_number: (attribute as any).defaultValue ?? null,
          unit: (attribute as any).unit ?? null,
          row: (attribute as any).displayProperties?.row ?? 0,
          columns: (attribute as any).displayProperties?.columns ?? 4,
          displayInViewMode: (attribute as any).displayProperties?.displayInViewMode ?? true
        };
      case 'boolean':
        return {
          ...base,
          defaultValue_boolean: (attribute as any).defaultValue ?? false,
          row: (attribute as any).displayProperties?.row ?? 0,
          columns: (attribute as any).displayProperties?.columns ?? 4,
          displayInViewMode: (attribute as any).displayProperties?.displayInViewMode ?? true
        };
      case 'code':
        return {
          ...base,
          contentType: (attribute as any).contentType ?? 'json',
          defaultValue_code: (attribute as any).defaultValue ?? '',
          row: (attribute as any).displayProperties?.row ?? 0,
          columns: (attribute as any).displayProperties?.columns ?? 4,
          displayInViewMode: (attribute as any).displayProperties?.displayInViewMode ?? true
        };
      case 'string-select':
        return {
          ...base,
          selectableValuesCsv: ((attribute as any).selectableValues ?? []).join(','),
          defaultValue_string: (attribute as any).defaultValue ?? '',
          row: (attribute as any).displayProperties?.row ?? 0,
          columns: (attribute as any).displayProperties?.columns ?? 4,
          displayInViewMode: (attribute as any).displayProperties?.displayInViewMode ?? true
        };
      case 'instant':
      case 'secret':
      case 'scan-mode':
      case 'certificate':
        return {
          ...base,
          acceptableType: (attribute as any).acceptableType,
          row: (attribute as any).displayProperties?.row ?? 0,
          columns: (attribute as any).displayProperties?.columns ?? 4,
          displayInViewMode: (attribute as any).displayProperties?.displayInViewMode ?? true
        };
      case 'timezone':
        return {
          ...base,
          defaultValue_timezone: (attribute as any).defaultValue ?? '',
          row: (attribute as any).displayProperties?.row ?? 0,
          columns: (attribute as any).displayProperties?.columns ?? 4,
          displayInViewMode: (attribute as any).displayProperties?.displayInViewMode ?? true
        };
      case 'object':
        return {
          ...base,
          visible: (attribute as any).displayProperties?.visible ?? true,
          wrapInBox: (attribute as any).displayProperties?.wrapInBox ?? false,
          attributes: (attribute as any).attributes?.map((a: OIBusAttribute) => this.flattenAttribute(a)) ?? []
        };
      case 'array':
        return {
          ...base,
          paginate: (attribute as any).paginate ?? false,
          numberOfElementPerPage: (attribute as any).numberOfElementPerPage ?? 20,
          translationKey: (attribute as any).translationKey,
          attributes: (attribute as any).rootAttribute?.attributes?.map((a: OIBusAttribute) => this.flattenAttribute(a)) ?? []
        };
    }
  }

  private buildAttributeFromForm(attrForm: any): OIBusAttribute {
    const deduplicateByKey = (list: Array<any>): Array<any> => {
      const seen = new Set<string>();
      return (list || []).filter(item => {
        if (!item?.key) {
          return false;
        }
        if (seen.has(item.key)) {
          return false;
        }
        seen.add(item.key);
        return true;
      });
    };
    const baseAttribute = {
      type: attrForm.type,
      key: attrForm.key,
      translationKey: attrForm.translationKey,
      validators: []
    };

    switch (attrForm.type) {
      case 'string':
        return {
          ...baseAttribute,
          type: 'string',
          defaultValue: attrForm.defaultValue_string ?? null,
          displayProperties: {
            row: Number(attrForm.row ?? 0),
            columns: Number(attrForm.columns ?? 4),
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'number':
        return {
          ...baseAttribute,
          type: 'number',
          defaultValue:
            attrForm.defaultValue_number === '' || attrForm.defaultValue_number === null || attrForm.defaultValue_number === undefined
              ? null
              : Number(attrForm.defaultValue_number),
          unit: attrForm.unit ?? null,
          displayProperties: {
            row: Number(attrForm.row ?? 0),
            columns: Number(attrForm.columns ?? 4),
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'boolean':
        return {
          ...baseAttribute,
          type: 'boolean',
          defaultValue: attrForm.defaultValue_boolean ?? false,
          displayProperties: {
            row: Number(attrForm.row ?? 0),
            columns: Number(attrForm.columns ?? 4),
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'code':
        return {
          ...baseAttribute,
          type: 'code',
          contentType: attrForm.contentType || 'json',
          defaultValue: attrForm.defaultValue_code ?? '',
          displayProperties: {
            row: Number(attrForm.row ?? 0),
            columns: Number(attrForm.columns ?? 4),
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'string-select':
        const values =
          typeof attrForm.selectableValuesCsv === 'string'
            ? attrForm.selectableValuesCsv
                .split(',')
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 0)
            : [];
        return {
          ...baseAttribute,
          type: 'string-select',
          selectableValues: values,
          defaultValue: attrForm.defaultValue_string ?? null,
          displayProperties: {
            row: Number(attrForm.row ?? 0),
            columns: Number(attrForm.columns ?? 4),
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'secret':
        return {
          ...baseAttribute,
          type: 'secret',
          displayProperties: {
            row: Number(attrForm.row ?? 0),
            columns: Number(attrForm.columns ?? 4),
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'instant':
        return {
          ...baseAttribute,
          type: 'instant',
          displayProperties: {
            row: Number(attrForm.row ?? 0),
            columns: Number(attrForm.columns ?? 4),
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'scan-mode':
        return {
          ...baseAttribute,
          type: 'scan-mode',
          acceptableType: attrForm.acceptableType || 'POLL',
          displayProperties: {
            row: Number(attrForm.row ?? 0),
            columns: Number(attrForm.columns ?? 4),
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'certificate':
        return {
          ...baseAttribute,
          type: 'certificate',
          displayProperties: {
            row: Number(attrForm.row ?? 0),
            columns: Number(attrForm.columns ?? 4),
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'timezone':
        return {
          ...baseAttribute,
          type: 'timezone',
          defaultValue: attrForm.defaultValue_timezone ?? null,
          displayProperties: {
            row: Number(attrForm.row ?? 0),
            columns: Number(attrForm.columns ?? 4),
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'object':
        const objectAttributes = deduplicateByKey(attrForm.attributes || []).map((nestedAttr: any) =>
          this.buildAttributeFromForm(nestedAttr)
        );
        return {
          ...baseAttribute,
          type: 'object',
          attributes: objectAttributes,
          enablingConditions: [],
          displayProperties: {
            visible: attrForm.visible ?? true,
            wrapInBox: attrForm.wrapInBox ?? false
          }
        };

      case 'array':
        const arrayAttributes = deduplicateByKey(attrForm.attributes || []).map((nestedAttr: any) =>
          this.buildAttributeFromForm(nestedAttr)
        );
        return {
          ...baseAttribute,
          type: 'array',
          paginate: attrForm.paginate ?? false,
          numberOfElementPerPage:
            attrForm.numberOfElementPerPage === '' ||
            attrForm.numberOfElementPerPage === null ||
            attrForm.numberOfElementPerPage === undefined
              ? 20
              : Number(attrForm.numberOfElementPerPage),
          rootAttribute: {
            type: 'object',
            key: 'element',
            translationKey: attrForm.translationKey || 'configuration.oibus.manifest.transformers.mapping.title',
            attributes: arrayAttributes,
            enablingConditions: [],
            validators: [],
            displayProperties: {
              visible: true,
              wrapInBox: false
            }
          }
        };

      default:
        throw new Error(`Unsupported attribute type: ${attrForm.type}`);
    }
  }

  private setupAutoSave(): void {
    // When table changes or display props change, propagate value
    const emit = () => {
      const manifest = this.generateManifest();
      this.currentValue = manifest;
      this.onChange(manifest);
      this.onTouched();
    };
    this.form.valueChanges.subscribe(() => emit());
    this.attributesControl.valueChanges.subscribe(() => emit());
  }

  writeValue(value: OIBusObjectAttribute | null): void {
    this.currentValue = value;
    this.initializeForm();
  }

  registerOnChange(fn: (value: OIBusObjectAttribute | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.form.disable({ emitEvent: false });
      this.attributesControl.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
      this.attributesControl.enable({ emitEvent: false });
    }
  }
}
