import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { NotificationComponent } from './shared/notification/notification.component';
import { DefaultValidationErrorsComponent } from './shared/default-validation-errors/default-validation-errors.component';
import { WindowService } from './shared/window.service';
import { CurrentUserService } from './shared/current-user.service';
import { User } from '../../../backend/shared/model/user.model';
import { NavigationService } from './shared/navigation.service';

@Component({
  selector: 'oib-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  imports: [RouterOutlet, NavbarComponent, NotificationComponent, DefaultValidationErrorsComponent]
})
export class AppComponent implements OnInit {
  private currentUserService = inject(CurrentUserService);
  private windowService = inject(WindowService);
  private navigationService = inject(NavigationService);

  title = 'OIBus';

  ngOnInit(): void {
    this.navigationService.init();
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
