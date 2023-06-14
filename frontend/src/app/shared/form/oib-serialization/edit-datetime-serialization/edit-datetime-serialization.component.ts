import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ValidatorFn, Validators } from '@angular/forms';
import { DateTimeFormat, DateTimeSerialization } from '../../../../../../../shared/model/types';
import { formDirectives } from '../../../form-directives';
import { NgForOf, NgIf } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { DatetimeTypesEnumPipe } from '../../../datetime-types-enum.pipe';
import { OibDatetimeFormatComponent } from '../../oib-datetime-format/oib-datetime-format.component';

const uniqueTitleValidator = (editedField: DateTimeSerialization, existingComponents: Array<DateTimeSerialization>): ValidatorFn => {
  return (control: AbstractControl) => {
    return control.value && existingComponents.some(c => c !== editedField && c.field === control.value) ? { uniqueField: true } : null;
  };
};

@Component({
  selector: 'oib-edit-datetime-serialization',
  templateUrl: './edit-datetime-serialization.component.html',
  styleUrls: ['./edit-datetime-serialization.component.scss'],
  imports: [...formDirectives, NgIf, NgForOf, TranslateModule, DatetimeTypesEnumPipe, OibDatetimeFormatComponent],
  standalone: true
})
export class EditDatetimeSerializationComponent implements OnInit {
  form = this.fb.group({
    field: [null as string | null, Validators.required],
    useAsReference: false as boolean | null,
    datetimeFormat: { type: 'datetime' } as DateTimeFormat
  });

  @Input({ required: true }) dateTimeSerialization!: DateTimeSerialization;
  @Input({ required: true }) existingDateTimeSerializations!: Array<DateTimeSerialization>;

  @Output() readonly saved = new EventEmitter<DateTimeSerialization>();
  @Output() readonly cancelled = new EventEmitter<void>();

  constructor(private fb: NonNullableFormBuilder) {}

  ngOnInit() {
    this.form.get('field')!.addValidators(uniqueTitleValidator(this.dateTimeSerialization, this.existingDateTimeSerializations));

    this.form.setValue({
      field: this.dateTimeSerialization.field,
      useAsReference: this.dateTimeSerialization.useAsReference,
      datetimeFormat: this.dateTimeSerialization.datetimeFormat
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
