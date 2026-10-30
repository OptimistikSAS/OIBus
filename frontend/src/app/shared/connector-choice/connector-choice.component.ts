import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';

import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { map, startWith, switchMap } from 'rxjs';

import { NorthType } from '@oibus/shared/connector/north-manifest.model';
import { SouthType } from '@oibus/shared/connector/south-manifest.model';

import { OI_FORM_VALIDATION_DIRECTIVES } from '../form/form-validation-directives';

/** The choice of a connector: an existing connector, whose settings are duplicated, or a type, to start from new settings */
export type ConnectorChoiceForm = FormGroup<{
  fromExisting: FormControl<boolean>;
  id: FormControl<string | null>;
  type: FormControl<string | null>;
}>;

/** The form of a connector choice: only the control of its mode (the existing connector, or the type) is enabled, and required */
export function createConnectorChoiceForm(fb: NonNullableFormBuilder, fromExisting: boolean): ConnectorChoiceForm {
  const form: ConnectorChoiceForm = fb.group({
    fromExisting,
    id: [{ value: null as string | null, disabled: !fromExisting }, Validators.required],
    type: [{ value: null as string | null, disabled: fromExisting }, Validators.required]
  });
  form.controls.fromExisting.valueChanges.subscribe(value => {
    if (value) {
      form.controls.id.enable();
      form.controls.type.disable();
    } else {
      form.controls.id.disable();
      form.controls.type.enable();
    }
  });
  return form;
}

/** The connector types, grouped by category in their order */
function groupByCategory(types: Array<SouthType | NorthType>): Array<{ category: string; types: Array<{ id: string; beta: boolean }> }> {
  const categories: Array<{ category: string; types: Array<{ id: string; beta: boolean }> }> = [];
  for (const type of types) {
    let group = categories.find(element => element.category === type.category);
    if (!group) {
      group = { category: type.category, types: [] };
      categories.push(group);
    }
    group.types.push({ id: type.id, beta: !!type.beta });
  }
  return categories;
}

/**
 * The choice of a South or North connector: either an existing connector whose settings are duplicated, or a type, listed by
 * category, to start from new settings.
 */
@Component({
  selector: 'oib-connector-choice',
  templateUrl: './connector-choice.component.html',
  styleUrl: './connector-choice.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, TranslatePipe, OI_FORM_VALIDATION_DIRECTIVES]
})
export class ConnectorChoiceComponent {
  readonly side = input.required<'south' | 'north'>();
  readonly form = input.required<ConnectorChoiceForm>();
  /** The existing connectors to duplicate: the mode is not offered without any */
  readonly existing = input.required<Array<{ id: string; name: string; type: string }>>();
  readonly types = input.required<Array<SouthType | NorthType>>();
  /** The translation key of the title shown above the choice */
  readonly titleKey = input.required<string>();

  readonly categories = computed(() => groupByCategory(this.types()));
  /**
   * The value of the form, disabled controls included, updated on every event of the form: read by the template, which shows the
   * errors once touched (e.g. by the Next button of the page)
   */
  private readonly selection = toSignal(
    toObservable(this.form).pipe(
      switchMap(form =>
        form.events.pipe(
          startWith(null),
          map(() => form.getRawValue())
        )
      )
    ),
    { initialValue: null }
  );

  /** Whether an existing connector is duplicated, or new settings are started from a type */
  fromExisting(): boolean {
    return this.selection()?.fromExisting ?? false;
  }

  /** The existing connector or the type chosen */
  chosen(): string | null {
    const selection = this.selection();
    if (!selection) {
      return null;
    }
    return selection.fromExisting ? selection.id : selection.type;
  }

  setFromExisting(fromExisting: boolean) {
    this.form().controls.fromExisting.setValue(fromExisting);
  }

  /** Chooses an existing connector, or a type, depending on the mode */
  choose(value: string) {
    const controls = this.form().controls;
    const control = controls.fromExisting.value ? controls.id : controls.type;
    control.setValue(value);
    control.markAsDirty();
  }
}
