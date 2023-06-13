import { Component, forwardRef, Input } from '@angular/core';
import { formDirectives } from '../../form-directives';
import { NgForOf, NgIf } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NonNullableFormBuilder } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AuthTypesEnumPipe } from '../../auth-types-enum.pipe';
import {
  ALL_CSV_CHARACTERS,
  CsvCharacter,
  Serialization,
  SERIALIZATION_TYPES,
  SerializationType,
  Timezone
} from '../../../../../../shared/model/types';
import { DatetimeTypesEnumPipe } from '../../datetime-types-enum.pipe';
import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';
import { inMemoryTypeahead } from '../../typeahead';
import { SerializationsEnumPipe } from '../../serialization-types-enum.pipe';
import { CsvCharacterEnumPipe } from '../../csv-character-enum.pipe';

// TypeScript issue with Intl: https://github.com/microsoft/TypeScript/issues/49231
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Intl {
  type Key = 'calendar' | 'collation' | 'currency' | 'numberingSystem' | 'timeZone' | 'unit';

  function supportedValuesOf(input: Key): string[];
}
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
    CsvCharacterEnumPipe
  ],
  templateUrl: './oib-serialization.component.html',
  styleUrls: ['./oib-serialization.component.scss'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibSerializationComponent), multi: true }]
})
export class OibSerializationComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() key = '';

  readonly serializationTypes = SERIALIZATION_TYPES;
  readonly csvDelimiters = ALL_CSV_CHARACTERS;
  private timezones: ReadonlyArray<Timezone> = Intl.supportedValuesOf('timeZone');
  timezoneTypeahead: (text$: Observable<string>) => Observable<Array<Timezone>> = inMemoryTypeahead(
    () => ['UTC', ...this.timezones],
    timezone => timezone
  );

  serializationCtrl = this.fb.group({
    type: 'file' as SerializationType,
    filename: '',
    delimiter: 'COMMA' as CsvCharacter
  });
  disabled = false;

  onChange: (value: Serialization) => void = () => {};
  onTouched = () => {};

  constructor(private fb: NonNullableFormBuilder) {
    this.serializationCtrl.controls.type.valueChanges.subscribe(newValue => {
      switch (newValue) {
        case 'file':
          this.serializationCtrl.controls.filename.enable();
          this.serializationCtrl.controls.delimiter.enable();
          break;
        default:
          this.serializationCtrl.controls.filename.disable();
          this.serializationCtrl.controls.delimiter.disable();
          break;
      }
    });

    this.serializationCtrl.valueChanges.subscribe(newValue => {
      switch (newValue.type) {
        case 'file':
          this.onChange({
            type: 'file',
            filename: newValue.filename!,
            delimiter: newValue.delimiter!
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
      case 'file':
        this.serializationCtrl.patchValue({
          type: 'file',
          filename: value.filename,
          delimiter: value.delimiter
        });
        break;
    }
  }
}
