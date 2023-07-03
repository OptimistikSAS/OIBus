import { Component, forwardRef, Input, OnInit } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { formDirectives } from '../../form-directives';
import { NgForOf, NgIf } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { EditElementComponent } from './edit-element/edit-element.component';
import { OibFormControl } from '../../../../../../shared/model/form.model';
import { PipeProviderService } from '../pipe-provider.service';

@Component({
  selector: 'oib-array',
  templateUrl: './oib-array.component.html',
  styleUrls: ['./oib-array.component.scss'],
  imports: [...formDirectives, NgIf, NgForOf, TranslateModule, EditElementComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => OibArrayComponent),
      multi: true
    }
  ],
  standalone: true
})
export class OibArrayComponent implements OnInit {
  @Input() label = '';
  @Input() key = '';
  @Input({ required: true }) formDescription!: Array<OibFormControl>;

  elements: Array<any> = [];
  elementsIncludingNew: Array<any> = [];

  displayedFields: Array<{ key: string; label: string; pipe?: string }> = [];

  disabled = false;

  constructor(private pipeProviderService: PipeProviderService) {}

  ngOnInit(): void {
    this.formDescription.forEach(formControl => {
      if (formControl.displayInViewMode) {
        this.displayedFields.push({ key: formControl.key, label: formControl.label, pipe: formControl.pipe });
      }
    });
  }

  /**
   * If null, this means no element is being edited or added. If not null, it contains the element being edited,
   * and a flag indicating if it's a new element being created, or an existing one being edited.
   * Only one element can be edited at a time, so if this is not null, buttons allowing to edit or add or reorder
   * elements should be disabled.
   */
  editedElement: {
    isNew: boolean;
    element: any;
  } | null = null;

  onChange: (elements: Array<any>) => void = () => {};
  onTouched: () => void = () => {};

  registerOnChange(fn: any) {
    this.onChange = fn;
  }

  registerOnTouched(fn: any) {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean) {
    this.disabled = isDisabled;
    if (isDisabled) {
      this.editedElement = null;
      this.recomputeElementsIncludingNew();
    }
  }

  writeValue(obj: Array<any>): void {
    this.elements = obj || [];
    this.editedElement = null;
    this.recomputeElementsIncludingNew();
  }

  /**
   * Method that should be called when the delete button of an element is clicked. It removes the element at the given
   * index
   */
  remove(index: number) {
    const newElements = [...this.elements];
    newElements.splice(index, 1);
    this.elements = newElements;
    this.recomputeElementsIncludingNew();
    this.propagateChange();
  }

  /**
   * Method that can be called by subclasses if they want to programmatically edit new known empty element
   */
  editNewElement() {
    this.editedElement = {
      isNew: true,
      element: this.createDefaultValue()
    };
    this.recomputeElementsIncludingNew();
  }

  /**
   * Method that should be called when the "Edit" button of an element is clicked. It sets a value for `editedElement`.
   */
  edit(element: any) {
    this.editedElement = {
      isNew: false,
      element
    };
    this.recomputeElementsIncludingNew();
  }

  /**
   * Method that should be called when the "Save" or "OK" button of the edit component is clicked, in order to save the
   * edited/created element in the array.
   * @param element: the element that has been created/edited by the edit component
   */
  save(element: any) {
    if (!this.editedElement) {
      return;
    }
    if (this.editedElement.isNew) {
      this.elements = [...this.elements, element];
    } else {
      const index = this.elements.indexOf(this.editedElement.element);
      const newElements = [...this.elements];
      newElements.splice(index, 1, element);
      this.elements = newElements;
    }
    this.editedElement = null;
    this.recomputeElementsIncludingNew();
    this.propagateChange();
  }

  /**
   * Method that should be called when the "Cancel" button of the edit component is clicked, in order to cancel the
   * edition
   */
  cancelEdition() {
    this.editedElement = null;
    this.recomputeElementsIncludingNew();
  }

  /**
   * Tells if the edit, delete and reorder buttons should be disabled, which is true if the form control is disabled
   * or if there is an edited element
   */
  get editDisabled(): boolean {
    return this.disabled || !!this.editedElement;
  }

  /**
   * Tells if the given element is the edited one. Should be used to decide, in each row, if it should just be
   * displayed or if the edit component should be displayed
   */
  isEdited(element: any): boolean {
    return (this.editedElement && this.editedElement.element === element) || false;
  }

  /**
   * Tells if a new element is being edited. Should be used to decide if the edit component should be
   * displayed.
   */
  isNewEdited(): boolean {
    return (this.editedElement && this.editedElement.isNew) || false;
  }

  propagateChange() {
    this.onChange(this.elements);
    this.onTouched();
  }

  recomputeElementsIncludingNew() {
    this.elementsIncludingNew = this.editedElement?.isNew ? [...this.elements, this.editedElement.element] : this.elements;
  }

  createDefaultValue(): any {
    const defaultValue: any = {};
    this.formDescription.forEach(formControl => (defaultValue[formControl.key] = formControl.defaultValue));
    return defaultValue;
  }

  getFieldValue(element: any, field: string, pipeIdentifier: string | undefined): string {
    const value = element[field];
    if (value && pipeIdentifier && this.pipeProviderService.validIdentifier(pipeIdentifier)) {
      return this.pipeProviderService.getPipeForString(pipeIdentifier).transform(value);
    }
    return value;
  }
}
