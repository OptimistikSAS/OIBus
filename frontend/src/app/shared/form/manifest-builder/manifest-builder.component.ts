import { Component, input, output, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { OIBusObjectAttribute, OIBusAttribute, OIBUS_ATTRIBUTE_TYPES } from '../../../../../../backend/shared/model/form.model';
import { BoxComponent, BoxTitleDirective } from '../../box/box.component';

@Component({
  selector: 'oib-manifest-builder',
  templateUrl: './manifest-builder.component.html',
  styleUrl: './manifest-builder.component.scss',
  imports: [ReactiveFormsModule, TranslateDirective, BoxComponent, BoxTitleDirective]
})
export class ManifestBuilderComponent implements OnInit {
  private fb = inject(FormBuilder);

  manifest = input.required<OIBusObjectAttribute>();
  manifestChange = output<OIBusObjectAttribute>();

  availableTypes = OIBUS_ATTRIBUTE_TYPES;

  form = this.fb.group({
    type: ['object', Validators.required],
    key: ['options', Validators.required],
    translationKey: ['configuration.oibus.manifest.transformers.options', Validators.required],
    visible: [true],
    wrapInBox: [false],
    attributes: this.fb.array([])
  });

  ngOnInit() {
    this.initializeForm();
  }

  private initializeForm() {
    const manifest = this.manifest();
    this.form.patchValue({
      type: manifest.type,
      key: manifest.key,
      translationKey: manifest.translationKey,
      visible: manifest.displayProperties.visible,
      wrapInBox: manifest.displayProperties.wrapInBox
    });

    // Clear existing form array
    const attributesArray = this.form.get('attributes');
    if (attributesArray) {
      while (attributesArray.value.length > 0) {
        this.removeAttribute(0);
      }
    }

    // Add existing attributes
    manifest.attributes.forEach(attr => {
      this.addAttribute(attr);
    });
  }

  addAttribute(existingAttribute?: OIBusAttribute): void {
    const attributesArray = this.form.get('attributes') as any;
    const attributeForm = this.fb.group({
      type: [existingAttribute?.type || 'string', Validators.required],
      key: [existingAttribute?.key || '', Validators.required],
      translationKey: [existingAttribute?.translationKey || '', Validators.required],
      // Common properties
      validators: this.fb.array([]),
      // Display properties for non-object/array types
      row: [
        existingAttribute && 'displayProperties' in existingAttribute && 'row' in existingAttribute.displayProperties
          ? existingAttribute.displayProperties.row
          : 0
      ],
      columns: [
        existingAttribute && 'displayProperties' in existingAttribute && 'columns' in existingAttribute.displayProperties
          ? existingAttribute.displayProperties.columns
          : 4
      ],
      displayInViewMode: [
        existingAttribute && 'displayProperties' in existingAttribute && 'displayInViewMode' in existingAttribute.displayProperties
          ? existingAttribute.displayProperties.displayInViewMode
          : true
      ],
      // Object/Array specific properties
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
      // Array specific properties
      paginate: [existingAttribute && 'paginate' in existingAttribute ? existingAttribute.paginate : false],
      numberOfElementPerPage: [
        existingAttribute && 'numberOfElementPerPage' in existingAttribute ? existingAttribute.numberOfElementPerPage : 20
      ],
      // Type specific properties
      defaultValue: [existingAttribute && 'defaultValue' in existingAttribute ? existingAttribute.defaultValue : null],
      unit: [existingAttribute && 'unit' in existingAttribute ? existingAttribute.unit : null],
      contentType: [existingAttribute && 'contentType' in existingAttribute ? existingAttribute.contentType : 'json'],
      selectableValues: [existingAttribute && 'selectableValues' in existingAttribute ? existingAttribute.selectableValues : []],
      acceptableType: [existingAttribute && 'acceptableType' in existingAttribute ? existingAttribute.acceptableType : 'POLL'],
      // Nested attributes for objects and arrays
      attributes: this.fb.array([]),
      enablingConditions: this.fb.array([])
    });

    // If it's an existing object or array, populate nested attributes
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
      key: [existingAttribute?.key || '', Validators.required],
      translationKey: [existingAttribute?.translationKey || '', Validators.required],
      validators: this.fb.array([]),
      row: [
        existingAttribute && 'displayProperties' in existingAttribute && 'row' in existingAttribute.displayProperties
          ? existingAttribute.displayProperties.row
          : 0
      ],
      columns: [
        existingAttribute && 'displayProperties' in existingAttribute && 'columns' in existingAttribute.displayProperties
          ? existingAttribute.displayProperties.columns
          : 4
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

    // Recursively add nested attributes for objects
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

    // Reset type-specific fields when type changes
    attributeForm.patchValue({
      unit: null,
      contentType: 'json',
      selectableValues: [],
      acceptableType: 'POLL',
      paginate: false,
      numberOfElementPerPage: 20
    });

    // Clear nested attributes when changing from object/array to other types
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
      key: formValue.key || 'options',
      translationKey: formValue.translationKey || 'configuration.oibus.manifest.transformers.options',
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
            row: attrForm.row || 0,
            columns: attrForm.columns || 4,
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'number':
        return {
          ...baseAttribute,
          type: 'number',
          defaultValue: attrForm.defaultValue,
          unit: attrForm.unit,
          displayProperties: {
            row: attrForm.row || 0,
            columns: attrForm.columns || 4,
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'boolean':
        return {
          ...baseAttribute,
          type: 'boolean',
          defaultValue: attrForm.defaultValue ?? false,
          displayProperties: {
            row: attrForm.row || 0,
            columns: attrForm.columns || 4,
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
            row: attrForm.row || 0,
            columns: attrForm.columns || 4,
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'string-select':
        return {
          ...baseAttribute,
          type: 'string-select',
          selectableValues: attrForm.selectableValues || [],
          defaultValue: attrForm.defaultValue,
          displayProperties: {
            row: attrForm.row || 0,
            columns: attrForm.columns || 4,
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'secret':
        return {
          ...baseAttribute,
          type: 'secret',
          displayProperties: {
            row: attrForm.row || 0,
            columns: attrForm.columns || 4,
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'instant':
        return {
          ...baseAttribute,
          type: 'instant',
          displayProperties: {
            row: attrForm.row || 0,
            columns: attrForm.columns || 4,
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'scan-mode':
        return {
          ...baseAttribute,
          type: 'scan-mode',
          acceptableType: attrForm.acceptableType || 'POLL',
          displayProperties: {
            row: attrForm.row || 0,
            columns: attrForm.columns || 4,
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'certificate':
        return {
          ...baseAttribute,
          type: 'certificate',
          displayProperties: {
            row: attrForm.row || 0,
            columns: attrForm.columns || 4,
            displayInViewMode: attrForm.displayInViewMode ?? true
          }
        };

      case 'timezone':
        return {
          ...baseAttribute,
          type: 'timezone',
          defaultValue: attrForm.defaultValue,
          displayProperties: {
            row: attrForm.row || 0,
            columns: attrForm.columns || 4,
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
          numberOfElementPerPage: attrForm.numberOfElementPerPage || 20,
          rootAttribute: {
            type: 'object',
            key: 'item',
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

  save(): void {
    if (this.form.valid) {
      const manifest = this.generateManifest();
      this.manifestChange.emit(manifest);
    }
  }

  get attributesControls() {
    return (this.form.get('attributes') as any)?.controls || [];
  }

  getNestedAttributesControls(attributeForm: FormGroup) {
    return (attributeForm.get('attributes') as any)?.controls || [];
  }
}
