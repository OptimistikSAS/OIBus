import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BehaviorSubject, defer, finalize, Observable, switchMap } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { TranslateDirective } from '@ngx-translate/core';
import { AsyncPipe, NgClass } from '@angular/common';

/**
 * A class that holds the state of an observable,
 * allowing to know when the observable is "pending", for example during an HTTP request.
 * This `isPending` field is observable itself,
 * with a true value when the observable is pending, and a false one otherwise.
 * The `pendingUntilFinalization` method can be used as an RxJS operator:
 * ```
 * createOrUpdate.pipe(this.state.pendingUntilFinalization()).subscribe(() => ...);
 * ```
 * The state is then usually used by a SaveButton component,
 * to know when the button should be disabled and display a spinner.
 */
export class ObservableState {
  isPending = new BehaviorSubject(false);

  pendingUntilFinalization<T>() {
    return (source: Observable<T>) => {
      return defer(() => {
        this.isPending.next(true);
        return source;
      }).pipe(finalize(() => this.isPending.next(false)));
    };
  }
}

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[oib-save-button]',
  templateUrl: './save-button.component.html',
  styleUrl: './save-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'btn btn-primary',
    '[attr.form]': 'form()',
    '[attr.id]': 'id()',
    '[disabled]': 'isDisabled()'
  },
  imports: [NgClass, TranslateDirective, AsyncPipe]
})
export class SaveButtonComponent {
  readonly form = input<string>();
  readonly translationKey = input('common.save');
  readonly iconClass = input('fa-save');
  readonly id = input('save-button');
  readonly state = input.required<ObservableState>({ alias: 'oib-save-button' });
  private readonly isPending = toSignal(toObservable(this.state).pipe(switchMap(state => state.isPending)));
  readonly forceDisabled = input(false);

  readonly isDisabled = computed(() => {
    return this.isPending() || this.forceDisabled();
  });
}
