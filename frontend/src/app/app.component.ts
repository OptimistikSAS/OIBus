import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { NotificationComponent } from './shared/notification/notification.component';
import { DefaultValidationErrorsComponent } from './shared/default-validation-errors/default-validation-errors.component';
import { WindowService } from './shared/window.service';
import { CurrentUserService } from './shared/current-user.service';
import { User } from '../../../shared/model/user.model';

@Component({
  selector: 'oib-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, NotificationComponent, DefaultValidationErrorsComponent]
})
export class AppComponent implements OnInit {
  title = 'OIBus';

  constructor(private currentUserService: CurrentUserService, private windowService: WindowService) {}

  ngOnInit(): void {
    this.currentUserService.get().subscribe(user => this.reloadIfLanguageOrTimezoneNeedsChange(user));
  }

  private reloadIfLanguageOrTimezoneNeedsChange(user: User | null) {
    // if the user language is not the used one
    if (user && (user.language !== this.windowService.languageToUse() || user.timezone !== this.windowService.timezoneToUse())) {
      // then first store the new ones
      this.windowService.storeLanguage(user.language);
      this.windowService.storeTimezone(user.timezone);
      // then reload
      this.windowService.reload();
    }
  }
}
