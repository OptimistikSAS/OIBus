import { Component, inject, OnInit, forwardRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
  ControlValueAccessor,
  NG_VALUE_ACCESSOR
} from '@angular/forms';
import { TranslateDirective, TranslateModule } from '@ngx-translate/core';
import { OIBusObjectAttribute, OIBusAttribute, OIBUS_ATTRIBUTE_TYPES } from '../../../../../../backend/shared/model/form.model';
import { BoxComponent, BoxTitleDirective } from '../../box/box.component';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'oib-manifest-builder',
  templateUrl: './manifest-builder.component.html',
  styleUrl: './manifest-builder.component.scss',
  imports: [ReactiveFormsModule, TranslateDirective, BoxComponent, BoxTitleDirective, NgTemplateOutlet, TranslateModule, NgbTooltip],
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

  availableTypes = OIBUS_ATTRIBUTE_TYPES;

  form = this.fb.group({
    visible: [true],
    wrapInBox: [false],
    attributes: this.fb.array([])
  });

  ngOnInit() {
    this.initializeForm();
    this.setupAutoSave();
  }

  private initializeForm() {
    const manifest = this.currentValue;
    if (!manifest) {
      this.currentValue = {
        type: 'object',
        key: 'options',
        translationKey: 'configuration.oibus.manifest.transformers.options',
        attributes: [],
        enablingConditions: [],
        validators: [],
        displayProperties: { visible: true, wrapInBox: false }
      };
    }

    const value = this.currentValue!;
    this.form.patchValue({
      visible: value.displayProperties.visible,
      wrapInBox: value.displayProperties.wrapInBox
    });

    const attributesArray = this.form.get('attributes');
    if (attributesArray) {
      while (attributesArray.value.length > 0) {
        this.removeAttribute(0);
      }
    }
    value.attributes.forEach(attr => {
      this.addAttribute(attr);
    });
  }

  addAttribute(existingAttribute?: OIBusAttribute): void {
    const attributesArray = this.form.get('attributes') as any;
    const attributeForm = this.fb.group({
      type: [existingAttribute?.type || 'string', Validators.required],
      key: [existingAttribute?.key || '', [Validators.required, this.createUniqueKeyValidator()]],
      translationKey: [existingAttribute?.translationKey || '', Validators.required],
      validators: this.fb.array([]),
      row: [
        existingAttribute && 'displayProperties' in existingAttribute && 'row' in existingAttribute.displayProperties
          ? existingAttribute.displayProperties.row
          : 0,
        [Validators.min(0)]
      ],
      columns: [
        existingAttribute && 'displayProperties' in existingAttribute && 'columns' in existingAttribute.displayProperties
          ? existingAttribute.displayProperties.columns
          : 4,
        [Validators.min(1), Validators.max(12)]
      ],
      displayInViewMode: [
        existingAttribute && 'displayProperties' in existingAttribute && 'displayInViewMode' in existingAttribute.displayProperties
          ? existingAttribute.displayProperties.displayInViewMode
          : true
      ],
      visible: [
        existingAttribute && 'displayProperties' in existingAttribute && 'visible' in existingAttribute.displayProperties
          ? existingAttribute.displayProperties.visible
          : true
      ],
      wrapInBox: [
        existingAttribute && 'displayProperties' in existingAttribute && 'wrapInBox' in existingAttribute.displayProperties
          ? existingAttribute.displayProperties.wrapInBox
          : false
      ],
      paginate: [existingAttribute && 'paginate' in existingAttribute ? existingAttribute.paginate : false],
      numberOfElementPerPage: [
        existingAttribute && 'numberOfElementPerPage' in existingAttribute ? existingAttribute.numberOfElementPerPage : 20
      ],
      defaultValue: [existingAttribute && 'defaultValue' in existingAttribute ? existingAttribute.defaultValue : null],
      unit: [existingAttribute && 'unit' in existingAttribute ? existingAttribute.unit : null],
      contentType: [existingAttribute && 'contentType' in existingAttribute ? existingAttribute.contentType : 'json'],
      selectableValues: [existingAttribute && 'selectableValues' in existingAttribute ? existingAttribute.selectableValues : []],
      acceptableType: [existingAttribute && 'acceptableType' in existingAttribute ? existingAttribute.acceptableType : 'POLL'],
      attributes: this.fb.array([]),
      enablingConditions: this.fb.array([])
    });

    if (existingAttribute && (existingAttribute.type === 'object' || existingAttribute.type === 'array')) {
      const nestedAttributes =
        existingAttribute.type === 'object' ? existingAttribute.attributes : existingAttribute.rootAttribute.attributes;
      nestedAttributes.forEach(nestedAttr => {
        this.addNestedAttribute(attributeForm, nestedAttr);
      });
    }

    attributesArray.push(attributeForm);
  }

  addNestedAttribute(parentForm: FormGroup, existingAttribute?: OIBusAttribute): void {
    const attributesArray = parentForm.get('attributes') as any;
    const attributeForm = this.fb.group({
      type: [existingAttribute?.type || 'string', Validators.required],
      key: [existingAttribute?.key || '', [Validators.required, this.createUniqueKeyValidator(parentForm)]],
      translationKey: [existingAttribute?.translationKey || '', Validators.required],
      validators: this.fb.array([]),
      row: [
        existingAttribute && 'displayProperties' in existingAttribute && 'row' in existingAttribute.displayProperties
          ? existingAttribute.displayProperties.row
          : 0,
        [Validators.min(0)]
      ],
      columns: [
        existingAttribute && 'displayProperties' in existingAttribute && 'columns' in existingAttribute.displayProperties
          ? existingAttribute.displayProperties.columns
          : 4,
        [Validators.min(1), Validators.max(12)]
      ],
      displayInViewMode: [
        existingAttribute && 'displayProperties' in existingAttribute && 'displayInViewMode' in existingAttribute.displayProperties
          ? existingAttribute.displayProperties.displayInViewMode
          : true
      ],
      visible: [
        existingAttribute && 'displayProperties' in existingAttribute && 'visible' in existingAttribute.displayProperties
          ? existingAttribute.displayProperties.visible
          : true
      ],
      wrapInBox: [
        existingAttribute && 'displayProperties' in existingAttribute && 'wrapInBox' in existingAttribute.displayProperties
          ? existingAttribute.displayProperties.wrapInBox
          : false
      ],
      paginate: [existingAttribute && 'paginate' in existingAttribute ? existingAttribute.paginate : false],
      numberOfElementPerPage: [
        existingAttribute && 'numberOfElementPerPage' in existingAttribute ? existingAttribute.numberOfElementPerPage : 20
      ],
      defaultValue: [existingAttribute && 'defaultValue' in existingAttribute ? existingAttribute.defaultValue : null],
      unit: [existingAttribute && 'unit' in existingAttribute ? existingAttribute.unit : null],
      contentType: [existingAttribute && 'contentType' in existingAttribute ? existingAttribute.contentType : 'json'],
      selectableValues: [existingAttribute && 'selectableValues' in existingAttribute ? existingAttribute.selectableValues : []],
      acceptableType: [existingAttribute && 'acceptableType' in existingAttribute ? existingAttribute.acceptableType : 'POLL'],
      attributes: this.fb.array([]),
      enablingConditions: this.fb.array([])
    });

    if (existingAttribute && existingAttribute.type === 'object') {
      existingAttribute.attributes.forEach((nestedAttr: OIBusAttribute) => {
        this.addNestedAttribute(attributeForm, nestedAttr);
      });
    }

    attributesArray.push(attributeForm);
  }

  removeAttribute(index: number): void {
    const attributesArray = this.form.get('attributes') as any;
    attributesArray.removeAt(index);
  }

  removeNestedAttribute(parentForm: FormGroup, index: number): void {
    const attributesArray = parentForm.get('attributes') as any;
    attributesArray.removeAt(index);
  }

  onTypeChange(attributeForm: FormGroup): void {
    const type = attributeForm.get('type')?.value;

    attributeForm.patchValue({
      unit: null,
      contentType: 'json',
      selectableValues: [],
      acceptableType: 'POLL',
      paginate: false,
      numberOfElementPerPage: 20
    });
    if (type !== 'object' && type !== 'array') {
      const attributesArray = attributeForm.get('attributes') as any;
      while (attributesArray.length > 0) {
        attributesArray.removeAt(0);
      }
    }
  }

  generateManifest(): OIBusObjectAttribute {
    const formValue = this.form.value;

    const attributes: Array<OIBusAttribute> = (formValue.attributes || []).map((attr: any) => {
      return this.buildAttributeFromForm(attr);
    });

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

  private buildAttributeFromForm(attrForm: any): OIBusAttribute {
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
          defaultValue: attrForm.defaultValue,
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
            attrForm.defaultValue === '' || attrForm.defaultValue === null || attrForm.defaultValue === undefined
              ? null
              : Number(attrForm.defaultValue),
          unit: attrForm.unit,
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
          defaultValue: attrForm.defaultValue ?? false,
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
          defaultValue: attrForm.defaultValue,
          displayProperties: {
            row: Number(attrForm.row ?? 0),
            columns: Number(attrForm.columns ?? 4),
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'string-select':
        const values = Array.isArray(attrForm.selectableValues)
          ? attrForm.selectableValues
          : typeof attrForm.selectableValues === 'string'
            ? attrForm.selectableValues
                .split(',')
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 0)
            : [];
        return {
          ...baseAttribute,
          type: 'string-select',
          selectableValues: values,
          defaultValue: attrForm.defaultValue,
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
          defaultValue: attrForm.defaultValue,
          displayProperties: {
            row: Number(attrForm.row ?? 0),
            columns: Number(attrForm.columns ?? 4),
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'object':
        const objectAttributes = (attrForm.attributes || []).map((nestedAttr: any) => this.buildAttributeFromForm(nestedAttr));
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
        const arrayAttributes = (attrForm.attributes || []).map((nestedAttr: any) => this.buildAttributeFromForm(nestedAttr));
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
    this.form.valueChanges.subscribe(() => {
      if (this.form.valid) {
        const manifest = this.generateManifest();
        this.currentValue = manifest;
        this.onChange(manifest);
        this.onTouched();
      }
    });
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
    } else {
      this.form.enable({ emitEvent: false });
    }
  }

  get attributesControls() {
    return (this.form.get('attributes') as any)?.controls || [];
  }

  getNestedAttributesControls(attributeForm: FormGroup) {
    return (attributeForm.get('attributes') as any)?.controls || [];
  }

  private createUniqueKeyValidator(parentForm?: FormGroup): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const currentKey = control.value;
      const attributesArray = parentForm ? parentForm.get('attributes') : this.form.get('attributes');

      if (!attributesArray) {
        return null;
      }

      const controls = attributesArray.getRawValue();
      const duplicateCount = controls.filter((attr: any) => attr.key === currentKey).length;

      if (duplicateCount > 1) {
        return { uniqueKey: { message: 'Key must be unique within the same level' } };
      }

      return null;
    };
  }
}
