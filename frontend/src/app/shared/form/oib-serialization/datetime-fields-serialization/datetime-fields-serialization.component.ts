import { Component, forwardRef } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { DateTimeSerialization } from '../../../../../../../shared/model/types';
import { formDirectives } from '../../../form-directives';
import { NgForOf, NgIf } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { DatetimeTypesEnumPipe } from '../../../datetime-types-enum.pipe';
import { EditDatetimeSerializationComponent } from '../edit-datetime-serialization/edit-datetime-serialization.component';

@Component({
  selector: 'oib-datetime-fields-serialization',
  templateUrl: './datetime-fields-serialization.component.html',
  styleUrls: ['./datetime-fields-serialization.component.scss'],
  imports: [...formDirectives, NgIf, NgForOf, TranslateModule, DatetimeTypesEnumPipe, EditDatetimeSerializationComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatetimeFieldsSerializationComponent),
      multi: true
    }
  ],
  standalone: true
})
export class DatetimeFieldsSerializationComponent {
  dateTimeSerializations: Array<DateTimeSerialization> = [];
  dateTimeSerializationsIncludingNew: Array<DateTimeSerialization> = [];

  disabled = false;

  /**
   * If null, this means no element is being edited or added. If not null, it contains the element being edited,
   * and a flag indicating if it's a new element being created, or an existing one being edited.
   * Only one element can be edited at a time, so if this is not null, buttons allowing to edit or add or reorder
   * elements should be disabled.
   */
  editedElement: {
    isNew: boolean;
    element: DateTimeSerialization;
  } | null = null;

  private onChange: (elements: Array<DateTimeSerialization>) => void = () => {};
  private onTouched: () => void = () => {};

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

  writeValue(obj: Array<DateTimeSerialization>): void {
    this.dateTimeSerializations = obj || [];
    this.editedElement = null;
    this.recomputeElementsIncludingNew();
  }

  /**
   * Method that should be called when the delete button of an element is clicked. It removes the element at the given
   * index
   */
  remove(index: number) {
    const newElements = [...this.dateTimeSerializations];
    newElements.splice(index, 1);
    this.dateTimeSerializations = newElements;
    this.recomputeElementsIncludingNew();
    this.propagateChange();
  }

  /**
   * Method that can be called by subclasses if they want to programmatically edit new known empty element
   */
  editNewElement() {
    this.editedElement = {
      isNew: true,
      element: {
        field: '',
        useAsReference: false,
        datetimeFormat: {
          type: 'string',
          timezone: 'Europe/Paris',
          format: 'yyyy-MM-dd HH:mm:ss.SSS',
          locale: 'en-US'
        }
      }
    };
    this.recomputeElementsIncludingNew();
  }

  /**
   * Method that should be called when the "Edit" button of an element is clicked. It sets a value for `editedElement`.
   */
  edit(element: DateTimeSerialization) {
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
  save(element: DateTimeSerialization) {
    if (!this.editedElement) {
      return;
    }
    if (this.editedElement.isNew) {
      this.dateTimeSerializations = [...this.dateTimeSerializations, element];
    } else {
      const index = this.dateTimeSerializations.indexOf(this.editedElement.element);
      const newElements = [...this.dateTimeSerializations];
      newElements.splice(index, 1, element);
      this.dateTimeSerializations = newElements;
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
  isEdited(element: DateTimeSerialization): boolean {
    return (this.editedElement && this.editedElement.element === element) || false;
  }

  /**
   * Tells if a new element is being edited. Should be used to decide if the edit component should be
   * displayed.
   */
  isNewEdited(): boolean {
    return (this.editedElement && this.editedElement.isNew) || false;
  }

  private propagateChange() {
    this.onChange(this.dateTimeSerializations);
    this.onTouched();
  }

  private recomputeElementsIncludingNew() {
    this.dateTimeSerializationsIncludingNew = this.editedElement?.isNew
      ? [...this.dateTimeSerializations, this.editedElement.element]
      : this.dateTimeSerializations;
  }
}
