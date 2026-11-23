import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  forwardRef,
  inject,
  Injector,
  input,
  Signal,
  signal
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NgControl } from '@angular/forms';

import { NgbDropdown, NgbDropdownItem, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, Subscription } from 'rxjs';

import { FormControlValidationDirective } from '../form-control-validation.directive';

/** An option of an `oib-select-or-create` */
export interface SelectOption {
  id: string;
  name: string;
}

/** Creates the options of an `oib-select-or-create`: certificates, scan modes… */
export interface OptionCreator<T extends SelectOption> {
  /** The translation key of the entry creating an option */
  readonly createLabel: string;
  /** The options created since the application was loaded: the lists loaded before do not have them */
  readonly created: Signal<ReadonlyArray<T>>;

  /** Opens the creation modal, and emits the created option once saved */
  create(): Observable<T>;
}

/** The options, followed by the created ones they do not have */
export function withCreated<T extends SelectOption>(options: ReadonlyArray<T>, created: ReadonlyArray<T>): Array<T> {
  return [...options, ...created.filter(createdOption => !options.some(option => option.id === createdOption.id))];
}

/**
 * A select whose last entry creates an option with the given `creator`, and selects it, without leaving the form.
 *
 * Its model is the id of the selected option, or the option itself with `bindValue="option"` (compared by id), `null`
 * when none is selected. Labelled by a label for its `inputId`:
 *
 * ```
 * <label for="certificate" class="form-label" translate="..."></label>
 * <oib-select-or-create formControlName="certificateId" inputId="certificate" [options]="certificates()" [creator]="certificateCreator" />
 * ```
 */
@Component({
  selector: 'oib-select-or-create',
  templateUrl: './select-or-create.component.html',
  styleUrl: './select-or-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgbDropdown, NgbDropdownToggle, NgbDropdownMenu, NgbDropdownItem, TranslatePipe, FormControlValidationDirective],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectOrCreateComponent),
      multi: true
    }
  ]
})
export class SelectOrCreateComponent<T extends SelectOption> implements ControlValueAccessor {
  private readonly injector = inject(Injector);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  /** The id of the dropdown button, for its label */
  readonly inputId = input.required<string>();
  readonly options = input.required<ReadonlyArray<T>>();
  /** Whether the model is the id of the selected option, or the option itself */
  readonly bindValue = input<'id' | 'option'>('id');
  /** The translation key of the entry selecting no option: without it, the selection can't be removed */
  readonly noneLabel = input<string | null>(null);
  /** The translation key shown while no option is selected, when there is no entry selecting none (`noneLabel`) */
  readonly placeholder = input<string | null>(null);
  /** Without creator, the select has no entry creating an option */
  readonly creator = input<OptionCreator<T> | null>(null);

  readonly allOptions = computed(() => withCreated(this.options(), this.creator()?.created() ?? []));
  readonly selectedId = signal<string | null>(null);
  readonly selectedName = computed(() => this.allOptions().find(option => option.id === this.selectedId())?.name ?? null);
  readonly emptyLabel = computed(() => this.noneLabel() ?? this.placeholder());
  readonly disabled = signal(false);

  private onChange: (value: string | T | null) => void = () => {};
  private onTouched: () => void = () => {};
  private controlEvents: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.controlEvents?.unsubscribe());
  }

  registerOnChange(fn: (value: string | T | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
    this.refreshOnControlEvents();
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  writeValue(value: string | T | null): void {
    // read whatever the model is: writeValue can be called before bindValue is set
    this.selectedId.set(value === null || value === undefined ? null : typeof value === 'string' ? value : value.id);
  }

  select(option: T | null): void {
    this.selectedId.set(option?.id ?? null);
    this.onChange(this.bindValue() === 'id' ? (option?.id ?? null) : option);
    this.onTouched();
  }

  create(creator: OptionCreator<T>): void {
    creator.create().subscribe(option => this.select(option));
  }

  /**
   * The validation state of the dropdown button (its red border) follows the control, which can be touched or validated
   * from outside, when the form is submitted for instance: refresh this OnPush component then. The control is known once
   * registered, the NgControl depending on this component, its value accessor, to be created.
   */
  private refreshOnControlEvents(): void {
    this.controlEvents?.unsubscribe();
    const control = this.injector.get(NgControl, null, { self: true })?.control;
    this.controlEvents = control?.events.subscribe(() => this.changeDetectorRef.markForCheck()) ?? null;
  }

  onOpenChange(open: boolean): void {
    if (!open) {
      this.onTouched();
    }
  }
}
