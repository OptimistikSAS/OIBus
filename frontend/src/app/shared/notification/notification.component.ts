import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { NgbToastModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { map, merge, scan, Subject } from 'rxjs';

import { Notification, NotificationService } from '../notification.service';

interface Action {
  type: 'addition' | 'removal';
  notification: Notification;
}

@Component({
  selector: 'oib-notification',
  templateUrl: './notification.component.html',
  styleUrl: './notification.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgbToastModule, TranslateDirective]
})
export class NotificationComponent {
  private readonly notificationService = inject(NotificationService);

  private readonly close$ = new Subject<Notification>();
  readonly notifications = toSignal(
    merge(
      this.notificationService.notificationChanges.pipe(map((notification): Action => ({ type: 'addition', notification }))),
      this.close$.pipe(map((notification): Action => ({ type: 'removal', notification })))
    ).pipe(
      scan((notifications, action) => {
        switch (action.type) {
          case 'addition':
            return [...notifications, action.notification];
          case 'removal':
            return notifications.filter(n => n != action.notification);
        }
      }, [] as Array<Notification>)
    ),
    { initialValue: [] }
  );

  close(notification: Notification) {
    this.close$.next(notification);
  }
}
