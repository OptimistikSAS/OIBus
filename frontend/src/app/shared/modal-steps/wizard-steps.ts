import { computed, Signal, signal, WritableSignal } from '@angular/core';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

/** The inputs where pressing Enter submits a form, as a browser does it with a submit button */
const SUBMITTING_INPUT_TYPES = new Set(['text', 'search', 'number', 'email', 'url', 'tel', 'password', 'date', 'time', 'datetime-local']);

/**
 * Whether pressing Enter (the `keydown.enter` event of a wizard form) should submit the form: in a single-line field only, and not
 * when the field itself already handled the key (e.g. to pick a typeahead suggestion). The wizards handle it themselves rather than
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
 * The navigation between the steps of a wizard (shown with `oib-modal-steps`): the next step opens once the current one is
 * valid, and a save attempt with errors opens the first step that has some.
 */
export class WizardSteps<S extends string> {
  readonly current: WritableSignal<S>;
  readonly isFirst = computed(() => this.current() === this.steps[0]);
  readonly isLast = computed(() => this.current() === this.steps[this.steps.length - 1]);
  /**
   * Changes each time the errors of whole steps are shown: marking a control and its descendants as touched doesn't
   * notify its parents, so the form events don't tell.
   */
  private readonly errorsShown = signal(0);
  /** The steps with an invalid control, whether its error was shown or not: listed in the Review step */
  readonly withErrors = computed(() => {
    this.formEvents();
    this.errorsShown();
    return this.steps.filter(step => this.controlsOf(step).some(control => control.invalid));
  });
  /** The steps with an error shown to the user, flagged in the steps bar */
  readonly invalid = computed(() => {
    this.formEvents();
    this.errorsShown();
    return this.steps.filter(step => this.controlsOf(step).some(control => hasShownError(control)));
  });

  /**
   * @param steps the steps, in order
   * @param controlsOf the controls edited in a step
   * @param formEvents changes on every change of the form, so that the invalid steps are kept up to date
   */
  constructor(
    readonly steps: ReadonlyArray<S>,
    private readonly controlsOf: (step: S) => Array<AbstractControl>,
    private readonly formEvents: Signal<unknown>
  ) {
    this.current = signal<S>(steps[0]);
  }

  next() {
    const controls = this.controlsOf(this.current());
    this.showErrors(controls);
    if (controls.some(control => control.invalid)) {
      return;
    }
    this.current.set(this.steps[this.steps.indexOf(this.current()) + 1]);
  }

  back() {
    this.current.set(this.steps[this.steps.indexOf(this.current()) - 1]);
  }

  /** Opens the first step with an invalid control, after showing all the errors. */
  showFirstInvalid() {
    this.showErrors(this.steps.flatMap(step => this.controlsOf(step)));
    const firstInvalid = this.steps.find(step => this.controlsOf(step).some(control => control.invalid));
    if (firstInvalid) {
      this.current.set(firstInvalid);
    }
  }

  private showErrors(controls: Array<AbstractControl>) {
    controls.forEach(control => control.markAllAsTouched());
    this.errorsShown.update(count => count + 1);
  }
}
