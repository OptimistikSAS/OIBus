import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { map, merge, Observable, scan, Subject } from 'rxjs';

import { Notification, NotificationService } from '../notification.service';
import { NgbToastModule } from '@ng-bootstrap/ng-bootstrap';
import { AsyncPipe } from '@angular/common';
import { TranslateDirective } from '@ngx-translate/core';

interface Action {
  type: 'addition' | 'removal';
  notification: Notification;
}

@Component({
  selector: 'oib-notification',
  templateUrl: './notification.component.html',
  styleUrl: './notification.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgbToastModule, TranslateDirective, AsyncPipe]
})
export class NotificationComponent {
  private notificationService = inject(NotificationService);

  notifications$: Observable<Array<Notification>>;
  private close$ = new Subject<Notification>();

  constructor() {
    const additions$: Observable<Action> = this.notificationService.notificationChanges.pipe(
      map(notification => ({ type: 'addition', notification }))
    );
    const removals$: Observable<Action> = this.close$.pipe(map(notification => ({ type: 'removal', notification })));

    this.notifications$ = merge(additions$, removals$).pipe(
      scan((notifications, action) => {
        switch (action.type) {
          case 'addition':
            return [...notifications, action.notification];
          case 'removal':
            return notifications.filter(n => n != action.notification);
        }
      }, [] as Array<Notification>)
    );
  }

  close(notification: Notification) {
    this.close$.next(notification);
  }
}
