import { ChangeDetectionStrategy, Component, forwardRef, inject, LOCALE_ID, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DateTime, WeekdayNumbers } from 'luxon';

interface DayOption {
  /** 0 = Sunday ... 6 = Saturday, matching the persisted representation. */
  value: number;
  label: string;
}

/**
 * A form control component allowing to select any subset of the days of the week.
 *
 * Its model is an array of day numbers where 0 is Sunday and 6 is Saturday, always sorted
 * ascending. An empty array conventionally means "every day"; this component does not interpret
 * that, it is up to the consumer to render the hint and to map it to the persisted value.
 *
 * Usage:
 *
 * ```
 * <oib-day-of-week-selector formControlName="daysOfWeek" />
 * ```
 */
@Component({
  selector: 'oib-day-of-week-selector',
  templateUrl: './day-of-week-selector.component.html',
  styleUrl: './day-of-week-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DayOfWeekSelectorComponent),
      multi: true
    }
  ]
})
export class DayOfWeekSelectorComponent implements ControlValueAccessor {
  private locale = inject(LOCALE_ID);

  readonly disabled = signal(false);
  readonly selected = signal<ReadonlyArray<number>>([]);

  // Rendered Monday-first, which is what the locales OIBus ships with expect, while the values stay
  // on the 0 = Sunday scale used by the API.
  readonly days: ReadonlyArray<DayOption> = [1, 2, 3, 4, 5, 6, 7].map(isoWeekday => ({
    value: isoWeekday % 7,
    label: DateTime.fromObject({ weekday: isoWeekday as WeekdayNumbers })
      .setLocale(this.locale === 'en' ? 'en-GB' : this.locale)
      .toFormat('ccc')
  }));

  private onChange: (value: Array<number>) => void = () => {};
  private onTouched: () => void = () => {};

  registerOnChange(fn: (value: Array<number>) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  writeValue(value: Array<number> | null): void {
    this.selected.set([...(value ?? [])].sort((a, b) => a - b));
  }

  isSelected(day: number): boolean {
    return this.selected().includes(day);
  }

  toggle(day: number): void {
    if (this.disabled()) {
      return;
    }
    // Always build a new array: the parent control's reset value may be the very array handed to
    // writeValue, and mutating it in place would silently corrupt a later form.reset().
    const next = this.isSelected(day)
      ? this.selected().filter(selectedDay => selectedDay !== day)
      : [...this.selected(), day].sort((a, b) => a - b);
    this.selected.set(next);
    this.onChange([...next]);
    this.onTouched();
  }
}
