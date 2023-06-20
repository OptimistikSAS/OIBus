import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ValidatorFn, Validators } from '@angular/forms';
import { DateTimeFormat, DateTimeField } from '../../../../../../../shared/model/types';
import { formDirectives } from '../../../form-directives';
import { NgForOf, NgIf } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { DatetimeTypesEnumPipe } from '../../../datetime-types-enum.pipe';
import { OibDatetimeFormatComponent } from '../../oib-datetime-format/oib-datetime-format.component';

const uniqueTitleValidator = (editedField: DateTimeField, existingComponents: Array<DateTimeField>): ValidatorFn => {
  return (control: AbstractControl) => {
    return control.value && existingComponents.some(c => c !== editedField && c.field === control.value) ? { uniqueField: true } : null;
  };
};

@Component({
  selector: 'oib-edit-datetime-field',
  templateUrl: './edit-datetime-field.component.html',
  styleUrls: ['./edit-datetime-field.component.scss'],
  imports: [...formDirectives, NgIf, NgForOf, TranslateModule, DatetimeTypesEnumPipe, OibDatetimeFormatComponent],
  standalone: true
})
export class EditDatetimeFieldComponent implements OnInit {
  form = this.fb.group({
    field: [null as string | null, Validators.required],
    useAsReference: false as boolean | null,
    datetimeFormat: { type: 'iso-8601-string', timezone: 'Europe/Paris' } as DateTimeFormat
  });

  @Input({ required: true }) dateTimeField!: DateTimeField;
  @Input({ required: true }) existingDateTimeFields!: Array<DateTimeField>;
  @Input({ required: true }) dateObjectTypes!: Array<string>;

  @Output() readonly saved = new EventEmitter<DateTimeField>();
  @Output() readonly cancelled = new EventEmitter<void>();

  constructor(private fb: NonNullableFormBuilder) {}

  ngOnInit() {
    this.form.get('field')!.addValidators(uniqueTitleValidator(this.dateTimeField, this.existingDateTimeFields));

    this.form.setValue({
      field: this.dateTimeField.field,
      useAsReference: this.dateTimeField.useAsReference,
      datetimeFormat: this.dateTimeField.datetimeFormat
    });
  }

  ok() {
    if (!this.form.valid) {
      return;
    }

    const formValue = this.form.value;

    this.saved.emit({
      field: formValue.field!,
      useAsReference: formValue.useAsReference!,
      datetimeFormat: formValue.datetimeFormat!
    });
  }

  cancel() {
    this.cancelled.emit(undefined);
  }
}
