import { ChangeDetectionStrategy, Component } from '@angular/core';
import { map, merge, Observable, scan, Subject } from 'rxjs';

import { Notification, NotificationService } from '../notification.service';
import { NgbToastModule } from '@ng-bootstrap/ng-bootstrap';
import { AsyncPipe, NgForOf, NgIf } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

interface Action {
  type: 'addition' | 'removal';
  notification: Notification;
}

@Component({
  selector: 'oib-notification',
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIf, NgForOf, NgbToastModule, TranslateModule, AsyncPipe],
  standalone: true
})
export class NotificationComponent {
  notifications$: Observable<Array<Notification>>;
  private close$ = new Subject<Notification>();

  constructor(private notificationService: NotificationService) {
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
