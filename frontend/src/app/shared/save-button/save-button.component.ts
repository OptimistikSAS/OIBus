import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BehaviorSubject, defer, finalize, Observable } from 'rxjs';
import { AsyncPipe, NgClass, NgIf } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

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
  styleUrls: ['./save-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, NgIf, NgClass, TranslateModule],
  standalone: true
})
export class SaveButtonComponent {
  @Input() form = 'form';
  @Input() translationKey = 'common.save';
  @Input() iconClass = 'fa-save';
  @Input() buttonId = 'save-button';
  @Input() state = new ObservableState();
  @Input() disabled = false;
}
