import { Component, forwardRef, Input } from '@angular/core';
import { formDirectives } from '../../form-directives';
import { NgForOf, NgIf } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NonNullableFormBuilder, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AuthTypesEnumPipe } from '../../auth-types-enum.pipe';
import {
  ALL_CSV_CHARACTERS,
  CsvCharacter,
  DateTimeFormat,
  DateTimeSerialization,
  Serialization,
  SERIALIZATION_TYPES,
  SerializationType
} from '../../../../../../shared/model/types';
import { DatetimeTypesEnumPipe } from '../../datetime-types-enum.pipe';
import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { SerializationsEnumPipe } from '../../serialization-types-enum.pipe';
import { CsvCharacterEnumPipe } from '../../csv-character-enum.pipe';
import { DatetimeFieldsSerializationComponent } from './datetime-fields-serialization/datetime-fields-serialization.component';
import { OibDatetimeFormatComponent } from '../oib-datetime-format/oib-datetime-format.component';

@Component({
  selector: 'oib-serialization',
  standalone: true,
  imports: [
    ...formDirectives,
    NgIf,
    NgForOf,
    TranslateModule,
    AuthTypesEnumPipe,
    DatetimeTypesEnumPipe,
    NgbTypeahead,
    SerializationsEnumPipe,
    CsvCharacterEnumPipe,
    DatetimeFieldsSerializationComponent,
    OibDatetimeFormatComponent
  ],
  templateUrl: './oib-serialization.component.html',
  styleUrls: ['./oib-serialization.component.scss'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibSerializationComponent), multi: true }]
})
export class OibSerializationComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() key = '';
  @Input() dateObjectTypes: Array<string> = [];

  readonly serializationTypes = SERIALIZATION_TYPES;
  readonly csvDelimiters = ALL_CSV_CHARACTERS;

  serializationCtrl = this.fb.group({
    type: 'csv' as SerializationType,
    filename: '',
    delimiter: 'COMMA' as CsvCharacter,
    compression: false,
    datetimeSerialization: [[] as Array<DateTimeSerialization>, Validators.required],
    outputDateTimeFormat: {
      type: 'specific-string',
      timezone: 'Europe/Paris',
      format: 'yyyy-MM-dd HH:mm:ss.SSS',
      locale: 'en-US'
    } as DateTimeFormat | null
  });
  disabled = false;

  onChange: (value: Serialization) => void = () => {};
  onTouched = () => {};

  constructor(private fb: NonNullableFormBuilder) {
    this.serializationCtrl.controls.type.valueChanges.subscribe(newValue => {
      switch (newValue) {
        case 'csv':
          this.serializationCtrl.controls.filename.enable();
          this.serializationCtrl.controls.delimiter.enable();
          this.serializationCtrl.controls.compression.enable();
          break;
        default:
          this.serializationCtrl.controls.filename.disable();
          this.serializationCtrl.controls.delimiter.disable();
          this.serializationCtrl.controls.compression.disable();
          break;
      }
    });

    this.serializationCtrl.valueChanges.subscribe(newValue => {
      switch (newValue.type) {
        case 'csv':
          this.onChange({
            type: 'csv',
            filename: newValue.filename!,
            delimiter: newValue.delimiter!,
            compression: newValue.compression!,
            outputDateTimeFormat: newValue.outputDateTimeFormat!,
            datetimeSerialization: newValue.datetimeSerialization!
          });
          break;
      }
    });
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (this.disabled) {
      this.serializationCtrl.disable();
    } else {
      this.serializationCtrl.enable();
    }
  }

  writeValue(value: Serialization): void {
    switch (value.type) {
      case 'csv':
        this.serializationCtrl.patchValue({
          type: 'csv',
          filename: value.filename,
          delimiter: value.delimiter,
          compression: value.compression,
          outputDateTimeFormat: value.outputDateTimeFormat,
          datetimeSerialization: value.datetimeSerialization
        });
        break;
    }
  }
}
