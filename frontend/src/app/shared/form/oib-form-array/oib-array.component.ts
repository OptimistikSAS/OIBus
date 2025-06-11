import { AfterViewChecked, Component, forwardRef, inject, input, OnInit } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  FormGroup,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator
} from '@angular/forms';

import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EditElementComponent } from './edit-element/edit-element.component';
import { OibFormControl } from '../../../../../../backend/shared/model/form.model';

@Component({
  selector: 'oib-array',
  templateUrl: './oib-array.component.html',
  styleUrl: './oib-array.component.scss',
  imports: [TranslateDirective, forwardRef(() => EditElementComponent), TranslatePipe],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => OibArrayComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => OibArrayComponent),
      multi: true
    }
  ]
})
export class OibArrayComponent implements OnInit, AfterViewChecked, ControlValueAccessor, Validator {
  private translateService = inject(TranslateService);

  readonly label = input('');
  readonly key = input('');
  readonly formDescription = input.required<Array<OibFormControl>>();
  readonly parentForm = input.required<FormGroup>();
  readonly allowRowDuplication = input(false);

  elements: Array<any> = [];
  elementsIncludingNew: Array<any> = [];

  displayedFields: Array<{ key: string; label: string; pipe?: string }> = [];

  disabled = false;

  ngOnInit(): void {
    this.formDescription().forEach(formControl => {
      if (formControl.displayInViewMode) {
        if (formControl.type === 'OibSelect') {
          this.displayedFields.push({ key: formControl.key, label: formControl.translationKey + '.' + 'title' });
        } else {
          this.displayedFields.push({ key: formControl.key, label: formControl.translationKey });
        }
      }
    });
  }

  ngAfterViewChecked(): void {
    this.countDivsInFakeTableRows();
  }

  /*
   * Counts the number of div elements within a row with the class "oib-fake-table"
   * and ensures that there are exactly six div elements in each row.
   * If there are fewer than six div elements, it adds the missing div elements
   * before the "col-2 text-end text-nowrap" div to align it to the right of the table.
   */
  countDivsInFakeTableRows() {
    const rows = Array.from(document.getElementsByClassName('oib-fake-table'));
    for (const row of rows) {
      const divElements = row.getElementsByTagName('div');
      if (divElements.length !== 6) {
        const numMissingDivs = 6 - divElements.length;
        for (let j = 0; j < numMissingDivs; j++) {
          const newDiv = document.createElement('div');
          newDiv.classList.add('col-2');
          row.insertBefore(newDiv, row.querySelector('.col-2.text-end.text-nowrap'));
        }
      }
    }
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
    // Only change is called, without "touch" to not trigger error validation immediately
    this.onChange(this.elements);
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
    this.onChange(this.elements);
    this.recomputeElementsIncludingNew();
  }

  /**
   * Method that should be called to duplicate an existing element in the array.
   * Opens the edit form for the duplicated element before saving.
   */
  duplicate(element: any) {
    const duplicatedElement = { ...element, fieldName: element.fieldName + '-copy' };
    this.editedElement = {
      isNew: true,
      element: duplicatedElement
    };
    this.recomputeElementsIncludingNew();
  }

  /**
   * Method that should be called when the "Save" or "OK" button of the edit component is clicked, in order to save the
   * edited/created element in the array.
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
    this.propagateChange();
  }

  /**
   * Method that should be called when the "Cancel" button of the edit component is clicked, in order to cancel the
   * edition
   */
  cancelEdition() {
    this.editedElement = null;
    this.recomputeElementsIncludingNew();
    this.onChange(this.elements);
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
    this.recomputeElementsIncludingNew();
  }

  recomputeElementsIncludingNew() {
    this.elementsIncludingNew = this.editedElement?.isNew ? [...this.elements, this.editedElement.element] : this.elements;
    this.countDivsInFakeTableRows();
  }

  createDefaultValue(): any {
    const defaultValue: any = {};
    this.formDescription().forEach(formControl => (defaultValue[formControl.key] = formControl.defaultValue));
    return defaultValue;
  }

  getFieldValue(element: any, field: string): string {
    const foundFormControl = this.formDescription().find(formControl => formControl.key === field);
    if (foundFormControl && element[field] && foundFormControl.type === 'OibSelect') {
      return this.translateService.instant(foundFormControl.translationKey + '.' + element[field]);
    }
    return element[field];
  }

  validate(_control: AbstractControl): ValidationErrors | null {
    // When there are elements being edited/created, throw a validation error
    // to let the user validate or discard the pending changes
    if (this.editedElement !== null) {
      return { resolvePendingChanges: true };
    }

    return null;
  }
}
