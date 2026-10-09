import { computed, effect, Signal, signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';

/**
 * Returns a signal of the given reactive form control, which notifies its consumers on every event of the control
 * (value, status - enabled/disabled included -, touched and pristine changes), whether the change comes from the user or
 * from code: a parent patching the form or marking it as touched, an enabling condition disabling the control...
 *
 * Reactive form controls are not signals, so an OnPush component is not refreshed when a control it renders is changed
 * from outside the component. Reading the control (or its state) through this signal in the template fixes that, and also
 * refreshes the template directives depending on the control state (the `is-invalid` class added by
 * FormControlValidationDirective, `val-errors`).
 *
 * Note that the events of a group include the value and status changes of its descendants (they bubble up), but not their
 * touched and pristine changes.
 *
 * Must be called in an injection context, as it creates an effect (which unsubscribes from the control events when the
 * control changes or when the caller is destroyed).
 * @param control a function returning the control to track, which may read signals (e.g. an input)
 */
export function trackControl<T extends AbstractControl>(control: () => T | null): Signal<T | null> {
  const source = computed(control);
  const changes = signal(0);
  effect(onCleanup => {
    const subscription = source()?.events.subscribe(() => changes.update(count => count + 1));
    onCleanup(() => subscription?.unsubscribe());
  });
  return computed(
    () => {
      changes();
      return source();
    },
    // the control is the same object after an event: always notify the consumers
    { equal: () => false }
  );
}
