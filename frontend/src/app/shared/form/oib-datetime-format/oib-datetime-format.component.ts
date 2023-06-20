import { Component, forwardRef, Input, OnInit } from '@angular/core';
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
export class OibDatetimeFormatComponent implements ControlValueAccessor, OnInit {
  @Input() label = '';
  @Input() key = '';
  @Input() displayExample = true;
  @Input({ required: true }) dateObjectTypes!: Array<string>;

  datetimeTypes: Array<DateTimeType> = [];
  readonly BASE_EXAMPLE = '2023-11-29T21:03:59.123Z';
  private timezones: ReadonlyArray<Timezone> = Intl.supportedValuesOf('timeZone');
  timezoneTypeahead: (text$: Observable<string>) => Observable<Array<Timezone>> = inMemoryTypeahead(
    () => ['UTC', ...this.timezones],
    timezone => timezone
  );

  datetimeFormatCtrl = this.fb.group({
    type: 'specific-string' as DateTimeType,
    format: 'yyyy-MM-dd HH:mm:ss.SSS',
    timezone: 'UTC',
    locale: 'en-US',
    dateObjectType: null as string | null
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
        case 'specific-string':
          this.datetimeFormatCtrl.controls.format.enable();
          this.datetimeFormatCtrl.controls.locale.enable();
          this.datetimeFormatCtrl.controls.timezone.enable();
          this.datetimeFormatCtrl.controls.dateObjectType.disable();
          break;
        case 'iso-8601-string':
          this.datetimeFormatCtrl.controls.format.disable();
          this.datetimeFormatCtrl.controls.locale.disable();
          this.datetimeFormatCtrl.controls.timezone.disable();
          this.datetimeFormatCtrl.controls.dateObjectType.disable();
          break;
        case 'date-object':
          this.datetimeFormatCtrl.controls.format.disable();
          this.datetimeFormatCtrl.controls.locale.disable();
          this.datetimeFormatCtrl.controls.timezone.enable();
          this.datetimeFormatCtrl.controls.dateObjectType.enable();
          break;
        default:
          this.datetimeFormatCtrl.controls.format.disable();
          this.datetimeFormatCtrl.controls.locale.disable();
          this.datetimeFormatCtrl.controls.timezone.disable();
          this.datetimeFormatCtrl.controls.dateObjectType.disable();
          break;
      }
    });

    this.datetimeFormatCtrl.valueChanges.subscribe(newValue => {
      switch (newValue.type) {
        case 'specific-string':
          this.onChange({
            type: 'specific-string',
            format: newValue.format!,
            timezone: newValue.timezone!,
            locale: newValue.locale!
          });
          this.example = DateTime.fromISO(this.BASE_EXAMPLE, { zone: newValue.timezone! }).toFormat(newValue.format!, {
            locale: newValue.locale!
          });
          break;

        case 'iso-8601-string':
          this.onChange({ type: 'iso-8601-string' });
          this.example = DateTime.fromISO(this.BASE_EXAMPLE, { zone: newValue.timezone! }).toISO()!;
          break;

        case 'unix-epoch':
          this.onChange({ type: 'unix-epoch' });
          this.example = Math.floor(DateTime.fromISO(this.BASE_EXAMPLE).toMillis() / 1000);
          break;

        case 'unix-epoch-ms':
          this.onChange({ type: 'unix-epoch-ms' });
          this.example = DateTime.fromISO(this.BASE_EXAMPLE).toMillis();
          break;

        case 'date-object':
          this.onChange({ type: 'date-object', timezone: newValue.timezone!, dateObjectType: newValue.dateObjectType! });
          this.example = DateTime.fromISO(this.BASE_EXAMPLE).toMillis();
          break;
      }
    });
  }

  ngOnInit() {
    this.datetimeTypes = this.dateObjectTypes.length === 0 ? DATE_TIME_TYPES.filter(type => type !== 'date-object') : DATE_TIME_TYPES;
    this.datetimeFormatCtrl.controls.dateObjectType.setValue(this.dateObjectTypes.length > 0 ? this.dateObjectTypes[0] : null);
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
    if (!value) {
      return;
    }
    switch (value.type) {
      case 'specific-string':
        this.datetimeFormatCtrl.patchValue({
          type: 'specific-string',
          format: value.format,
          timezone: value.timezone,
          locale: value.locale
        });
        break;
      case 'iso-8601-string':
        this.datetimeFormatCtrl.patchValue({
          type: 'iso-8601-string'
        });
        break;
      case 'date-object':
        this.datetimeFormatCtrl.patchValue({
          type: value.type,
          timezone: value.timezone,
          dateObjectType: value.dateObjectType
        });
        break;
      case 'unix-epoch':
      case 'unix-epoch-ms':
      default:
        this.datetimeFormatCtrl.patchValue({ type: value.type });
        break;
    }
  }
}
