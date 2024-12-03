import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BehaviorSubject, defer, finalize, Observable } from 'rxjs';
import { AsyncPipe, NgClass } from '@angular/common';
import { TranslateDirective } from '@ngx-translate/core';

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
  selector: 'oib-save-button',
  templateUrl: './save-button.component.html',
  styleUrl: './save-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, NgClass, TranslateDirective]
})
export class SaveButtonComponent {
  readonly form = input('form');
  readonly translationKey = input('common.save');
  readonly iconClass = input('fa-save');
  readonly buttonId = input('save-button');
  readonly state = input(new ObservableState());
  readonly disabled = input(false);
  // input to indicate if the button is part of a button group with a cancel button
  // if not then it is rounded all the way
  readonly insideOfGroup = input(true);
}
