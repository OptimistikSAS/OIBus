import { computed, Signal, signal } from '@angular/core';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

import { compareSettings, countChanges, SettingSummary } from '../../shared/form/oibus-settings-summary/settings-summary';

/** The steps of the south and history item modals, in order. */
export const ITEM_MODAL_STEPS = ['general', 'settings', 'review'] as const;
export type ItemModalStep = (typeof ITEM_MODAL_STEPS)[number];

/** An item as summed up in the Review step: its general settings, and the settings of its connector type */
export interface ItemSummary {
  general: Array<SettingSummary>;
  settings: Array<SettingSummary>;
}

/** How many settings of an item changed since it was saved */
export function countItemChanges(summary: ItemSummary, saved: ItemSummary): number {
  return countChanges(compareSettings(summary.general, saved.general)) + countChanges(compareSettings(summary.settings, saved.settings));
}

/** The inputs where pressing Enter submits a form, as a browser does it with a submit button */
const SUBMITTING_INPUT_TYPES = new Set(['text', 'search', 'number', 'email', 'url', 'tel', 'password', 'date', 'time', 'datetime-local']);

/**
 * Whether pressing Enter (the `keydown.enter` event of an item form) should submit the form: in a single-line field only, and not
 * when the field itself already handled the key (e.g. to pick a typeahead suggestion). The modals handle it themselves rather than
 * let the browser submit the form, which it only does through a submit button: there is none before the Save one shows.
 */
export function submitsOnEnter(event: Event): boolean {
  const target = event.target;
  return (
    !event.defaultPrevented &&
    !(event as KeyboardEvent).isComposing &&
    target instanceof HTMLInputElement &&
    SUBMITTING_INPUT_TYPES.has(target.type)
  );
}

/** True when the control, or one of its descendants, has an error the user was already shown. */
function hasShownError(control: AbstractControl): boolean {
  if (control.errors && control.touched) {
    return true;
  }
  if (control instanceof FormGroup || control instanceof FormArray) {
    return Object.values(control.controls).some(child => hasShownError(child));
  }
  return false;
}

/**
 * The navigation between the steps of an item modal: the next step opens once the current one is valid, and a save
 * attempt with errors opens the first step that has some.
 */
export class ItemModalSteps {
  readonly steps = ITEM_MODAL_STEPS;
  readonly current = signal<ItemModalStep>('general');
  readonly isFirst = computed(() => this.current() === ITEM_MODAL_STEPS[0]);
  readonly isLast = computed(() => this.current() === ITEM_MODAL_STEPS[ITEM_MODAL_STEPS.length - 1]);
  /**
   * Changes each time the errors of whole steps are shown: marking a control and its descendants as touched doesn't
   * notify its parents, so the form events don't tell.
   */
  private readonly errorsShown = signal(0);
  /** The steps with an invalid control, whether its error was shown or not: listed in the Review step */
  readonly withErrors = computed(() => {
    this.formEvents();
    this.errorsShown();
    return ITEM_MODAL_STEPS.filter(step => this.controlsOf(step).some(control => control.invalid));
  });
  /** The steps with an error shown to the user, flagged in the steps bar */
  readonly invalid = computed(() => {
    this.formEvents();
    this.errorsShown();
    return ITEM_MODAL_STEPS.filter(step => this.controlsOf(step).some(control => hasShownError(control)));
  });

  /**
   * @param controlsOf the controls edited in a step
   * @param formEvents changes on every change of the form, so that the invalid steps are kept up to date
   */
  constructor(
    private readonly controlsOf: (step: ItemModalStep) => Array<AbstractControl>,
    private readonly formEvents: Signal<unknown>
  ) {}

  next() {
    const controls = this.controlsOf(this.current());
    this.showErrors(controls);
    if (controls.some(control => control.invalid)) {
      return;
    }
    this.current.set(ITEM_MODAL_STEPS[ITEM_MODAL_STEPS.indexOf(this.current()) + 1]);
  }

  back() {
    this.current.set(ITEM_MODAL_STEPS[ITEM_MODAL_STEPS.indexOf(this.current()) - 1]);
  }

  /** Opens the first step with an invalid control, after showing all the errors. */
  showFirstInvalid() {
    this.showErrors(ITEM_MODAL_STEPS.flatMap(step => this.controlsOf(step)));
    const firstInvalid = ITEM_MODAL_STEPS.find(step => this.controlsOf(step).some(control => control.invalid));
    if (firstInvalid) {
      this.current.set(firstInvalid);
    }
  }

  private showErrors(controls: Array<AbstractControl>) {
    controls.forEach(control => control.markAllAsTouched());
    this.errorsShown.update(count => count + 1);
  }
}
