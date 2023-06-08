import { Component, forwardRef, Input } from '@angular/core';
import { formDirectives } from '../../form-directives';
import { NgForOf, NgIf } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NonNullableFormBuilder } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AuthTypesEnumPipe } from '../../auth-types-enum.pipe';
import { DATE_TIME_TYPES, DateTimeFormat, DateTimeType, Timezone } from '../../../../../../shared/model/types';
import { DatetimeTypesEnumPipe } from '../../datetime-types-enum.pipe';
import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';
import { inMemoryTypeahead } from '../../typeahead';
import { DateTime } from 'luxon';

// TypeScript issue with Intl: https://github.com/microsoft/TypeScript/issues/49231
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Intl {
  type Key = 'calendar' | 'collation' | 'currency' | 'numberingSystem' | 'timeZone' | 'unit';

  function supportedValuesOf(input: Key): string[];
}
@Component({
  selector: 'oib-datetime-format',
  standalone: true,
  imports: [...formDirectives, NgIf, NgForOf, TranslateModule, AuthTypesEnumPipe, DatetimeTypesEnumPipe, NgbTypeahead],
  templateUrl: './oib-datetime-format.component.html',
  styleUrls: ['./oib-datetime-format.component.scss'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OibDatetimeFormatComponent), multi: true }]
})
export class OibDatetimeFormatComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() key = '';

  readonly datetimeTypes = DATE_TIME_TYPES;
  readonly BASE_EXAMPLE = '2023-11-29T21:03:59.123Z';
  private timezones: ReadonlyArray<Timezone> = Intl.supportedValuesOf('timeZone');
  timezoneTypeahead: (text$: Observable<string>) => Observable<Array<Timezone>> = inMemoryTypeahead(
    () => ['UTC', ...this.timezones],
    timezone => timezone
  );

  datetimeFormatCtrl = this.fb.group({
    type: 'string' as DateTimeType,
    format: 'yyyy-MM-dd HH:mm:ss.SSS',
    timezone: 'UTC',
    locale: 'en-US',
    field: 'timestamp'
  });
  disabled = false;
  example: DateTime | number | string = DateTime.fromISO(this.BASE_EXAMPLE, { zone: 'UTC' }).toFormat('yyyy-MM-dd HH:mm:ss.SSS', {
    locale: 'en-US'
  });

  onChange: (value: DateTimeFormat) => void = () => {};
  onTouched = () => {};

  constructor(private fb: NonNullableFormBuilder) {
    this.datetimeFormatCtrl.controls.type.valueChanges.subscribe(newValue => {
      switch (newValue) {
        case 'string':
          this.datetimeFormatCtrl.controls.format.enable();
          this.datetimeFormatCtrl.controls.locale.enable();
          break;
        case 'number':
        case 'datetime':
          this.datetimeFormatCtrl.controls.format.disable();
          this.datetimeFormatCtrl.controls.locale.disable();
          break;
      }
    });

    this.datetimeFormatCtrl.valueChanges.subscribe(newValue => {
      switch (newValue.type) {
        case 'string':
          this.onChange({
            type: 'string',
            format: newValue.format!,
            timezone: newValue.timezone!,
            locale: newValue.locale!,
            field: newValue.field!
          });
          this.example = DateTime.fromISO(this.BASE_EXAMPLE, { zone: newValue.timezone! }).toFormat(newValue.format!, {
            locale: newValue.locale!
          });
          break;

        case 'number':
          this.onChange({ type: 'number', timezone: newValue.timezone!, field: newValue.field! });
          this.example = DateTime.fromISO(this.BASE_EXAMPLE, { zone: newValue.timezone! }).toMillis();
          break;

        case 'datetime':
          this.onChange({ type: 'datetime', timezone: newValue.timezone!, field: newValue.field! });
          this.example = DateTime.fromISO(this.BASE_EXAMPLE, { zone: newValue.timezone! });
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
      this.datetimeFormatCtrl.disable();
    } else {
      this.datetimeFormatCtrl.enable();
    }
  }

  writeValue(value: DateTimeFormat): void {
    switch (value.type) {
      case 'string':
        this.datetimeFormatCtrl.patchValue({
          type: 'string',
          format: value.format,
          timezone: value.timezone,
          locale: value.locale,
          field: value.field
        });
        break;
      case 'number':
        this.datetimeFormatCtrl.patchValue({ type: 'number', timezone: value.timezone, field: value.field });
        break;
      case 'datetime':
        this.datetimeFormatCtrl.patchValue({ type: 'datetime', timezone: value.timezone, field: value.field });
        break;
    }
  }
}
